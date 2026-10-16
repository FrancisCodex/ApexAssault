import * as THREE from 'three';
import type { Aircraft } from '../entities/Aircraft';
import type { Combatant, GameContext } from '../core/context';
import { steerToward, leadPoint } from './steering';
import { clamp, rand, G, pick } from '../core/utils';
import { MAP } from '../world/layout';

export type AIRole = 'FIGHTER' | 'ESCORT' | 'BOMBER' | 'ATTACKER' | 'WINGMAN';
type State = 'CRUISE' | 'ENGAGE' | 'EVADE' | 'BOMB_RUN' | 'EGRESS' | 'FORMATION';

const _desired = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _lead = new THREE.Vector3();

const ENEMY_CHATTER = [
  'Bandit on my six!', 'Break, break!', 'I can\'t shake him!', 'Engaging the enemy fighter.',
  'Who is this pilot?!', 'Focus fire on the lead aircraft!', 'Missile! Evading!',
];
const ALLY_CHATTER = ['Fox two!', 'Splash one!', 'Guns, guns, guns!', 'Engaging bandit.', 'I\'ve got your back, Apex 1.'];

/**
 * Virtual pilot. Produces stick inputs that drive the same flight model the
 * player uses, so AI aircraft obey energy, stall and G limits.
 */
export class PilotAI {
  role: AIRole;
  state: State = 'CRUISE';
  skill: number;
  target: Combatant | null = null;
  groundTarget: Combatant | null = null;
  /** Ground targets the mission assigns to bombers/attackers, in priority order. */
  groundTargets: Combatant[] = [];
  leader: Aircraft | null = null;
  waypoint = new THREE.Vector3();
  cruiseAlt = 2200;
  /** Locked-on time against the current target (drives the player's lock warning). */
  lockTime = 0;

  private think = 0;
  private evadeTimer = 0;
  private evadeDir = 1;
  private missileCooldown = rand(4, 8);
  private burst = 0;
  private burstPause = 0;
  private bombsLeft = 0;
  private bombTimer = 0;
  private chatterCooldown = rand(8, 20);
  private jink = 0;

  constructor(role: AIRole, skill: number) {
    this.role = role;
    this.skill = clamp(skill, 0.2, 1);
  }

  update(dt: number, ctx: GameContext, self: Aircraft) {
    const c = self.controls;
    this.think -= dt;
    this.missileCooldown -= dt;
    this.chatterCooldown -= dt;
    this.evadeTimer -= dt;
    if (this.think <= 0) {
      this.think = rand(0.35, 0.6) / (0.5 + this.skill * 0.5);
      this.decide(ctx, self);
    }

    let wantAccel = false, wantBrake = false;
    switch (this.state) {
      case 'EVADE': {
        // Hard break turn perpendicular to the threat, with flares.
        const threat = ctx.missiles.incoming(self)[0];
        if (threat) {
          _tmp.copy(threat.pos).sub(self.position).normalize();
          _desired.crossVectors(_tmp, _tmp2.set(0, 1, 0)).multiplyScalar(this.evadeDir);
          _desired.y = self.altitude < 600 ? 0.4 : -0.15;
          _desired.normalize();
          const d = threat.pos.distanceTo(self.position);
          if (d < 1600 && Math.random() < this.skill * 0.06) self.deployFlares(ctx);
        } else {
          self.forward(_desired);
        }
        wantAccel = true;
        break;
      }
      case 'ENGAGE':
        ({ wantAccel, wantBrake } = this.engage(dt, ctx, self));
        break;
      case 'BOMB_RUN':
        this.bombRun(dt, ctx, self);
        wantAccel = self.speed < self.spec.cornerSpeed * 1.2;
        break;
      case 'FORMATION': {
        const L = this.leader!;
        _tmp.set(this.evadeDir * 60, 10, 70).applyQuaternion(L.quaternion).add(L.position);
        _tmp.addScaledVector(L.velocity, 1.5);
        _desired.copy(_tmp).sub(self.position);
        const dist = _desired.length();
        _desired.normalize();
        wantAccel = dist > 150 || self.speed < L.speed;
        wantBrake = dist < 60 && self.speed > L.speed;
        break;
      }
      case 'EGRESS':
      case 'CRUISE':
      default: {
        _desired.copy(this.waypoint).sub(self.position);
        const horiz = Math.hypot(_desired.x, _desired.z);
        if (horiz < 800) this.newWaypoint(self);
        _desired.y = clamp((this.cruiseAlt - self.position.y) / 1500, -0.3, 0.3) * horiz / 1000;
        _desired.normalize();
        wantAccel = self.speed < self.spec.cornerSpeed * 1.3;
        break;
      }
    }

    this.avoidTerrainAndBounds(ctx, self, _desired);
    // Less skilled pilots are sloppy with the stick.
    this.jink += dt;
    const gain = 0.55 + this.skill * 0.6;
    steerToward(self, _desired, c, gain);
    if (this.skill < 0.7) c.pitch *= 0.85 + Math.sin(this.jink * 1.7) * 0.1;
    c.accel = wantAccel;
    c.brake = wantBrake;
    // Energy management: don't stall while turning.
    if (self.speed < self.spec.stallSpeed * 1.5) { c.accel = true; c.brake = false; c.pitch = Math.min(c.pitch, 0.4); }
  }

