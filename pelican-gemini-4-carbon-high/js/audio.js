/**
 * 100% Procedural Web Audio API Soundscape & Foley Synthesizer
 * Zero external audio files. Designed for mobile browser touch-unlock compliance.
 */

export function createAudioEngine() {
  let ctx = null;
  let enabled = true;
  let surfGain = null;
  let tickAccumulator = 0;

  function unlock() {
    if (!enabled) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      setupOceanSurfBed();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function getReadyContext() {
    if (!enabled || !ctx || ctx.state === 'closed') return null;
    return ctx;
  }

  function setupOceanSurfBed() {
    if (!ctx) return;
    // Create 3-second looping pink-ish noise buffer for gentle coastal waves & breeze
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 0.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.08;
      // Crossfade loop seam
      if (i < 2000) data[i] *= i / 2000;
      if (i > length - 2000) data[i] *= (length - i) / 2000;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    // Slow LFO modulating wave swell filter & volume
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.16; // ~6s ocean wave period
    const lfoFilterGain = ctx.createGain();
    lfoFilterGain.gain.value = 220;
    lfo.connect(lfoFilterGain);
    lfoFilterGain.connect(filter.frequency);

    surfGain = ctx.createGain();
    surfGain.gain.value = 0.055;

    noise.connect(filter);
    filter.connect(surfGain);
    surfGain.connect(ctx.destination);

    noise.start();
    lfo.start();
  }

  /**
   * Classic dual-strike brass bicycle bell ("Ding-ding!")
   */
  function playBell() {
    const ac = getReadyContext();
    if (!ac) return;

    const now = ac.currentTime;
    const strikes = [0, 0.095];
    // Metallic bell partials
    const ratios = [1.0, 2.74, 5.18];
    const baseFreq = 1568; // G6 bright brass bell

    for (const offset of strikes) {
      const t0 = now + offset;
      for (let i = 0; i < ratios.length; i++) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq * ratios[i], t0);

        const amp = (0.14 / (i + 1)) * (offset > 0 ? 1.15 : 0.9);
        const decay = 0.95 / (1 + i * 0.7);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(amp, t0 + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + decay + 0.02);
      }
    }
  }

  /**
   * Comical joyful pelican honk / gulp when catching fish or cheering!
   */
  function playPelicanGulp(isFishCatch = true) {
    const ac = getReadyContext();
    if (!ac) return;
    const now = ac.currentTime;

    // 1) Playful nasal honk (sawtooth through formant bandpass)
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isFishCatch ? 235 : 265, now);
    osc.frequency.exponentialRampToValueAtTime(isFishCatch ? 340 : 210, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(185, now + 0.28);

    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(680, now);
    bp.Q.value = 3.2;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.30);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.32);

    // 2) Satisfying "bloop-gulp!" pitch drop on swallow
    if (isFishCatch) {
      const gulpOsc = ac.createOscillator();
      const gulpGain = ac.createGain();
      gulpOsc.type = 'sine';
      gulpOsc.frequency.setValueAtTime(520, now + 0.18);
      gulpOsc.frequency.exponentialRampToValueAtTime(140, now + 0.34);

      gulpGain.gain.setValueAtTime(0.001, now + 0.18);
      gulpGain.gain.linearRampToValueAtTime(0.13, now + 0.20);
      gulpGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.36);

      gulpOsc.connect(gulpGain);
      gulpGain.connect(ac.destination);
      gulpOsc.start(now + 0.18);
      gulpOsc.stop(now + 0.38);
    }
  }

  /**
   * Fish launch splash / bunny-hop spring boing
   */
  function playHopOrToss(type = 'hop') {
    const ac = getReadyContext();
    if (!ac) return;
    const now = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    if (type === 'hop') {
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.18);
    } else {
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.20);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Subtle bicycle freehub mechanical click synced to wheel rotation!
   */
  function updateMechanicalTicks(dWheel, coasting) {
    if (!ctx || ctx.state !== 'running' || !enabled) return;
    tickAccumulator += Math.abs(dWheel);
    const step = coasting ? 0.22 : 0.55; // clicks more rapidly when freewheeling!
    if (tickAccumulator >= step) {
      tickAccumulator %= step;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(coasting ? 2600 : 1850, now);
      gain.gain.setValueAtTime(coasting ? 0.018 : 0.007, now);
      gain.gain.exponentialRampToValueAtTime(0.0002, now + 0.014);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.016);
    }
  }

  function setEnabled(flag) {
    enabled = flag;
    if (!ctx && enabled) {
      unlock();
      return enabled;
    }
    if (ctx && surfGain) {
      surfGain.gain.setTargetAtTime(enabled ? 0.055 : 0.0, ctx.currentTime, 0.08);
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  return {
    unlock,
    isEnabled: () => enabled,
    toggle,
    playBell,
    playPelicanGulp,
    playHopOrToss,
    updateMechanicalTicks
  };
}
