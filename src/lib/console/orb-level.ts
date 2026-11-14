/** Microphone loudness for the listening orb, from an analyser's byte time-domain samples (128 is silence). */
export function micLevel(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const centred = (samples[i] - 128) / 128;
    sum += centred * centred;
  }
  const rms = Math.sqrt(sum / samples.length);
  // Speech sits around 0.02-0.2 RMS; stretch that range to 0..1.
  return Math.min(1, Math.max(0, (rms - 0.01) * 6));
}

/** Smooths a level over time with a 120 ms time constant, so the orb follows the voice without jitter. */
export function smoothLevel(previous: number, next: number, dtMs: number, timeConstantMs = 120): number {
  const keep = Math.exp(-Math.max(0, dtMs) / timeConstantMs);
  return next + (previous - next) * keep;
}
