import * as THREE from 'three';
import type { Aircraft } from '../entities/Aircraft';
import type { GroundTarget } from '../entities/GroundTarget';
import type { Combatant, GameContext } from '../core/context';
import type { AircraftId } from '../data/aircraft';
import type { MissionConfig, MissionMode, Objective, Team, Banner } from '../data/types';
import type { AIRole } from '../ai/PilotAI';
import type { TimeOfDay } from '../world/Atmosphere';

export interface MissionHost {
  ctx: GameContext;
  ground: GroundTarget[];
  spawnAircraft(id: AircraftId, team: Team, name: string, pos: THREE.Vector3, heading: number, speed: number, role?: AIRole, skill?: number): Aircraft;
  spawnPlayer(pos: THREE.Vector3, heading: number, speed: number): Aircraft;
  radio(from: string, text: string, tone: 'ally' | 'enemy' | 'command' | 'system'): void;
  banner(title: string, subtitle: string | undefined, tone: Banner['tone']): void;
  addScore(n: number): void;
}

export interface HudStat { label: string; value: string; warn?: boolean }

export abstract class Mission {
  abstract readonly mode: MissionMode;
  abstract readonly title: string;
  abstract readonly time: TimeOfDay;
  objectives: Objective[] = [];
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' = 'RUNNING';
  failReason = '';
  elapsed = 0;
  timeLimit = 0;
  bonus = 0;
  dirty = true;

  constructor(protected host: MissionHost, protected config: MissionConfig) {}

  abstract setup(): void;
  abstract update(dt: number): void;
  onDestroyed(_victim: Combatant, _killer: Aircraft | null): void {}
  abstract stats(): HudStat[];
  abstract rank(score: number): 'S' | 'A' | 'B' | 'C' | 'D';

  protected objective(id: string, text: string): Objective {
    const o: Objective = { id, text, done: false };
    this.objectives.push(o);
    this.dirty = true;
    return o;
  }

  protected complete(id: string, progress?: string) {
    const o = this.objectives.find((x) => x.id === id);
    if (o && !o.done) {
      o.done = true;
      if (progress) o.progress = progress;
      this.dirty = true;
    }
  }

  protected setProgress(id: string, progress: string) {
    const o = this.objectives.find((x) => x.id === id);
    if (o && o.progress !== progress) { o.progress = progress; this.dirty = true; }
  }

  protected succeed() {
    if (this.status !== 'RUNNING') return;
    this.status = 'SUCCESS';
  }

  protected fail(reason: string) {
    if (this.status !== 'RUNNING') return;
    this.status = 'FAILED';
    this.failReason = reason;
  }

  /** Common: helper to spawn a formation offset around a lead point. */
  protected formation(count: number, center: THREE.Vector3, heading: number, spacing = 120): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const back = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    for (let i = 0; i < count; i++) {
      const side = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * Math.ceil(i / 2);
      out.push(center.clone().addScaledVector(right, side * spacing).addScaledVector(back, Math.abs(side) * spacing * 0.8).add(new THREE.Vector3(0, (i % 3) * 25, 0)));
    }
    return out;
  }
}

/** Heading (rotation about Y) that points the nose from a to b. */
export const headingTo = (from: THREE.Vector3, to: THREE.Vector3) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
