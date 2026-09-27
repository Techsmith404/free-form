import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

export interface NativeTimerPluginInterface {
  startCountdownNotification(options: { timerId: string; title: string; targetEndTime: number }): Promise<{ success: boolean; notificationId: number }>;
  cancelCountdownNotification(options: { timerId: string }): Promise<{ success: boolean }>;
  cancelAllCountdowns(): Promise<{ success: boolean }>;
  setSystemClockTimer(options: { lengthSeconds: number; title: string; skipUi?: boolean }): Promise<{ success: boolean }>;
  dismissSystemClockTimer(options: { title: string; skipUi?: boolean }): Promise<{ success: boolean }>;
}

export const NativeTimer = registerPlugin<NativeTimerPluginInterface>('NativeTimer');

/**
 * Dispatch an actual timer directly into Android's native Clock app (Samsung Clock / Google Clock)
 */
export async function setNativeSystemClockTimer(lengthSeconds: number, title: string, skipUi: boolean = true): Promise<boolean> {
  if (!isNative) return false;
  try {
    const res = await NativeTimer.setSystemClockTimer({
      lengthSeconds,
      title: title || 'Free Form Timer',
      skipUi
    });
    return res.success;
  } catch (err) {
    console.warn('Failed to set native system clock timer', err);
    return false;
  }
}

/**
 * Dismiss/cancel a timer inside Android's native Clock app
 */
export async function dismissNativeSystemClockTimer(title: string, skipUi: boolean = true): Promise<boolean> {
  if (!isNative) return false;
  try {
    const res = await NativeTimer.dismissSystemClockTimer({
      title: title || 'Free Form Timer',
      skipUi
    });
    return res.success;
  } catch (err) {
    console.warn('Failed to dismiss native system clock timer', err);
    return false;
  }
}



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
 * Trigger subtle, light crisp tick on normal button presses (replaces heavy vibration)
 */
export async function hapticTap(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.selectionChanged();
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(6);
    }
  } catch {}
}

/**
 * Trigger medium haptic bump on counter increments, timers, or toggles
 */
export async function hapticMedium(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  } catch {}
}

/**
 * Trigger firm haptic feedback on delete or important alerts
 */
export async function hapticHeavy(): Promise<void> {
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
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
      navigator.vibrate([10, 40, 15]);
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

const activeSystemTimerKeys = new Set<string>();

/**
 * Schedule a native OS-level alarm notification for a timer and display live countdown chronometer
 */
export async function scheduleNativeTimerAlarm(timerId: string, title: string, triggerDate: Date): Promise<void> {
  if (!isNative) return;

  const targetTimeMs = triggerDate.getTime();
  if (targetTimeMs <= Date.now()) return;

  const timerTitle = title || 'Timer';
  const remainingSecs = Math.max(1, Math.round((targetTimeMs - Date.now()) / 1000));

  // 1. Automatically dispatch into Android System Clock (Samsung Clock / Google Clock)
  // This automatically activates:
  // - The purple dynamic status bar pill (One UI Live Notification chip)
  // - The lock screen "Live notification" widget with Pause/Cancel controls
  // - The floating full-screen alarm modal with system ringtone when expired
  const timerRunKey = `${timerId}_${Math.floor(targetTimeMs / 5000)}`;
  if (!activeSystemTimerKeys.has(timerRunKey)) {
    activeSystemTimerKeys.add(timerRunKey);
    setNativeSystemClockTimer(remainingSecs, timerTitle, true).catch(() => {});
  }

  // 2. Start live countdown chronometer notification in notification shade
  try {
    await NativeTimer.startCountdownNotification({
      timerId,
      title: timerTitle,
      targetEndTime: targetTimeMs
    });
  } catch (err) {
    console.warn('NativeTimer chronometer notification failed', err);
  }

  // 3. Schedule completion alarm notification
  try {
    const notifId = getDeterministicNotifId(`timer_${timerId}`);

    // Cancel existing scheduled completion alarm first
    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch {}

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: '⏰ Timer Finished!',
          body: `Timer "${timerTitle}" has ended.`,
          schedule: { at: triggerDate, allowWhileIdle: true },
          channelId: 'timer_alarms',
          actionTypeId: 'TIMER_DONE',
          extra: { timerId }
        }
      ]
    });
  } catch (err) {
    console.warn('Failed to schedule native timer alarm', err);
  }
}

/**
 * Cancel a scheduled native timer alarm and remove live countdown chronometer
 */
export async function cancelNativeTimerAlarm(timerId: string, title?: string): Promise<void> {
  if (!isNative) return;

  // 1. Dismiss System Clock timer if active
  if (title) {
    dismissNativeSystemClockTimer(title, true).catch(() => {});
  }

  // 2. Cancel live countdown chronometer notification
  try {
    await NativeTimer.cancelCountdownNotification({ timerId });
  } catch {}

  // 3. Cancel scheduled alarm
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

