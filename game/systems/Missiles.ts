import * as THREE from 'three';
import type { GameContext, Combatant } from '../core/context';
import type { Aircraft } from '../entities/Aircraft';
import type { Flare } from './Flares';
import type { Team } from '../data/types';
import { WEAPONS, type WeaponSpec, type WeaponId } from '../data/weapons';
import { G, segmentPointDistance, smoothstep } from '../core/utils';
import { PartBuilder, tube, box } from '../models/PartBuilder';

type Trackable = Combatant | Flare;
const isCombatant = (t: Trackable): t is Combatant => (t as Combatant).applyDamage !== undefined;

export class Missile {
  spec!: WeaponSpec;
  pos = new THREE.Vector3();
  prev = new THREE.Vector3();
  dir = new THREE.Vector3();
  vel = new THREE.Vector3();
  speed = 0;
  age = 0;
  target: Trackable | null = null;
  /** The combatant originally targeted (for warnings / miss reports). */
  intended: Combatant | null = null;
  owner: Aircraft | null = null;
  team: Team = 'BLUE';
  alive = false;
  mesh!: THREE.Mesh;
  flareCheckId = -1;
  trailTimer = 0;
  lostReported = false;
}

const geoCache = new Map<number, THREE.BufferGeometry>();
function missileGeometry(scale: number) {
  let g = geoCache.get(scale);
  if (!g) {
    const b = new PartBuilder();
    b.add(tube(0.11, 0.11, 3.0, 8), '#e8e8e4', [0, 0, 0]);
    b.add(new THREE.ConeGeometry(0.11, 0.5, 8).rotateX(-Math.PI / 2), '#555', [0, 0, -1.75]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.add(box(0.02, 0.45, 0.5), '#bbb', [Math.sin(a) * 0.2, Math.cos(a) * 0.2, 1.2], [0, 0, -a]);
    }
    g = b.build();
    g.scale(scale, scale, scale);
    geoCache.set(scale, g);
  }
  return g;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, -1);

/** Rotate unit vector `dir` toward unit vector `to` by at most `maxAngle`. */
function rotateTowards(dir: THREE.Vector3, to: THREE.Vector3, maxAngle: number) {
  const angle = dir.angleTo(to);
  if (angle < 1e-5) return;
  const t = Math.min(1, maxAngle / angle);
  tmpA.crossVectors(dir, to);
  if (tmpA.lengthSq() < 1e-10) tmpA.set(0, 1, 0);
  tmpA.normalize();
  tmpQ.setFromAxisAngle(tmpA, angle * t);
  dir.applyQuaternion(tmpQ).normalize();
}

