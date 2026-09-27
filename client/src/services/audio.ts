// Browser Web Audio API Synthesizer for Synced Timer & Reminder Alarms
// Zero external audio files required, zero latency, 100% offline capable.

let alarmInterval: number | null = null;

export function startAlarmChime() {
  if (alarmInterval) return;

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Two-tone pleasant ascending alert chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // C6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now + 0.15); // E6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);

      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);

      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 500);
    } catch {
      // AudioContext may require initial user gesture; fails gracefully
    }
  };

  playChime();
  alarmInterval = window.setInterval(playChime, 900);
}

export function stopAlarmChime() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}
