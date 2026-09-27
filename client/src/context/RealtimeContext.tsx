import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Reminder, RealtimeEvent, ConflictRecord } from '../types/index.js';
import * as api from '../api/index.js';
import { startAlarmChime, stopAlarmChime } from '../services/audio.js';
import { syncService } from '../services/syncService.js';
import {
  scheduleNativeTimerAlarm,
  cancelNativeTimerAlarm,
  scheduleNativeReminderAlarm,
  cancelNativeReminderAlarm,
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

  // Derive active ringing timer or triggered reminder
  const ringingTimer = timers.find((t) => t.status === 'ringing') || null;
  const triggeredReminder = reminders.find((r) => r.status === 'triggered') || null;

  // Handle Alarm Audio & Haptics: play when anything is ringing/triggered, stop when all are clear
  useEffect(() => {
    if (ringingTimer || triggeredReminder) {
      startAlarmChime();
      hapticWarning();

      // Show browser system notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = ringingTimer ? `⏰ Timer Finished: ${ringingTimer.title}` : `🔔 Reminder: ${triggeredReminder?.title}`;
        try {
          new Notification(title, {
            body: ringingTimer ? 'Tap to open and stop alarm' : (triggeredReminder?.notes || 'Reminder due'),
            icon: '/pwa-192x192.png',
            tag: ringingTimer?.id || triggeredReminder?.id
          });
        } catch {}
      }
    } else {
      stopAlarmChime();
    }
  }, [ringingTimer, triggeredReminder]);

  // Synchronize OS-level native alarms whenever timers change
  useEffect(() => {
    timers.forEach((timer) => {
      if (timer.status === 'running' && timer.target_end_time) {
        scheduleNativeTimerAlarm(timer.id, timer.title, new Date(timer.target_end_time));
      } else {
        cancelNativeTimerAlarm(timer.id, timer.title);
      }
    });
  }, [timers]);


  // Synchronize OS-level native alarms whenever reminders change
  useEffect(() => {
    reminders.forEach((reminder) => {
      if (reminder.status === 'pending' && reminder.due_date) {
        scheduleNativeReminderAlarm(reminder.id, reminder.title, new Date(reminder.due_date), reminder.notes);
      } else {
        cancelNativeReminderAlarm(reminder.id);
      }
    });
  }, [reminders]);

  // Local fallback ticker for offline / foreground timer expiration
  useEffect(() => {
    const runningTimers = timers.filter((t) => t.status === 'running' && t.target_end_time);
    if (runningTimers.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      let hasRinging = false;
      timers.forEach((timer) => {
        if (timer.status === 'running' && timer.target_end_time) {
          if (new Date(timer.target_end_time).getTime() <= now) {
            hasRinging = true;
          }
        }
      });

      if (hasRinging) {
        setTimers((prev) =>
          prev.map((t) =>
            t.status === 'running' && t.target_end_time && new Date(t.target_end_time).getTime() <= now
              ? { ...t, status: 'ringing', remaining_seconds: 0 }
              : t
          )
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timers]);

  // Request browser notification permission once on initial load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fetch initial state via REST & local storage
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

  // Connect WebSocket function
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
      try {
        socketRef.current.close();
      } catch {}
      socketRef.current = null;
    }
    setIsConnecting(true);
    isConnectingRef.current = true;
    setReconnectAttempt(0);
    refreshState();
    syncService.performSync().catch(() => {});
    connectRef.current();
  }, [refreshState]);

  // Connect WebSocket
  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

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

          // Retry every 3 seconds
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };
      } catch (err) {
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

    // Reconnect immediately when browser comes back online
    const handleOnline = () => {
      refreshState();
      manualReconnect();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      unmounted = true;
      window.removeEventListener('online', handleOnline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
      stopAlarmChime();
    };
  }, [refreshState, manualReconnect]);

  const handleRealtimeEvent = (event: RealtimeEvent) => {
    switch (event.type) {
      case 'SYNC_STATE':
        setTimers(event.payload.timers);
        setReminders(event.payload.reminders);
        if (event.payload.conflicts) {
          setConflicts(event.payload.conflicts);
        }
        break;

      case 'TIMER_UPDATED':
        setTimers((prev) => {
          const index = prev.findIndex((t) => t.id === event.payload.timer.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = event.payload.timer;
            return next;
          }
          return [event.payload.timer, ...prev];
        });
        break;

      case 'TIMER_DELETED':
        setTimers((prev) => prev.filter((t) => t.id !== event.payload.timerId));
        break;

      case 'TIMER_RING':
        setTimers((prev) => {
          const index = prev.findIndex((t) => t.id === event.payload.timer.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = event.payload.timer;
            return next;
          }
          return [event.payload.timer, ...prev];
        });
        break;

      case 'TIMER_DISMISSED':
        setTimers((prev) =>
          prev.map((t) => (t.id === event.payload.timerId ? { ...t, status: 'dismissed' } : t))
        );
        break;

      case 'REMINDER_UPDATED':
        setReminders((prev) => {
          const index = prev.findIndex((r) => r.id === event.payload.reminder.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = event.payload.reminder;
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
          const index = prev.findIndex((r) => r.id === event.payload.reminder.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = event.payload.reminder;
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

  // Actions
  const createTimer = async (data: { title: string; duration_seconds: number; notebook_id?: string | null; auto_start?: boolean }) => {
    return api.createTimer(data);
  };

  const startTimer = async (id: string) => {
    await api.startTimer(id);
  };

  const pauseTimer = async (id: string) => {
    await api.pauseTimer(id);
  };

  const resetTimer = async (id: string) => {
    await api.resetTimer(id);
  };

  const dismissTimer = async (id: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'DISMISS_TIMER', timerId: id }));
    }
    await api.dismissTimer(id);
  };

  const deleteTimer = async (id: string) => {
    await api.deleteTimer(id);
  };

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
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
