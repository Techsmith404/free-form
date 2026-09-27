package io.freeform.notes;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

/**
 * Full-screen alarm activity shown on top of the lock screen when a timer expires.
 * Declared with showWhenLocked + turnScreenOn so it appears even when phone is locked.
 * This gives the native full-screen takeover modal that users expect from alarm apps.
 */
public class AlarmActivity extends Activity {

    public static final String EXTRA_TIMER_ID = "timerId";
    public static final String EXTRA_TIMER_TITLE = "timerTitle";

    private String timerId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over the lock screen and turn screen on
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        // Keep screen bright while alarm is showing
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        timerId = getIntent().getStringExtra(EXTRA_TIMER_ID);
        String timerTitle = getIntent().getStringExtra(EXTRA_TIMER_TITLE);
        if (timerId == null) timerId = "default";
        if (timerTitle == null || timerTitle.trim().isEmpty()) timerTitle = "Timer";

        // Build the full-screen layout programmatically to avoid needing extra XML layout file
        buildLayout(timerTitle);
    }

    private void buildLayout(String timerTitle) {
        // Root layout - dark background
        android.widget.LinearLayout root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setBackgroundColor(0xFF0D1117); // dark background
        root.setPadding(64, 128, 64, 128);

        // Timer icon label
        TextView iconView = new TextView(this);
        iconView.setText("⏰");
        iconView.setTextSize(72);
        iconView.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams iconParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        iconParams.setMargins(0, 0, 0, 32);
        root.addView(iconView, iconParams);

        // "Timer Finished!" heading
        TextView headingView = new TextView(this);
        headingView.setText("Timer Finished!");
        headingView.setTextSize(32);
        headingView.setTextColor(0xFFFFFFFF);
        headingView.setTypeface(headingView.getTypeface(), android.graphics.Typeface.BOLD);
        headingView.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams headingParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        headingParams.setMargins(0, 0, 0, 16);
        root.addView(headingView, headingParams);

        // Timer name
        TextView titleView = new TextView(this);
        titleView.setText("\"" + timerTitle + "\"");
        titleView.setTextSize(20);
        titleView.setTextColor(0xFFB0B8C4);
        titleView.setGravity(android.view.Gravity.CENTER);
        android.widget.LinearLayout.LayoutParams titleParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.setMargins(0, 0, 0, 64);
        root.addView(titleView, titleParams);

        // Stop Alarm button
        Button stopButton = new Button(this);
        stopButton.setText("⏹  STOP ALARM");
        stopButton.setTextSize(18);
        stopButton.setTextColor(0xFFFFFFFF);
        stopButton.setBackgroundColor(0xFFEF4444); // red-500
        stopButton.setAllCaps(false);
        android.widget.LinearLayout.LayoutParams btnParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            160 // tall touch target
        );
        stopButton.setPadding(0, 0, 0, 0);
        stopButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopAlarm();
            }
        });
        root.addView(stopButton, btnParams);

        setContentView(root);
    }

    private void stopAlarm() {
        // Stop alarm audio & vibration
        AlarmSoundManager.stopAlarm(this, timerId);

        // Cancel the alarm notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NativeAlarmReceiver.getAlarmNotificationId(timerId));
            nm.cancel(NativeAlarmReceiver.getCountdownNotificationId(timerId));
        }

        // Send action to JS bridge so app state + cross-device WebSocket dismiss fires
        NativeTimerPlugin.sendTimerActionEvent("stop", timerId);

        finish();
    }

    @Override
    public void onBackPressed() {
        // Don't allow back to dismiss - user must tap Stop
        // (same behavior as system alarm apps)
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
    }
}
