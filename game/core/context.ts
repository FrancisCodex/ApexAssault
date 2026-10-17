import type * as THREE from 'three';
import type { Team, DIFFICULTY_TUNING, Difficulty } from '../data/types';
import type { Terrain } from '../world/Terrain';
import type { Effects } from '../systems/Effects';
import type { Bullets } from '../systems/Bullets';
import type { Missiles } from '../systems/Missiles';
import type { Flares } from '../systems/Flares';
import type { AudioSystem } from '../Audio';
import type { Aircraft } from '../entities/Aircraft';
import type { GroundTarget } from '../entities/GroundTarget';

export interface Combatant {
  id: string;
  team: Team;
  name: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  alive: boolean;
  hp: number;
  maxHp: number;
  radius: number;
  isAir: boolean;
  isMissionTarget: boolean;
  /** Targets can be hidden from lock-on until a mission phase unlocks them. */
  targetable: boolean;
  score: number;
  applyDamage(amount: number, source: Aircraft | null, ctx: GameContext): void;
}

export interface GameEvents {
  destroyed(victim: Combatant, killer: Aircraft | null): void;
  hit(victim: Combatant, attacker: Aircraft | null, missile: boolean): void;
  missileMissed(owner: Aircraft | null): void;
  radio(from: string, text: string, tone: 'ally' | 'enemy' | 'command' | 'system'): void;
}

export interface GameContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  terrain: Terrain;
  effects: Effects;
  bullets: Bullets;
  missiles: Missiles;
  flares: Flares;
  audio: AudioSystem;
  aircraft: Aircraft[];
  ground: GroundTarget[];
  player: Aircraft | null;
  time: number;
  difficulty: Difficulty;
  tuning: (typeof DIFFICULTY_TUNING)[Difficulty];
  events: GameEvents;
}

export const hostileTo = (a: Team, b: Team) => a !== b;
