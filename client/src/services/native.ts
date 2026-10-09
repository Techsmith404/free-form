import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

/**
 * Register a listener for Android system back button / swipe back gesture.
 * The handler returns boolean:
 * - true if the back action was consumed/handled (e.g., closed an open modal or drawer)
 * - false if the back action is unhandled (which triggers clean app exit)
 */
export function registerBackButtonHandler(handler: () => boolean): () => void {
  if (!isNative) return () => {};

  try {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const handled = handler();
      if (!handled) {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((h) => h?.remove?.()).catch(() => {});
    };
  } catch (err) {
    console.warn('Failed to register native backButton listener', err);
    return () => {};
  }
}

export interface NativeTimerPluginInterface {
  startCountdownNotification(options: { timerId: string; title: string; targetEndTime: number }): Promise<{ success: boolean; notificationId: number }>;
  cancelCountdownNotification(options: { timerId: string }): Promise<{ success: boolean }>;
  cancelAllCountdowns(): Promise<{ success: boolean }>;
  triggerAlarm(options: { timerId: string; title?: string }): Promise<{ success: boolean }>;
  stopAlarm(options: { timerId: string }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'onTimerAction',
    listenerFunc: (data: { action: 'stop' | 'pause' | 'ring'; timerId: string }) => void
  ): Promise<any>;
}

export const NativeTimer = registerPlugin<NativeTimerPluginInterface>('NativeTimer');

/**
 * Stop native alarm ringtone and dismiss alarm notifications.
 * Called when:
 * - User taps "Stop Alarm" in the in-app modal
 * - A TIMER_DISMISSED event comes in from another device via WebSocket
 */
export async function stopNativeAlarmSound(timerId: string = 'default'): Promise<boolean> {
  if (!isNative) return false;
  try {
    const res = await NativeTimer.stopAlarm({ timerId });
    return res.success;
  } catch (err) {
    console.warn('Failed to stop native alarm sound', err);
    return false;
  }
}

/**
 * Register a listener for actions from native notification buttons (Stop / Pause / Ring).
 * Returns a cleanup function that removes the listener on unmount.
 */
export function onNativeTimerAction(callback: (data: { action: 'stop' | 'pause' | 'ring'; timerId: string }) => void): () => void {
  if (!isNative) return () => {};
  try {
    const listenerPromise = NativeTimer.addListener('onTimerAction', callback);
    return () => {
      listenerPromise.then(handle => handle?.remove?.()).catch(() => {});
    };
  } catch {
    return () => {};
  }
}

/**
 * Initialize native device features (Status bar, splash screen, notification channel)
 */
export async function initNativeApp(): Promise<void> {
  if (!isNative) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#161A25' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('Native status bar initialization failed', err);
  }

  try {
    await LocalNotifications.createChannel({
      id: 'timer_alarms',
      name: 'Timers & Reminders',
      description: 'High-priority notifications for Free Form timers and reminders',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1, // Public on lock screen
      vibration: true,
      lights: true,
      lightColor: '#48BEB6'
    });
  } catch (err) {
    console.warn('Native notification channel creation failed', err);
  }

  try {
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.warn('Native notification permission request failed', err);
  }

  try {
    setTimeout(async () => {
      try {
        await SplashScreen.hide();
      } catch {}
    }, 400);
  } catch {}
}

/** Ultra-light mechanical tick on UI interactions */
export async function hapticTap(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.selectionChanged();
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(6);
    }
  } catch {}
}

/** Gentle bump on counter tally clicks */
export async function hapticMedium(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  } catch {}
}

/** Firm pulse on deletions / important actions */
export async function hapticHeavy(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
  } catch {}
}

/** Multi-pulse success haptic on form completion / save */
export async function hapticSuccess(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 40, 15]);
    }
  } catch {}
}

/** Warning pulse haptic for triggered reminders (non-alarm) */
export async function hapticWarning(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 80, 30, 80, 30]);
    }
  } catch {}
}

function getDeterministicNotifId(idStr: string): number {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash + idStr.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
}

/**
 * Schedule a native OS-level live countdown notification for a running timer.
 * This posts the chronometer notification and schedules the AlarmManager trigger.
 * Does NOT schedule a separate LocalNotifications completion — the AlarmManager handles that.
 */
export async function scheduleNativeTimerAlarm(timerId: string, title: string, triggerDate: Date): Promise<void> {
  if (!isNative) return;

  const targetTimeMs = triggerDate.getTime();
  if (targetTimeMs <= Date.now()) return;

  const timerTitle = title || 'Timer';

  // Start the live countdown chronometer notification in the notification shade & lock screen.
  // The plugin also schedules the AlarmManager to fire NativeAlarmReceiver when time expires.
  try {
    await NativeTimer.startCountdownNotification({
      timerId,
      title: timerTitle,
      targetEndTime: targetTimeMs
    });
  } catch (err) {
    console.warn('NativeTimer chronometer notification failed', err);
  }
}

/**
 * Cancel a scheduled native timer alarm and remove the live countdown notification.
 * Also cancels the AlarmManager so the alarm won't fire even after deletion.
 */
export async function cancelNativeTimerAlarm(timerId: string): Promise<void> {
  if (!isNative) return;

  try {
    await NativeTimer.cancelCountdownNotification({ timerId });
  } catch (err) {
    console.warn('Failed to cancel native timer alarm', err);
  }
}

/**
 * Schedule a native reminder notification via LocalNotifications.
 */
export async function scheduleNativeReminderAlarm(reminderId: string, title: string, triggerDate: Date, notes?: string): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = getDeterministicNotifId(`reminder_${reminderId}`);
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch {}

    if (triggerDate.getTime() > Date.now()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: `🔔 Reminder: ${title}`,
            body: notes || 'Your scheduled reminder is due!',
            schedule: { at: triggerDate, allowWhileIdle: true },
            channelId: 'timer_alarms',
            actionTypeId: 'REMINDER_DUE',
            extra: { reminderId }
          }
        ]
      });
    }
  } catch (err) {
    console.warn('Failed to schedule native reminder alarm', err);
  }
}

/**
 * Cancel a scheduled native reminder alarm.
 */
export async function cancelNativeReminderAlarm(reminderId: string): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = getDeterministicNotifId(`reminder_${reminderId}`);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (err) {
    console.warn('Failed to cancel native reminder alarm', err);
  }
}
