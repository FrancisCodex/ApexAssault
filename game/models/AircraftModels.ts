import * as THREE from 'three';
import type { AircraftId } from '../data/aircraft';
import type { Team } from '../data/types';
import { PartBuilder, fuselage, wing, fin, box, cyl, tube, sphere } from './PartBuilder';

export interface AircraftModel {
  root: THREE.Group;
  body: THREE.Mesh;
  nozzles: { pos: THREE.Vector3; radius: number }[];
  props: THREE.Object3D[];
  rotors: THREE.Object3D[];
  tailRotors: THREE.Object3D[];
  wingtips: THREE.Vector3[];
  muzzle: THREE.Vector3;
  length: number;
}

const CANOPY = '#16222e';
const NOZZLE = '#3b3936';
const TEAM_MARK: Record<Team, string> = { BLUE: '#2563eb', RED: '#b91c1c' };

let sharedMaterial: THREE.MeshStandardMaterial | null = null;
export const airframeMaterial = () =>
  (sharedMaterial ??= new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.45, roughness: 0.5, envMapIntensity: 1.0,
  }));

const geometryCache = new Map<string, { geo: THREE.BufferGeometry; meta: Omit<AircraftModel, 'root' | 'body' | 'props' | 'rotors' | 'tailRotors'> }>();

interface JetParams {
  length: number;
  radius: number;
  squashY?: number;
  squashX?: number;
  main: string;
  dark: string;
  accent?: string;
  canopy: [number, number, number, number]; // y, z, length, width
  wing: { root: number; tip: number; span: number; sweep: number; x: number; y: number; z: number; thick: number; dihedral?: number };
  stab?: { root: number; tip: number; span: number; sweep: number; x: number; y: number; z: number };
  canard?: { root: number; tip: number; span: number; sweep: number; x: number; y: number; z: number };
  fins: { twin: boolean; root: number; tip: number; h: number; sweep: number; x: number; y: number; z: number; cant: number };
  engines: { x: number; y: number; z: number; r: number; nacelle?: number };
  center?: { w: number; h: number; len: number; z: number; y: number };
  intakes?: { x: number; y: number; z: number; w: number; h: number; len: number };
}

