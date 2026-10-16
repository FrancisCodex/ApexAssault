import type { WeaponId } from './weapons';

export type AircraftId =
  | 'F14' | 'F22' | 'A10' | 'SPITFIRE' | 'AH64'
  | 'MIG21' | 'SU27' | 'SU57' | 'TU22' | 'SU25';

export type FlightKind = 'JET' | 'PROP' | 'HELI';
export type Role = 'FIGHTER' | 'MULTIROLE' | 'ATTACKER' | 'BOMBER' | 'HELI';

export interface AircraftSpec {
  id: AircraftId;
  name: string;
  short: string;
  kind: FlightKind;
  role: Role;
  description: string;
  hp: number;
  /** Generous collision radius used for gun / missile hits (meters). */
  hitRadius: number;
  /** Visual scale factor for camera framing. */
  size: number;

  // --- Flight model (SI units: m, m/s, rad/s) ---
  stallSpeed: number;
  cornerSpeed: number;
  maxSpeed: number;
  /** Acceleration from engines at military power (m/s²). */
  milAccel: number;
  /** Acceleration with afterburner / emergency power (m/s²). */
  abAccel: number;
  maxG: number;
  pitchRate: number;
  rollRate: number;
  yawRate: number;
  /** How quickly body rates reach the commanded rate. */
  response: number;
  /** How fast the velocity vector follows the nose (lift). */
  liftAlign: number;
  /** Post-stall / high-G turn multiplier (thrust vectoring = high). */
  psm: number;
  /** Speed bleed at full G (m/s²). */
  turnBleed: number;

  gun: { rate: number; damage: number; ammo: number; spread: number; name: string };
  missile: WeaponId;
  missiles: number;
  special: WeaponId;
  specialAmmo: number;
  flares: number;

  /** 0-100 values for the hangar screen. */
  ui: { speed: number; mobility: number; armor: number; air: number; ground: number };
  /** Cockpit eye offset in local space. */
  cockpit: [number, number, number];
}

