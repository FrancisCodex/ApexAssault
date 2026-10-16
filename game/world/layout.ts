import type { Team } from '../data/types';

/**
 * Theatre: the island of Varga. Our forces hold Port Ardent Air Base on the western
 * coast. The Kessel Federation has dug in on the eastern plateau behind the Greyspine
 * mountains, guarding the only low pass with a SAM belt.
 */
export const MAP = {
  half: 16000,
  /** Leaving this square triggers "RETURN TO COMBAT AREA". */
  combatHalf: 13500,
  seaFloor: -160,
};

export const FRIENDLY_BASE = { x: -9500, z: 2500, radius: 2300, name: 'Port Ardent AB' };
export const ENEMY_BASE = { x: 8500, z: -4500, radius: 2400, name: 'Kessel Ridge AB' };
export const PASS = { x: 250, z: -1200, name: 'Greyspine Pass' };
export const RIDGE_PEAK_HINT = { x: 1100, z: 1600 };
export const OUTPOST = { x: 4600, z: 1800, name: 'Outpost Bravo' };

export const TOWNS = [
  { x: -11900, z: 5200, radius: 900, count: 260, name: 'Ardent Harbor' },
  { x: -6200, z: 6800, radius: 500, count: 90, name: 'Millbrook' },
  { x: -7000, z: -3600, radius: 450, count: 70, name: 'Southfield' },
  { x: 5200, z: -8600, radius: 600, count: 140, name: 'Drava (occupied)' },
  { x: 11000, z: 1500, radius: 500, count: 90, name: 'Kessgrad' },
];

export type GroundKind =
  | 'HANGAR' | 'TOWER' | 'HQ' | 'BUNKER' | 'RADAR' | 'RADOME' | 'FUEL'
  | 'SAM' | 'AA' | 'COMMS' | 'BARRACKS' | 'SHELTER';

export type SiteGroup = 'FB' | 'EB' | 'PASS' | 'OUTPOST' | 'RIDGE';

export interface SiteDef {
  kind: GroundKind;
  x: number;
  z: number;
  rot?: number;
  team: Team;
  group: SiteGroup;
  name?: string;
}

const fb = (kind: GroundKind, dx: number, dz: number, rot = 0, name?: string): SiteDef => ({
  kind, x: FRIENDLY_BASE.x + dx, z: FRIENDLY_BASE.z + dz, rot, team: 'BLUE', group: 'FB', name,
});
const eb = (kind: GroundKind, dx: number, dz: number, rot = 0, name?: string): SiteDef => ({
  kind, x: ENEMY_BASE.x + dx, z: ENEMY_BASE.z + dz, rot, team: 'RED', group: 'EB', name,
});

/** Runway definitions: center, length along heading (rad, 0 = along X axis). */
export const RUNWAYS = [
  { x: FRIENDLY_BASE.x, z: FRIENDLY_BASE.z, length: 2700, width: 55, rot: 0, team: 'BLUE' as Team },
  { x: ENEMY_BASE.x + 300, z: ENEMY_BASE.z, length: 2600, width: 50, rot: Math.PI / 2, team: 'RED' as Team },
];

