import * as THREE from 'three';
import type { Aircraft } from './entities/Aircraft';
import type { Combatant, GameContext } from './core/context';
import type { Input } from './Input';
import type { Settings } from './data/types';
import { WEAPONS, type WeaponSpec } from './data/weapons';
import { steerToward, leadPoint } from './ai/steering';
import { clamp, DEG } from './core/utils';

const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Translates input into stick commands, and runs targeting / lock-on. */
export class PlayerController {
  weaponSlot: 'MSL' | 'SP' = 'MSL';
  target: Combatant | null = null;
  lockProgress = 0;
  locked = false;
  multiLocks: Combatant[] = [];
  private multiTimer = 0;
  aimDir = new THREE.Vector3(0, 0, -1);
  gunLead = new THREE.Vector3();
  gunLeadValid = false;
  /** Free-look offsets requested by the player (radians). */
  look = { yaw: 0, pitch: 0, back: false, target: false };
  private lookIdle = 0;
  /** Edge-triggered actions consumed by the engine. */
  actions = { camera: false, map: false, pause: false };
  firingGun = false;
  private mouseScale = 1;

  constructor(public ac: Aircraft) {
    ac.forward(this.aimDir);
  }

  get weapon(): WeaponSpec {
    return WEAPONS[this.weaponSlot === 'MSL' ? this.ac.spec.missile : this.ac.spec.special];
  }

  get ammo() { return this.weaponSlot === 'MSL' ? this.ac.missiles : this.ac.specialAmmo; }

  update(dt: number, ctx: GameContext, input: Input, settings: Settings, edges = true) {
    const ac = this.ac;
    const pressed = (code: string) => edges && input.pressed(code);
    const padPressed = (i: number) => edges && input.padPressed(i);
    this.mouseScale = edges ? 1 : 0;
    const c = ac.controls;
    const pad = !!input.pad;
    if (edges) {
      this.actions.camera = pressed('KeyV') || padPressed(8);
      this.actions.map = pressed('KeyM');
      this.actions.pause = pressed('Escape') || pressed('KeyP') || padPressed(9);
    }
    if (!ac.alive) return;

    // ------------------------------------------------------------ flight inputs
    const inv = settings.invertPitch ? -1 : 1;
    let pitch = input.keyAxis('KeyW', 'KeyS') * inv;
    let roll = input.keyAxis('KeyA', 'KeyD');
    let yaw = input.keyAxis('KeyQ', 'KeyE');
    if (pad) {
      pitch += input.axis(1) * inv;
      roll += input.axis(0);
      yaw += (input.padDown(5) ? 1 : 0) - (input.padDown(4) ? 1 : 0);
    }
    pitch = clamp(pitch, -1, 1); roll = clamp(roll, -1, 1); yaw = clamp(yaw, -1, 1);
    c.accel = input.down('ShiftLeft') || input.down('ShiftRight') || input.padValue(7) > 0.3;
    c.brake = input.down('Space') || input.padValue(6) > 0.3;

    if (settings.controlMode === 'MOUSE_AIM') {
      this.updateMouseAim(dt, input, settings, pitch, roll, yaw);
    } else {
      ac.forward(this.aimDir);
      if (settings.controlMode === 'STANDARD' && !ac.isHeli) this.assist(pitch, roll, yaw);
      else { c.pitch = pitch; c.roll = roll; c.yaw = yaw; }
      this.updateFreeLook(dt, input, settings);
    }
    this.look.back = input.down('KeyX') || input.padDown(10);
    this.look.target = input.down('KeyC') || input.padDown(11);

    // ------------------------------------------------------------ targeting
    if (pressed('Tab') || pressed('KeyT') || padPressed(1)) this.cycleTarget(ctx);
    if (!this.target || !this.target.alive || !this.target.targetable) {
      this.target = null;
      this.autoTarget(ctx);
    }
    if (pressed('KeyR') || padPressed(3)) {
      this.weaponSlot = this.weaponSlot === 'MSL' ? 'SP' : 'MSL';
      this.lockProgress = 0;
      this.multiLocks = [];
    }
    this.updateLock(dt, ctx);

    // ------------------------------------------------------------ weapons
    this.gunLeadValid = false;
    if (this.target) {
      const d = this.target.position.distanceTo(ac.position);
      if (d < 1500) {
        leadPoint(ac.position, ac.velocity, this.target.position, this.target.velocity, this.gunLead);
        this.gunLeadValid = true;
      }
    }
    this.firingGun = input.mouse[0] || input.down('KeyJ') || input.padDown(2);
    if (this.firingGun) {
      let aim: THREE.Vector3 | null = null;
      ac.forward(_fwd);
      if (ac.isHeli && settings.controlMode === 'MOUSE_AIM' && this.aimDir.dot(_fwd) > 0.5) aim = this.aimDir;
      if (this.gunLeadValid && settings.aimAssist) {
        _to.copy(this.gunLead).sub(ac.position).normalize();
        if (_to.dot(_fwd) > Math.cos(3.2 * DEG)) aim = _to;
      }
      if (ac.tryFireGun(ctx, aim ? _tmp.copy(aim) : null)) ctx.audio.gunTick();
    }
    if (pressed('Mouse2') || pressed('KeyK') || padPressed(0)) this.fireMissile(ctx);
    if (pressed('KeyF') || padPressed(13)) ac.deployFlares(ctx);
  }

