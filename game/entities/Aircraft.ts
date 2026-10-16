import * as THREE from 'three';
import { AIRCRAFT, type AircraftId, type AircraftSpec } from '../data/aircraft';
import { WEAPONS, BULLET_SPEED, BULLET_LIFE, type WeaponId } from '../data/weapons';
import type { Team } from '../data/types';
import type { Combatant, GameContext } from '../core/context';
import { createAircraftModel, type AircraftModel } from '../models/AircraftModels';
import { G, clamp, damp, moveTowards, smoothstep, rand, nextId, DEG } from '../core/utils';
import type { PilotAI } from '../ai/PilotAI';

export interface Controls {
  pitch: number; // +1 nose up
  roll: number; // +1 roll right
  yaw: number; // +1 nose right
  accel: boolean;
  brake: boolean;
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _vdir = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

let flameAlpha: THREE.CanvasTexture | null = null;
const flameAlphaMap = () => {
  if (flameAlpha) return flameAlpha;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 64, 0, 0); // bottom = nozzle, top = tip
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.35, '#999');
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 64);
  return (flameAlpha = new THREE.CanvasTexture(c));
};

const flameMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffb066').multiplyScalar(3),
    alphaMap: flameAlphaMap(),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

export class Aircraft implements Combatant {
  readonly id = nextId('ac');
  readonly spec: AircraftSpec;
  readonly model: AircraftModel;
  readonly isAir = true;
  name: string;
  team: Team;
  isPlayer = false;
  isMissionTarget = false;
  targetable = true;
  score = 100;

  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  quaternion = new THREE.Quaternion();
  angVel = new THREE.Vector3();
  controls: Controls = { pitch: 0, roll: 0, yaw: 0, accel: false, brake: false };

  throttle = 0.62;
  airbrake = 0;
  psm = 0;
  gForce = 1;
  aoa = 0;
  speed = 0;
  altitude = 0;
  stalled = false;
  landed = false;

  hp: number;
  maxHp: number;
  radius: number;
  alive = true;
  /** Seconds the wreck keeps falling after being shot down. */
  wreckTimer = 0;
  removed = false;
  hitFlash = 0;
  lastAttacker: Aircraft | null = null;

  gunAmmo: number;
  missiles: number;
  specialAmmo: number;
  flares: number;
  flareTimer = 0;
  flareCooldown = 0;
  flareDeployId = 0;
  private gunCooldown = 0;
  private gunSide = 1;
  private railReady: number[] = [0, 0];
  private specialReady = 0;
  private railSide = 0;
  private salvo: { id: WeaponId; left: number; timer: number; target: Combatant | null } | null = null;

  // Helicopter attitude state.
  private heliYaw = 0;
  private heliPitch = 0;
  private heliRoll = 0;

  ai: PilotAI | null = null;
  stats = { shots: 0, hits: 0 };

  private flames: THREE.Mesh[] = [];
  private vaporTimer = 0;
  private smokeTimer = 0;

  constructor(id: AircraftId, team: Team, name: string) {
    this.spec = AIRCRAFT[id];
    this.team = team;
    this.name = name;
    this.hp = this.maxHp = this.spec.hp;
    this.radius = this.spec.hitRadius;
    this.gunAmmo = this.spec.gun.ammo;
    this.missiles = this.spec.missiles;
    this.specialAmmo = this.spec.specialAmmo;
    this.flares = this.spec.flares;
    this.model = createAircraftModel(id, team);
    this.score = this.spec.role === 'BOMBER' ? 150 : id === 'SU57' ? 400 : this.spec.role === 'ATTACKER' ? 120 : 100;

    for (const n of this.model.nozzles) {
      const geo = new THREE.ConeGeometry(n.radius, n.radius * 7, 12, 1, true);
      geo.rotateX(Math.PI / 2); // tip points toward +Z (aft)
      geo.translate(0, 0, n.radius * 3.5);
      const flame = new THREE.Mesh(geo, flameMaterial());
      flame.position.copy(n.pos);
      flame.frustumCulled = false;
      this.model.root.add(flame);
      this.flames.push(flame);
    }
  }

  get isHeli() { return this.spec.kind === 'HELI'; }

  spawn(pos: THREE.Vector3, heading: number, speed: number) {
    this.position.copy(pos);
    this.quaternion.setFromEuler(new THREE.Euler(0, heading, 0, 'YXZ'));
    this.heliYaw = heading;
    this.heliPitch = this.heliRoll = 0;
    _fwd.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.velocity.copy(_fwd).multiplyScalar(speed);
    this.speed = speed;
    this.syncModel();
  }

