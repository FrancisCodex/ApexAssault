export type WeaponId =
  | 'MSL' | 'XLAA' | 'QAAM' | 'GPB' | 'RKT' | 'HELLFIRE' | 'STINGER'
  | 'EMSL' | 'SAM' | 'BOMB';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  short: string;
  guided: boolean;
  air: boolean;
  ground: boolean;
  lockRange: number;
  /** Half-angle (deg) of the lock cone around the nose. */
  lockCone: number;
  lockTime: number;
  /** Number of simultaneous locks (multi-target weapons). */
  multiLock: number;
  /** Rounds fired per trigger pull (rockets). */
  salvo: number;
  /** Seconds before the weapon can fire again. */
  reload: number;
  /** Number of hardpoints that reload independently (Ace Combat style alternating rails). */
  rails: number;
  launchSpeed: number;
  maxSpeed: number;
  accel: number;
  burnTime: number;
  turnG: number;
  seekerCone: number;
  life: number;
  damage: number;
  blastRadius: number;
  proximity: number;
  /** 0 = always decoyed by flares, 1 = immune. */
  flareResist: number;
  /** Free-fall weapon (bombs). */
  drop: boolean;
  scale: number;
  smoke: boolean;
}

const base: Omit<WeaponSpec, 'id' | 'name' | 'short'> = {
  guided: true, air: true, ground: true, lockRange: 3600, lockCone: 35, lockTime: 0.5,
  multiLock: 1, salvo: 1, reload: 1.6, rails: 2, launchSpeed: 20, maxSpeed: 800, accel: 450,
  burnTime: 3.5, turnG: 32, seekerCone: 55, life: 11, damage: 75, blastRadius: 18,
  proximity: 13, flareResist: 0.35, drop: false, scale: 1, smoke: true,
};

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  MSL: { ...base, id: 'MSL', name: 'Standard Missile', short: 'MSL' },
  XLAA: {
    ...base, id: 'XLAA', name: 'Long-Range AAM', short: 'XLAA', ground: false,
    lockRange: 6500, lockCone: 28, lockTime: 0.35, multiLock: 4, reload: 9, rails: 1,
    maxSpeed: 950, accel: 520, burnTime: 5, turnG: 26, seekerCone: 45, life: 14, damage: 100,
    proximity: 16, flareResist: 0.5, scale: 1.3,
  },
  QAAM: {
    ...base, id: 'QAAM', name: 'High-Agility AAM', short: 'QAAM', ground: false,
    lockRange: 3200, lockCone: 45, lockTime: 0.4, reload: 4.5, rails: 1,
    maxSpeed: 840, accel: 560, turnG: 70, seekerCone: 130, life: 12, damage: 95, flareResist: 0.8,
  },
  GPB: {
    ...base, id: 'GPB', name: 'Guided Penetration Bomb', short: 'GPB', air: false,
    lockRange: 4200, lockCone: 55, lockTime: 0.6, reload: 3.5, rails: 1, launchSpeed: 0,
    maxSpeed: 400, accel: 0, burnTime: 0, turnG: 5, seekerCone: 80, life: 30, damage: 280,
    blastRadius: 70, proximity: 8, flareResist: 1, drop: true, scale: 1.6, smoke: false,
  },
  RKT: {
    ...base, id: 'RKT', name: 'Rocket Launcher', short: 'RKT', guided: false,
    lockRange: 2500, lockCone: 20, salvo: 6, reload: 3.5, rails: 1, launchSpeed: 120,
    maxSpeed: 650, accel: 900, burnTime: 1.2, turnG: 0, life: 5, damage: 50, blastRadius: 24,
    proximity: 9, scale: 0.6,
  },
  HELLFIRE: {
    ...base, id: 'HELLFIRE', name: 'AGM-114 Hellfire', short: 'AGM', air: false,
    lockRange: 4800, lockCone: 32, lockTime: 0.35, multiLock: 4, reload: 7, rails: 1,
    maxSpeed: 450, accel: 320, burnTime: 4, turnG: 25, seekerCone: 70, life: 16, damage: 230,
    blastRadius: 32, proximity: 8, flareResist: 1,
  },
  STINGER: {
    ...base, id: 'STINGER', name: 'FIM-92 Stinger', short: 'AAM', ground: false,
    lockRange: 3000, lockCone: 30, reload: 2, maxSpeed: 680, turnG: 30, damage: 85, proximity: 11,
    scale: 0.7,
  },
  EMSL: {
    ...base, id: 'EMSL', name: 'R-73', short: 'MSL', ground: false, lockRange: 3200,
    maxSpeed: 720, turnG: 24, damage: 34, flareResist: 0.15, life: 10,
  },
  SAM: {
    ...base, id: 'SAM', name: 'SA-11 SAM', short: 'SAM', ground: false, lockRange: 7000,
    launchSpeed: 60, maxSpeed: 700, accel: 320, burnTime: 6, turnG: 21, seekerCone: 60, life: 20,
    damage: 50, proximity: 16, flareResist: 0.25, scale: 1.8,
  },
  BOMB: {
    ...base, id: 'BOMB', name: 'FAB-500', short: 'BOMB', guided: false, air: false,
    launchSpeed: 0, maxSpeed: 400, accel: 0, burnTime: 0, turnG: 0, life: 40, damage: 200,
    blastRadius: 60, proximity: 6, drop: true, scale: 1.5, smoke: false, reload: 0.15,
  },
};

export const BULLET_SPEED = 1000;
export const BULLET_LIFE = 1.7;