  /** Ace Combat "Standard": A/D bank-and-turn, auto-level, gentle coordination. */
  private assist(pitch: number, roll: number, yaw: number) {
    const ac = this.ac, c = ac.controls;
    ac.forward(_fwd);
    if (Math.abs(_fwd.y) > 0.8) {
      c.pitch = pitch; c.roll = roll; c.yaw = yaw;
      return;
    }
    const bank = ac.bankAngle();
    let rollCmd = 0;
    if (roll !== 0) {
      rollCmd = clamp(wrapAngle(roll * 72 * DEG - bank) * 2.2, -1, 1);
    } else if (Math.abs(pitch) < 0.3) {
      rollCmd = clamp(-bank * 1.6, -1, 1); // auto-level (also rolls out of inverted)
    }
    c.roll = rollCmd;
    c.yaw = clamp(yaw + roll * 0.3, -1, 1);
    // Turn assist: pull enough to hold altitude through the bank (load factor 1/cos(bank)).
    let assist = 0;
    if (roll !== 0 && Math.cos(bank) > 0.2) {
      const loadPull = (1 / Math.max(Math.cos(bank), 0.34) - 1) * 0.42;
      const vsHold = (-ac.velocity.y / Math.max(ac.speed, 60)) * 4;
      assist = clamp(loadPull + vsHold, -0.2, 1) / Math.max(Math.cos(bank), 0.34) * 0.75;
    }
    c.pitch = clamp(pitch + assist * (pitch === 0 ? 1 : 0.4), -1, 1);
  }

  private updateMouseAim(dt: number, input: Input, settings: Settings, pitch: number, roll: number, yaw: number) {
    const ac = this.ac, c = ac.controls;
    const sens = 0.0022 * settings.mouseSensitivity;
    const inv = settings.invertPitch ? -1 : 1;
    let dx = input.mouseDX * sens * this.mouseScale, dy = input.mouseDY * sens * inv * this.mouseScale;
    if (input.pad) { dx += input.axis(2) * 2.2 * dt; dy += input.axis(3) * 2.2 * dt * inv; }
    _q.setFromAxisAngle(UP, -dx);
    this.aimDir.applyQuaternion(_q);
    _right.crossVectors(this.aimDir, UP).normalize();
    _q.setFromAxisAngle(_right, -dy);
    _tmp.copy(this.aimDir).applyQuaternion(_q);
    if (Math.abs(_tmp.y) < 0.97) this.aimDir.copy(_tmp);
    this.aimDir.normalize();

    if (ac.isHeli) {
      ac.forward(_fwd);
      const err = Math.atan2(
        _fwd.x * this.aimDir.z - _fwd.z * this.aimDir.x,
        _fwd.x * this.aimDir.x + _fwd.z * this.aimDir.z,
      );
      c.yaw = clamp(err * 2.5, -1, 1) + yaw;
      c.pitch = pitch;
      c.roll = roll;
    } else {
      steerToward(ac, this.aimDir, c, 1.1);
      // Keyboard still overrides for manual maneuvers.
      if (pitch !== 0) c.pitch = pitch;
      if (roll !== 0) c.roll = roll;
      if (yaw !== 0) c.yaw = yaw;
    }
    this.look.yaw = 0;
    this.look.pitch = 0;
  }

  private updateFreeLook(dt: number, input: Input, settings: Settings) {
    let ly = input.keyAxis('ArrowRight', 'ArrowLeft') * 2.2 * dt;
    let lp = input.keyAxis('ArrowDown', 'ArrowUp') * 1.6 * dt;
    if (input.pad) { ly -= input.axis(2) * 2.6 * dt; lp -= input.axis(3) * 2 * dt; }
    if (input.pointerLocked) {
      ly -= input.mouseDX * 0.003 * settings.mouseSensitivity * this.mouseScale;
      lp -= input.mouseDY * 0.003 * settings.mouseSensitivity * this.mouseScale;
    }
    if (ly !== 0 || lp !== 0) {
      this.lookIdle = 0;
      this.look.yaw = clamp(this.look.yaw + ly, -Math.PI * 0.95, Math.PI * 0.95);
      this.look.pitch = clamp(this.look.pitch + lp, -1.2, 1.3);
    } else {
      this.lookIdle += dt;
      if (this.lookIdle > 0.8) {
        const k = 1 - Math.exp(-4 * dt);
        this.look.yaw -= this.look.yaw * k;
        this.look.pitch -= this.look.pitch * k;
      }
    }
  }

