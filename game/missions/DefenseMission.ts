import * as THREE from 'three';
import { Mission, headingTo, type HudStat } from './Mission';
import type { Aircraft } from '../entities/Aircraft';
import type { GroundTarget } from '../entities/GroundTarget';
import type { Combatant } from '../core/context';
import type { AircraftId } from '../data/aircraft';
import type { AIRole } from '../ai/PilotAI';
import { TIMES } from '../world/Atmosphere';
import { FRIENDLY_BASE } from '../world/layout';
import { rand, clamp } from '../core/utils';

interface WaveDef { fighters: number; fighterType: AircraftId; bombers: number; attackers: number; aces: number; label: string }

const WAVES: WaveDef[] = [
  { fighters: 4, fighterType: 'MIG21', bombers: 0, attackers: 0, aces: 0, label: 'Fighter sweep' },
  { fighters: 3, fighterType: 'MIG21', bombers: 2, attackers: 0, aces: 0, label: 'Bombers with escort' },
  { fighters: 3, fighterType: 'SU27', bombers: 2, attackers: 3, aces: 0, label: 'Strike package' },
  { fighters: 4, fighterType: 'SU27', bombers: 4, attackers: 2, aces: 0, label: 'Heavy bomber raid' },
  { fighters: 4, fighterType: 'SU27', bombers: 3, attackers: 2, aces: 2, label: 'Crimson Wolf squadron' },
];

/**
 * OPERATION IRON BASTION — hold Port Ardent Air Base against escalating raids
 * coming out of the sunrise.
 */
export class DefenseMission extends Mission {
  readonly mode = 'DEFENSE' as const;
  readonly title = 'Operation Iron Bastion';
  readonly time = TIMES.DAWN;

  private wave = 0;
  private waveAircraft: Aircraft[] = [];
  private intermission = 8;
  private assets: GroundTarget[] = [];
  private hq!: GroundTarget;
  private integrityWarned = false;

  setup() {
    const h = this.host;
    for (const g of h.ground) {
      g.active = true;
      if (g.team === 'BLUE' && g.group === 'FB' && !g.isAirDefense) this.assets.push(g);
      if (g.team === 'BLUE' && g.kind === 'HQ') this.hq = g;
    }
    const heli = this.config.aircraft === 'AH64';
    const start = new THREE.Vector3(FRIENDLY_BASE.x + 2500, 0, FRIENDLY_BASE.z);
    start.y = h.ctx.terrain.getSurface(start.x, start.z) + (heli ? 180 : 1300);
    h.spawnPlayer(start, -Math.PI / 2, heli ? 20 : 220);
    (['F14', 'F22'] as AircraftId[]).forEach((id, i) => {
      const p = start.clone().add(new THREE.Vector3(-200, heli ? 1000 : 80, i ? 160 : -160));
      const w = h.spawnAircraft(id, 'BLUE', `Apex ${i + 2}`, p, -Math.PI / 2, 220, 'WINGMAN', 0.7);
      w.ai!.leader = h.ctx.player;
    });

    this.objective('waves', `Repel all ${WAVES.length} enemy raids`);
    this.objective('base', 'Keep Port Ardent above 35% integrity');
    this.objective('hq', 'Protect Base Command');
    this.setProgress('waves', `0/${WAVES.length}`);
    h.banner('OPERATION IRON BASTION', 'Defend Port Ardent Air Base', 'info');
    h.radio('Port Ardent Control', 'All units, radar shows multiple contacts forming up over the eastern plateau. They will come out of the sunrise.', 'command');
    h.radio('Port Ardent Control', 'Bombers are the priority. Do not let them reach the flight line!', 'command');
  }

  integrity(): number {
    const max = this.assets.reduce((a, g) => a + g.maxHp, 0);
    const cur = this.assets.reduce((a, g) => a + Math.max(0, g.hp), 0);
    return max ? cur / max : 1;
  }

