import type { AircraftId } from './aircraft';

export type MissionMode = 'ATTACK' | 'DEFENSE';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'ACE';
export type ControlMode = 'STANDARD' | 'EXPERT' | 'MOUSE_AIM';
export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';
export type CameraMode = 'CHASE' | 'CHASE_FAR' | 'COCKPIT' | 'HUD';
export type Team = 'BLUE' | 'RED';

export interface Settings {
  controlMode: ControlMode;
  invertPitch: boolean;
  mouseSensitivity: number;
  aimAssist: boolean;
  quality: Quality;
  clouds: boolean;
  bloom: boolean;
  rearMirror: boolean;
  fov: number;
  masterVolume: number;
  musicVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  controlMode: 'STANDARD',
  invertPitch: false,
  mouseSensitivity: 1,
  aimAssist: true,
  quality: 'MEDIUM',
  clouds: true,
  bloom: true,
  rearMirror: false,
  fov: 65,
  masterVolume: 70,
  musicVolume: 50,
};

export interface MissionConfig {
  mode: MissionMode;
  aircraft: AircraftId;
  difficulty: Difficulty;
}

export interface Objective {
  id: string;
  text: string;
  done: boolean;
  failed?: boolean;
  progress?: string;
}

export interface RadioMessage {
  id: number;
  from: string;
  text: string;
  tone: 'ally' | 'enemy' | 'command' | 'system';
  time: number;
}

export interface MissionResult {
  success: boolean;
  reason: string;
  score: number;
  time: number;
  airKills: number;
  groundKills: number;
  shotsFired: number;
  hits: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
  mode: MissionMode;
  aircraft: AircraftId;
}

export interface Banner {
  title: string;
  subtitle?: string;
  tone: 'info' | 'success' | 'danger';
  id: number;
}

export const DIFFICULTY_TUNING: Record<Difficulty, {
  damageTaken: number;
  aiAccuracy: number;
  aiReaction: number;
  enemyCount: number;
  aiMissileRate: number;
}> = {
  EASY: { damageTaken: 0.5, aiAccuracy: 0.45, aiReaction: 0.55, enemyCount: 0.75, aiMissileRate: 0.5 },
  NORMAL: { damageTaken: 0.8, aiAccuracy: 0.65, aiReaction: 0.75, enemyCount: 1, aiMissileRate: 0.8 },
  HARD: { damageTaken: 1.1, aiAccuracy: 0.8, aiReaction: 0.9, enemyCount: 1.25, aiMissileRate: 1 },
  ACE: { damageTaken: 1.4, aiAccuracy: 0.95, aiReaction: 1, enemyCount: 1.5, aiMissileRate: 1.25 },
};
