import type * as THREE from 'three';

/**
 * Fully synthesized audio (no asset files): engine, guns, missiles,
 * explosions, lock tones and missile alerts via the Web Audio API.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private abGain!: GainNode;
  private gunGain!: GainNode;
  private gunFilter!: BiquadFilterNode;
  private toneOsc: OscillatorNode | null = null;
  private toneGain!: GainNode;
  private alertTimer = 0;
  private toneMode = 0;
  private toneTimer = 0;
  private gunHold = 0;
  private listener: THREE.Vector3 | null = null;
  volume = 0.7;
  enabled = false;

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = 0.97 * b + 0.03 * w; // slightly brown noise
      d[i] = w * 0.5 + b * 2.5;
    }

    // Engine: two detuned oscillators through a low-pass + noise rumble.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 600;
    this.engineGain.connect(this.engineFilter).connect(this.sfx);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    const og = ctx.createGain(); og.gain.value = 0.18;
    this.engineOsc.connect(og).connect(this.engineGain);
    const og2 = ctx.createGain(); og2.gain.value = 0.25;
    this.engineOsc2.connect(og2).connect(this.engineGain);
    this.engineOsc.start();
    this.engineOsc2.start();

    const rumble = this.loopNoise();
    const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
    this.abGain = ctx.createGain(); this.abGain.gain.value = 0;
    rumble.connect(rf).connect(this.abGain).connect(this.sfx);

    const wind = this.loopNoise();
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.sfx);

    const gun = this.loopNoise();
    this.gunFilter = ctx.createBiquadFilter(); this.gunFilter.type = 'bandpass'; this.gunFilter.frequency.value = 900; this.gunFilter.Q.value = 0.9;
    this.gunGain = ctx.createGain(); this.gunGain.gain.value = 0;
    gun.connect(this.gunFilter).connect(this.gunGain).connect(this.sfx);

    this.toneOsc = ctx.createOscillator();
    this.toneOsc.type = 'square';
    this.toneOsc.frequency.value = 1000;
    this.toneGain = ctx.createGain(); this.toneGain.gain.value = 0;
    const tf = ctx.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 2500;
    this.toneOsc.connect(tf).connect(this.toneGain).connect(this.master);
    this.toneOsc.start();
    this.enabled = true;
  }

  private loopNoise() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    src.start(0, Math.random() * 1.5);
    return src;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  setListener(p: THREE.Vector3) { this.listener = p; }

  private attenuation(pos?: THREE.Vector3) {
    if (!pos || !this.listener) return 1;
    const d = pos.distanceTo(this.listener);
    return Math.max(0, 1 / (1 + d / 400) - 0.03);
  }

  /** Called every frame for the player aircraft. */
  updateEngine(dt: number, throttle: number, speed: number, kind: 'JET' | 'PROP' | 'HELI', active: boolean) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const on = active ? 1 : 0;
    let f1: number, f2: number;
    if (kind === 'HELI') { f1 = 18 + throttle * 6; f2 = 36 + throttle * 10; }
    else if (kind === 'PROP') { f1 = 55 + throttle * 45; f2 = 110 + throttle * 90; }
    else { f1 = 70 + throttle * 90; f2 = 140 + throttle * 160; }
    this.engineOsc!.frequency.setTargetAtTime(f1, t, 0.1);
    this.engineOsc2!.frequency.setTargetAtTime(f2, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(300 + throttle * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(on * (0.35 + throttle * 0.3), t, 0.1);
    const ab = Math.max(0, (throttle - 0.85) / 0.15);
    this.abGain.gain.setTargetAtTime(on * (0.15 + ab * 0.55 + (kind === 'HELI' ? 0.3 : 0)), t, 0.1);
    this.windFilter.frequency.setTargetAtTime(400 + speed * 4, t, 0.1);
    this.windGain.gain.setTargetAtTime(on * Math.min(0.5, speed / 600), t, 0.1);

    this.gunHold -= dt;
    this.gunGain.gain.setTargetAtTime(on * (this.gunHold > 0 ? 0.9 : 0), t, 0.012);

    // Lock / missile alert tones.
    this.toneTimer -= dt;
    this.alertTimer -= dt;
    let freq = 0, gain = 0;
    if (this.alertTimer > 0) {
      // Fast high-pitched beeping.
      const phase = (t * 9) % 1;
      freq = 1450; gain = phase < 0.5 ? 0.16 : 0;
    } else if (this.toneMode === 1) {
      const phase = (t * 6) % 1;
      freq = 900; gain = phase < 0.35 ? 0.07 : 0;
    } else if (this.toneMode === 2) {
      freq = 1150; gain = 0.06;
    }
    if (!active) gain = 0;
    if (freq) this.toneOsc!.frequency.setValueAtTime(freq, t);
    this.toneGain.gain.setTargetAtTime(gain, t, 0.008);
  }

  gunTick() { this.gunHold = 0.07; }

  setLockTone(mode: number) { this.toneMode = mode; }

  missileAlert() { this.alertTimer = 0.25; }

  private burst(opts: { dur: number; freq: number; q?: number; gain: number; type?: BiquadFilterType; pos?: THREE.Vector3; sweep?: number }) {
    if (!this.ctx || !this.enabled) return;
    const att = this.attenuation(opts.pos);
    if (att <= 0.01) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.sweep), t + opts.dur);
    f.Q.value = opts.q ?? 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain * att, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  explosion(pos?: THREE.Vector3, scale = 1) {
    this.burst({ dur: 1.4 + scale * 0.4, freq: 900, sweep: 60, gain: 1.4 * Math.min(scale, 2), pos });
  }

  flak(pos: THREE.Vector3) {
    this.burst({ dur: 0.5, freq: 1200, sweep: 120, gain: 0.7, pos });
  }

  missileLaunch(own: boolean, pos?: THREE.Vector3) {
    this.burst({ dur: own ? 1.3 : 1.0, freq: 2400, sweep: 300, gain: own ? 0.7 : 0.5, type: 'bandpass', q: 0.5, pos: own ? undefined : pos });
  }

  flare() { this.burst({ dur: 0.35, freq: 3000, sweep: 800, gain: 0.35, type: 'highpass' }); }

  hitConfirm() { this.blip(1800, 0.05, 0.08); }

  playerHit() { this.burst({ dur: 0.25, freq: 2500, sweep: 400, gain: 0.6, type: 'bandpass', q: 1.2 }); }

  lockBeep() { this.blip(1300, 0.06, 0.08); }

  uiBlip() { this.blip(700, 0.05, 0.06); }

  uiDeny() { this.blip(220, 0.12, 0.08, 'sawtooth'); }

  private blip(freq: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [this.engineGain, this.abGain, this.windGain, this.gunGain, this.toneGain]) g.gain.setTargetAtTime(0, t, 0.05);
    this.toneMode = 0;
    this.alertTimer = 0;
  }
}
