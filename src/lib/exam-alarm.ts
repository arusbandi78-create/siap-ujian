// Browser-generated audio works offline without downloading an audio asset.
export const ALARM_DURATION_SECONDS = 6;
const ALARM_GAIN = 0.3;
let context: AudioContext | undefined;
let siren: OscillatorNode | undefined;

/** Called directly by the start button to unlock browser audio playback. */
export function prepareExamAlarm() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch { /* Audio is optional; exam enforcement must still work. */ }
}

export function stopExamAlarm() {
  const current = siren;
  siren = undefined;
  try { current?.stop(); } catch { /* Already stopped. */ }
}

export function playExamAlarm() {
  if (!context || context.state === "closed" || siren) return;
  try {
    void context.resume().catch(() => {});
    const audio = context;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(650, start);
    // Alternating rising/falling police wail, with a brief fade at both ends.
    for (let step = 1; step <= ALARM_DURATION_SECONDS * 2; step++) {
      oscillator.frequency.linearRampToValueAtTime(step % 2 ? 1400 : 650, start + step / 2);
    }
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.08);
    // Escalate the app signal, never attempt to override system volume/mute.
    gain.gain.linearRampToValueAtTime(ALARM_GAIN, start + 3);
    gain.gain.setValueAtTime(ALARM_GAIN, start + ALARM_DURATION_SECONDS - 0.15);
    gain.gain.linearRampToValueAtTime(0, start + ALARM_DURATION_SECONDS);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    siren = oscillator;
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      if (siren === oscillator) siren = undefined;
    };
    oscillator.start(start);
    oscillator.stop(start + ALARM_DURATION_SECONDS);
  } catch { stopExamAlarm(); }
}

export function releaseExamAlarm() {
  stopExamAlarm();
  const audio = context;
  context = undefined;
  if (audio && audio.state !== "closed") void audio.close().catch(() => {});
}