export const AIRCRAFT: Record<AircraftId, AircraftSpec> = {
  F14: {
    id: 'F14', name: 'F-14D Super Tomcat', short: 'F-14D', kind: 'JET', role: 'MULTIROLE',
    description: 'Swing-wing fleet defender. Long-range XLAA lets you lock four bandits at once before they ever see you.',
    hp: 115, hitRadius: 10, size: 1.15,
    stallSpeed: 62, cornerSpeed: 175, maxSpeed: 375, milAccel: 14, abAccel: 27,
    maxG: 8, pitchRate: 1.25, rollRate: 3.5, yawRate: 0.35, response: 5, liftAlign: 3.2, psm: 1.35, turnBleed: 26,
    gun: { rate: 20, damage: 6, ammo: 1400, spread: 0.0035, name: 'M61A1 20mm' },
    missile: 'MSL', missiles: 80, special: 'XLAA', specialAmmo: 16, flares: 30,
    ui: { speed: 85, mobility: 70, armor: 75, air: 92, ground: 55 },
    cockpit: [0, 1.15, -4.2],
  },
  F22: {
    id: 'F22', name: 'F-22A Raptor', short: 'F-22A', kind: 'JET', role: 'FIGHTER',
    description: 'Stealth air-superiority fighter with thrust vectoring. Unmatched post-stall maneuvers and high-agility QAAM.',
    hp: 100, hitRadius: 9, size: 1.05,
    stallSpeed: 52, cornerSpeed: 160, maxSpeed: 400, milAccel: 17, abAccel: 31,
    maxG: 9, pitchRate: 1.45, rollRate: 4.2, yawRate: 0.45, response: 6, liftAlign: 3.6, psm: 1.9, turnBleed: 24,
    gun: { rate: 20, damage: 6, ammo: 1200, spread: 0.003, name: 'M61A2 20mm' },
    missile: 'MSL', missiles: 76, special: 'QAAM', specialAmmo: 18, flares: 30,
    ui: { speed: 95, mobility: 98, armor: 60, air: 98, ground: 45 },
    cockpit: [0, 1.0, -3.9],
  },
  A10: {
    id: 'A10', name: 'A-10C Thunderbolt II', short: 'A-10C', kind: 'JET', role: 'ATTACKER',
    description: 'Flying tank built around a 30mm cannon. Slow, but shrugs off flak and levels bases with guided bombs.',
    hp: 175, hitRadius: 10, size: 1.1,
    stallSpeed: 45, cornerSpeed: 130, maxSpeed: 225, milAccel: 12, abAccel: 13.5,
    maxG: 7, pitchRate: 1.2, rollRate: 3.2, yawRate: 0.5, response: 5, liftAlign: 3.4, psm: 1.2, turnBleed: 20,
    gun: { rate: 40, damage: 9, ammo: 1150, spread: 0.004, name: 'GAU-8 30mm' },
    missile: 'MSL', missiles: 48, special: 'GPB', specialAmmo: 24, flares: 40,
    ui: { speed: 45, mobility: 60, armor: 98, air: 50, ground: 98 },
    cockpit: [0, 1.25, -3.6],
  },
  SPITFIRE: {
    id: 'SPITFIRE', name: 'Spitfire Mk IX (Restomod)', short: 'SPITFIRE', kind: 'PROP', role: 'FIGHTER',
    description: 'A legend with modern avionics. Turns inside anything in the sky. Rocket salvos shred ground defenses.',
    hp: 85, hitRadius: 8, size: 0.85,
    stallSpeed: 38, cornerSpeed: 105, maxSpeed: 195, milAccel: 10, abAccel: 12,
    maxG: 7, pitchRate: 1.65, rollRate: 3.8, yawRate: 0.6, response: 6, liftAlign: 4.2, psm: 1.3, turnBleed: 16,
    gun: { rate: 22, damage: 7, ammo: 1500, spread: 0.005, name: 'Hispano 20mm' },
    missile: 'MSL', missiles: 32, special: 'RKT', specialAmmo: 48, flares: 20,
    ui: { speed: 35, mobility: 100, armor: 40, air: 70, ground: 75 },
    cockpit: [0, 0.75, 0.2],
  },
  AH64: {
    id: 'AH64', name: 'AH-64E Apache Guardian', short: 'AH-64E', kind: 'HELI', role: 'HELI',
    description: 'Hover, strafe and pop up from behind ridges. Hellfire salvos crack bunkers; Stingers keep fighters honest.',
    hp: 150, hitRadius: 9, size: 1.0,
    stallSpeed: 0, cornerSpeed: 40, maxSpeed: 90, milAccel: 0, abAccel: 0,
    maxG: 3.5, pitchRate: 1.2, rollRate: 1.6, yawRate: 1.6, response: 3, liftAlign: 0, psm: 1, turnBleed: 0,
    gun: { rate: 10, damage: 11, ammo: 1200, spread: 0.004, name: 'M230 30mm' },
    missile: 'STINGER', missiles: 16, special: 'HELLFIRE', specialAmmo: 16, flares: 40,
    ui: { speed: 15, mobility: 85, armor: 85, air: 45, ground: 95 },
    cockpit: [0, 1.0, -2.6],
  },

  // ---------------- Enemy / AI only ----------------
  MIG21: {
    id: 'MIG21', name: 'MiG-21bis Fishbed', short: 'MiG-21', kind: 'JET', role: 'FIGHTER', description: '',
    hp: 70, hitRadius: 10, size: 0.9,
    stallSpeed: 70, cornerSpeed: 180, maxSpeed: 330, milAccel: 13, abAccel: 24,
    maxG: 7, pitchRate: 1.1, rollRate: 3.4, yawRate: 0.3, response: 4.5, liftAlign: 3, psm: 1.2, turnBleed: 26,
    gun: { rate: 15, damage: 4, ammo: 400, spread: 0.008, name: 'GSh-23' },
    missile: 'EMSL', missiles: 4, special: 'EMSL', specialAmmo: 0, flares: 6,
    ui: { speed: 0, mobility: 0, armor: 0, air: 0, ground: 0 }, cockpit: [0, 1, -3],
  },
  SU27: {
    id: 'SU27', name: 'Su-27SM Flanker', short: 'Su-27', kind: 'JET', role: 'FIGHTER', description: '',
    hp: 100, hitRadius: 11, size: 1.15,
    stallSpeed: 60, cornerSpeed: 165, maxSpeed: 360, milAccel: 15, abAccel: 27,
    maxG: 8.5, pitchRate: 1.3, rollRate: 3.8, yawRate: 0.4, response: 5, liftAlign: 3.4, psm: 1.5, turnBleed: 24,
    gun: { rate: 18, damage: 4, ammo: 500, spread: 0.007, name: 'GSh-30-1' },
    missile: 'EMSL', missiles: 6, special: 'EMSL', specialAmmo: 0, flares: 10,
    ui: { speed: 0, mobility: 0, armor: 0, air: 0, ground: 0 }, cockpit: [0, 1, -4],
  },
  SU57: {
    id: 'SU57', name: 'Su-57 Felon "Crimson Wolf"', short: 'Su-57', kind: 'JET', role: 'FIGHTER', description: '',
    hp: 150, hitRadius: 11, size: 1.15,
    stallSpeed: 50, cornerSpeed: 160, maxSpeed: 395, milAccel: 17, abAccel: 31,
    maxG: 9, pitchRate: 1.45, rollRate: 4.2, yawRate: 0.45, response: 6, liftAlign: 3.6, psm: 1.85, turnBleed: 22,
    gun: { rate: 18, damage: 5, ammo: 600, spread: 0.005, name: 'GSh-30-1' },
    missile: 'EMSL', missiles: 10, special: 'EMSL', specialAmmo: 0, flares: 16,
    ui: { speed: 0, mobility: 0, armor: 0, air: 0, ground: 0 }, cockpit: [0, 1, -4],
  },
  TU22: {
    id: 'TU22', name: 'Tu-22M3 Backfire', short: 'Tu-22M', kind: 'JET', role: 'BOMBER', description: '',
    hp: 260, hitRadius: 20, size: 2.2,
    stallSpeed: 80, cornerSpeed: 200, maxSpeed: 290, milAccel: 10, abAccel: 14,
    maxG: 3, pitchRate: 0.45, rollRate: 1.1, yawRate: 0.2, response: 2.5, liftAlign: 2.2, psm: 1, turnBleed: 10,
    gun: { rate: 8, damage: 3, ammo: 800, spread: 0.01, name: 'GSh-23 tail' },
    missile: 'BOMB', missiles: 12, special: 'BOMB', specialAmmo: 0, flares: 10,
    ui: { speed: 0, mobility: 0, armor: 0, air: 0, ground: 0 }, cockpit: [0, 1.5, -12],
  },
  SU25: {
    id: 'SU25', name: 'Su-25 Frogfoot', short: 'Su-25', kind: 'JET', role: 'ATTACKER', description: '',
    hp: 140, hitRadius: 10, size: 1.0,
    stallSpeed: 55, cornerSpeed: 140, maxSpeed: 260, milAccel: 12, abAccel: 14,
    maxG: 6.5, pitchRate: 1.1, rollRate: 3, yawRate: 0.4, response: 4.5, liftAlign: 3.2, psm: 1.2, turnBleed: 20,
    gun: { rate: 15, damage: 5, ammo: 600, spread: 0.008, name: 'GSh-30-2' },
    missile: 'BOMB', missiles: 6, special: 'BOMB', specialAmmo: 0, flares: 12,
    ui: { speed: 0, mobility: 0, armor: 0, air: 0, ground: 0 }, cockpit: [0, 1, -3],
  },
};

export const PLAYABLE: AircraftId[] = ['F14', 'F22', 'A10', 'SPITFIRE', 'AH64'];
