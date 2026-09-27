package io.freeform.notes;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

public class AlarmSoundManager {
    private static final String TAG = "AlarmSoundManager";
    private static MediaPlayer mediaPlayer = null;
    private static Vibrator vibrator = null;
    private static String activeTimerId = null;

    public static synchronized void playAlarm(Context context, String timerId) {
        stopAll(context);
        activeTimerId = timerId;

        try {
            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            if (alertUri == null) {
                alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(context, alertUri);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "Failed to play alarm media player", e);
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) {
                    vibrator = vm.getDefaultVibrator();
                }
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 600, 300, 600, 300, 800, 400};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0)); // 0 = repeat from beginning
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to start vibration", e);
        }
    }

    public static synchronized void stopAlarm(Context context, String timerId) {
        if (activeTimerId == null || activeTimerId.equals(timerId) || timerId == null) {
            stopAll(context);
        }
    }

    public static synchronized void stopAll(Context context) {
        activeTimerId = null;
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping media player", e);
            }
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping vibrator", e);
            }
            vibrator = null;
        }
    }
}