  private decide(ctx: GameContext, self: Aircraft) {
    const threats = ctx.missiles.incoming(self);
    const closeThreat = threats.find((m) => m.pos.distanceTo(self.position) < 2400);
    if (closeThreat && this.role !== 'BOMBER' && Math.random() < 0.4 + this.skill * 0.6) {
      if (this.state !== 'EVADE') {
        this.evadeDir = Math.random() < 0.5 ? 1 : -1;
        this.chatter(ctx, self, 'Missile! Evading!');
      }
      this.state = 'EVADE';
      this.evadeTimer = rand(1.5, 3);
      return;
    }
    if (this.state === 'EVADE' && this.evadeTimer > 0) return;

    if (this.role === 'BOMBER' || this.role === 'ATTACKER') {
      this.groundTargets = this.groundTargets.filter((t) => t.alive);
      if (!this.groundTarget?.alive) this.groundTarget = this.groundTargets[0] ?? null;
      // Attackers defend themselves when jumped at close range.
      if (this.role === 'ATTACKER') {
        const close = this.nearestHostile(ctx, self, 900);
        if (close && Math.random() < 0.3) { this.target = close; this.state = 'ENGAGE'; return; }
      }
      if (this.groundTarget) { this.state = 'BOMB_RUN'; return; }
      this.state = 'CRUISE';
      return;
    }

    if (this.role === 'WINGMAN' && this.leader?.alive) {
      const t = this.nearestHostile(ctx, self, 6000);
      if (t) { this.target = t; this.state = 'ENGAGE'; }
      else this.state = 'FORMATION';
      return;
    }

    // Fighters / escorts: pick a target, preferring the player.
    if (!this.target?.alive || Math.random() < 0.08) {
      const range = this.role === 'ESCORT' ? 4500 : 14000;
      this.target = this.pickAirTarget(ctx, self, range);
    }
    this.state = this.target ? 'ENGAGE' : 'CRUISE';
    if (this.state === 'CRUISE' && this.leader?.alive) {
      this.waypoint.copy(this.leader.position);
    }
  }

