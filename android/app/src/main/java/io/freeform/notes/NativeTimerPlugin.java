package io.freeform.notes;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeTimer")
public class NativeTimerPlugin extends Plugin {
    private static final String TAG = "NativeTimerPlugin";
    private static NativeTimerPlugin instance = null;

    @Override
    public void load() {
        super.load();
        instance = this;
        Context context = getContext();
        if (context != null) {
            NativeAlarmReceiver.createChannels(context);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
        super.handleOnDestroy();
    }

    /**
     * Sends a timer action event to the JS layer (Capacitor notifyListeners).
     * Called from BroadcastReceiver and AlarmActivity — these run when app may be open or closed.
     * When app is NOT open, instance is null and we skip (the AlarmManager already handled it).
     */
    public static void sendTimerActionEvent(String action, String timerId) {
        if (instance != null) {
            try {
                JSObject data = new JSObject();
                data.put("action", action);
                data.put("timerId", timerId);
                instance.notifyListeners("onTimerAction", data);
            } catch (Exception e) {
                Log.e(TAG, "Failed to send timer action event", e);
            }
        }
    }

    private NotificationManager getNotificationManager() {
        Context context = getContext();
        if (context == null) return null;
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private AlarmManager getAlarmManager() {
        Context context = getContext();
        if (context == null) return null;
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private long getLongValue(PluginCall call, String key) {
        if (call.getData() != null && call.getData().has(key)) {
            try {
                return call.getData().getLong(key);
            } catch (Exception e1) {
                try {
                    return (long) call.getData().getDouble(key);
                } catch (Exception e2) {
                    try {
                        return Long.parseLong(call.getData().getString(key));
                    } catch (Exception e3) {}
                }
            }
        }
        return 0L;
    }

    /**
     * Creates a PendingIntent for the AlarmManager to fire ACTION_ALARM_TRIGGER via NativeAlarmReceiver.
     * IMPORTANT: title is NOT put into the intent for the cancel path — only timerId and action matter
     * for PendingIntent matching. Title is fetched separately when needed.
     */
    private PendingIntent buildAlarmPendingIntent(Context context, String timerId, String title, int flags) {
        Intent alarmIntent = new Intent(context, NativeAlarmReceiver.class);
        alarmIntent.setAction(NativeAlarmReceiver.ACTION_ALARM_TRIGGER);
        alarmIntent.putExtra("timerId", timerId);
        if (title != null) {
            alarmIntent.putExtra("title", title);
        }
        return PendingIntent.getBroadcast(
            context,
            NativeAlarmReceiver.getAlarmNotificationId(timerId),
            alarmIntent,
            flags
        );
    }

    @PluginMethod
    public void startCountdownNotification(PluginCall call) {
        Context context = getContext();
        NotificationManager nm = getNotificationManager();
        AlarmManager am = getAlarmManager();

        if (context == null || nm == null) {
            call.reject("Context or NotificationManager unavailable");
            return;
        }

        NativeAlarmReceiver.createChannels(context);

        String timerId = call.getString("timerId", "default");
        String title = call.getString("title", "Timer");
        long targetEndTimeMillis = getLongValue(call, "targetEndTime");

        if (targetEndTimeMillis <= 0) {
            call.reject("Valid targetEndTime is required");
            return;
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // 1. Schedule native AlarmManager to trigger alarm when time expires.
        //    Uses setExactAndAllowWhileIdle to ensure it fires even in Doze mode.
        if (am != null) {
            // Cancel any previous alarm for this timer first
            PendingIntent cancelFlags_pi = buildAlarmPendingIntent(context, timerId, title, flags);
            am.cancel(cancelFlags_pi);

            PendingIntent alarmPendingIntent = buildAlarmPendingIntent(context, timerId, title, flags);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, targetEndTimeMillis, alarmPendingIntent);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, targetEndTimeMillis, alarmPendingIntent);
                }
            } catch (SecurityException se) {
                Log.w(TAG, "Exact alarm permission not granted, falling back to set()", se);
                am.set(AlarmManager.RTC_WAKEUP, targetEndTimeMillis, alarmPendingIntent);
            }
        }

        // 2. Start the TimerForegroundService, which posts the promoted "Live Update" notification.
        //    A foreground service is REQUIRED by Android for setRequestPromotedOngoing(true) to work.
        //    The service also handles the chronometer countdown display and notification actions.
        TimerForegroundService.startForTimer(context, timerId, title, targetEndTimeMillis);

        // 3. Also post the standard countdown notification (belt-and-suspenders for older One UI).
        //    The foreground service handles the promoted one; this covers the shade/lock screen fallback.
        int notifId = NativeAlarmReceiver.getCountdownNotificationId(timerId);

        JSObject res = new JSObject();
        res.put("success", true);
        res.put("notificationId", notifId);
        call.resolve(res);
    }