  forward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.quaternion); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.quaternion); }
  right(out = new THREE.Vector3()) { return out.set(1, 0, 0).applyQuaternion(this.quaternion); }

  /** Bank angle relative to the horizon (rad, + = right wing down). */
  bankAngle(): number {
    this.right(_right);
    this.up(_up);
    return Math.atan2(-_right.y, _up.y);
  }

  // ======================================================================= update

  update(dt: number, ctx: GameContext) {
    if (!this.alive) {
      this.updateWreck(dt, ctx);
      return;
    }
    if (this.isHeli) this.updateHeli(dt, ctx);
    else this.updatePlane(dt);

    this.gunCooldown -= dt;
    this.flareCooldown -= dt;
    this.flareTimer -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.updateSalvo(dt, ctx);
    this.checkCollision(ctx);
    if (this.alive) this.updateVisuals(dt, ctx);
  }

  private updatePlane(dt: number) {
    const s = this.spec, c = this.controls;
    const q = this.quaternion;
    _fwd.set(0, 0, -1).applyQuaternion(q);
    _up.set(0, 1, 0).applyQuaternion(q);
    let speed = this.velocity.length();

    // --- Throttle (Ace Combat style: returns to cruise when released) ---
    const highG = c.accel && c.brake;
    const target = highG ? 0.7 : c.accel ? 1 : c.brake ? 0.12 : 0.62;
    this.throttle = moveTowards(this.throttle, target, dt * (target > this.throttle ? 0.9 : 1.4));
    this.airbrake += ((c.brake && !c.accel ? 1 : 0) - this.airbrake) * damp(5, dt);
    const psmTarget = highG && Math.abs(c.pitch) > 0.25 ? 1 : 0;
    this.psm += (psmTarget - this.psm) * damp(6, dt);

    // --- Rotational dynamics ---
    const auth = clamp((speed - s.stallSpeed * 0.4) / (s.cornerSpeed - s.stallSpeed * 0.4), 0.12, 1);
    const gRate = (s.maxG * G * 1.7) / Math.max(speed, 30);
    let maxPitch = Math.min(s.pitchRate * auth, gRate);
    // Post-stall / high-G turn: ignore the G limit, but cap the pitch rate (~125 deg/s).
    maxPitch += (Math.min(s.pitchRate * s.psm, 2.2) * Math.max(auth, 0.5) - maxPitch) * this.psm;
    const pitchCmd = c.pitch < 0 ? c.pitch * 0.65 : c.pitch;
    _tmp.set(
      pitchCmd * maxPitch,
      -c.yaw * s.yawRate * clamp(auth, 0.35, 1) * (1 + this.psm),
      -c.roll * s.rollRate * clamp(auth, 0.25, 1),
    );
    this.angVel.lerp(_tmp, damp(s.response, dt));
    const w = this.angVel.length();
    if (w > 1e-6) {
      _q.setFromAxisAngle(_tmp2.copy(this.angVel).divideScalar(w), w * dt);
      q.multiply(_q).normalize();
    }

    // --- Stall: the nose falls toward the flight path / ground ---
    const stallF = smoothstep(s.stallSpeed * 1.05, s.stallSpeed * 0.65, speed) * (1 - this.psm * 0.7);
    this.stalled = stallF > 0.35;
    _fwd.set(0, 0, -1).applyQuaternion(q);
    if (stallF > 0.01) {
      _vdir.copy(this.velocity).normalize().add(_tmp.set(0, -0.8 * stallF, 0)).normalize();
      const ang = _fwd.angleTo(_vdir);
      if (ang > 1e-4) {
        _tmp.crossVectors(_fwd, _vdir).normalize();
        _q.setFromAxisAngle(_tmp, Math.min(ang, 1.4 * stallF * dt));
        q.premultiply(_q).normalize();
        _fwd.set(0, 0, -1).applyQuaternion(q);
      }
    }

    // --- Translational dynamics ---
    if (speed < 1) _vdir.copy(_fwd); else _vdir.copy(this.velocity).divideScalar(speed);
    const oldDir = _tmp2.copy(_vdir);
    const liftF = clamp((speed - s.stallSpeed * 0.7) / (s.stallSpeed * 0.5), 0, 1);
    const align = s.liftAlign * liftF * (1 - this.psm * 0.7);
    _vdir.lerp(_fwd, damp(align, dt)).normalize();
    const turn = oldDir.angleTo(_vdir) / Math.max(dt, 1e-4);
    const gTurn = (turn * speed) / G;

    const thr = this.throttle <= 0.85
      ? (this.throttle / 0.85) * s.milAccel
      : s.milAccel + ((this.throttle - 0.85) / 0.15) * (s.abAccel - s.milAccel);
    const k = s.abAccel / (s.maxSpeed * s.maxSpeed);
    const parasitic = k * speed * speed * (1 + this.airbrake * 1.8);
    const induced = s.turnBleed * Math.pow(clamp(gTurn / (s.maxG * 1.7), 0, 1.5), 2) + this.psm * 30;
    const along = thr * Math.max(0, _fwd.dot(_vdir)) - parasitic - induced - G * _vdir.y;
    speed = clamp(speed + along * dt, 0, s.maxSpeed * 1.3);

    this.velocity.copy(_vdir).multiplyScalar(speed);
    // Gravity component the wing can no longer support.
    _tmp.set(0, -G, 0).addScaledVector(_vdir, G * _vdir.y);
    this.velocity.addScaledVector(_tmp, (1 - liftF) * dt);
    this.position.addScaledVector(this.velocity, dt);

    this.speed = this.velocity.length();
    const gNow = gTurn / 1.7 + _up.y;
    this.gForce += (gNow - this.gForce) * damp(6, dt);
    this.aoa = this.speed > 1 ? _fwd.angleTo(_tmp.copy(this.velocity).normalize()) / DEG : 0;
  }

  private updateHeli(dt: number, ctx: GameContext) {
    const s = this.spec, c = this.controls;
    const collectiveTarget = c.accel && !c.brake ? 1 : c.brake && !c.accel ? 0 : 0.5;
    this.throttle = moveTowards(this.throttle, collectiveTarget, dt * 1.6);

    const hspeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.heliYaw += (-c.yaw * s.yawRate - Math.sin(this.heliRoll) * clamp(hspeed / 40, 0, 1) * 0.9) * dt;
    const tp = c.pitch * 0.5;
    const tr = -c.roll * 0.6;
    this.heliPitch += (tp - this.heliPitch) * damp(2.6, dt);
    this.heliRoll += (tr - this.heliRoll) * damp(3, dt);
    _e.set(this.heliPitch, this.heliYaw, this.heliRoll, 'YXZ');
    this.quaternion.setFromEuler(_e);

    _up.set(0, 1, 0).applyQuaternion(this.quaternion);
    // Collective with automatic tilt compensation so neutral collective holds altitude.
    const lift = (G * (0.55 + 0.9 * this.throttle)) / Math.max(0.75, _up.y);
    _tmp.copy(_up).multiplyScalar(lift);
    _tmp.y -= G;
    const v = this.velocity.length();
    _tmp.addScaledVector(this.velocity, -(0.00055 * v + 0.03));
    _tmp.y -= this.velocity.y * 0.35;
    this.velocity.addScaledVector(_tmp, dt);
    if (this.velocity.length() > s.maxSpeed) this.velocity.setLength(s.maxSpeed);
    this.position.addScaledVector(this.velocity, dt);
    this.speed = this.velocity.length();
    this.gForce = 1 + _tmp.length() / G * 0.1;
    this.aoa = 0;
    this.stalled = false;

    // Landing / skid contact.
    const ground = ctx.terrain.getSurface(this.position.x, this.position.z);
    const alt = this.position.y - ground;
    this.landed = false;
    if (alt < 1.4) {
      const gentle = this.velocity.y > -9 && _up.y > 0.8 && hspeed < 22 && ctx.terrain.getHeight(this.position.x, this.position.z) > 0;
      if (gentle) {
        this.position.y = ground + 1.4;
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.velocity.x *= 1 - damp(3, dt);
        this.velocity.z *= 1 - damp(3, dt);
        this.landed = true;
      }
    }
  }

  private checkCollision(ctx: GameContext) {
    const ground = ctx.terrain.getSurface(this.position.x, this.position.z);
    this.altitude = this.position.y - ground;
    if (this.landed) return;
    if (this.altitude < 0.8) {
      this.position.y = ground + 0.5;
      this.crash(ctx, ground <= 0.01 && ctx.terrain.getHeight(this.position.x, this.position.z) < 0);
      return;
    }
    // Structures.
    if (this.altitude < 80) {
      for (const g of ctx.ground) {
        const dx = this.position.x - g.position.x, dz = this.position.z - g.position.z;
        const r = g.radius * 0.8;
        if (dx * dx + dz * dz < r * r && this.position.y < g.position.y + g.height) {
          this.crash(ctx, false);
          return;
        }
      }
    }
  }

  private crash(ctx: GameContext, water: boolean) {
    this.hp = 0;
    ctx.effects.groundImpact(this.position, water, 6);
    this.destroy(ctx, null);
    this.wreckTimer = 0;
    this.model.root.visible = false;
    this.removed = true;
  }

  private updateWreck(dt: number, ctx: GameContext) {
    if (this.removed) return;
    this.wreckTimer -= dt;
    this.velocity.y -= G * dt;
    this.velocity.multiplyScalar(1 - 0.15 * dt);
    this.position.addScaledVector(this.velocity, dt);
    _q.setFromAxisAngle(_tmp.set(0.3, 0.2, 1).normalize(), 2.2 * dt);
    this.quaternion.multiply(_q);
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.03;
      ctx.effects.damageSmoke(this.position, this.velocity, true);
    }
    const ground = ctx.terrain.getSurface(this.position.x, this.position.z);
    if (this.position.y <= ground + 1 || this.wreckTimer <= 0) {
      ctx.effects.explosion(this.position, 1.6);
      ctx.effects.groundImpact(this.position, ground <= 0.01, 5);
      if (ground > 0.01) ctx.effects.addFire(this.position.setY(ground), 0.6, 25);
      this.removed = true;
      this.model.root.visible = false;
    }
    this.syncModel();
  }

  private updateVisuals(dt: number, ctx: GameContext) {
    this.syncModel();
    const ab = clamp((this.throttle - 0.8) / 0.2, 0, 1);
    for (const f of this.flames) {
      const flicker = 0.85 + Math.random() * 0.3;
      f.visible = ab > 0.02 || this.throttle > 0.5;
      f.scale.set(0.85 + ab * 0.15, 0.85 + ab * 0.15, (0.12 + ab * 1.15) * flicker);
      (f.material as THREE.MeshBasicMaterial).opacity = 0.15 + ab * 0.6;
      (f.material as THREE.MeshBasicMaterial).color.setRGB(0.7 + ab * 2.8, 0.55 + ab * 1.2, 0.9 - ab * 0.5);
    }
    for (const p of this.model.props) p.rotation.z += dt * (30 + this.throttle * 40);
    for (const r of this.model.rotors) r.rotation.y += dt * 28;
    for (const r of this.model.tailRotors) r.rotation.x += dt * 50;

    // Wingtip vapour at high G — sells the maneuver.
    const vaporStrength = smoothstep(4.5, 8, this.gForce) + this.psm * 0.8;
    this.vaporTimer -= dt;
    if (vaporStrength > 0.05 && this.vaporTimer <= 0 && !this.isHeli) {
      this.vaporTimer = 0.02;
      for (const tip of this.model.wingtips) {
        _tmp.copy(tip).applyQuaternion(this.quaternion).add(this.position);
        ctx.effects.vapor(_tmp, this.velocity, Math.min(1, vaporStrength));
      }
    }
    // Damage smoke and fire.
    const dmg = 1 - this.hp / this.maxHp;
    if (dmg > 0.5) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = dmg > 0.75 ? 0.04 : 0.08;
        _tmp.set(0, 0.5, this.model.length * 0.25).applyQuaternion(this.quaternion).add(this.position);
        ctx.effects.damageSmoke(_tmp, this.velocity, dmg > 0.75);
      }
    }
  }

  syncModel() {
    this.model.root.position.copy(this.position);
    this.model.root.quaternion.copy(this.quaternion);
  }

  // ======================================================================= weapons

  muzzleWorld(out: THREE.Vector3) {
    out.copy(this.model.muzzle);
    if (this.spec.id === 'SPITFIRE' || this.spec.id === 'F14') out.x *= this.gunSide;
    return out.applyQuaternion(this.quaternion).add(this.position);
  }

  tryFireGun(ctx: GameContext, aimDir: THREE.Vector3 | null, damageScale = 1): boolean {
    if (this.gunAmmo <= 0 || this.gunCooldown > 0) return false;
    const g = this.spec.gun;
    this.gunCooldown += 1 / g.rate;
    if (this.gunCooldown < 0) this.gunCooldown = 0;
    this.gunSide *= -1;
    const pos = this.muzzleWorld(_tmp);
    const dir = aimDir ? _tmp2.copy(aimDir) : this.forward(_tmp2);
    dir.x += rand(-g.spread, g.spread);
    dir.y += rand(-g.spread, g.spread);
    dir.z += rand(-g.spread, g.spread);
    dir.normalize();
    const vel = dir.multiplyScalar(BULLET_SPEED).add(this.velocity);
    ctx.bullets.fire(this, this.team, pos, vel, g.damage * damageScale, BULLET_LIFE, this.isPlayer);
    this.gunAmmo--;
    if (this.isPlayer) this.stats.shots++;
    if (Math.random() < 0.5) ctx.effects.muzzle(pos);
    return true;
  }

  /** Seconds until the given weapon can fire again (0 = ready). */
  weaponReadyIn(id: WeaponId, time: number) {
    const spec = WEAPONS[id];
    if (id === this.spec.special && id !== this.spec.missile) return Math.max(0, this.specialReady - time);
    if (spec.rails <= 1) return Math.max(0, this.railReady[0] - time);
    return Math.max(0, Math.min(this.railReady[0], this.railReady[1]) - time);
  }

  tryFireMissile(ctx: GameContext, id: WeaponId, targets: (Combatant | null)[]): boolean {
    const spec = WEAPONS[id];
    const isSpecial = id === this.spec.special && id !== this.spec.missile;
    const ammo = isSpecial ? this.specialAmmo : this.missiles;
    if (ammo <= 0) return false;
    if (isSpecial) {
      if (this.specialReady > ctx.time) return false;
      this.specialReady = ctx.time + spec.reload;
    } else {
      let rail = -1;
      for (let i = 0; i < (spec.rails || 1); i++) if (this.railReady[i] <= ctx.time) { rail = i; break; }
      if (rail < 0) return false;
      this.railReady[rail] = ctx.time + spec.reload;
    }

    if (spec.salvo > 1) {
      const n = Math.min(spec.salvo, ammo);
      this.salvo = { id, left: n, timer: 0, target: targets[0] ?? null };
      if (isSpecial) this.specialAmmo -= n; else this.missiles -= n;
      this.updateSalvo(0, ctx);
      return true;
    }

    const list = targets.length ? targets : [null];
    const n = Math.min(list.length, ammo);
    for (let i = 0; i < n; i++) this.launchOne(ctx, id, list[i]);
    if (isSpecial) this.specialAmmo -= n; else this.missiles -= n;
    return true;
  }

  private launchOne(ctx: GameContext, id: WeaponId, target: Combatant | null) {
    const spec = WEAPONS[id];
    this.railSide = this.railSide === 1 ? -1 : 1;
    const span = this.isHeli ? 2.3 : Math.max(1.8, this.model.length * 0.14);
    const pos = _tmp.set(this.railSide * span, this.isHeli ? -0.6 : -1.1, 0.5).applyQuaternion(this.quaternion).add(this.position);
    const dir = this.forward(_tmp2);
    ctx.missiles.launch(id, this, this.team, pos, dir, this.velocity, target);
    if (this.isPlayer) this.stats.shots++;
    if (!spec.drop) ctx.audio.missileLaunch(this.isPlayer);
  }

  private updateSalvo(dt: number, ctx: GameContext) {
    if (!this.salvo) return;
    this.salvo.timer -= dt;
    while (this.salvo && this.salvo.timer <= 0) {
      this.launchOne(ctx, this.salvo.id, this.salvo.target);
      this.salvo.left--;
      this.salvo.timer += 0.07;
      if (this.salvo.left <= 0) this.salvo = null;
    }
  }

  deployFlares(ctx: GameContext): boolean {
    if (this.flares <= 0 || this.flareCooldown > 0) return false;
    this.flares--;
    this.flareCooldown = this.isPlayer ? 1.2 : 3;
    this.flareTimer = 2.5;
    this.flareDeployId++;
    ctx.flares.deploy(this, 6);
    if (this.isPlayer) ctx.audio.flare();
    return true;
  }

  // ======================================================================= damage

  applyDamage(amount: number, source: Aircraft | null, ctx: GameContext) {
    if (!this.alive) return;
    if (this.isPlayer) amount *= ctx.tuning.damageTaken;
    else if (source?.isPlayer) source.stats.hits++;
    this.hp -= amount;
    this.hitFlash = 0.35;
    if (source) this.lastAttacker = source;
    if (this.hp <= 0) this.destroy(ctx, source);
  }

  destroy(ctx: GameContext, killer: Aircraft | null) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.wreckTimer = 8;
    for (const f of this.flames) f.visible = false;
    ctx.effects.explosion(this.position, 1.4 * this.spec.size, this.velocity);
    ctx.audio.explosion(this.position, 1.5);
    // Wreck keeps some momentum and tumbles.
    this.velocity.multiplyScalar(0.7);
    this.velocity.y -= 10;
    ctx.events.destroyed(this, killer ?? this.lastAttacker);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.model.root);
    for (const f of this.flames) {
      f.geometry.dispose();
      (f.material as THREE.Material).dispose();
    }
  }
}
