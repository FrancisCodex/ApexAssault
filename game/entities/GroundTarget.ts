import * as THREE from 'three';
import type { Combatant, GameContext } from '../core/context';
import type { Aircraft } from './Aircraft';
import type { Team } from '../data/types';
import type { GroundKind, SiteDef, SiteGroup } from '../world/layout';
import { createGroundModel, charredMaterial, type GroundModel } from '../models/GroundModels';
import { nextId, rand, randomUnitVector } from '../core/utils';

const STATS: Record<GroundKind, { hp: number; score: number }> = {
  HANGAR: { hp: 260, score: 150 },
  SHELTER: { hp: 220, score: 120 },
  TOWER: { hp: 160, score: 100 },
  HQ: { hp: 700, score: 400 },
  BUNKER: { hp: 1100, score: 1500 },
  RADAR: { hp: 150, score: 180 },
  RADOME: { hp: 200, score: 180 },
  FUEL: { hp: 90, score: 90 },
  SAM: { hp: 70, score: 200 },
  AA: { hp: 60, score: 120 },
  COMMS: { hp: 140, score: 150 },
  BARRACKS: { hp: 200, score: 90 },
};

export const GROUND_LABEL: Record<GroundKind, string> = {
  HANGAR: 'HANGAR', SHELTER: 'SHELTER', TOWER: 'TOWER', HQ: 'HQ', BUNKER: 'HQ BUNKER', RADAR: 'RADAR',
  RADOME: 'RADAR', FUEL: 'FUEL', SAM: 'SAM', AA: 'AA GUN', COMMS: 'COMMS', BARRACKS: 'BARRACKS',
};

const _tmp = new THREE.Vector3();
const _aim = new THREE.Vector3();

export class GroundTarget implements Combatant {
  readonly id = nextId('gt');
  readonly isAir = false;
  readonly kind: GroundKind;
  readonly group: SiteGroup;
  readonly model: GroundModel;
  readonly height: number;
  team: Team;
  name: string;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  hp: number;
  maxHp: number;
  radius: number;
  alive = true;
  isMissionTarget = false;
  targetable = true;
  score: number;
  /** Air defenses only engage while active (mission scripting can disable them). */
  active = true;

  private cooldown = rand(1, 4);
  private lockTime = 0;
  private trackTarget: Aircraft | null = null;
  private salvo = 0;

  constructor(def: SiteDef, ground: number) {
    this.kind = def.kind;
    this.group = def.group;
    this.team = def.team;
    this.name = def.name ?? GROUND_LABEL[def.kind];
    const st = STATS[def.kind];
    this.hp = this.maxHp = st.hp;
    this.score = st.score;
    this.model = createGroundModel(def.kind, def.team);
    this.model.root.position.set(def.x, ground, def.z);
    this.model.root.rotation.y = def.rot ?? 0;
    this.height = this.model.height;
    this.radius = this.model.radius;
    this.position.set(def.x, ground + this.height * 0.45, def.z);
  }

  get isAirDefense() { return this.kind === 'SAM' || this.kind === 'AA'; }

  /** True while this SAM site is painting the given aircraft (drives the lock warning). */
  isLocking(ac: Aircraft) {
    return this.alive && this.active && this.kind === 'SAM' && this.trackTarget === ac && this.lockTime > 0.4;
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.active = true;
    this.cooldown = rand(1, 4);
    this.lockTime = 0;
    this.trackTarget = null;
    this.model.body.material = this.model.body.userData.mat ?? this.model.body.material;
    this.model.root.scale.set(1, 1, 1);
    this.model.root.rotation.z = 0;
    if (this.model.turret) this.model.turret.visible = true;
  }

  update(dt: number, ctx: GameContext, radarAlive: boolean) {
    if (!this.alive) return;
    if (this.model.spinner) this.model.spinner.rotation.y += dt * 1.6;
    if (!this.active || !this.isAirDefense) return;

    this.cooldown -= dt;
    const range = this.kind === 'SAM' ? (radarAlive ? 7500 : 4500) : 2600;
    // Re-evaluate target periodically.
    if (!this.trackTarget || !this.trackTarget.alive || this.trackTarget.position.distanceTo(this.position) > range) {
      this.trackTarget = this.pickTarget(ctx, range);
      this.lockTime = 0;
    }
    const t = this.trackTarget;
    if (!t) return;

    // Aim turret.
    _tmp.copy(t.position).sub(this.model.root.position);
    if (this.model.turret) {
      const yaw = Math.atan2(-_tmp.x, -_tmp.z) - this.model.root.rotation.y;
      this.model.turret.rotation.y = yaw;
      if (this.model.barrel) {
        const elev = Math.atan2(_tmp.y, Math.hypot(_tmp.x, _tmp.z));
        this.model.barrel.rotation.x = Math.max(0.2, elev);
      }
    }

    if (this.kind === 'SAM') this.updateSam(dt, ctx, t);
    else this.updateFlak(ctx, t);
  }