    @PluginMethod
    public void cancelCountdownNotification(PluginCall call) {
        String timerId = call.getString("timerId", "default");
        Context context = getContext();
        NotificationManager nm = getNotificationManager();
        AlarmManager am = getAlarmManager();

        // Cancel the scheduled AlarmManager alarm.
        // Use FLAG_NO_CREATE so we don't accidentally create a new PendingIntent.
        if (context != null && am != null) {
            int cancelFlags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                cancelFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            // We need to match the original intent exactly (same action + timerId extra)
            Intent alarmIntent = new Intent(context, NativeAlarmReceiver.class);
            alarmIntent.setAction(NativeAlarmReceiver.ACTION_ALARM_TRIGGER);
            alarmIntent.putExtra("timerId", timerId);
            PendingIntent pi = PendingIntent.getBroadcast(
                context,
                NativeAlarmReceiver.getAlarmNotificationId(timerId),
                alarmIntent,
                cancelFlags
            );
            if (pi != null) {
                am.cancel(pi);
                pi.cancel();
            }
        }

        // Stop foreground service
        if (context != null) {
            TimerForegroundService.stopService(context);
        }

        // Cancel both countdown and alarm notifications
        if (nm != null) {
            nm.cancel(NativeAlarmReceiver.getCountdownNotificationId(timerId));
            nm.cancel(NativeAlarmReceiver.getAlarmNotificationId(timerId));
        }

        // Stop any playing alarm audio
        if (context != null) {
            AlarmSoundManager.stopAlarm(context, timerId);
        }

        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    @PluginMethod
    public void cancelAllCountdowns(PluginCall call) {
        Context context = getContext();
        NotificationManager nm = getNotificationManager();
        if (context != null) {
            TimerForegroundService.stopService(context);
        }
        if (nm != null) {
            for (int i = 0; i < 10000; i++) {
                nm.cancel(NativeAlarmReceiver.COUNTDOWN_NOTIFICATION_BASE_ID + i);
                nm.cancel(NativeAlarmReceiver.ALARM_NOTIFICATION_BASE_ID + i);
            }
        }
        if (context != null) {
            AlarmSoundManager.stopAll(context);
        }
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    /**
     * Directly trigger the alarm (called from JS when app is foreground and timer expires
     * before AlarmManager fires — e.g. in dev/short timers).
     */
    @PluginMethod
    public void triggerAlarm(PluginCall call) {
        Context context = getContext();
        String timerId = call.getString("timerId", "default");
        String title = call.getString("title", "Timer");

        if (context != null) {
            TimerForegroundService.stopService(context);
            Intent intent = new Intent(context, NativeAlarmReceiver.class);
            intent.setAction(NativeAlarmReceiver.ACTION_ALARM_TRIGGER);
            intent.putExtra("timerId", timerId);
            intent.putExtra("title", title);
            context.sendBroadcast(intent);
        }

        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    /**
     * Stop alarm audio and cancel notifications (called from JS when user taps Stop Alarm
     * in the in-app modal, or when a cross-device dismiss comes in via WebSocket).
     */
    @PluginMethod
    public void stopAlarm(PluginCall call) {
        Context context = getContext();
        String timerId = call.getString("timerId", "default");
        NotificationManager nm = getNotificationManager();

        if (context != null) {
            TimerForegroundService.stopService(context);
            AlarmSoundManager.stopAlarm(context, timerId);
        }

        if (nm != null) {
            nm.cancel(NativeAlarmReceiver.getAlarmNotificationId(timerId));
            nm.cancel(NativeAlarmReceiver.getCountdownNotificationId(timerId));
        }

        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }
}
