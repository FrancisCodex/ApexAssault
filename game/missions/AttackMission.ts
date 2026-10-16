import * as THREE from 'three';
import { Mission, headingTo, type HudStat } from './Mission';
import type { Aircraft } from '../entities/Aircraft';
import type { GroundTarget } from '../entities/GroundTarget';
import type { Combatant } from '../core/context';
import { TIMES } from '../world/Atmosphere';
import { ENEMY_BASE, PASS, FRIENDLY_BASE } from '../world/layout';
import { formatTime, rand } from '../core/utils';
import type { AircraftId } from '../data/aircraft';

/**
 * OPERATION HAMMERFALL — push through the Greyspine SAM belt, neutralise
 * Kessel Ridge Air Base and destroy the enemy command bunker.
 */
export class AttackMission extends Mission {
  readonly mode = 'ATTACK' as const;
  readonly title = 'Operation Hammerfall';
  readonly time = TIMES.MIDDAY;

  private phase = 0;
  private passTargets: GroundTarget[] = [];
  private baseTargets: GroundTarget[] = [];
  private hq!: GroundTarget;
  private reinforceTimer = 50;
  private enemyAir: Aircraft[] = [];
  private acesSpawned = false;
  private warnedTime = false;

  setup() {
    const h = this.host;
    this.timeLimit = 20 * 60;
    const player = this.config.aircraft;
    const heli = player === 'AH64';

    // --- Mission targets ---
    for (const g of h.ground) {
      if (g.team !== 'RED') { g.active = g.isAirDefense; continue; }
      if (g.group === 'PASS' || g.group === 'RIDGE') this.passTargets.push(g);
      if (g.group === 'EB' && (g.isAirDefense || g.kind === 'HANGAR' || g.kind === 'SHELTER')) this.baseTargets.push(g);
      if (g.kind === 'BUNKER') this.hq = g;
    }
    this.passTargets.forEach((g) => (g.isMissionTarget = true));
    this.hq.targetable = false;

    // --- Player and wingmen ---
    const start = heli
      ? new THREE.Vector3(PASS.x - 3200, 0, PASS.z + 200)
      : new THREE.Vector3(FRIENDLY_BASE.x + 1800, 0, FRIENDLY_BASE.z - 500);
    start.y = h.ctx.terrain.getSurface(start.x, start.z) + (heli ? 220 : 1300);
    const heading = -Math.PI / 2; // east
    h.spawnPlayer(start, heading, heli ? 30 : 230);

    const wingIds: AircraftId[] = ['F22', 'F14'];
    wingIds.forEach((id, i) => {
      const p = start.clone().add(new THREE.Vector3(-150 - i * 60, heli ? 900 : 60, (i ? 1 : -1) * 140));
      p.y = Math.max(p.y, h.ctx.terrain.getSurface(p.x, p.z) + 700);
      const w = h.spawnAircraft(id, 'BLUE', `Apex ${i + 2}`, p, heading, 230, 'WINGMAN', 0.75);
      w.ai!.leader = h.ctx.player;
    });

    // --- Enemy combat air patrol over the pass ---
    const n = Math.max(2, Math.round(4 * h.ctx.tuning.enemyCount));
    const cap = new THREE.Vector3(PASS.x + 1500, 2600, PASS.z);
    this.formation(n, cap, Math.PI / 2, 160).forEach((p, i) => {
      const e = h.spawnAircraft('MIG21', 'RED', `Viper ${i + 1}`, p, Math.PI / 2, 220, 'FIGHTER', 0.45 + i * 0.05);
      e.ai!.waypoint.set(PASS.x - 2000, 2400, PASS.z);
      this.enemyAir.push(e);
    });

    this.objective('pass', 'Destroy the Greyspine Pass air defenses (SAM / AA / Radar)');
    this.objective('base', 'Neutralise Kessel Ridge AB defenses and hangars');
    this.objective('hq', 'Destroy the Kessel Command HQ bunker');
    this.objective('time', `Complete the operation within ${formatTime(this.timeLimit)}`);
    this.objectives.find((o) => o.id === 'base')!.progress = 'LOCKED';
    this.objectives.find((o) => o.id === 'hq')!.progress = 'LOCKED';

    h.banner('OPERATION HAMMERFALL', 'Breach the Greyspine Pass air-defense line', 'info');
    h.radio('Overwatch', 'Apex squadron, this is Overwatch. SAM sites are dug in at Greyspine Pass. Fly low through the valley to stay under their radar.', 'command');
    h.radio('Overwatch', 'Hit the radar on the ridge and their SAMs lose long-range tracking.', 'command');
  }