export class Missiles {
  readonly list: Missile[] = [];
  private pool: Missile[] = [];
  private material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5 });

  constructor(private scene: THREE.Scene) {}

  clear() {
    for (const m of this.list) { m.alive = false; m.mesh.visible = false; this.pool.push(m); }
    this.list.length = 0;
  }

  launch(
    id: WeaponId, owner: Aircraft | null, team: Team, pos: THREE.Vector3, dir: THREE.Vector3,
    baseVel: THREE.Vector3, target: Combatant | null,
  ): Missile {
    const spec = WEAPONS[id];
    const m = this.pool.pop() ?? new Missile();
    if (!m.mesh) {
      m.mesh = new THREE.Mesh(missileGeometry(spec.scale), this.material);
      this.scene.add(m.mesh);
    } else {
      m.mesh.geometry = missileGeometry(spec.scale);
    }
    m.mesh.visible = true;
    m.spec = spec;
    m.pos.copy(pos); m.prev.copy(pos);
    m.dir.copy(dir).normalize();
    m.speed = Math.max(baseVel.length(), 60) + spec.launchSpeed;
    if (spec.drop) {
      m.vel.copy(baseVel);
      m.speed = baseVel.length();
    } else {
      m.vel.copy(m.dir).multiplyScalar(m.speed);
    }
    m.age = 0;
    m.target = spec.guided ? target : null;
    m.intended = target;
    m.owner = owner;
    m.team = team;
    m.alive = true;
    m.flareCheckId = -1;
    m.trailTimer = 0;
    m.lostReported = false;
    this.list.push(m);
    return m;
  }

  /** Missiles currently homing on the given combatant. */
  incoming(target: Combatant): Missile[] {
    return this.list.filter((m) => m.alive && m.target === target);
  }

  update(dt: number, ctx: GameContext) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      this.step(m, dt, ctx);
      if (!m.alive) {
        m.mesh.visible = false;
        this.pool.push(m);
        this.list.splice(i, 1);
      }
    }
  }

  private step(m: Missile, dt: number, ctx: GameContext) {
    const s = m.spec;
    m.age += dt;
    m.prev.copy(m.pos);

    // --- Countermeasures: each new flare release gives one chance to decoy. ---
    const tgt = m.target;
    if (tgt && isCombatant(tgt) && tgt.isAir) {
      const ac = tgt as unknown as Aircraft;
      if (ac.flareDeployId !== m.flareCheckId && ac.flareTimer > 0 && m.pos.distanceTo(ac.position) < 3200) {
        m.flareCheckId = ac.flareDeployId;
        if (Math.random() > s.flareResist) {
          const f = ctx.flares.nearestFor(ac, m.pos);
          if (f) m.target = f;
        }
      }
    }

    // --- Guidance ---
    if (m.target && (!m.target.alive || (isCombatant(m.target) && !m.target.alive))) {
      m.target = null;
    }
    if (m.target) {
      const tp = m.target.position;
      tmpB.copy(tp).sub(m.pos);
      const dist = tmpB.length();
      const losDir = tmpB.divideScalar(Math.max(dist, 1e-3));
      const offBore = Math.acos(Math.min(1, Math.max(-1, losDir.dot(m.dir))));
      if (offBore > (s.seekerCone * Math.PI) / 180 && m.age > 0.4) {
        m.target = null; // lost lock — overshoot
      } else {
        const closing = Math.max(m.speed - m.target.velocity.dot(losDir) * 0.5, 150);
        const tgo = Math.min(dist / closing, 6);
        tmpA.copy(tp).addScaledVector(m.target.velocity, tgo * 0.95);
        // Top-attack profile against ground targets: loft, then dive in steeply
        // so ridges in front of the target don't eat the missile.
        const vsGround = isCombatant(m.target) && !m.target.isAir;
        if (vsGround && !s.drop) tmpA.y += Math.min(dist * 0.18, 260) * smoothstep(700, 2200, dist);
        tmpA.sub(m.pos).normalize();
        const turnRate = (s.turnG * G) / Math.max(m.speed, 50);
        const authority = (m.age < 0.25 ? 0.25 : 1) * (vsGround ? 2 : 1);
        rotateTowards(m.dir, tmpA, turnRate * authority * dt);
      }
    }

    if (!m.target && m.intended && !m.lostReported && m.intended.alive && s.guided) {
      m.lostReported = true;
      ctx.events.missileMissed(m.owner);
    }

    // --- Kinematics ---
    if (s.drop) {
      m.vel.y -= G * dt;
      m.vel.multiplyScalar(1 - 0.003 * dt);
      if (m.target) {
        // Glide-bomb steering: bend velocity toward the target.
        m.speed = m.vel.length();
        m.dir.copy(m.vel).normalize();
        tmpA.copy(m.target.position).sub(m.pos).normalize();
        rotateTowards(m.dir, tmpA, ((s.turnG * G) / Math.max(m.speed, 40)) * dt);
        m.vel.copy(m.dir).multiplyScalar(m.speed);
      }
      m.dir.copy(m.vel).normalize();
      m.speed = m.vel.length();
    } else {
      if (m.age < s.burnTime) m.speed = Math.min(s.maxSpeed, m.speed + s.accel * dt);
      else m.speed = Math.max(80, m.speed - (25 + m.dir.y * G) * dt);
      m.vel.copy(m.dir).multiplyScalar(m.speed);
      if (!m.target && !s.guided) m.vel.y -= G * dt * 0.3; // rockets drop a little
    }
    m.pos.addScaledVector(m.vel, dt);

    // --- Visual ---
    m.mesh.position.copy(m.pos);
    m.mesh.quaternion.setFromUnitVectors(Z, m.dir);
    if (s.smoke) {
      m.trailTimer -= dt;
      if (m.trailTimer <= 0) {
        m.trailTimer = 0.016;
        tmpA.copy(m.pos).addScaledVector(m.dir, -1.6 * s.scale);
        ctx.effects.missileTrail(tmpA, m.vel, m.age < s.burnTime, s.scale);
      }
    }

    // --- Detonation checks ---
    if (m.age > 0.15) {
      const hit = this.findProximityHit(m, ctx);
      if (hit) { this.detonate(m, ctx, hit); return; }
    }
    const ground = ctx.terrain.getHeight(m.pos.x, m.pos.z);
    if (m.pos.y <= Math.max(ground, 0)) {
      m.pos.y = Math.max(ground, 0);
      this.detonate(m, ctx, null, true, ground < 0);
      return;
    }
    if (m.age > s.life) {
      ctx.effects.explosion(m.pos, 0.35);
      m.alive = false;
    }
  }

  private findProximityHit(m: Missile, ctx: GameContext): Combatant | null {
    const s = m.spec;
    const t = m.target;
    if (t && isCombatant(t)) {
      const prox = s.proximity + t.radius * (t.isAir ? 0.35 : 0.6);
      if (segmentPointDistance(m.prev, m.pos, t.position) < prox) return t;
      return null;
    }
    if (t) {
      // Chasing a flare: detonate on it harmlessly.
      if (segmentPointDistance(m.prev, m.pos, t.position) < 6) {
        ctx.effects.explosion(m.pos, 0.4);
        m.alive = false;
      }
      return null;
    }
    // Unguided: hit anything hostile we brush past.
    const pools: Combatant[][] = [ctx.aircraft, ctx.ground];
    for (const list of pools) {
      for (const c of list) {
        if (!c.alive || c.team === m.team) continue;
        if (c.isAir && !s.air && !s.drop && s.guided) continue;
        const prox = s.proximity + c.radius * 0.5;
        if (segmentPointDistance(m.prev, m.pos, c.position) < prox) return c;
      }
    }
    return null;
  }

  private detonate(m: Missile, ctx: GameContext, direct: Combatant | null, groundHit = false, water = false) {
    const s = m.spec;
    m.alive = false;
    const scale = Math.min(2.6, 0.6 + s.damage / 90);
    ctx.effects.explosion(m.pos, scale, direct?.isAir ? direct.velocity : undefined);
    if (groundHit) ctx.effects.groundImpact(m.pos, water, 2.5 * scale);
    ctx.audio.explosion(m.pos, scale);

    if (direct) {
      direct.applyDamage(s.damage, m.owner, ctx);
      ctx.events.hit(direct, m.owner, true);
    }
    // Area damage — mostly matters for bombs against clustered structures.
    if (s.blastRadius > 0) {
      for (const list of [ctx.ground, ctx.aircraft] as Combatant[][]) {
        for (const c of list) {
          if (!c.alive || c === direct || c.team === m.team) continue;
          const d = c.position.distanceTo(m.pos) - c.radius * 0.5;
          if (d < s.blastRadius) {
            const dmg = s.damage * 0.6 * (1 - Math.max(0, d) / s.blastRadius);
            if (dmg > 1) {
              c.applyDamage(dmg, m.owner, ctx);
              ctx.events.hit(c, m.owner, true);
            }
          }
        }
      }
    }
  }
}