  private pickAirTarget(ctx: GameContext, self: Aircraft, range: number): Combatant | null {
    let best: Combatant | null = null, bestScore = Infinity;
    for (const a of ctx.aircraft) {
      if (!a.alive || a.team === self.team) continue;
      const d = a.position.distanceTo(self.position);
      if (d > range) continue;
      // Pressure the player a bit more than AI wingmen.
      const score = d * (a.isPlayer ? 0.7 : 1) + rand(0, 800);
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  private nearestHostile(ctx: GameContext, self: Aircraft, range: number): Combatant | null {
    let best: Combatant | null = null, bd = range;
    for (const a of ctx.aircraft) {
      if (!a.alive || a.team === self.team) continue;
      const d = a.position.distanceTo(self.position);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  private engage(dt: number, ctx: GameContext, self: Aircraft) {
    const t = this.target!;
    const dist = t.position.distanceTo(self.position);
    self.forward(_tmp);
    leadPoint(self.position, self.velocity, t.position, t.velocity, _lead);
    const toLead = _tmp2.copy(_lead).sub(self.position).normalize();
    const gunAngle = Math.acos(clamp(toLead.dot(_tmp), -1, 1));

    // Lead pursuit up close, pure pursuit at range, lag a little when overshooting.
    if (dist < 1600) _desired.copy(toLead);
    else _desired.copy(t.position).sub(self.position).normalize();

    // Guns.
    const gunRange = 700 + this.skill * 400;
    this.burstPause -= dt;
    if (dist < gunRange && gunAngle < 0.05 + (1 - this.skill) * 0.04 && this.burstPause <= 0) {
      this.burst += dt;
      const err = (1 - ctx.tuning.aiAccuracy) * 0.03 + (1 - this.skill) * 0.01;
      const aim = toLead.clone();
      aim.x += rand(-err, err); aim.y += rand(-err, err); aim.z += rand(-err, err);
      self.tryFireGun(ctx, aim.normalize(), self.team === 'RED' ? 0.75 : 1.2);
      if (this.burst > 0.6) { this.burst = 0; this.burstPause = rand(0.6, 1.4) / (0.5 + this.skill); }
    }

    // Missiles: hold lock inside the cone for a moment, then launch.
    const toTarget = _tmp2.copy(t.position).sub(self.position).normalize();
    const offBore = Math.acos(clamp(toTarget.dot(_tmp), -1, 1));
    if (offBore < 0.45 && dist > 500 && dist < 3400 && self.missiles > 0) {
      this.lockTime += dt;
      const rate = self.team === 'RED' ? ctx.tuning.aiMissileRate : 1;
      if (this.lockTime > 1.4 / (0.5 + this.skill * 0.5) && this.missileCooldown <= 0) {
        if (self.tryFireMissile(ctx, self.spec.missile, [t])) {
          this.missileCooldown = rand(7, 12) / rate;
          this.lockTime = 0;
          if (self.team === 'BLUE') this.chatter(ctx, self, 'Fox two!');
        }
      }
    } else {
      this.lockTime = Math.max(0, this.lockTime - dt * 2);
    }

    if (Math.random() < 0.002) this.chatter(ctx, self, pick(self.team === 'RED' ? ENEMY_CHATTER : ALLY_CHATTER));

    // Throttle: close the gap, but avoid flying past the target.
    const closing = -_tmp.copy(t.velocity).sub(self.velocity).dot(toTarget);
    const wantBrake = dist < 450 && closing > 40 && offBore < 0.6;
    const wantAccel = !wantBrake && (dist > 900 || self.speed < self.spec.cornerSpeed);
    return { wantAccel, wantBrake };
  }

  private bombRun(dt: number, ctx: GameContext, self: Aircraft) {
    const t = this.groundTarget!;
    const alt = this.role === 'BOMBER' ? 950 : 900;
    _tmp.copy(t.position).sub(self.position);
    const horiz = Math.hypot(_tmp.x, _tmp.z);
    const hv = Math.hypot(self.velocity.x, self.velocity.z);
    const height = Math.max(10, self.position.y - t.position.y);
    const fall = Math.sqrt((2 * height) / G);
    const releaseDist = hv * fall * 0.98;

    if (this.role === 'ATTACKER' && horiz < 2600 && horiz > 400) {
      // Dive attack.
      _desired.copy(t.position).sub(self.position).normalize();
    } else {
      _desired.set(_tmp.x, 0, _tmp.z).normalize();
      _desired.y = clamp((t.position.y + alt - self.position.y) / 900, -0.4, 0.4);
      _desired.normalize();
    }

    const aligned = new THREE.Vector3(_tmp.x, 0, _tmp.z).normalize().dot(_tmp2.set(self.velocity.x, 0, self.velocity.z).normalize()) > 0.94;
    const inWindow = this.role === 'ATTACKER'
      ? horiz < 900 && height < 900
      : Math.abs(horiz - releaseDist) < 220 && aligned;
    this.bombTimer -= dt;
    if (inWindow && this.bombsLeft === 0 && self.missiles > 0) this.bombsLeft = Math.min(4, self.missiles);
    if (this.bombsLeft > 0 && this.bombTimer <= 0) {
      this.bombTimer = 0.22;
      this.bombsLeft--;
      self.tryFireMissile(ctx, 'BOMB', [null]);
      if (this.bombsLeft === 0) {
        this.state = 'EGRESS';
        this.newWaypoint(self, 6000);
        this.think = 6; // fly away before turning back in
      }
    }
    if (horiz < 300 && this.bombsLeft === 0 && !inWindow) {
      this.state = 'EGRESS';
      this.newWaypoint(self, 5000);
      this.think = 5;
    }
  }

  newWaypoint(self: Aircraft, dist = 4000) {
    const a = Math.random() * Math.PI * 2;
    this.waypoint.set(
      clamp(self.position.x + Math.cos(a) * dist, -MAP.combatHalf + 2000, MAP.combatHalf - 2000),
      this.cruiseAlt,
      clamp(self.position.z + Math.sin(a) * dist, -MAP.combatHalf + 2000, MAP.combatHalf - 2000),
    );
  }

  private avoidTerrainAndBounds(ctx: GameContext, self: Aircraft, desired: THREE.Vector3) {
    const minClear = 120 + self.speed * 0.5;
    let worst = Infinity;
    for (const t of [1, 2.5, 4]) {
      _tmp.copy(self.position).addScaledVector(self.velocity, t);
      const clear = _tmp.y - ctx.terrain.getSurface(_tmp.x, _tmp.z);
      worst = Math.min(worst, clear);
    }
    if (worst < minClear) {
      const urgency = clamp(1 - worst / minClear, 0, 1);
      desired.y = Math.max(desired.y, 0.25 + urgency * 0.9);
      desired.normalize();
    }
    const lim = MAP.combatHalf - 800;
    if (Math.abs(self.position.x) > lim || Math.abs(self.position.z) > lim) {
      _tmp.set(-self.position.x, 0, -self.position.z).normalize();
      desired.lerp(_tmp, 0.7).normalize();
    }
  }

  private chatter(ctx: GameContext, self: Aircraft, text: string) {
    if (this.chatterCooldown > 0) return;
    this.chatterCooldown = rand(14, 30);
    ctx.events.radio(self.name, text, self.team === 'RED' ? 'enemy' : 'ally');
  }
}