const JETS: Partial<Record<AircraftId, JetParams>> = {
  F14: {
    length: 12, radius: 0.95, squashY: 0.85, main: '#a7afb7', dark: '#6f7780',
    canopy: [0.85, -3.6, 3.4, 1.0],
    wing: { root: 4.6, tip: 1.5, span: 7.6, sweep: 4.4, x: 2.1, y: 0.05, z: -0.4, thick: 0.35, dihedral: -0.02 },
    stab: { root: 3.3, tip: 1.1, span: 3.6, sweep: 2.6, x: 2.0, y: -0.25, z: 5.0 },
    fins: { twin: true, root: 3.4, tip: 1.2, h: 3.4, sweep: 2.6, x: 1.45, y: 0.4, z: 4.0, cant: 0.12 },
    engines: { x: 1.45, y: -0.35, z: 8.6, r: 0.68, nacelle: 9.5 },
    center: { w: 3.6, h: 1.0, len: 9.5, z: 2.6, y: -0.1 },
    intakes: { x: 1.45, y: -0.25, z: -1.6, w: 1.2, h: 1.3, len: 1.6 },
  },
  F22: {
    length: 13, radius: 0.9, squashY: 0.75, squashX: 1.15, main: '#7b838c', dark: '#565d65',
    canopy: [0.75, -3.2, 3.2, 0.95],
    wing: { root: 7.0, tip: 1.3, span: 5.2, sweep: 5.6, x: 1.6, y: 0, z: -1.2, thick: 0.35 },
    stab: { root: 3.0, tip: 1.2, span: 2.9, sweep: 2.4, x: 1.5, y: -0.1, z: 5.6 },
    fins: { twin: true, root: 3.0, tip: 1.1, h: 2.9, sweep: 2.3, x: 1.5, y: 0.35, z: 4.2, cant: 0.45 },
    engines: { x: 0.65, y: -0.1, z: 8.4, r: 0.62 },
    center: { w: 3.4, h: 0.95, len: 10, z: 2.4, y: -0.1 },
    intakes: { x: 1.35, y: -0.15, z: -1.8, w: 0.9, h: 1.2, len: 2.0 },
  },
  MIG21: {
    length: 13.5, radius: 0.75, main: '#b39c69', dark: '#7e6c45', accent: '#5f6b3e',
    canopy: [0.62, -2.2, 2.2, 0.7],
    wing: { root: 6.0, tip: 0.6, span: 3.6, sweep: 5.4, x: 0.6, y: -0.1, z: -0.6, thick: 0.25 },
    stab: { root: 2.0, tip: 0.6, span: 2.0, sweep: 1.6, x: 0.6, y: 0, z: 4.6 },
    fins: { twin: false, root: 3.8, tip: 1.0, h: 2.8, sweep: 3.0, x: 0, y: 0.6, z: 2.6, cant: 0 },
    engines: { x: 0, y: 0, z: 6.9, r: 0.62 },
  },
  SU27: {
    length: 14, radius: 0.9, squashY: 0.85, main: '#8aa0b5', dark: '#5f748a', accent: '#c8d3dc',
    canopy: [0.85, -4.0, 3.0, 0.95],
    wing: { root: 5.6, tip: 1.3, span: 5.8, sweep: 4.6, x: 1.7, y: 0, z: -0.6, thick: 0.35 },
    stab: { root: 3.0, tip: 1.0, span: 3.2, sweep: 2.2, x: 2.2, y: -0.2, z: 6.2 },
    fins: { twin: true, root: 3.2, tip: 1.1, h: 3.4, sweep: 2.5, x: 2.1, y: 0.4, z: 4.6, cant: 0.05 },
    engines: { x: 1.15, y: -0.45, z: 9.0, r: 0.7, nacelle: 9.0 },
    center: { w: 3.2, h: 0.9, len: 9, z: 3.2, y: -0.15 },
    intakes: { x: 1.15, y: -0.55, z: -0.8, w: 1.1, h: 1.0, len: 2.2 },
  },
  SU57: {
    length: 14, radius: 0.9, squashY: 0.72, squashX: 1.2, main: '#3d3f44', dark: '#26272b', accent: '#9b1c1c',
    canopy: [0.75, -3.8, 3.0, 0.95],
    wing: { root: 7.0, tip: 1.4, span: 5.4, sweep: 5.4, x: 1.8, y: 0, z: -0.8, thick: 0.32 },
    stab: { root: 3.0, tip: 1.0, span: 3.0, sweep: 2.2, x: 2.2, y: -0.15, z: 6.0 },
    fins: { twin: true, root: 3.0, tip: 1.0, h: 2.7, sweep: 2.4, x: 1.9, y: 0.4, z: 4.8, cant: 0.5 },
    engines: { x: 1.1, y: -0.35, z: 8.8, r: 0.66, nacelle: 8.5 },
    center: { w: 3.4, h: 0.85, len: 10, z: 2.8, y: -0.1 },
    intakes: { x: 1.15, y: -0.5, z: -0.6, w: 1.1, h: 0.9, len: 2.2 },
  },
  SU25: {
    length: 13, radius: 0.85, main: '#6f6a4a', dark: '#4a4733', accent: '#8a7e5a',
    canopy: [0.8, -3.4, 2.0, 0.85],
    wing: { root: 3.4, tip: 1.5, span: 6.8, sweep: 1.4, x: 1.2, y: 0.1, z: -0.4, thick: 0.4, dihedral: -0.04 },
    stab: { root: 2.2, tip: 1.0, span: 2.6, sweep: 1.3, x: 0.6, y: 0.6, z: 5.2 },
    fins: { twin: false, root: 3.0, tip: 1.4, h: 2.8, sweep: 1.6, x: 0, y: 0.6, z: 4.2, cant: 0 },
    engines: { x: 1.1, y: -0.1, z: 4.6, r: 0.55, nacelle: 6 },
  },
  TU22: {
    length: 40, radius: 1.8, main: '#cfd0c8', dark: '#9a9b93', accent: '#7b7c74',
    canopy: [1.6, -16, 4.0, 1.6],
    wing: { root: 9.5, tip: 2.6, span: 15, sweep: 10, x: 2.2, y: 0, z: -4, thick: 0.6 },
    stab: { root: 5, tip: 1.8, span: 6, sweep: 4.5, x: 1.2, y: 0.2, z: 14 },
    fins: { twin: false, root: 8, tip: 2.6, h: 7.5, sweep: 6.5, x: 0, y: 1.2, z: 10, cant: 0 },
    engines: { x: 1.3, y: -0.4, z: 20.6, r: 1.05, nacelle: 18 },
    center: { w: 5.0, h: 2.2, len: 18, z: 8, y: -0.2 },
    intakes: { x: 2.4, y: 0.2, z: -1, w: 1.6, h: 2.0, len: 3 },
  },
};

