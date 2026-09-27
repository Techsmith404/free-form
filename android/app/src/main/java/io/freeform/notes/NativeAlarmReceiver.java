package io.freeform.notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class NativeAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "NativeAlarmReceiver";
    public static final String ACTION_ALARM_TRIGGER = "io.freeform.notes.ACTION_ALARM_TRIGGER";
    public static final String ACTION_TIMER_STOP = "io.freeform.notes.ACTION_TIMER_STOP";
    public static final String ACTION_TIMER_PAUSE = "io.freeform.notes.ACTION_TIMER_PAUSE";
    public static final String ACTION_ALARM_DISMISS = "io.freeform.notes.ACTION_ALARM_DISMISS";

    public static final String ALARM_CHANNEL_ID = "timer_alarms";
    public static final String COUNTDOWN_CHANNEL_ID = "timer_countdown_channel";
    public static final int ALARM_NOTIFICATION_BASE_ID = 990000;
    public static final int COUNTDOWN_NOTIFICATION_BASE_ID = 880000;

    public static int getCountdownNotificationId(String timerId) {
        int hash = timerId.hashCode();
        return COUNTDOWN_NOTIFICATION_BASE_ID + Math.abs(hash % 10000);
    }

    public static int getAlarmNotificationId(String timerId) {
        int hash = timerId.hashCode();
        return ALARM_NOTIFICATION_BASE_ID + Math.abs(hash % 10000);
    }

    public static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && context != null) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Ongoing countdown channel
            // IMPORTANCE_DEFAULT is needed for One UI "Live Notification" at-a-glance lock screen widget.
            // IMPORTANCE_LOW would suppress it from appearing as a Live Activity on lock screen.
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

            // High importance alarm channel for the "Timer Finished" heads-up
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
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                alarmChannel.setBypassDnd(true);
            }
            nm.createNotificationChannel(alarmChannel);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        String timerId = intent.getStringExtra("timerId");
        if (timerId == null) timerId = "default";
        String title = intent.getStringExtra("title");
        if (title == null || title.trim().isEmpty()) title = "Timer";

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (ACTION_ALARM_TRIGGER.equals(action)) {
            // 1. Acquire wake lock to turn screen on
            try {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    PowerManager.WakeLock wakeLock = pm.newWakeLock(
                        PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "FreeForm:AlarmWakeLock"
                    );
                    wakeLock.acquire(15000); // 15 seconds
                }
            } catch (Exception e) {
                Log.e(TAG, "WakeLock failed", e);
            }

            // 2. Play native alarm ringtone + vibration
            AlarmSoundManager.playAlarm(context, timerId);

            // 3. Cancel the live countdown notification
            if (nm != null) {
                nm.cancel(getCountdownNotificationId(timerId));
            }

            // 4. Ensure alarm channels exist
            createChannels(context);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            // 5. Build a full-screen intent that opens AlarmActivity (NOT MainActivity).
            //    AlarmActivity is styled as a transparent overlay over the lock screen.
            Intent alarmActivityIntent = new Intent(context, AlarmActivity.class);
            alarmActivityIntent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            );
            alarmActivityIntent.putExtra(AlarmActivity.EXTRA_TIMER_ID, timerId);
            alarmActivityIntent.putExtra(AlarmActivity.EXTRA_TIMER_TITLE, title);
            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                getAlarmNotificationId(timerId),
                alarmActivityIntent,
                pendingFlags
            );

            // 6. Dismiss action from notification shade (without opening full-screen activity)
            Intent dismissIntent = new Intent(context, NativeAlarmReceiver.class);
            dismissIntent.setAction(ACTION_ALARM_DISMISS);
            dismissIntent.putExtra("timerId", timerId);
            PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                context,
                getAlarmNotificationId(timerId) + 1,
                dismissIntent,
                pendingFlags
            );

            // 7. Post the alarm notification with setFullScreenIntent pointing at AlarmActivity
            NotificationCompat.Builder alarmBuilder = new NotificationCompat.Builder(context, ALARM_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("⏰ Timer Finished!")
                .setContentText("\"" + title + "\" has ended.")
                .setContentIntent(fullScreenPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "⏹ Stop Alarm", dismissPendingIntent);

            if (nm != null) {
                nm.notify(getAlarmNotificationId(timerId), alarmBuilder.build());
            }

            // 8. Also launch the AlarmActivity directly for immediate full-screen display
            try {
                context.startActivity(alarmActivityIntent);
            } catch (Exception e) {
                Log.e(TAG, "Could not start AlarmActivity", e);
            }

            // 9. Notify JS bridge that alarm is ringing (so in-app state updates if app is open)
            NativeTimerPlugin.sendTimerActionEvent("ring", timerId);

        } else if (ACTION_ALARM_DISMISS.equals(action)) {
            // Triggered from notification shade "Stop Alarm" action button
            AlarmSoundManager.stopAlarm(context, timerId);
            if (nm != null) {
                nm.cancel(getAlarmNotificationId(timerId));
                nm.cancel(getCountdownNotificationId(timerId));
            }
            // Notify JS bridge → dismissTimer → cross-device WebSocket broadcast
            NativeTimerPlugin.sendTimerActionEvent("stop", timerId);

        } else if (ACTION_TIMER_STOP.equals(action)) {
            // Triggered from countdown notification "Stop" action button
            AlarmSoundManager.stopAlarm(context, timerId);
            if (nm != null) {
                nm.cancel(getCountdownNotificationId(timerId));
                nm.cancel(getAlarmNotificationId(timerId));
            }
            NativeTimerPlugin.sendTimerActionEvent("stop", timerId);

        } else if (ACTION_TIMER_PAUSE.equals(action)) {
            // Triggered from countdown notification "Pause" action button
            AlarmSoundManager.stopAlarm(context, timerId);
            if (nm != null) {
                nm.cancel(getCountdownNotificationId(timerId));
            }
            NativeTimerPlugin.sendTimerActionEvent("pause", timerId);
        }
    }
}
