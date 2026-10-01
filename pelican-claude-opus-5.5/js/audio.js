/** Tiny synthesized sound kit: no audio files needed. */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._ambient();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) {
      if (on) this.ctx.resume(); else this.ctx.suspend();
    }
  }

  _env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  _ambient() {
    // gentle wind + surf bed whose loudness follows riding speed
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.0;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.wind = { lp, g };
  }

  setWind(speed) {
    if (!this.wind) return;
    const t = this.ctx.currentTime;
    this.wind.g.gain.setTargetAtTime(0.012 + Math.min(speed, 14) * 0.004, t, 0.3);
    this.wind.lp.frequency.setTargetAtTime(350 + speed * 70, t, 0.3);
  }

  bell() {
    const c = this.ensure(); if (!c) return;
    const t0 = c.currentTime;
    for (const dt of [0, 0.17]) {
      const t = t0 + dt;
      [[1, 1], [2.02, 0.35], [2.76, 0.4], [5.4, 0.12]].forEach(([r, a]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 2100 * r;
        this._env(g, t, 0.003, 0.22 * a, 1.1 / Math.sqrt(r));
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 1.3);
      });
    }
  }

  honk() {
    const c = this.ensure(); if (!c) return;
    const t0 = c.currentTime;
    for (const [dt, f] of [[0, 330], [0.24, 290]]) {
      const t = t0 + dt;
      const o1 = c.createOscillator(), o2 = c.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'square';
      o1.frequency.setValueAtTime(f, t); o1.frequency.exponentialRampToValueAtTime(f * 0.78, t + 0.2);
      o2.frequency.setValueAtTime(f * 1.01, t); o2.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.2);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.6;
      const g = c.createGain();
      this._env(g, t, 0.02, 0.35, 0.2);
      o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(this.master);
      o1.start(t); o2.start(t); o1.stop(t + 0.3); o2.stop(t + 0.3);
    }
  }

  gulp(golden) {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.16);
    this._env(g, t, 0.01, 0.4, 0.17);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.25);
    const notes = golden ? [784, 988, 1175, 1568] : [880, 1320];
    notes.forEach((f, i) => {
      const tt = t + 0.12 + i * 0.07;
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = 'triangle'; o2.frequency.value = f;
      this._env(g2, tt, 0.005, 0.16, 0.22);
      o2.connect(g2); g2.connect(this.master); o2.start(tt); o2.stop(tt + 0.3);
    });
  }

  whoosh() {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2200, t + 0.25);
    const g = c.createGain(); this._env(g, t, 0.05, 0.35, 0.3);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.45);
  }

  thud() {
    const c = this.ensure(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    this._env(g, t, 0.005, 0.6, 0.2);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.3);
    // spring "boing"
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(260, t); o2.frequency.exponentialRampToValueAtTime(520, t + 0.08); o2.frequency.exponentialRampToValueAtTime(300, t + 0.25);
    this._env(g2, t, 0.005, 0.12, 0.25);
    o2.connect(g2); g2.connect(this.master); o2.start(t); o2.stop(t + 0.35);
  }

  fanfare() {
    const c = this.ensure(); if (!c) return;
    const t0 = c.currentTime;
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]].forEach(([f, dt]) => {
      const t = t0 + dt;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      this._env(g, t, 0.01, 0.12, dt > 0.6 ? 0.6 : 0.16);
      o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.9);
    });
  }
}