function buildJet(id: AircraftId, team: Team) {
  const p = JETS[id]!;
  const b = new PartBuilder();
  const L = p.length;
  const mark = TEAM_MARK[team];

  b.add(
    fuselage(L, [[0, 0.02], [0.06, p.radius * 0.35], [0.18, p.radius * 0.75], [0.33, p.radius], [0.75, p.radius * 0.95], [1, p.radius * 0.6]], 14, p.squashY ?? 1, p.squashX ?? 1),
    p.main, [0, 0, -L * 0.18],
  );
  // Radome tip.
  b.add(fuselage(L * 0.12, [[0, 0.01], [1, p.radius * 0.36]], 10), p.dark, [0, 0, -L * 0.18 - L * 0.5 + L * 0.03]);

  const [cy, cz, cl, cw] = p.canopy;
  b.add(sphere(0.5, 14, 10), CANOPY, [0, cy, cz], [0, 0, 0], [cw, 0.9, cl]);

  if (p.center) {
    const c = p.center;
    b.add(box(c.w, c.h, c.len), p.main, [0, c.y, c.z]);
    b.add(box(c.w * 0.7, c.h * 0.3, c.len * 0.8), p.dark, [0, c.y + c.h * 0.55, c.z + 0.5]);
  }
  if (p.intakes) {
    const it = p.intakes;
    b.addPair(box(it.w, it.h, it.len), p.dark, [it.x, it.y, it.z]);
  }

  const w = p.wing;
  b.addPair(wing(w.root, w.tip, w.span, w.sweep, w.thick, w.dihedral ?? 0), p.main, [w.x, w.y, w.z]);
  // Roundels on the wings.
  b.addPair(cyl(0.55 * (L / 13), 0.55 * (L / 13), 0.06, 16), mark, [w.x + w.span * 0.62, w.y + 0.2, w.z + w.sweep * 0.62 + (w.root + (w.tip - w.root) * 0.62) * 0.5]);
  if (p.accent) {
    b.addPair(wing(w.root * 0.35, w.tip * 0.6, w.span * 0.98, w.sweep, w.thick * 1.05, w.dihedral ?? 0), p.accent, [w.x + 0.02, w.y + 0.005, w.z + w.root * 0.55]);
  }

  if (p.stab) {
    const s = p.stab;
    b.addPair(wing(s.root, s.tip, s.span, s.sweep, 0.2), p.main, [s.x, s.y, s.z]);
  }
  if (p.canard) {
    const s = p.canard;
    b.addPair(wing(s.root, s.tip, s.span, s.sweep, 0.15), p.main, [s.x, s.y, s.z]);
  }

  const f = p.fins;
  if (f.twin) {
    b.addPair(fin(f.root, f.tip, f.h, f.sweep, 0.22), p.main, [f.x, f.y, f.z], [0, 0, -f.cant]);
    b.addPair(box(0.05, 0.6, 0.6), mark, [f.x + f.h * 0.45 * Math.sin(f.cant), f.y + f.h * 0.55, f.z + f.sweep * 0.6 + 0.6]);
  } else {
    b.add(fin(f.root, f.tip, f.h, f.sweep, 0.25), p.main, [f.x, f.y, f.z]);
    b.add(box(0.3, 0.6, 0.8), mark, [0, f.y + f.h * 0.55, f.z + f.sweep * 0.6 + 0.8]);
  }

  const e = p.engines;
  const nozzles: { pos: THREE.Vector3; radius: number }[] = [];
  const engineXs = e.x === 0 ? [0] : [e.x, -e.x];
  for (const x of engineXs) {
    if (e.nacelle) b.add(tube(e.r * 1.1, e.r * 1.15, e.nacelle), p.main, [x, e.y, e.z - e.nacelle / 2 - 0.3]);
    b.add(tube(e.r * 0.95, e.r, 1.4), NOZZLE, [x, e.y, e.z - 0.2]);
    nozzles.push({ pos: new THREE.Vector3(x, e.y, e.z + 0.5), radius: e.r * 0.85 });
  }

  // Under-wing ordnance for flavour.
  const pylonX = w.x + w.span * 0.38;
  const pylonZ = w.z + w.sweep * 0.38 + w.root * 0.45;
  b.addPair(tube(0.12, 0.12, L * 0.2, 6), '#e5e7eb', [pylonX, w.y - 0.45, pylonZ]);

  const geo = b.build();
  const span = w.x + w.span;
  const tipZ = w.z + w.sweep + w.tip * 0.5;
  return {
    geo,
    meta: {
      nozzles,
      wingtips: [new THREE.Vector3(span, w.y + w.span * Math.tan(w.dihedral ?? 0), tipZ), new THREE.Vector3(-span, w.y, tipZ)],
      muzzle: new THREE.Vector3(-0.8, 0.3, -L * 0.45),
      length: L * 1.4,
    },
  };
}

