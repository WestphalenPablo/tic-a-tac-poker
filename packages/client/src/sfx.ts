/** Tiny synthesized sound effects (no asset files). Silent if audio is unavailable or blocked. */

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** Card flip: a short filtered noise burst with a fast decay. */
export function playFlip() {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.09);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = 'bandpass'; band.frequency.value = 2200; band.Q.value = 0.8;
  const gain = a.createGain();
  gain.gain.value = 0.5;
  src.connect(band).connect(gain).connect(a.destination);
  src.start();
}

/** Winner reveal: two quick rising notes. */
export function playWin() {
  const a = audio();
  if (!a) return;
  [660, 880].forEach((f, i) => {
    const t0 = a.currentTime + i * 0.12;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'triangle'; osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(g).connect(a.destination);
    osc.start(t0); osc.stop(t0 + 0.32);
  });
}

/** Tie: one low blip. */
export function playTie() {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = 'sine'; osc.frequency.value = 280;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
  osc.connect(g).connect(a.destination);
  osc.start(t0); osc.stop(t0 + 0.27);
}
