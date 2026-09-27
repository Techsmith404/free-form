import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

/**
 * Initialize native device features (Status bar, splash screen, notification channel)
 */
export async function initNativeApp(): Promise<void> {
  if (!isNative) return;

  try {
    // 1. Configure status bar - prevent overlaying web content
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#161A25' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn('Native status bar initialization failed', err);
  }

  try {
    // 2. Create high-importance notification channel on Android for alarms
    await LocalNotifications.createChannel({
      id: 'timer_alarms',
      name: 'Timers & Reminders',
      description: 'High-priority notifications for Free Form timers and reminders',
      importance: 5, // High / Heads-up
      visibility: 1, // Public on lock screen
      vibration: true,
      lights: true,
      lightColor: '#48BEB6'
    });
  } catch (err) {
    console.warn('Native notification channel creation failed', err);
  }

  try {
    // 3. Request notification permissions for timer alarms
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.warn('Native notification permission request failed', err);
  }

  try {
    // 4. Hide splash screen after brief load
    setTimeout(async () => {
      try {
        await SplashScreen.hide();
      } catch {}
    }, 400);
  } catch {}
}

/**
 * Trigger subtle light haptic feedback on button presses
 */
export async function hapticTap(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {}
}

/**
 * Trigger medium haptic feedback on counter increments, timers, or toggles
 */
export async function hapticMedium(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(25);
    }
  } catch {}
}

/**
 * Trigger heavy haptic feedback on delete or important alerts
 */
export async function hapticHeavy(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(45);
    }
  } catch {}
}

/**
 * Trigger success notification haptic on save/complete
 */
export async function hapticSuccess(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 60, 20]);
    }
  } catch {}
}

/**
 * Trigger warning/alert haptic for ringing timers and triggered reminders
 */
export async function hapticWarning(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 100, 40, 100, 40]);
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
 * Schedule a native OS-level alarm notification for a timer
 */
export async function scheduleNativeTimerAlarm(timerId: string, title: string, triggerDate: Date): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = getDeterministicNotifId(`timer_${timerId}`);

    // Cancel existing one first if any
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch {}

    // Only schedule if trigger date is in the future
    if (triggerDate.getTime() > Date.now()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId,
            title: '⏰ Timer Finished!',
            body: title ? `Timer "${title}" has ended.` : 'Your timer has finished!',
            schedule: { at: triggerDate, allowWhileIdle: true },
            channelId: 'timer_alarms',
            actionTypeId: 'TIMER_DONE',
            extra: { timerId }
          }
        ]
      });
    }
  } catch (err) {
    console.warn('Failed to schedule native timer alarm', err);
  }
}

/**
 * Cancel a scheduled native timer alarm
 */
export async function cancelNativeTimerAlarm(timerId: string): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = getDeterministicNotifId(`timer_${timerId}`);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (err) {
    console.warn('Failed to cancel native timer alarm', err);
  }
}

/**
 * Schedule a native OS-level alarm notification for a reminder
 */
export async function scheduleNativeReminderAlarm(reminderId: string, title: string, triggerDate: Date, notes?: string): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = getDeterministicNotifId(`reminder_${reminderId}`);

    // Cancel existing one first if any
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
 * Cancel a scheduled native reminder alarm
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
