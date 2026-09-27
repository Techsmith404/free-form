package io.freeform.notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.provider.AlarmClock;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeTimer")
public class NativeTimerPlugin extends Plugin {

    private static final String COUNTDOWN_CHANNEL_ID = "timer_countdown_channel";
    private static final String ALARM_CHANNEL_ID = "timer_alarms";
    private static final int ONGOING_NOTIFICATION_BASE_ID = 880000;

    private NotificationManager getNotificationManager() {
        Context context = getContext();
        if (context == null) return null;
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getNotificationManager();
            if (nm == null) return;

            // 1. Ongoing countdown channel (Default importance: visible in shade & lock screen, silent, live chronometer)
            NotificationChannel countdownChannel = new NotificationChannel(
                COUNTDOWN_CHANNEL_ID,
                "Active Timer Countdowns",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            countdownChannel.setDescription("Live countdown timer in notification shade and lock screen");
            countdownChannel.setShowBadge(false);
            countdownChannel.enableVibration(false);
            countdownChannel.setSound(null, null);
            countdownChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(countdownChannel);

            // 2. High importance alarm channel for completed timers & reminders
            NotificationChannel alarmChannel = new NotificationChannel(
                ALARM_CHANNEL_ID,
                "Timers & Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            alarmChannel.setDescription("High-priority alarm notifications for Free Form timers and reminders");
            alarmChannel.setShowBadge(true);
            alarmChannel.enableVibration(true);
            alarmChannel.enableLights(true);
            alarmChannel.setLightColor(Color.parseColor("#48BEB6"));
            alarmChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(alarmChannel);
        }
    }

    private int getNotificationId(String timerId) {
        int hash = timerId.hashCode();
        return ONGOING_NOTIFICATION_BASE_ID + Math.abs(hash % 10000);
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

    @PluginMethod
    public void startCountdownNotification(PluginCall call) {
        createNotificationChannels();

        String timerId = call.getString("timerId", "default");
        String title = call.getString("title", "Timer");
        long targetEndTimeMillis = getLongValue(call, "targetEndTime");

        if (targetEndTimeMillis <= 0) {
            call.reject("Valid targetEndTime is required");
            return;
        }

        Context context = getContext();
        NotificationManager nm = getNotificationManager();
        if (nm == null || context == null) {
            call.reject("Context or NotificationManager unavailable");
            return;
        }

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openAppIntent.putExtra("timerId", timerId);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, openAppIntent, flags);

        int smallIcon = R.mipmap.ic_launcher;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, COUNTDOWN_CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle("⏳ " + (title == null || title.trim().isEmpty() ? "Timer" : title))
            .setContentText("Timer running")
            .setContentIntent(pendingIntent)
            .setShowWhen(true)
            .setWhen(targetEndTimeMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        int notifId = getNotificationId(timerId);
        nm.notify(notifId, builder.build());

        JSObject res = new JSObject();
        res.put("success", true);
        res.put("notificationId", notifId);
        call.resolve(res);
    }

    @PluginMethod
    public void cancelCountdownNotification(PluginCall call) {
        String timerId = call.getString("timerId", "default");
        NotificationManager nm = getNotificationManager();
        if (nm != null) {
            nm.cancel(getNotificationId(timerId));
        }
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    @PluginMethod
    public void cancelAllCountdowns(PluginCall call) {
        NotificationManager nm = getNotificationManager();
        if (nm != null) {
            for (int i = 0; i < 10000; i++) {
                nm.cancel(ONGOING_NOTIFICATION_BASE_ID + i);
            }
        }
        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
    }

    @PluginMethod
    public void setSystemClockTimer(PluginCall call) {
        int lengthSeconds = call.getInt("lengthSeconds", 60);
        String title = call.getString("title", "Free Form Timer");
        boolean skipUi = call.getBoolean("skipUi", true);

        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
            intent.putExtra(AlarmClock.EXTRA_LENGTH, lengthSeconds);
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, title);
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Context context = getContext();
            if (context != null) {
                context.startActivity(intent);
                JSObject res = new JSObject();
                res.put("success", true);
                call.resolve(res);
            } else {
                call.reject("Context is null");
            }
        } catch (Exception err) {
            call.reject("Failed to set system timer in Clock app: " + err.getMessage());
        }
    }

    @PluginMethod
    public void dismissSystemClockTimer(PluginCall call) {
        String title = call.getString("title", "Free Form Timer");
        boolean skipUi = call.getBoolean("skipUi", true);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(AlarmClock.ACTION_DISMISS_TIMER);
                intent.putExtra(AlarmClock.EXTRA_MESSAGE, title);
                intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                Context context = getContext();
                if (context != null && intent.resolveActivity(context.getPackageManager()) != null) {
                    context.startActivity(intent);
                }
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception err) {
            JSObject res = new JSObject();
            res.put("success", false);
            call.resolve(res);
        }
    }
}