  private pickTarget(ctx: GameContext, range: number): Aircraft | null {
    let best: Aircraft | null = null, bd = range;
    for (const a of ctx.aircraft) {
      if (!a.alive || a.team === this.team) continue;
      const d = a.position.distanceTo(this.position);
      // Low flying beats radar: terrain masking and a minimum engagement altitude.
      if (d < bd && a.altitude > (this.kind === 'SAM' ? 40 : 10) && ctx.terrain.lineOfSight(this.position, a.position, 10)) {
        bd = d; best = a;
      }
    }
    return best;
  }

  /** SAM sites lock for a moment (giving a warning) and fire pairs. */
  private updateSam(dt: number, ctx: GameContext, t: Aircraft) {
    this.lockTime += dt;
    const lockNeeded = this.team === 'RED' ? 2.2 / ctx.tuning.aiReaction : 1.5;
    if (this.lockTime < lockNeeded || this.cooldown > 0) return;
    if (!ctx.terrain.lineOfSight(this.position, t.position, 10)) { this.lockTime = 0; return; }
    const pos = _tmp.copy(this.model.root.position).add(_aim.set(0, 6, 0));
    _aim.copy(t.position).sub(pos).normalize();
    _aim.y = Math.max(_aim.y, 0.5);
    _aim.normalize();
    ctx.missiles.launch('SAM', null, this.team, pos, _aim, _aim.clone().multiplyScalar(40), t);
    ctx.audio.missileLaunch(false, pos);
    this.salvo++;
    if (this.salvo >= 2) {
      this.salvo = 0;
      const rate = this.team === 'RED' ? ctx.tuning.aiMissileRate : 1;
      this.cooldown = rand(9, 13) / rate;
    } else {
      this.cooldown = 1.2;
    }
  }

  /** Flak: predicted bursts with error growing with range and target speed. */
  private updateFlak(ctx: GameContext, t: Aircraft) {
    if (this.cooldown > 0) return;
    this.cooldown = this.team === 'RED' ? 0.45 : 0.35;
    const dist = t.position.distanceTo(this.position);
    const shellSpeed = 900;
    const tof = dist / shellSpeed;
    const acc = this.team === 'RED' ? ctx.tuning.aiAccuracy : 0.8;
    const errorRadius = (20 + dist * 0.035 + t.speed * 0.12) * (1.4 - acc);
    const burst = _aim.copy(t.position).addScaledVector(t.velocity, tof)
      .add(randomUnitVector(_tmp).multiplyScalar(Math.random() * errorRadius));
    ctx.effects.flak(burst);
    ctx.audio.flak(burst);
    for (const a of ctx.aircraft) {
      if (!a.alive || a.team === this.team) continue;
      const d = a.position.distanceTo(burst);
      if (d < 28) {
        a.applyDamage(9 * (1 - d / 28) + 1.5, null, ctx);
        ctx.events.hit(a, null, false);
      }
    }
  }

  applyDamage(amount: number, source: Aircraft | null, ctx: GameContext) {
    if (!this.alive || !this.targetable) return;
    if (source?.isPlayer) source.stats.hits++;
    this.hp -= amount;
    if (this.hp <= 0) this.destroy(ctx, source);
  }

  destroy(ctx: GameContext, killer: Aircraft | null) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    const big = this.radius > 25 ? 2.6 : 1.6;
    ctx.effects.explosion(this.position, big);
    if (this.kind === 'FUEL') {
      ctx.effects.explosion(_tmp.copy(this.position).setY(this.position.y + 15), 3);
    }
    ctx.effects.addFire(this.model.root.position, this.radius > 25 ? 1.4 : 0.8, 160);
    ctx.audio.explosion(this.position, big);
    this.model.body.userData.mat ??= this.model.body.material;
    this.model.body.material = charredMaterial();
    this.model.root.scale.set(1, this.kind === 'COMMS' ? 0.25 : 0.45, 1);
    if (this.kind === 'SAM' || this.kind === 'AA') this.model.root.rotation.z = 0.15;
    if (this.model.turret) this.model.turret.visible = false;
    ctx.events.destroyed(this, killer);
  }
}
