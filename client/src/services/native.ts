import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

/**
 * Initialize native device features (Status bar, splash screen, notifications)
 */
export async function initNativeApp(): Promise<void> {
  if (!isNative) return;

  try {
    // 1. Configure status bar
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#161A25' });
  } catch (err) {
    console.warn('Native status bar initialization failed', err);
  }

  try {
    // 2. Request notification permissions for timer alarms
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.warn('Native notification permission request failed', err);
  }

  try {
    // 3. Hide splash screen after brief load
    setTimeout(async () => {
      try {
        await SplashScreen.hide();
      } catch {}
    }, 500);
  } catch {}
}

/**
 * Trigger subtle light haptic feedback on button presses
 */
export async function hapticTap(): Promise<void> {
  if (isNative) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {}
  }
}

/**
 * Trigger medium haptic feedback on counter increments or toggles
 */
export async function hapticMedium(): Promise<void> {
  if (isNative) {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(20);
    } catch {}
  }
}

/**
 * Trigger success notification haptic on save/complete
 */
export async function hapticSuccess(): Promise<void> {
  if (isNative) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([15, 50, 15]);
    } catch {}
  }
}

/**
 * Schedule a native OS-level alarm notification for a timer
 */
export async function scheduleNativeTimerAlarm(timerId: string, title: string, triggerDate: Date): Promise<void> {
  if (!isNative) return;

  try {
    // Convert string ID to positive 32-bit integer for notification ID
    const notifId = Math.abs(timerId.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0) | 0);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title: '⏰ Free Form Timer Finished',
          body: title || 'Your timer is done!',
          schedule: { at: triggerDate },
          sound: 'alarm_chime.wav',
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
 * Cancel a scheduled native timer alarm
 */
export async function cancelNativeTimerAlarm(timerId: string): Promise<void> {
  if (!isNative) return;

  try {
    const notifId = Math.abs(timerId.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0) | 0);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (err) {
    console.warn('Failed to cancel native timer alarm', err);
  }
}
