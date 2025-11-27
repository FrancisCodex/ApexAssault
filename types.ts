export type PlaneType = 'FIGHTER' | 'PROPELLER' | 'HELICOPTER';

export interface PlaneStats {
  id: PlaneType;
  name: string;
  speed: number;
  turnSpeed: number;
  health: number;
  damage: number;
  fireRate: number; // ms between shots
  flareCooldown: number; // ms
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
  maxShots?: number;
  maxDistance?: number;
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
    speed: 1,
    turnSpeed: 2.5,
    health: 90,
    damage: 30,
    fireRate: 170,
    flareCooldown: 5000,
    description: 'High speed, rapid fire, balanced handling.',
    skill: {
      name: 'Homer Missile',
      description: 'Acivates 5 Homer Missiles for 10s.',
      cooldown: 10000,
      damage: 50,
      duration: 10000,
      maxShots: 5,
      maxDistance: 1500
    }
  },
  PROPELLER: {
    id: 'PROPELLER',
    name: 'Spitfire MK',
    speed: .75,
    turnSpeed: 3.75,
    health: 85,
    damage: 20,
    fireRate: 120,
    flareCooldown: 5000,
    description: 'Agile dogfighter, heavy hits, lower speed.',
    skill: {
      name: 'Trailing Missile',
      description: 'Rear-firing missile barrage.',
      cooldown: 10000,
      damage: 50,
      duration: 2500,
      fireRate: 50,
      maxDistance: 1000
    }
  },
  HELICOPTER: {
    id: 'HELICOPTER',
    name: 'Apache AH-64',
    speed: 0.5,
    turnSpeed: 4,
    health: 170,
    damage: 15, // Gatling gun
    fireRate: 150,
    flareCooldown: 5000,
    description: 'Tanky, extremely agile turning, gatling gun.',
    skill: {
      name: 'Missile Barrage',
      description: 'Manual rapid fire missiles. Homing in FOV.',
      cooldown: 10000,
      damage: 12,
      duration: 2500,
      fireRate: 250,
      maxDistance: 600
    }
  },
};