export const SITES: SiteDef[] = [
  // ---- Port Ardent Air Base (friendly) ----
  fb('HQ', 1000, 520, 0, 'Base Command'),
  fb('TOWER', 500, 300, 0, 'Control Tower'),
  fb('HANGAR', -900, 380, 0, 'Hangar A'),
  fb('HANGAR', -620, 380, 0, 'Hangar B'),
  fb('HANGAR', -340, 380, 0, 'Hangar C'),
  fb('HANGAR', -60, 380, 0, 'Hangar D'),
  fb('RADOME', 200, 750, 0, 'Air Defense Radar'),
  fb('FUEL', -1150, 640, 0, 'Fuel Depot 1'),
  fb('FUEL', -1150, 700 + 40, 0, 'Fuel Depot 2'),
  fb('FUEL', -1210, 690, 0, 'Fuel Depot 3'),
  fb('BARRACKS', 1100, 260, 0, 'Barracks'),
  fb('AA', -1500, -250, 0, 'AA Battery W'),
  fb('AA', 1500, -250, 0, 'AA Battery E'),
  fb('AA', 0, 1000, 0, 'AA Battery N'),
  fb('SAM', 1700, 700, 0, 'Patriot E'),
  fb('SAM', -1500, 900, 0, 'Patriot W'),

  // ---- Greyspine Pass forward air-defense line (enemy) ----
  { kind: 'SAM', x: PASS.x + 50, z: PASS.z + 380, team: 'RED', group: 'PASS', name: 'SAM Site Alpha' },
  { kind: 'SAM', x: PASS.x - 420, z: PASS.z - 350, team: 'RED', group: 'PASS', name: 'SAM Site Bravo' },
  { kind: 'SAM', x: PASS.x + 520, z: PASS.z - 260, team: 'RED', group: 'PASS', name: 'SAM Site Charlie' },
  { kind: 'AA', x: PASS.x - 120, z: PASS.z, team: 'RED', group: 'PASS', name: 'Pass AA' },
  { kind: 'AA', x: PASS.x + 260, z: PASS.z + 60, team: 'RED', group: 'PASS', name: 'Pass AA 2' },
  { kind: 'RADAR', x: RIDGE_PEAK_HINT.x, z: RIDGE_PEAK_HINT.z, team: 'RED', group: 'RIDGE', name: 'Greyspine Radar' },

  // ---- Outpost Bravo ----
  { kind: 'SAM', x: OUTPOST.x, z: OUTPOST.z, team: 'RED', group: 'OUTPOST', name: 'Outpost SAM' },
  { kind: 'AA', x: OUTPOST.x + 180, z: OUTPOST.z + 120, team: 'RED', group: 'OUTPOST', name: 'Outpost AA' },
  { kind: 'BARRACKS', x: OUTPOST.x - 150, z: OUTPOST.z + 40, team: 'RED', group: 'OUTPOST', name: 'Outpost Barracks' },
  { kind: 'COMMS', x: OUTPOST.x - 60, z: OUTPOST.z - 160, team: 'RED', group: 'OUTPOST', name: 'Relay Tower' },

  // ---- Kessel Ridge Air Base (enemy) ----
  eb('BUNKER', -750, 50, 0, 'Kessel Command HQ'),
  eb('COMMS', -820, -330, 0, 'Command Uplink'),
  eb('RADAR', -620, 650, 0, 'Base Radar'),
  eb('HANGAR', -60, -800, Math.PI / 2, 'Hangar 1'),
  eb('HANGAR', -60, -500, Math.PI / 2, 'Hangar 2'),
  eb('HANGAR', -60, -200, Math.PI / 2, 'Hangar 3'),
  eb('HANGAR', -60, 100, Math.PI / 2, 'Hangar 4'),
  eb('SHELTER', -60, 420, Math.PI / 2, 'Shelter 1'),
  eb('SHELTER', -60, 620, Math.PI / 2, 'Shelter 2'),
  eb('FUEL', -480, -950, 0, 'Fuel Farm 1'),
  eb('FUEL', -420, -1000, 0, 'Fuel Farm 2'),
  eb('BARRACKS', -500, 300, Math.PI / 2, 'Barracks'),
  eb('TOWER', 120, 350, 0, 'Control Tower'),
  eb('AA', 700, -700, 0, 'AA Gun 1'),
  eb('AA', 700, 700, 0, 'AA Gun 2'),
  eb('AA', -1050, 300, 0, 'AA Gun 3'),
  eb('AA', -1000, -700, 0, 'AA Gun 4'),
  eb('AA', -300, -1300, 0, 'AA Gun 5'),
  eb('SAM', 1100, 0, 0, 'SAM Site East'),
  eb('SAM', -1300, -100, 0, 'SAM Site West'),
  eb('SAM', -200, -1600, 0, 'SAM Site South'),
  eb('SAM', -200, 1500, 0, 'SAM Site North'),
];

/** Flattening radius around each structure so nothing floats on a slope. */
export const PAD_RADIUS: Record<GroundKind, number> = {
  HANGAR: 70, TOWER: 40, HQ: 80, BUNKER: 90, RADAR: 45, RADOME: 45, FUEL: 35,
  SAM: 45, AA: 30, COMMS: 30, BARRACKS: 55, SHELTER: 50,
};
