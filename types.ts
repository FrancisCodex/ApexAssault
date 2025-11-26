export type PlaneType = 'FIGHTER' | 'PROPELLER' | 'HELICOPTER';

export interface PlaneStats {
  id: PlaneType;
  name: string;
  speed: number;
  turnSpeed: number;
  health: number;
  damage: number;
  fireRate: number; // ms between shots
  description: string;
  skill: Skill;
}

export interface Skill {
  name: string;
  description: string;
  cooldown: number; // ms
  damage: number;
  duration?: number; // for barrage
  fireRate?: number; // for barrage
}

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'VICTORY';

export type ControlScheme = 'MOUSE' | 'KEYBOARD';

export interface Settings {
  controlScheme: ControlScheme;
  showClouds: boolean;
  masterVolume: number;
}

export interface LastResult {
  score: number;
  wave: number;
  plane: string;
}

export interface GameState {
  status: GameStatus;
  wave: number;
  score: number;
  enemiesKilled: number;
  selectedPlane: PlaneType;
  playerHealth: number;
  maxPlayerHealth: number;
  isFiring: boolean;
  lastResult: LastResult | null;
  settings: Settings;
}

export const PLANE_STATS: Record<PlaneType, PlaneStats> = {
  FIGHTER: {
    id: 'FIGHTER',
    name: 'F-14 Tomcat',
    speed: 1.5,
    turnSpeed: 1.5,
    health: 100,
    damage: 30,
    fireRate: 170,
    description: 'High speed, rapid fire, balanced handling.',
    skill: {
      name: 'Homer Missile',
      description: 'Fires a tracking missile.',
      cooldown: 10000,
      damage: 75
    }
  },
  PROPELLER: {
    id: 'PROPELLER',
    name: 'Spitfire MK',
    speed: 1.5,
    turnSpeed: 2.75,
    health: 90,
    damage: 20,
    fireRate: 120,
    description: 'Agile dogfighter, heavy hits, lower speed.',
    skill: {
      name: 'Trailing Missile',
      description: 'Fires a backward tracking missile.',
      cooldown: 10000,
      damage: 75
    }
  },
  HELICOPTER: {
    id: 'HELICOPTER',
    name: 'Apache AH-64',
    speed: 0.5,
    turnSpeed: 3.5,
    health: 170,
    damage: 8, // Gatling gun
    fireRate: 150,
    description: 'Tanky, extremely agile turning, gatling gun.',
    skill: {
      name: 'Missile Barrage',
      description: 'Rapid fire homing missiles for 2.5s.',
      cooldown: 10000,
      damage: 10,
      duration: 2500,
      fireRate: 20
    }
  },
};