function buildA10(team: Team) {
  const b = new PartBuilder();
  const main = '#5f666b', dark = '#43494d';
  b.add(fuselage(15, [[0, 0.3], [0.08, 0.75], [0.25, 0.95], [0.6, 0.85], [1, 0.35]], 12), main, [0, 0, 0]);
  b.add(tube(0.18, 0.18, 1.6, 8), '#2d2d2d', [0, -0.3, -8.2]); // GAU-8 barrel
  b.add(sphere(0.5, 12, 8), CANOPY, [0, 0.8, -4.6], [0, 0, 0], [1.0, 0.9, 2.3]);
  b.addPair(wing(3.2, 1.7, 8.6, 0.4, 0.5, 0.06), main, [0.8, -0.4, -0.6]);
  b.addPair(cyl(0.6, 0.6, 0.06, 16), TEAM_MARK[team], [6, 0.05, 0.6]);
  // Engine pods high on the rear fuselage.
  b.addPair(tube(0.75, 0.7, 3.6, 12), main, [1.3, 1.25, 3.3]);
  b.addPair(box(0.25, 0.9, 1.6), dark, [0.75, 0.75, 3.2]);
  b.addPair(tube(0.6, 0.62, 0.6, 12), NOZZLE, [1.3, 1.25, 5.3]);
  b.addPair(wing(2.0, 1.4, 3.2, 0.2, 0.2), main, [0.3, 0.4, 6.0]);
  b.addPair(fin(2.4, 1.6, 2.8, 0.3, 0.2), main, [3.4, -0.6, 5.7]);
  // Bombs.
  b.addPair(tube(0.25, 0.25, 2.2, 8), '#6b7140', [3.0, -0.95, 0.6]);
  b.addPair(tube(0.25, 0.25, 2.2, 8), '#6b7140', [5.0, -0.85, 0.7]);
  return {
    geo: b.build(),
    meta: {
      nozzles: [{ pos: new THREE.Vector3(1.3, 1.25, 5.7), radius: 0.45 }, { pos: new THREE.Vector3(-1.3, 1.25, 5.7), radius: 0.45 }],
      wingtips: [new THREE.Vector3(9.4, 0.2, 0.8), new THREE.Vector3(-9.4, 0.2, 0.8)],
      muzzle: new THREE.Vector3(0, -0.3, -9),
      length: 18,
    },
  };
}

