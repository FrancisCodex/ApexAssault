import * as THREE from 'three';
import type { GroundKind } from '../world/layout';
import type { Team } from '../data/types';
import { PartBuilder, box, cyl, tube, sphere } from './PartBuilder';

export interface GroundModel {
  root: THREE.Group;
  body: THREE.Mesh;
  turret?: THREE.Object3D;
  barrel?: THREE.Object3D;
  spinner?: THREE.Object3D;
  height: number;
  radius: number;
}

let structMat: THREE.MeshStandardMaterial | null = null;
export const structureMaterial = () =>
  (structMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 }));

let charredMat: THREE.MeshStandardMaterial | null = null;
export const charredMaterial = () =>
  (charredMat ??= new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 1, metalness: 0 }));

const cache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
};

const camo = (team: Team) => (team === 'BLUE' ? '#5d6a4a' : '#7a7151');
const camoDark = (team: Team) => (team === 'BLUE' ? '#434d35' : '#575036');

function mesh(geo: THREE.BufferGeometry) {
  const m = new THREE.Mesh(geo, structureMaterial());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createGroundModel(kind: GroundKind, team: Team): GroundModel {
  const root = new THREE.Group();
  let body: THREE.Mesh;
  let turret: THREE.Object3D | undefined;
  let barrel: THREE.Object3D | undefined;
  let spinner: THREE.Object3D | undefined;
  let height = 10, radius = 20;

  switch (kind) {
    case 'HANGAR': {
      body = mesh(cached(`hangar-${team}`, () => {
        const b = new PartBuilder();
        const arch = new THREE.CylinderGeometry(20, 20, 50, 18, 1, false, -Math.PI / 2, Math.PI);
        arch.rotateX(-Math.PI / 2);
        b.add(arch, team === 'BLUE' ? '#8d949a' : '#8b8676', [0, 0, 0], [0, 0, 0], [1, 0.8, 1]);
        b.add(box(30, 13, 0.6), '#4a4f54', [0, 6.5, -25]);
        b.add(box(42, 1, 52), '#6b6f73', [0, 0.2, 0]);
        return b.build();
      }));
      height = 16; radius = 26;
      break;
    }
    case 'SHELTER': {
      body = mesh(cached(`shelter-${team}`, () => {
        const b = new PartBuilder();
        const arch = new THREE.CylinderGeometry(14, 14, 34, 14, 1, false, -Math.PI / 2, Math.PI);
        arch.rotateX(-Math.PI / 2);
        b.add(arch, '#76736a', [0, 0, 0], [0, 0, 0], [1, 0.62, 1]);
        b.add(box(22, 8, 1), '#3b3d3f', [0, 4, -17]);
        return b.build();
      }));
      height = 9; radius = 18;
      break;
    }
    case 'TOWER': {
      body = mesh(cached('tower', () => {
        const b = new PartBuilder();
        b.add(box(16, 8, 16), '#b5b0a3', [0, 4, 0]);
        b.add(box(7, 24, 7), '#c2bdb0', [0, 20, 0]);
        b.add(cyl(7, 5.5, 5, 8), '#2a3b4a', [0, 34.5, 0]);
        b.add(cyl(7.6, 7.6, 1, 8), '#d0ccc0', [0, 37.4, 0]);
        b.add(cyl(0.3, 0.3, 6, 4), '#d33', [0, 41, 0]);
        return b.build();
      }));
      height = 40; radius = 12;
      break;
    }
    case 'HQ': {
      body = mesh(cached('hq', () => {
        const b = new PartBuilder();
        b.add(box(70, 16, 34), '#b8b2a2', [0, 8, 0]);
        b.add(box(30, 24, 26), '#a9a393', [-20, 12, 20]);
        b.add(box(72, 1.2, 36), '#77736a', [0, 16.6, 0]);
        b.add(box(8, 3, 6), '#8b8f94', [10, 18.5, 0]);
        b.add(box(8, 3, 6), '#8b8f94', [24, 18.5, -6]);
        b.add(cyl(0.4, 0.4, 18, 4), '#888', [-28, 33, 22]);
        b.add(sphere(3, 12, 8), '#e6e6e6', [18, 20, 8]);
        // Window bands.
        for (let i = 0; i < 3; i++) b.add(box(70.4, 1.2, 34.4), '#33414d', [0, 3.5 + i * 4.5, 0]);
        return b.build();
      }));
      height = 24; radius = 40;
      break;
    }
    case 'BUNKER': {
      body = mesh(cached('bunker', () => {
        const b = new PartBuilder();
        const frustum = new THREE.CylinderGeometry(36, 52, 18, 4, 1);
        frustum.rotateY(Math.PI / 4);
        b.add(frustum, '#7f7b70', [0, 9, 0], [0, 0, 0], [1.25, 1, 0.9]);
        b.add(box(40, 6, 28), '#6c685e', [0, 20, 0]);
        b.add(box(14, 10, 8), '#3a3a36', [0, 5, -34]);
        b.add(cyl(0.6, 1.2, 40, 6), '#7a7a7a', [16, 40, 8]);
        b.add(sphere(4, 10, 8), '#d9d6cc', [-14, 25, 6]);
        b.add(box(4, 3, 4), '#9b1c1c', [0, 24.5, 0]);
        return b.build();
      }));
      height = 26; radius = 45;
      break;
    }
    case 'RADAR': {
      body = mesh(cached(`radar-${team}`, () => {
        const b = new PartBuilder();
        b.add(box(14, 6, 10), camo(team), [0, 3, 0]);
        b.add(cyl(1.2, 1.6, 10, 8), '#777', [0, 11, 0]);
        return b.build();
      }));
      spinner = new THREE.Group();
      const sb = new PartBuilder();
      const dish = new THREE.SphereGeometry(9, 16, 6, 0, Math.PI, 0, Math.PI / 2.2);
      dish.rotateX(-Math.PI / 2);
      sb.add(dish, '#d6d6d0', [0, 0, 0], [0, 0, 0], [1, 0.45, 0.5]);
      sb.add(box(1, 4, 1), '#666', [0, -1, 0]);
      sb.add(box(1, 1, 5), '#666', [0, 0, -2.5]);
      spinner.add(mesh(sb.build()));
      spinner.position.y = 17;
      height = 24; radius = 14;
      break;
    }
    case 'RADOME': {
      body = mesh(cached('radome', () => {
        const b = new PartBuilder();
        b.add(cyl(8, 9, 8, 12), '#c9c5b8', [0, 4, 0]);
        b.add(sphere(11, 18, 12), '#f0efea', [0, 14, 0]);
        b.add(box(10, 5, 8), '#a5a194', [14, 2.5, 0]);
        return b.build();
      }));
      height = 25; radius = 14;
      break;
    }
    case 'FUEL': {
      body = mesh(cached(`fuel-${team}`, () => {
        const b = new PartBuilder();
        b.add(cyl(13, 13, 11, 20), '#d9d7cf', [0, 5.5, 0]);
        b.add(cyl(13.2, 13.2, 0.8, 20), '#9da0a3', [0, 11.3, 0]);
        b.add(box(30, 0.6, 30), '#76736b', [0, 0.3, 0]);
        return b.build();
      }));
      height = 12; radius = 15;
      break;
    }
    case 'BARRACKS': {
      body = mesh(cached(`barracks-${team}`, () => {
        const b = new PartBuilder();
        for (let i = 0; i < 3; i++) {
          b.add(box(40, 6, 11), team === 'BLUE' ? '#a5a08f' : '#8f8a73', [0, 3, (i - 1) * 16]);
          const roof = new THREE.CylinderGeometry(0.01, 8, 4, 4, 1);
          roof.rotateY(Math.PI / 4);
          b.add(roof, '#5d4a3a', [0, 8, (i - 1) * 16], [0, 0, 0], [3.6, 1, 1]);
        }
        return b.build();
      }));
      height = 10; radius = 28;
      break;
    }
    case 'COMMS': {
      body = mesh(cached('comms', () => {
        const b = new PartBuilder();
        b.add(box(10, 4, 10), '#8a877d', [0, 2, 0]);
        for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
          b.add(box(0.5, 60, 0.5), '#b0b0b0', [x * 0.6, 32, z * 0.6], [x * 0.012, 0, z * 0.012]);
        }
        for (let h = 8; h < 60; h += 8) b.add(box(3.4, 0.3, 3.4), '#9a9a9a', [0, h, 0]);
        b.add(cyl(0.4, 0.4, 10, 4), '#c33', [0, 66, 0]);
        b.add(cyl(2.5, 2.5, 0.4, 12), '#ddd', [1.8, 50, 0], [0, 0, Math.PI / 2]);
        return b.build();
      }));
      height = 66; radius = 10;
      break;
    }
    case 'SAM': {
      body = mesh(cached(`sam-${team}`, () => {
        const b = new PartBuilder();
        b.add(box(3.2, 1.6, 9), camo(team), [0, 1.6, 0]);
        b.add(box(3.0, 1.6, 2.6), camoDark(team), [0, 2.8, -3.4]);
        for (const x of [-1.2, 1.2]) for (const z of [-3, -1, 1, 3]) b.add(cyl(0.45, 0.45, 0.5, 8), '#222', [x, 0.5, z], [0, 0, Math.PI / 2]);
        // Radar truck alongside.
        b.add(box(3, 2, 7), camo(team), [8, 1.8, 2]);
        b.add(box(0.6, 4, 0.6), '#555', [8, 4.5, 2]);
        b.add(box(5, 3, 0.4), '#9a9a8a', [8, 7, 2]);
        b.add(box(24, 0.5, 20), '#6b6655', [3, 0.25, 0]);
        return b.build();
      }));
      turret = new THREE.Group();
      turret.position.set(0, 2.6, 1.5);
      const lb = new PartBuilder();
      for (const [x, y] of [[-0.7, 0], [0.7, 0], [-0.7, 0.9], [0.7, 0.9]]) lb.add(tube(0.38, 0.38, 6.5, 8), '#4d5a3a', [x, y, -2.2]);
      lb.add(box(2.6, 0.4, 3), '#333', [0, -0.5, 0]);
      barrel = mesh(lb.build());
      barrel.rotation.x = 0.6;
      turret.add(barrel);
      height = 8; radius = 12;
      break;
    }
    case 'AA': {
      body = mesh(cached(`aa-${team}`, () => {
        const b = new PartBuilder();
        b.add(cyl(4, 5, 1.6, 10), '#6f6a5c', [0, 0.8, 0]);
        b.add(cyl(7, 8, 1.2, 14), '#5f5a4c', [0, 0.6, 0]); // sandbag ring
        return b.build();
      }));
      turret = new THREE.Group();
      turret.position.set(0, 2.2, 0);
      const tb = new PartBuilder();
      tb.add(box(3, 1.8, 3.4), camo(team), [0, 0, 0]);
      turret.add(mesh(tb.build()));
      const bb = new PartBuilder();
      bb.add(tube(0.16, 0.16, 5, 6), '#222', [-0.55, 0, -2.5]);
      bb.add(tube(0.16, 0.16, 5, 6), '#222', [0.55, 0, -2.5]);
      bb.add(box(1.6, 0.8, 1.4), camoDark(team), [0, 0, -0.2]);
      barrel = mesh(bb.build());
      barrel.position.set(0, 0.6, -0.6);
      barrel.rotation.x = 0.7;
      turret.add(barrel);
      height = 5; radius = 8;
      break;
    }
  }

  root.add(body!);
  if (turret) root.add(turret);
  if (spinner) root.add(spinner);
  return { root, body: body!, turret, barrel, spinner, height, radius };
}

