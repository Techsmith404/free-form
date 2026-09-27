import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Reminder, RealtimeEvent, ConflictRecord } from '../types/index.js';
import * as api from '../api/index.js';
import { startAlarmChime, stopAlarmChime } from '../services/audio.js';
import { syncService } from '../services/syncService.js';
import {
  isNative,
  scheduleNativeTimerAlarm,
  cancelNativeTimerAlarm,
  scheduleNativeReminderAlarm,
  cancelNativeReminderAlarm,
  stopNativeAlarmSound,
  onNativeTimerAction,
  hapticWarning
} from '../services/native.js';

interface RealtimeContextValue {
  timers: Timer[];
  reminders: Reminder[];
  conflicts: ConflictRecord[];
  ringingTimer: Timer | null;
  triggeredReminder: Reminder | null;
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempt: number;
  manualReconnect: () => void;
  timersModalOpen: boolean;
  setTimersModalOpen: (open: boolean) => void;
  conflictModalOpen: boolean;
  setConflictModalOpen: (open: boolean) => void;
  refreshConflicts: () => Promise<void>;
  // Timer actions
  createTimer: (data: { title: string; duration_seconds: number; notebook_id?: string | null; auto_start?: boolean }) => Promise<Timer>;
  startTimer: (id: string) => Promise<void>;
  pauseTimer: (id: string) => Promise<void>;
  resetTimer: (id: string) => Promise<void>;
  dismissTimer: (id: string) => Promise<void>;
  deleteTimer: (id: string) => Promise<void>;
  // Reminder actions
  createReminder: (data: { title: string; notes?: string; due_date: string; priority?: 'low' | 'normal' | 'high'; notebook_id?: string | null }) => Promise<Reminder>;
  updateReminder: (id: string, data: Partial<Reminder>) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  dismissReminder: (id: string) => Promise<void>;
  snoozeReminder: (id: string, minutes?: number) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [timersModalOpen, setTimersModalOpen] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);

  // Track timers that have been locally dismissed to prevent the JS ticker re-ringing them.
  // This is critical: without it, the 1-second local ticker re-sets dismissed timers to 'ringing'.
  const locallyDismissedTimerIds = useRef<Set<string>>(new Set());

  // Ref-based copies of action functions so the native listener useEffect doesn't need
  // to re-register every time these change (avoids stale closure issues).
  const dismissTimerRef = useRef<(id: string) => Promise<void>>(async () => {});
  const pauseTimerRef = useRef<(id: string) => Promise<void>>(async () => {});

  // Derive active ringing timer or triggered reminder
  const ringingTimer = timers.find((t) => t.status === 'ringing') || null;
  const triggeredReminder = reminders.find((r) => r.status === 'triggered') || null;

  // ─── Alarm Audio & Haptics ────────────────────────────────────────────────
  // On native: AlarmSoundManager (Java) handles audio — don't duplicate with Web Audio.
  // On web: use the Web Audio synth chime.
  useEffect(() => {
    if (ringingTimer || triggeredReminder) {
      hapticWarning();

      if (!isNative) {
        // Only use Web Audio on non-native (desktop browser, PWA web)
        startAlarmChime();

        if ('Notification' in window && Notification.permission === 'granted') {
          const notifTitle = ringingTimer
            ? `⏰ Timer Finished: ${ringingTimer.title}`
            : `🔔 Reminder: ${triggeredReminder?.title}`;
          try {
            new Notification(notifTitle, {
              body: ringingTimer ? 'Click to stop alarm' : (triggeredReminder?.notes || 'Reminder due'),
              icon: '/pwa-192x192.png',
              tag: ringingTimer?.id || triggeredReminder?.id
            });
          } catch {}
        }
      }
      // On native: NativeAlarmReceiver already played system alarm sound via AlarmManager.
      // Nothing extra to do here — the alarm is already ringing.
    } else {
      stopAlarmChime();
      // stopNativeAlarmSound is called explicitly in dismissTimer/deleteTimer/resetTimer
      // so we don't need it here (avoids double-stopping).
    }
  }, [ringingTimer?.id, triggeredReminder?.id]);

  // ─── Sync native AlarmManager whenever timer list changes ─────────────────
  useEffect(() => {
    timers.forEach((timer) => {
      if (timer.status === 'running' && timer.target_end_time) {
        scheduleNativeTimerAlarm(timer.id, timer.title, new Date(timer.target_end_time));
      } else if (timer.status !== 'ringing') {
        // Don't cancel when ringing — let AlarmSoundManager handle the active alarm state
        cancelNativeTimerAlarm(timer.id);
      }
    });
  }, [timers]);

  // ─── Sync native reminders ────────────────────────────────────────────────
  useEffect(() => {
    reminders.forEach((reminder) => {
      if (reminder.status === 'pending' && reminder.due_date) {
        scheduleNativeReminderAlarm(reminder.id, reminder.title, new Date(reminder.due_date), reminder.notes);
      } else {
        cancelNativeReminderAlarm(reminder.id);
      }
    });
  }, [reminders]);

  // ─── Local fallback ticker (foreground only) ──────────────────────────────
  // This handles the case where the app is open and the WebSocket server hasn't
  // broadcast TIMER_RING yet (e.g. offline, or brief network hiccup).
  // Key fix: skip timers that have been locally dismissed to prevent re-ringing.
  useEffect(() => {
    const runningTimers = timers.filter((t) => t.status === 'running' && t.target_end_time);
    if (runningTimers.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTimers((prev) => {
        let changed = false;
        const next = prev.map((t) => {
          if (
            t.status === 'running' &&
            t.target_end_time &&
            new Date(t.target_end_time).getTime() <= now &&
            !locallyDismissedTimerIds.current.has(t.id)
          ) {
            changed = true;
            return { ...t, status: 'ringing' as const, remaining_seconds: 0 };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  // ─── Browser notification permission ──────────────────────────────────────
  useEffect(() => {
    if (!isNative && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const refreshConflicts = useCallback(async () => {
    try {
      const list = await api.fetchConflicts();
      setConflicts(list);
    } catch {}
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const [tList, rList, cList] = await Promise.all([
        api.fetchTimers(),
        api.fetchReminders(),
        api.fetchConflicts()
      ]);
      setTimers(tList);
      setReminders(rList);
      setConflicts(cList);
    } catch (err) {
      console.error('Error fetching timers/reminders/conflicts:', err);
    }
  }, []);

  // ─── WebSocket connection ─────────────────────────────────────────────────
  const connectRef = useRef<() => void>(() => {});

  const manualReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      try { socketRef.current.close(); } catch {}
      socketRef.current = null;
    }
    setIsConnecting(true);
    isConnectingRef.current = true;
    setReconnectAttempt(0);
    refreshState();
    syncService.performSync().catch(() => {});
    connectRef.current();
  }, [refreshState]);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      if (socketRef.current && (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      )) return;

      setIsConnecting(true);
      isConnectingRef.current = true;

      const wsUrl = api.getWebSocketUrl();
      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          setIsConnected(true);
          setIsConnecting(false);
          isConnectingRef.current = false;
          setReconnectAttempt(0);
          syncService.performSync().catch(() => {});
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const msg: RealtimeEvent = JSON.parse(event.data);
            handleRealtimeEvent(msg);
          } catch (e) {
            console.error('Failed to parse realtime message:', e);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          setIsConnected(false);
          setIsConnecting(false);
          isConnectingRef.current = false;
          setReconnectAttempt((prev) => prev + 1);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
      } catch {
        setIsConnected(false);
        setIsConnecting(false);
        isConnectingRef.current = false;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      }
    }

    connectRef.current = connect;
    refreshState();
    connect();

    const handleOnline = () => { refreshState(); manualReconnect(); };
    window.addEventListener('online', handleOnline);

    return () => {
      unmounted = true;
      window.removeEventListener('online', handleOnline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
      stopAlarmChime();
    };
  }, [refreshState, manualReconnect]);

  // ─── Realtime event handler ────────────────────────────────────────────────
  const handleRealtimeEvent = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'SYNC_STATE':
        setTimers(event.payload.timers);
        setReminders(event.payload.reminders);
        if (event.payload.conflicts) setConflicts(event.payload.conflicts);
        break;

      case 'TIMER_UPDATED':
        setTimers((prev) => {
          const idx = prev.findIndex((t) => t.id === event.payload.timer.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.payload.timer;
            return next;
          }
          return [event.payload.timer, ...prev];
        });
        // If this update transitions the timer out of ringing, silence native audio
        if (event.payload.timer.status !== 'ringing') {
          stopNativeAlarmSound(event.payload.timer.id);
        }
        break;

      case 'TIMER_DELETED':
        // Timer deleted — cancel any pending alarm and silence audio
        stopNativeAlarmSound(event.payload.timerId);
        cancelNativeTimerAlarm(event.payload.timerId);
        setTimers((prev) => prev.filter((t) => t.id !== event.payload.timerId));
        break;

      case 'TIMER_RING':
        // Server confirmed timer has expired — update state and trigger native alarm
        // (on native, AlarmManager already fired NativeAlarmReceiver independently)
        setTimers((prev) => {
          const idx = prev.findIndex((t) => t.id === event.payload.timer.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.payload.timer;
            return next;
          }
          return [event.payload.timer, ...prev];
        });
        break;

      case 'TIMER_DISMISSED':
        // A device dismissed the timer — mark locally dismissed so our ticker won't re-ring it,
        // then silence native audio.
        locallyDismissedTimerIds.current.add(event.payload.timerId);
        stopNativeAlarmSound(event.payload.timerId);
        setTimers((prev) =>
          prev.map((t) => (t.id === event.payload.timerId ? { ...t, status: 'dismissed' } : t))
        );
        break;

      case 'REMINDER_UPDATED':
        setReminders((prev) => {
          const idx = prev.findIndex((r) => r.id === event.payload.reminder.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.payload.reminder;
            return next;
          }
          return [...prev, event.payload.reminder];
        });
        break;

      case 'REMINDER_DELETED':
        setReminders((prev) => prev.filter((r) => r.id !== event.payload.reminderId));
        break;

      case 'REMINDER_TRIGGER':
        setReminders((prev) => {
          const idx = prev.findIndex((r) => r.id === event.payload.reminder.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.payload.reminder;
            return next;
          }
          return [...prev, event.payload.reminder];
        });
        break;

      case 'REMINDER_DISMISSED':
        setReminders((prev) =>
          prev.map((r) => (r.id === event.payload.reminderId ? { ...r, status: 'dismissed' } : r))
        );
        break;

      case 'CONFLICT_CREATED':
        setConflicts((prev) => [event.payload.conflict, ...prev.filter((c) => c.id !== event.payload.conflict.id)]);
        break;

      case 'CONFLICT_RESOLVED':
        setConflicts((prev) => prev.filter((c) => c.id !== event.payload.conflictId));
        break;
    }
  };

  // ─── Timer Actions ─────────────────────────────────────────────────────────
  const createTimer = async (data: { title: string; duration_seconds: number; notebook_id?: string | null; auto_start?: boolean }) => {
    return api.createTimer(data);
  };

  const startTimer = async (id: string) => {
    locallyDismissedTimerIds.current.delete(id); // allow re-ringing if restarted
    await api.startTimer(id);
  };

  const pauseTimer = async (id: string) => {
    await api.pauseTimer(id);
  };

  const resetTimer = async (id: string) => {
    locallyDismissedTimerIds.current.delete(id);
    await stopNativeAlarmSound(id);
    await api.resetTimer(id);
  };

  const dismissTimer = async (id: string) => {
    // Mark as locally dismissed FIRST — before any async calls — so the 1-second ticker
    // cannot fire and re-ring this timer between now and when the server state updates.
    locallyDismissedTimerIds.current.add(id);

    // Immediately silence native audio (phone ringtone / vibration)
    await stopNativeAlarmSound(id);

    // Optimistically update local state so the alarm modal disappears instantly
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'dismissed' } : t))
    );

    // Send dismiss to server (which will broadcast TIMER_DISMISSED to all devices)
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'DISMISS_TIMER', timerId: id }));
    }
    try {
      await api.dismissTimer(id);
    } catch (err) {
      console.warn('dismissTimer REST call failed:', err);
    }
  };

  const deleteTimer = async (id: string) => {
    locallyDismissedTimerIds.current.add(id);
    await stopNativeAlarmSound(id);
    await cancelNativeTimerAlarm(id);
    await api.deleteTimer(id);
  };

  // ─── Native Notification Action Listener ──────────────────────────────────
  // Keep refs up-to-date so the stable listener closure always calls the latest version
  dismissTimerRef.current = dismissTimer;
  pauseTimerRef.current = pauseTimer;

  useEffect(() => {
    const cleanup = onNativeTimerAction(({ action, timerId }) => {
      if (action === 'stop') {
        // User tapped "Stop" or "Stop Alarm" on the notification / AlarmActivity
        dismissTimerRef.current(timerId);
      } else if (action === 'pause') {
        pauseTimerRef.current(timerId);
      } else if (action === 'ring') {
        // AlarmManager fired while app is in foreground — update state to show alarm modal
        if (!locallyDismissedTimerIds.current.has(timerId)) {
          setTimers((prev) =>
            prev.map((t) => (t.id === timerId ? { ...t, status: 'ringing', remaining_seconds: 0 } : t))
          );
        }
      }
    });
    return cleanup;
  }, []); // stable — uses refs, not closures

  // ─── Reminder Actions ──────────────────────────────────────────────────────
  const createReminder = async (data: { title: string; notes?: string; due_date: string; priority?: 'low' | 'normal' | 'high'; notebook_id?: string | null }) => {
    return api.createReminder(data);
  };

  const updateReminder = async (id: string, data: Partial<Reminder>) => {
    await api.updateReminder(id, data);
  };

  const completeReminder = async (id: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'COMPLETE_REMINDER', reminderId: id }));
    }
    await api.completeReminder(id);
  };

  const dismissReminder = async (id: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'DISMISS_REMINDER', reminderId: id }));
    }
    await api.dismissReminder(id);
  };

  const snoozeReminder = async (id: string, minutes?: number) => {
    await api.snoozeReminder(id, minutes);
  };

  const deleteReminder = async (id: string) => {
    await api.deleteReminder(id);
  };

  return (
    <RealtimeContext.Provider
      value={{
        timers,
        reminders,
        conflicts,
        ringingTimer,
        triggeredReminder,
        isConnected,
        isConnecting,
        reconnectAttempt,
        manualReconnect,
        timersModalOpen,
        setTimersModalOpen,
        conflictModalOpen,
        setConflictModalOpen,
        refreshConflicts,
        createTimer,
        startTimer,
        pauseTimer,
        resetTimer,
        dismissTimer,
        deleteTimer,
        createReminder,
        updateReminder,
        completeReminder,
        dismissReminder,
        snoozeReminder,
        deleteReminder
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within a RealtimeProvider');
  return context;
};