function buildSpitfire(team: Team) {
  const b = new PartBuilder();
  const top = '#56653f', under = '#9aa092', mark = TEAM_MARK[team];
  b.add(fuselage(8.6, [[0, 0.35], [0.12, 0.55], [0.3, 0.62], [0.55, 0.5], [1, 0.12]], 14, 1.15, 0.95), top, [0, 0, 0.5]);
  b.add(sphere(0.38, 12, 8), CANOPY, [0, 0.65, 0.4], [0, 0, 0], [0.9, 0.85, 2.6]);
  // Elliptical wing in two panels.
  b.addPair(wing(2.4, 1.9, 2.9, 0.05, 0.32, 0.08), top, [0.45, -0.3, -1.4]);
  b.addPair(wing(1.9, 0.6, 2.4, 0.55, 0.22, 0.08), top, [3.3, -0.06, -1.33]);
  b.addPair(cyl(0.55, 0.55, 0.06, 16), mark, [3.3, 0.18, -0.4]);
  b.addPair(cyl(0.3, 0.3, 0.07, 16), '#f5f5f5', [3.3, 0.19, -0.4]);
  b.addPair(wing(1.2, 0.5, 1.6, 0.4, 0.14), top, [0.1, 0.15, 4.0]);
  b.add(fin(1.5, 0.6, 1.6, 0.45, 0.14), top, [0, 0.25, 3.9]);
  b.add(box(0.5, 0.25, 1.2), under, [0, -0.62, -0.6]); // radiator
  b.addPair(tube(0.1, 0.1, 1.4, 6), '#2b2b2b', [1.8, -0.3, -1.7]); // cannons
  b.add(fuselage(0.9, [[0, 0.02], [0.6, 0.28], [1, 0.32]], 10), '#2a2a2a', [0, 0, -4.1]); // spinner
  const geo = b.build();

  const prop = new THREE.Group();
  const pb = new PartBuilder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    pb.add(box(0.22, 1.6, 0.06), '#1c1c1c', [Math.sin(a) * 0.8, Math.cos(a) * 0.8, 0], [0, 0, -a]);
  }
  const blades = new THREE.Mesh(pb.build(), airframeMaterial());
  prop.add(blades);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.65, 24),
    new THREE.MeshBasicMaterial({ color: '#222', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  prop.position.set(0, 0, -4.15);
  return {
    geo,
    prop,
    meta: {
      nozzles: [],
      wingtips: [new THREE.Vector3(5.6, 0.2, -0.6), new THREE.Vector3(-5.6, 0.2, -0.6)],
      muzzle: new THREE.Vector3(1.8, -0.3, -2.6),
      length: 10,
    },
  };
}

function buildApache(team: Team) {
  const b = new PartBuilder();
  const main = '#4f553a', dark = '#373b28';
  b.add(fuselage(9, [[0, 0.35], [0.12, 0.75], [0.35, 0.95], [0.7, 0.8], [1, 0.4]], 10, 1.25, 0.8), main, [0, 0, -1.2]);
  b.add(tube(0.35, 0.22, 7.5, 8), main, [0, 0.35, 6.6]); // tail boom
  b.add(sphere(0.5, 10, 8), CANOPY, [0, 0.75, -3.6], [0, 0, 0], [0.75, 1.1, 2.2]);
  b.add(sphere(0.5, 10, 8), CANOPY, [0, 1.15, -1.9], [0, 0, 0], [0.8, 1.0, 1.8]);
  b.addPair(box(0.9, 0.9, 3.2), dark, [0.95, 0.6, -0.2]); // engine nacelles
  b.addPair(wing(1.2, 0.9, 1.9, 0.1, 0.18), main, [0.6, -0.1, -0.6]); // stub wings
  b.addPair(box(0.5, 0.5, 1.8), '#5b6045', [1.9, -0.55, -0.1]); // hellfire racks
  b.addPair(tube(0.3, 0.3, 1.8, 8), '#3f4330', [2.3, -0.55, 0]); // rocket pods
  b.add(fin(1.6, 1.0, 2.2, 0.6, 0.18), main, [0, 0.4, 9.4]);
  b.addPair(wing(1.0, 0.7, 1.4, 0.1, 0.12), main, [0.1, 0.25, 9.6]);
  b.add(box(0.15, 0.8, 0.15), '#222', [0, -0.95, -4.0]); // gun mount
  b.add(tube(0.08, 0.08, 1.5, 6), '#222', [0, -1.3, -4.6]);
  b.addPair(box(0.12, 0.12, 2.2), '#222', [0.9, -1.35, -0.8]); // gear
  b.addPair(cyl(0.45, 0.45, 0.06, 14), TEAM_MARK[team], [0.75, 0.35, 3.0], [0, 0, Math.PI / 2]);
  b.add(cyl(0.18, 0.25, 0.9, 8), dark, [0, 1.55, -0.5]); // mast
  const geo = b.build();

  const rotor = new THREE.Group();
  const rb = new PartBuilder();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    rb.add(box(7.2, 0.06, 0.5), '#1e1e1e', [Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6], [0, -a, 0]);
  }
  rb.add(cyl(0.35, 0.35, 0.4, 10), '#2a2a2a');
  rotor.add(new THREE.Mesh(rb.build(), airframeMaterial()));
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(7.3, 32),
    new THREE.MeshBasicMaterial({ color: '#111', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  rotor.position.set(0, 2.05, -0.5);

  const tail = new THREE.Group();
  const tb = new PartBuilder();
  tb.add(box(0.06, 2.6, 0.25), '#1e1e1e');
  tb.add(box(0.06, 0.25, 2.6), '#1e1e1e');
  tail.add(new THREE.Mesh(tb.build(), airframeMaterial()));
  tail.position.set(0.35, 1.6, 10.0);

  return {
    geo, rotor, tail,
    meta: {
      nozzles: [],
      wingtips: [new THREE.Vector3(2.5, -0.1, 0), new THREE.Vector3(-2.5, -0.1, 0)],
      muzzle: new THREE.Vector3(0, -1.3, -5.4),
      length: 14,
    },
  };
}

export function createAircraftModel(id: AircraftId, team: Team): AircraftModel {
  const key = `${id}-${team}`;
  const root = new THREE.Group();
  const props: THREE.Object3D[] = [];
  const rotors: THREE.Object3D[] = [];
  const tailRotors: THREE.Object3D[] = [];
  let geo: THREE.BufferGeometry;
  let meta: Omit<AircraftModel, 'root' | 'body' | 'props' | 'rotors' | 'tailRotors'>;

  if (id === 'SPITFIRE') {
    const r = buildSpitfire(team);
    geo = r.geo; meta = r.meta;
    root.add(r.prop); props.push(r.prop);
  } else if (id === 'AH64') {
    const r = buildApache(team);
    geo = r.geo; meta = r.meta;
    root.add(r.rotor, r.tail); rotors.push(r.rotor); tailRotors.push(r.tail);
  } else {
    let cached = geometryCache.get(key);
    if (!cached) {
      cached = id === 'A10' ? buildA10(team) : buildJet(id, team);
      geometryCache.set(key, cached);
    }
    geo = cached.geo; meta = cached.meta;
  }

  const body = new THREE.Mesh(geo, airframeMaterial());
  body.castShadow = true;
  root.add(body);
  return { root, body, props, rotors, tailRotors, ...meta, nozzles: meta.nozzles.map((n) => ({ ...n, pos: n.pos.clone() })) };
}