// ---------------------------------------------------------------- airfield surfaces

function runwayTexture(length: number, width: number): THREE.CanvasTexture {
  const cw = 128, ch = 2048;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#34363a';
  ctx.fillRect(0, 0, cw, ch);
  // Asphalt noise & tyre marks.
  for (let i = 0; i < 4000; i++) {
    const v = 40 + Math.random() * 30;
    ctx.fillStyle = `rgba(${v},${v},${v + 3},0.35)`;
    ctx.fillRect(Math.random() * cw, Math.random() * ch, 2, 2);
  }
  ctx.fillStyle = 'rgba(15,15,15,0.35)';
  for (const end of [0.08, 0.92]) ctx.fillRect(cw * 0.35, ch * end - 60, cw * 0.3, 120);
  const ppm = ch / length;
  ctx.fillStyle = '#e8e8e2';
  // Side stripes.
  ctx.fillRect(4, 0, 3, ch);
  ctx.fillRect(cw - 7, 0, 3, ch);
  // Centre line dashes (30m dash, 20m gap).
  for (let y = 120 * ppm; y < ch - 120 * ppm; y += 50 * ppm) ctx.fillRect(cw / 2 - 1.5, y, 3, 30 * ppm);
  // Threshold piano keys.
  for (const top of [true, false]) {
    const y0 = top ? 8 : ch - 8 - 45 * ppm;
    for (let i = 0; i < 8; i++) {
      const x = 12 + i * ((cw - 24) / 8);
      if (Math.abs(x + 4 - cw / 2) < 8) continue;
      ctx.fillRect(x, y0, (cw - 24) / 8 - 5, 45 * ppm);
    }
    // Touchdown zone blocks.
    const ty = top ? 300 * ppm : ch - 300 * ppm - 50 * ppm;
    ctx.fillRect(cw * 0.25, ty, cw * 0.12, 50 * ppm);
    ctx.fillRect(cw * 0.63, ty, cw * 0.12, 50 * ppm);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  void width;
  return tex;
}

export function createRunway(length: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const rw = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({ map: runwayTexture(length, width), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -4 }),
  );
  rw.rotation.x = -Math.PI / 2;
  rw.receiveShadow = true;
  g.add(rw);
  // Parallel taxiway and apron.
  const concrete = new THREE.MeshStandardMaterial({ color: '#7d7b74', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
  const taxi = new THREE.Mesh(new THREE.PlaneGeometry(24, length * 0.9), concrete);
  taxi.rotation.x = -Math.PI / 2;
  taxi.position.set(width / 2 + 110, 0, 0);
  taxi.receiveShadow = true;
  g.add(taxi);
  for (const z of [-length * 0.42, 0, length * 0.42]) {
    const link = new THREE.Mesh(new THREE.PlaneGeometry(110, 20), concrete);
    link.rotation.x = -Math.PI / 2;
    link.position.set(width / 2 + 55, 0, z);
    g.add(link);
  }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(220, length * 0.55), concrete);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(width / 2 + 240, 0, -length * 0.08);
  apron.receiveShadow = true;
  g.add(apron);
  // Approach lights.
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
  const lightGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  for (const dir of [-1, 1]) {
    for (let i = 1; i <= 8; i++) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(0, 1, dir * (length / 2 + i * 40));
      g.add(l);
    }
  }
  return g;
}

// ---------------------------------------------------------------- vegetation & towns

export function createTreeMesh(count: number): THREE.InstancedMesh {
  const b = new PartBuilder();
  b.add(cyl(0.35, 0.5, 4, 5), '#4a3a2a', [0, 2, 0]);
  b.add(new THREE.ConeGeometry(3.2, 9, 7), '#ffffff', [0, 8, 0]);
  b.add(new THREE.ConeGeometry(2.4, 6, 7), '#ffffff', [0, 12, 0]);
  const geo = b.build();
  // Trunk stays brown via instance colour multiplication: tint white parts only.
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function createHouseMeshes(count: number) {
  const walls = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    count,
  );
  const roofGeo = new THREE.ConeGeometry(0.75, 0.5, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 0.25, 0);
  const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), count);
  return { walls, roofs };
}

/** Static parked aircraft use the same airframes; exported for convenience. */
export { tube };
