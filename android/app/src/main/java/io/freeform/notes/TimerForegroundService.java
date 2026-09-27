package io.freeform.notes;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

/**
 * Foreground Service for running timer countdowns.
 *
 * This service is the backbone of the "Live Update" / Now Bar integration:
 * - Runs as a foreground service with FOREGROUND_SERVICE_TYPE_SPECIAL_USE.
 * - Posts a notification requesting Promoted Ongoing status (Android 16 API level 36),
 *   which signals to Samsung One UI 8+ to promote it into the Now Bar (lock screen capsule,
 *   Always-on Display, and status bar chip).
 * - Dynamically updates contentText every 1 second (e.g. "04:59", "04:58") so Samsung's
 *   Now Bar capsule (which renders EXTRA_TEXT as its second line) displays the live ticking
 *   countdown numbers instead of static text.
 * - Also sets setUsesChronometer + setChronometerCountDown for native chronometer rendering.
 */
public class TimerForegroundService extends Service {
    private static final String TAG = "TimerForegroundService";

    public static final String ACTION_START  = "io.freeform.notes.TIMER_SERVICE_START";
    public static final String ACTION_STOP   = "io.freeform.notes.TIMER_SERVICE_STOP";

    // Stable notification ID for the active promoted foreground timer
    public static final int FOREGROUND_NOTIF_ID = 770001;

    public static final String EXTRA_TIMER_ID  = "timerId";
    public static final String EXTRA_TITLE     = "title";
    public static final String EXTRA_END_TIME  = "targetEndTime";

    // Android 16 Live Updates promoted ongoing extra key
    public static final String EXTRA_REQUEST_PROMOTED_ONGOING = "android.requestPromotedOngoing";

    private final Handler tickerHandler = new Handler(Looper.getMainLooper());
    private Runnable tickerRunnable = null;

    private String currentTimerId = "default";
    private String currentTitle = "Timer";
    private long currentTargetEndMs = 0L;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (action == null) return START_NOT_STICKY;