  // ------------------------------------------------------------------ targeting

  private candidates(ctx: GameContext): Combatant[] {
    const out: Combatant[] = [];
    for (const list of [ctx.aircraft, ctx.ground] as Combatant[][]) {
      for (const t of list) {
        if (!t.alive || !t.targetable || t.team === this.ac.team) continue;
        if (t.position.distanceTo(this.ac.position) > 22000) continue;
        out.push(t);
      }
    }
    return out;
  }

  private priority(t: Combatant) {
    this.ac.forward(_fwd);
    _to.copy(t.position).sub(this.ac.position);
    const d = _to.length();
    const ang = Math.acos(clamp(_to.divideScalar(d).dot(_fwd), -1, 1));
    return ang * 5000 + d * (t.isAir ? 0.8 : 1) - (t.isMissionTarget ? 1500 : 0);
  }

  private autoTarget(ctx: GameContext) {
    let best: Combatant | null = null, bs = Infinity;
    for (const t of this.candidates(ctx)) {
      const p = this.priority(t);
      if (p < bs) { bs = p; best = t; }
    }
    if (best !== this.target) { this.lockProgress = 0; this.locked = false; }
    this.target = best;
  }

  private cycleTarget(ctx: GameContext) {
    const list = this.candidates(ctx).sort((a, b) => this.priority(a) - this.priority(b)).slice(0, 12);
    if (!list.length) { this.target = null; return; }
    const i = this.target ? list.indexOf(this.target) : -1;
    this.target = list[(i + 1) % list.length];
    this.lockProgress = 0;
    this.locked = false;
    ctx.audio.uiBlip();
  }

  canLock(t: Combatant, w: WeaponSpec, ctx: GameContext): boolean {
    if (!w.guided) return false;
    if (t.isAir ? !w.air : !w.ground) return false;
    const ac = this.ac;
    _to.copy(t.position).sub(ac.position);
    const d = _to.length();
    if (d > w.lockRange) return false;
    ac.forward(_fwd);
    if (w.drop) {
      // Bombs: target must be ahead and below.
      _to.divideScalar(d);
      if (_to.y > -0.05 || _to.dot(_fwd) < Math.cos(w.lockCone * DEG)) return false;
    } else if (_to.divideScalar(d).dot(_fwd) < Math.cos(w.lockCone * DEG)) return false;
    return ctx.terrain.lineOfSight(ac.position, t.position, 12);
  }

  private updateLock(dt: number, ctx: GameContext) {
    const w = this.weapon;
    const prevLocked = this.locked;
    if (w.multiLock > 1) {
      this.multiLocks = this.multiLocks.filter((t) => t.alive && t.targetable && this.canLock(t, w, ctx));
      this.multiTimer += dt;
      if (this.multiLocks.length < w.multiLock && this.multiTimer >= w.lockTime) {
        const pool = this.candidates(ctx)
          .filter((t) => !this.multiLocks.includes(t) && this.canLock(t, w, ctx))
          .sort((a, b) => (a === this.target ? -1 : b === this.target ? 1 : this.priority(a) - this.priority(b)));
        if (pool.length) {
          this.multiLocks.push(pool[0]);
          this.multiTimer = 0;
          ctx.audio.lockBeep();
        }
      }
      this.locked = this.multiLocks.length > 0;
      this.lockProgress = this.locked ? 1 : clamp(this.multiTimer / w.lockTime, 0, 1);
    } else {
      this.multiLocks = [];
      if (this.target && this.canLock(this.target, w, ctx)) {
        this.lockProgress = Math.min(1, this.lockProgress + dt / w.lockTime);
      } else {
        this.lockProgress = Math.max(0, this.lockProgress - dt * 3);
      }
      this.locked = this.lockProgress >= 1;
    }
    if (this.locked && !prevLocked && w.multiLock <= 1) ctx.audio.lockBeep();
    ctx.audio.setLockTone(this.lockProgress > 0 && !this.locked ? 1 : this.locked ? 2 : 0);
  }

  private fireMissile(ctx: GameContext) {
    const w = this.weapon;
    const id = w.id;
    let targets: (Combatant | null)[] = [];
    if (w.multiLock > 1) targets = this.multiLocks.length ? [...this.multiLocks] : [null];
    else targets = [this.locked ? this.target : null];
    if (this.ac.tryFireMissile(ctx, id, targets)) {
      if (w.multiLock > 1) { this.multiLocks = []; this.multiTimer = 0; }
    } else if (this.ammo <= 0) {
      ctx.audio.uiDeny();
    }
  }
}