  update(dt: number) {
    const h = this.host;
    this.elapsed += dt;
    if (!h.ctx.player?.alive) { this.fail('You were shot down.'); return; }
    if (this.elapsed > this.timeLimit) { this.fail('Operation window expired.'); return; }
    if (!this.warnedTime && this.timeLimit - this.elapsed < 120) {
      this.warnedTime = true;
      h.radio('Overwatch', 'Two minutes remaining in the operation window!', 'command');
    }

    const passLeft = this.passTargets.filter((g) => g.alive).length;
    const baseLeft = this.baseTargets.filter((g) => g.alive).length;
    if (this.phase === 0) {
      this.setProgress('pass', `${this.passTargets.length - passLeft}/${this.passTargets.length}`);
      if (passLeft === 0) this.startPhase1();
    } else if (this.phase === 1) {
      this.setProgress('base', `${this.baseTargets.length - baseLeft}/${this.baseTargets.length}`);
      if (baseLeft === 0) this.startPhase2();
    } else if (this.phase === 2) {
      if (!this.hq.alive) {
        this.complete('hq', 'DESTROYED');
        this.complete('time');
        this.bonus = Math.max(0, Math.round((this.timeLimit - this.elapsed) * 3));
        this.succeed();
      }
    }

    // Kessel Ridge scrambles reinforcements while its hangars stand.
    if (this.phase >= 1) {
      this.reinforceTimer -= dt;
      const hangarsAlive = h.ground.some((g) => g.team === 'RED' && g.group === 'EB' && (g.kind === 'HANGAR' || g.kind === 'SHELTER') && g.alive);
      const airborne = this.enemyAir.filter((a) => a.alive).length;
      if (this.reinforceTimer <= 0 && hangarsAlive && airborne < 6) {
        this.reinforceTimer = rand(45, 65);
        this.scramble(2, 'SU27');
        h.radio('Overwatch', 'Enemy fighters scrambling from Kessel Ridge!', 'command');
      }
    }
  }

  private startPhase1() {
    const h = this.host;
    this.phase = 1;
    this.complete('pass', 'COMPLETE');
    this.setProgress('base', `0/${this.baseTargets.length}`);
    this.baseTargets.forEach((g) => (g.isMissionTarget = true));
    h.banner('PASS SECURED', 'Strike Kessel Ridge Air Base', 'success');
    h.radio('Overwatch', 'Greyspine Pass is open. All units, proceed east to Kessel Ridge AB. Take out their air defenses and hangars.', 'command');
    this.scramble(Math.max(2, Math.round(4 * h.ctx.tuning.enemyCount)), 'SU27');
  }

  private startPhase2() {
    const h = this.host;
    this.phase = 2;
    this.complete('base', 'COMPLETE');
    this.setProgress('hq', 'TARGET');
    this.hq.targetable = true;
    this.hq.isMissionTarget = true;
    h.banner('DEFENSES DOWN', 'Destroy the Kessel Command HQ', 'success');
    h.radio('Overwatch', 'Their air defense is collapsing. The command bunker is exposed — bring it down!', 'command');
    if (!this.acesSpawned) {
      this.acesSpawned = true;
      const pos = new THREE.Vector3(ENEMY_BASE.x + 6000, 3200, ENEMY_BASE.z + 2000);
      const n = this.config.difficulty === 'EASY' ? 1 : 2;
      this.formation(n, pos, Math.PI / 2, 150).forEach((p, i) => {
        const a = h.spawnAircraft('SU57', 'RED', `Crimson ${i + 1}`, p, Math.PI / 2, 260, 'FIGHTER', 0.95);
        a.isMissionTarget = true;
        this.enemyAir.push(a);
      });
      h.radio('Crimson 1', 'This is Crimson Wolf squadron. The demon of Apex ends here.', 'enemy');
      h.banner('WARNING', 'Enemy ace squadron inbound', 'danger');
    }
  }

  private scramble(count: number, id: AircraftId) {
    const h = this.host;
    const runway = new THREE.Vector3(ENEMY_BASE.x + 300, 0, ENEMY_BASE.z + 900);
    runway.y = h.ctx.terrain.getHeight(runway.x, runway.z) + 250;
    for (let i = 0; i < count; i++) {
      const p = runway.clone().add(new THREE.Vector3(i * 40 - 20, i * 60, -i * 250));
      const target = h.ctx.player?.position ?? new THREE.Vector3();
      const a = h.spawnAircraft(id, 'RED', `Kessel ${Math.floor(rand(10, 99))}`, p, headingTo(p, target), 170, 'FIGHTER', 0.55 + Math.random() * 0.2);
      this.enemyAir.push(a);
    }
  }

  onDestroyed(victim: Combatant, killer: Aircraft | null) {
    void killer;
    if (victim === this.hq) this.host.radio('Overwatch', 'Direct hit on Kessel Command! The bunker is collapsing!', 'command');
    else if ((victim as GroundTarget).kind === 'RADAR' && (victim as GroundTarget).group === 'RIDGE') {
      this.host.radio('Overwatch', 'Ridge radar is down. Their SAMs are blind beyond short range.', 'command');
    }
  }

  stats(): HudStat[] {
    const remaining = this.timeLimit - this.elapsed;
    return [
      { label: 'TIME', value: formatTime(remaining), warn: remaining < 120 },
      { label: 'PHASE', value: `${this.phase + 1}/3` },
    ];
  }

  rank(score: number) {
    return score >= 9000 ? 'S' : score >= 6500 ? 'A' : score >= 4500 ? 'B' : score >= 2500 ? 'C' : 'D';
  }
}