        if (ACTION_START.equals(action)) {
            currentTimerId   = intent.getStringExtra(EXTRA_TIMER_ID);
            currentTitle     = intent.getStringExtra(EXTRA_TITLE);
            currentTargetEndMs = intent.getLongExtra(EXTRA_END_TIME, 0L);

            if (currentTimerId == null) currentTimerId = "default";
            if (currentTitle == null || currentTitle.trim().isEmpty()) currentTitle = "Timer";

            // Stop any existing ticker loop before starting a new one
            stopTicker();

            Notification notification = buildLiveCountdownNotification(this, currentTimerId, currentTitle, currentTargetEndMs);

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // API 34+
                    startForeground(
                        FOREGROUND_NOTIF_ID,
                        notification,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    );
                } else {
                    startForeground(FOREGROUND_NOTIF_ID, notification);
                }
                Log.d(TAG, "Started foreground timer service for: " + currentTitle);
            } catch (Exception e) {
                Log.e(TAG, "startForeground failed", e);
            }

            // Start 1-second dynamic countdown ticker
            startTicker();

        } else if (ACTION_STOP.equals(action)) {
            Log.d(TAG, "Stopping foreground timer service");
            stopTicker();
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE);
                } else {
                    stopForeground(true);
                }
            } catch (Exception ignored) {}
            stopSelf();
        }

        return START_NOT_STICKY;
    }

    private void startTicker() {
        stopTicker();
        tickerRunnable = new Runnable() {
            @Override
            public void run() {
                long remainingMs = currentTargetEndMs - System.currentTimeMillis();
                if (remainingMs <= 0) {
                    // Timer expired — AlarmManager will fire the alarm activity
                    stopTicker();
                    return;
                }

                // Update notification text (renders live countdown in Samsung Now Bar capsule)
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        Notification updatedNotification = buildLiveCountdownNotification(
                            TimerForegroundService.this,
                            currentTimerId,
                            currentTitle,
                            currentTargetEndMs
                        );
                        nm.notify(FOREGROUND_NOTIF_ID, updatedNotification);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error updating notification ticker", e);
                }

                tickerHandler.postDelayed(this, 1000);
            }
        };

        // Post next update in 1 second
        tickerHandler.postDelayed(tickerRunnable, 1000);
    }

    private void stopTicker() {
        if (tickerRunnable != null) {
            tickerHandler.removeCallbacks(tickerRunnable);
            tickerRunnable = null;
        }
    }

    @Override
    public void onDestroy() {
        stopTicker();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Format milliseconds into clean MM:SS or H:MM:SS for display in Samsung's Now Bar capsule.
     */
    public static String formatRemaining(long remainingMs) {
        if (remainingMs <= 0) return "00:00";
        // Round up to nearest second so 59.9s displays as 60s
        long totalSecs = Math.max(0, (remainingMs + 999) / 1000);
        long hours = totalSecs / 3600;
        long minutes = (totalSecs % 3600) / 60;
        long seconds = totalSecs % 60;

        if (hours > 0) {
            return String.format(Locale.getDefault(), "%d:%02d:%02d", hours, minutes, seconds);
        } else {
            return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds);
        }
    }

    /**
     * Build the "Live Update" promoted ongoing notification.
     *
     * Key requirements for Samsung Now Bar / Android 16 Live Updates:
     * 1. setOngoing(true) — required for promoted ongoing activities
     * 2. setRequestPromotedOngoing(true) / "android.requestPromotedOngoing" extra
     * 3. setContentText(timeStr) — Samsung Now Bar renders EXTRA_TEXT on line 2 of the capsule
     * 4. setUsesChronometer(true) + setChronometerCountDown(true) for native chronometer rendering
     * 5. CATEGORY_STOPWATCH — signals timer/chronometer to OS
     * 6. VISIBILITY_PUBLIC — allows rendering on lock screen & AOD
     * 7. PRIORITY_DEFAULT — standard priority ensures proper Now Bar promotion
     * 8. setOnlyAlertOnce(true) — silent second-by-second updates without noise or vibration
     */
    public static Notification buildLiveCountdownNotification(
            Context context, String timerId, String title, long targetEndMs) {

        NativeAlarmReceiver.createChannels(context);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Tap notification body → open Free Form app
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("timerId", timerId);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context, NativeAlarmReceiver.getCountdownNotificationId(timerId), openIntent, pendingFlags
        );

        // Pause action
        Intent pauseIntent = new Intent(context, NativeAlarmReceiver.class);
        pauseIntent.setAction(NativeAlarmReceiver.ACTION_TIMER_PAUSE);
        pauseIntent.putExtra("timerId", timerId);
        PendingIntent pausePending = PendingIntent.getBroadcast(
            context, NativeAlarmReceiver.getCountdownNotificationId(timerId) + 1, pauseIntent, pendingFlags
        );

        // Stop action
        Intent stopIntent = new Intent(context, NativeAlarmReceiver.class);
        stopIntent.setAction(NativeAlarmReceiver.ACTION_TIMER_STOP);
        stopIntent.putExtra("timerId", timerId);
        PendingIntent stopPending = PendingIntent.getBroadcast(
            context, NativeAlarmReceiver.getCountdownNotificationId(timerId) + 2, stopIntent, pendingFlags
        );

        long remainingMs = targetEndMs - System.currentTimeMillis();
        String timeStr = formatRemaining(remainingMs);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(
                context, NativeAlarmReceiver.COUNTDOWN_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("⏳ " + title)
            .setContentText(timeStr)
            .setContentIntent(openPendingIntent)
            .setShowWhen(true)
            .setWhen(targetEndMs)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePending)
            .addAction(android.R.drawable.ic_delete, "Stop", stopPending);

        // Request promoted ongoing treatment via method reflection if available in androidx
        try {
            java.lang.reflect.Method m = builder.getClass().getMethod("setRequestPromotedOngoing", boolean.class);
            m.invoke(builder, true);
        } catch (Throwable ignored) {}

        // Add the Android 16 live update extra bundle directly
        Bundle extras = new Bundle();
        extras.putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true);
        builder.addExtras(extras);

        Notification notification = builder.build();

        // Ensure flags and extras on the built Notification object
        if (notification.extras != null) {
            notification.extras.putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true);
        }

        if (Build.VERSION.SDK_INT >= 36) {
            try {
                java.lang.reflect.Field flagField = notification.getClass().getField("FLAG_PROMOTED_ONGOING");
                notification.flags |= flagField.getInt(null);
            } catch (Throwable ignored) {}
        }

        return notification;
    }

    /**
     * Start the foreground timer service for an active countdown.
     */
    public static void startForTimer(Context context, String timerId, String title, long targetEndMs) {
        if (context == null) return;
        Intent intent = new Intent(context, TimerForegroundService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_TIMER_ID, timerId);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_END_TIME, targetEndMs);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start TimerForegroundService", e);
        }
    }

    /**
     * Stop the foreground timer service and remove the promoted notification.
     */
    public static void stopService(Context context) {
        if (context == null) return;
        Intent intent = new Intent(context, TimerForegroundService.class);
        intent.setAction(ACTION_STOP);
        try {
            context.startService(intent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop TimerForegroundService", e);
        }

        // Also explicitly cancel the foreground notification id via NotificationManager
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(FOREGROUND_NOTIF_ID);
            }
        } catch (Exception ignored) {}
    }
}
