package io.freeform.notes;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Full-screen alarm activity displayed over the lock screen when a timer expires.
 * Designed to match the Free Form dark teal aesthetic.
 */
public class AlarmActivity extends Activity {

    public static final String EXTRA_TIMER_ID = "timerId";
    public static final String EXTRA_TIMER_TITLE = "timerTitle";

    private String timerId;
    private TextView bellIcon;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen and wake the display
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
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        timerId = getIntent().getStringExtra(EXTRA_TIMER_ID);
        String timerTitle = getIntent().getStringExtra(EXTRA_TIMER_TITLE);
        if (timerId == null) timerId = "default";
        if (timerTitle == null || timerTitle.trim().isEmpty()) timerTitle = "Timer";

        buildLayout(timerTitle);
    }

    private void buildLayout(String timerTitle) {
        // ── Colors from Free Form design system ──────────────────────────────
        int bgDark        = Color.parseColor("#0D1117"); // near-black page bg
        int bgCard        = Color.parseColor("#161A25"); // card surface
        int bgCardBorder  = Color.parseColor("#1E2536"); // card border
        int accentTeal    = Color.parseColor("#48BEB6"); // brand teal
        int accentTealDim = Color.parseColor("#2A7370"); // dimmed teal for glow
        int textPrimary   = Color.parseColor("#F0F4F8"); // near-white
        int textSecondary = Color.parseColor("#8B97A8"); // muted
        int red           = Color.parseColor("#EF4444"); // stop button red

        // ── Root frame (full screen) ──────────────────────────────────────────
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(bgDark);

        // ── Subtle radial glow behind the card (teal circle, very transparent) ─
        View glow = new View(this);
        GradientDrawable glowDrawable = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{ 0x2048BEB6, 0x0048BEB6, 0x0048BEB6 }
        );
        glowDrawable.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        glowDrawable.setGradientRadius(600f);
        glowDrawable.setShape(GradientDrawable.OVAL);
        glow.setBackground(glowDrawable);
        FrameLayout.LayoutParams glowParams = new FrameLayout.LayoutParams(800, 800);
        glowParams.gravity = Gravity.CENTER;
        glowParams.topMargin = -200;
        root.addView(glow, glowParams);

        // ── Centered content column ───────────────────────────────────────────
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);

        int px16 = dp(16);
        int px24 = dp(24);
        int px32 = dp(32);
        int px48 = dp(48);

        col.setPadding(px32, 0, px32, 0);

        // ── Top spacer ────────────────────────────────────────────────────────
        addSpacer(col, dp(80));

        // ── Pulsing bell icon ─────────────────────────────────────────────────
        bellIcon = new TextView(this);
        bellIcon.setText("⏰");
        bellIcon.setTextSize(72);
        bellIcon.setGravity(Gravity.CENTER);
        // Circle background behind bell
        GradientDrawable bellBg = new GradientDrawable();
        bellBg.setShape(GradientDrawable.OVAL);
        bellBg.setColor(Color.parseColor("#1A2A3A")); // very dark teal-navy
        bellBg.setStroke(dp(2), accentTeal);
        bellIcon.setBackground(bellBg);
        int bellSize = dp(128);
        LinearLayout.LayoutParams bellParams = new LinearLayout.LayoutParams(bellSize, bellSize);
        bellParams.gravity = Gravity.CENTER_HORIZONTAL;
        bellParams.bottomMargin = px32;
        col.addView(bellIcon, bellParams);

        // ── "Timer Finished!" heading ─────────────────────────────────────────
        TextView heading = new TextView(this);
        heading.setText("Timer Finished!");
        heading.setTextSize(30);
        heading.setTextColor(textPrimary);
        heading.setTypeface(null, Typeface.BOLD);
        heading.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams headingParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        headingParams.bottomMargin = px16;
        col.addView(heading, headingParams);

        // ── Timer title pill ──────────────────────────────────────────────────
        TextView titlePill = new TextView(this);
        titlePill.setText(timerTitle);
        titlePill.setTextSize(16);
        titlePill.setTextColor(accentTeal);
        titlePill.setGravity(Gravity.CENTER);
        titlePill.setPadding(px24, dp(10), px24, dp(10));
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setShape(GradientDrawable.RECTANGLE);
        pillBg.setCornerRadius(dp(100));
        pillBg.setColor(Color.parseColor("#0D2A28")); // very dark teal
        pillBg.setStroke(dp(1), Color.parseColor("#1E4A47")); // teal border
        titlePill.setBackground(pillBg);
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        pillParams.gravity = Gravity.CENTER_HORIZONTAL;
        pillParams.bottomMargin = dp(56);
        col.addView(titlePill, pillParams);

        // ── Subtext ───────────────────────────────────────────────────────────
        TextView subtext = new TextView(this);
        subtext.setText("Tap to stop the alarm on all devices");
        subtext.setTextSize(13);
        subtext.setTextColor(textSecondary);
        subtext.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtextParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subtextParams.bottomMargin = px24;
        col.addView(subtext, subtextParams);

        // ── STOP ALARM button ─────────────────────────────────────────────────
        Button stopButton = new Button(this);
        stopButton.setText("⏹  STOP ALARM");
        stopButton.setTextSize(17);
        stopButton.setTextColor(Color.WHITE);
        stopButton.setAllCaps(false);
        stopButton.setTypeface(null, Typeface.BOLD);
        stopButton.setLetterSpacing(0.05f);
        stopButton.setPadding(0, 0, 0, 0);

        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setShape(GradientDrawable.RECTANGLE);
        btnBg.setCornerRadius(dp(16));
        btnBg.setColor(red);
        stopButton.setBackground(btnBg);

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(64)
        );
        btnParams.bottomMargin = dp(20);
        stopButton.setOnClickListener(v -> stopAlarm());
        col.addView(stopButton, btnParams);

        // ── Divider line ──────────────────────────────────────────────────────
        View divider = new View(this);
        divider.setBackgroundColor(Color.parseColor("#1E2536"));
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(1)
        );
        dividerParams.bottomMargin = dp(20);
        col.addView(divider, dividerParams);

        // ── "Open App" ghost button ───────────────────────────────────────────
        Button openButton = new Button(this);
        openButton.setText("Open Free Form");
        openButton.setTextSize(14);
        openButton.setTextColor(textSecondary);
        openButton.setAllCaps(false);
        openButton.setBackground(null);
        LinearLayout.LayoutParams openParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48)
        );
        openButton.setOnClickListener(v -> openApp());
        col.addView(openButton, openParams);

        // ── Wrap col in a card ────────────────────────────────────────────────
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setShape(GradientDrawable.RECTANGLE);
        cardBg.setCornerRadius(dp(28));
        cardBg.setColor(bgCard);
        cardBg.setStroke(dp(1), bgCardBorder);

        FrameLayout card = new FrameLayout(this);
        card.setBackground(cardBg);
        card.addView(col);
        col.setPadding(px32, dp(40), px32, dp(32));

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.gravity = Gravity.CENTER_VERTICAL;
        cardParams.leftMargin = dp(20);
        cardParams.rightMargin = dp(20);

        root.addView(card, cardParams);

        setContentView(root);

        // Start the pulsing bell animation
        startPulseAnimation();
    }

    private void startPulseAnimation() {
        if (bellIcon == null) return;

        // Scale up slightly and back, repeatedly — like a real alarm ringing
        ObjectAnimator scaleX = ObjectAnimator.ofFloat(bellIcon, "scaleX", 1f, 1.15f, 1f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(bellIcon, "scaleY", 1f, 1.15f, 1f);
        scaleX.setDuration(700);
        scaleY.setDuration(700);
        scaleX.setRepeatCount(ObjectAnimator.INFINITE);
        scaleY.setRepeatCount(ObjectAnimator.INFINITE);
        scaleX.setInterpolator(new DecelerateInterpolator());
        scaleY.setInterpolator(new DecelerateInterpolator());

        // Slight rotation wobble like a real alarm bell
        ObjectAnimator rotate = ObjectAnimator.ofFloat(bellIcon, "rotation", 0f, -12f, 12f, -8f, 8f, 0f);
        rotate.setDuration(700);
        rotate.setRepeatCount(ObjectAnimator.INFINITE);

        AnimatorSet set = new AnimatorSet();
        set.playTogether(scaleX, scaleY, rotate);
        set.start();
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private void addSpacer(LinearLayout parent, int height) {
        View spacer = new View(this);
        parent.addView(spacer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, height
        ));
    }

    private void stopAlarm() {
        // Stop alarm audio & vibration
        AlarmSoundManager.stopAlarm(this, timerId);

        // Stop foreground countdown service
        TimerForegroundService.stopService(this);

        // Cancel both alarm and countdown notifications
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NativeAlarmReceiver.getAlarmNotificationId(timerId));
            nm.cancel(NativeAlarmReceiver.getCountdownNotificationId(timerId));
        }

        // Tell the JS bridge → dismissTimer → cross-device WebSocket broadcast
        NativeTimerPlugin.sendTimerActionEvent("stop", timerId);

        finish();
    }

    private void openApp() {
        // Stop the alarm first, then open the main app
        stopAlarm();
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("timerId", timerId);
        startActivity(intent);
    }

    @Override
    public void onBackPressed() {
        // Don't allow dismissing with back — user must tap Stop Alarm
        // Same behavior as Samsung Clock alarm
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