  update(dt: number) {
    const h = this.host;
    this.elapsed += dt;
    if (!h.ctx.player?.alive) { this.fail('You were shot down.'); return; }
    const integ = this.integrity();
    this.setProgress('base', `${Math.round(integ * 100)}%`);
    if (!this.hq.alive) { this.fail('Base Command was destroyed.'); return; }
    if (integ < 0.35) { this.fail('Port Ardent has fallen.'); return; }
    if (integ < 0.6 && !this.integrityWarned) {
      this.integrityWarned = true;
      h.radio('Port Ardent Control', 'We\'re taking heavy damage down here! Stop those bombers!', 'command');
    }

    const alive = this.waveAircraft.filter((a) => a.alive).length;
    if (this.wave > 0 && alive === 0 && this.intermission <= 0) {
      this.setProgress('waves', `${this.wave}/${WAVES.length}`);
      if (this.wave >= WAVES.length) {
        this.complete('waves', 'COMPLETE');
        this.complete('base', `${Math.round(integ * 100)}%`);
        this.complete('hq', 'INTACT');
        this.bonus = Math.round(integ * 3000);
        this.succeed();
        return;
      }
      this.intermission = 15;
      h.banner(`RAID ${this.wave} REPELLED`, `Next raid incoming — regroup`, 'success');
      h.radio('Port Ardent Control', 'Good work, Apex. Radar shows another group forming up — stand by.', 'command');
    }
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.spawnWave();
    }
  }

  private spawnWave() {
    const h = this.host;
    const def = WAVES[this.wave];
    this.wave++;
    this.waveAircraft = [];
    const k = h.ctx.tuning.enemyCount;
    const scaled = (n: number) => (n === 0 ? 0 : Math.max(1, Math.round(n * k)));
    const approachZ = FRIENDLY_BASE.z + rand(-3500, 3500);
    const origin = new THREE.Vector3(9500, 2600, approachZ);
    const heading = headingTo(origin, new THREE.Vector3(FRIENDLY_BASE.x, 0, FRIENDLY_BASE.z));

    const bombers: Aircraft[] = [];
    this.formation(scaled(def.bombers), origin.clone().setY(2200), heading, 220).forEach((p, i) => {
      const b = this.spawn('TU22', `Hammer ${i + 1}`, p, heading, 210, 'BOMBER', 0.5);
      b.ai!.groundTargets = this.bomberTargets(i);
      b.ai!.cruiseAlt = 1200;
      b.isMissionTarget = true;
      bombers.push(b);
    });
    const atkOrigin = origin.clone().add(new THREE.Vector3(800, -600, 1800));
    this.formation(scaled(def.attackers), atkOrigin, heading, 140).forEach((p, i) => {
      const a = this.spawn('SU25', `Anvil ${i + 1}`, p, heading, 200, 'ATTACKER', 0.6);
      a.ai!.groundTargets = this.attackerTargets(i);
    });
    const ftrOrigin = origin.clone().add(new THREE.Vector3(-600, 500, -1200));
    this.formation(scaled(def.fighters), ftrOrigin, heading, 160).forEach((p, i) => {
      const role: AIRole = bombers.length && i % 2 === 0 ? 'ESCORT' : 'FIGHTER';
      const f = this.spawn(def.fighterType, `Viper ${i + 1}`, p, heading, 240, role, 0.45 + this.wave * 0.08);
      if (role === 'ESCORT') f.ai!.leader = bombers[i % bombers.length];
      f.ai!.waypoint.set(FRIENDLY_BASE.x, 2200, FRIENDLY_BASE.z);
    });
    for (let i = 0; i < def.aces; i++) {
      const p = origin.clone().add(new THREE.Vector3(1500, 900, i * 200));
      const a = this.spawn('SU57', `Crimson ${i + 1}`, p, heading, 270, 'FIGHTER', 0.95);
      a.isMissionTarget = true;
    }
    h.banner(`RAID ${this.wave}/${WAVES.length}`, def.label, 'danger');
    h.radio('Port Ardent Control', `New contacts bearing 090, ${this.waveAircraft.length} aircraft. ${def.label}!`, 'command');
    if (def.aces) h.radio('Crimson 1', 'Crimson Wolves, engage. Leave none of them flying.', 'enemy');
  }

  private spawn(id: AircraftId, name: string, p: THREE.Vector3, heading: number, speed: number, role: AIRole, skill: number) {
    const a = this.host.spawnAircraft(id, 'RED', name, p, heading, speed, role, clamp(skill, 0.3, 1));
    a.ai!.waypoint.set(FRIENDLY_BASE.x, a.ai!.cruiseAlt, FRIENDLY_BASE.z);
    this.waveAircraft.push(a);
    return a;
  }

  private bomberTargets(i: number): Combatant[] {
    const alive = this.assets.filter((g) => g.alive);
    const pri = ['HANGAR', 'FUEL', 'HQ', 'RADOME', 'TOWER', 'BARRACKS'];
    alive.sort((a, b) => pri.indexOf(a.kind) - pri.indexOf(b.kind) + (Math.random() - 0.5) * 3);
    // Spread bombers across different targets.
    return [...alive.slice(i % Math.max(1, alive.length)), ...alive.slice(0, i % Math.max(1, alive.length))];
  }

  private attackerTargets(i: number): Combatant[] {
    const defenses = this.host.ground.filter((g) => g.team === 'BLUE' && g.isAirDefense && g.alive);
    const rest = this.assets.filter((g) => g.alive);
    return [...defenses.slice(i % Math.max(1, defenses.length)), ...defenses, ...rest];
  }

  onDestroyed(victim: Combatant, killer: Aircraft | null) {
    void killer;
    if (victim.team === 'BLUE' && !victim.isAir) {
      this.host.radio('Port Ardent Control', `${victim.name} has been destroyed!`, 'command');
    }
  }

  stats(): HudStat[] {
    const integ = this.integrity();
    const alive = this.waveAircraft.filter((a) => a.alive).length;
    return [
      { label: 'RAID', value: `${this.wave}/${WAVES.length}` },
      { label: 'HOSTILES', value: this.intermission > 0 && this.wave < WAVES.length ? `NEXT ${Math.ceil(this.intermission)}s` : `${alive}` },
      { label: 'BASE', value: `${Math.round(integ * 100)}%`, warn: integ < 0.6 },
    ];
  }

  rank(score: number) {
    return score >= 7000 ? 'S' : score >= 5500 ? 'A' : score >= 4000 ? 'B' : score >= 2500 ? 'C' : 'D';
  }
}
