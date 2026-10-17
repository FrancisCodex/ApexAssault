import * as THREE from 'three';
import { Terrain } from './Terrain';
import { Water } from './Water';
import { Clouds } from './Clouds';
import { SITES, RUNWAYS, TOWNS, FRIENDLY_BASE, ENEMY_BASE } from './layout';
import { createRunway, createTreeMesh, createHouseMeshes } from '../models/GroundModels';
import { createAircraftModel } from '../models/AircraftModels';
import { GroundTarget } from '../entities/GroundTarget';
import { mulberry32 } from '../core/utils';
import type { Quality } from '../data/types';

/** Builds and owns all static scenery plus the persistent ground targets. */
export class World {
  readonly terrain: Terrain;
  readonly water = new Water();
  clouds: Clouds | null = null;
  readonly ground: GroundTarget[] = [];
  readonly group = new THREE.Group();
  private terrainMesh: THREE.Mesh | null = null;
  private trees: THREE.InstancedMesh | null = null;
  mapImage: HTMLCanvasElement;

  constructor(private scene: THREE.Scene, quality: Quality) {
    this.terrain = new Terrain(513);
    scene.add(this.group);
    this.group.add(this.water.mesh);
    this.buildTerrain(quality);
    this.buildAirfields();
    this.buildTowns();
    for (const def of SITES) {
      const g = new GroundTarget(def, this.terrain.getHeight(def.x, def.z));
      this.ground.push(g);
      this.group.add(g.model.root);
    }
    this.mapImage = this.terrain.renderMapImage(512);
  }

  buildTerrain(quality: Quality) {
    if (this.terrainMesh) {
      this.group.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
    }
    this.terrainMesh = this.terrain.buildMesh(quality);
    this.group.add(this.terrainMesh);

    if (this.trees) {
      this.group.remove(this.trees);
      this.trees.geometry.dispose();
    }
    const count = quality === 'LOW' ? 3000 : quality === 'MEDIUM' ? 9000 : 18000;
    const pts = this.terrain.scatterTrees(count);
    const trees = createTreeMesh(pts.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const greens = ['#2f4a22', '#3b5a2a', '#294020', '#46612f', '#36502a'].map((h) => new THREE.Color(h));
    pts.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.t * Math.PI * 2);
      s.set(t.s, t.s * (0.9 + t.t * 0.4), t.s);
      p.set(t.x, t.y - 0.5, t.z);
      m.compose(p, q, s);
      trees.setMatrixAt(i, m);
      c.copy(greens[i % greens.length]);
      if (t.x > 3000) c.lerp(new THREE.Color('#5a5a32'), 0.35); // drier east
      trees.setColorAt(i, c);
    });
    trees.instanceMatrix.needsUpdate = true;
    if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
    trees.computeBoundingSphere();
    this.trees = trees;
    this.group.add(trees);
  }

  setClouds(enabled: boolean, quality: Quality) {
    if (this.clouds) {
      this.group.remove(this.clouds.mesh);
      this.clouds = null;
    }
    if (!enabled) return;
    this.clouds = new Clouds(quality === 'LOW' ? 30 : quality === 'MEDIUM' ? 55 : 80);
    this.group.add(this.clouds.mesh);
  }

  private buildAirfields() {
    for (const r of RUNWAYS) {
      const g = createRunway(r.length, r.width);
      g.position.set(r.x, this.terrain.getHeight(r.x, r.z) + 0.15, r.z);
      // Taxiway / apron sit on the side facing the hangars.
      g.rotation.y = r.team === 'BLUE' ? -Math.PI / 2 : Math.PI;
      this.group.add(g);
    }
    // Parked aircraft for life on the flight line.
    const parked: [string, 'BLUE' | 'RED', number, number, number][] = [
      ['F14', 'BLUE', FRIENDLY_BASE.x - 820, FRIENDLY_BASE.z + 270, Math.PI],
      ['F14', 'BLUE', FRIENDLY_BASE.x - 760, FRIENDLY_BASE.z + 270, Math.PI],
      ['F22', 'BLUE', FRIENDLY_BASE.x - 260, FRIENDLY_BASE.z + 270, Math.PI],
      ['A10', 'BLUE', FRIENDLY_BASE.x + 20, FRIENDLY_BASE.z + 270, Math.PI],
      ['SU27', 'RED', ENEMY_BASE.x + 60, ENEMY_BASE.z + 420, -Math.PI / 2],
      ['SU27', 'RED', ENEMY_BASE.x + 60, ENEMY_BASE.z + 620, -Math.PI / 2],
      ['MIG21', 'RED', ENEMY_BASE.x + 80, ENEMY_BASE.z - 1000, -Math.PI / 2],
    ];
    for (const [id, team, x, z, rot] of parked) {
      const m = createAircraftModel(id as any, team);
      m.root.position.set(x, this.terrain.getHeight(x, z) + 1.6, z);
      m.root.rotation.y = rot;
      this.group.add(m.root);
    }
  }

  private buildTowns() {
    const rnd = mulberry32(2024);
    const total = TOWNS.reduce((a, t) => a + t.count, 0);
    const { walls, roofs } = createHouseMeshes(total);
    const wallCols = ['#e8e1d3', '#d9cdb5', '#c9b99a', '#f0ece4', '#b8ab92'].map((h) => new THREE.Color(h));
    const roofCols = ['#8a3b2a', '#6e3326', '#5b5752', '#7a4a33', '#4f5a63'].map((h) => new THREE.Color(h));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    for (const town of TOWNS) {
      const streetAngle = rnd() * Math.PI;
      for (let k = 0; k < town.count; k++) {
        let x = 0, z = 0, h = -1, tries = 0;
        while (tries++ < 12) {
          const r = Math.sqrt(rnd()) * town.radius;
          const a = rnd() * Math.PI * 2;
          // Snap to a loose street grid.
          const gx = Math.round((Math.cos(a) * r) / 28) * 28;
          const gz = Math.round((Math.sin(a) * r) / 22) * 22;
          x = town.x + gx * Math.cos(streetAngle) - gz * Math.sin(streetAngle);
          z = town.z + gx * Math.sin(streetAngle) + gz * Math.cos(streetAngle);
          h = this.terrain.getHeight(x, z);
          const n = this.terrain.getNormal(x, z);
          if (h > 3 && n.y > 0.93) break;
          h = -1;
        }
        if (h < 0) continue;
        const w = 8 + rnd() * 10, d = 7 + rnd() * 8, ht = 5 + rnd() * (k % 9 === 0 ? 18 : 5);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), streetAngle + (rnd() < 0.5 ? 0 : Math.PI / 2));
        m.compose(new THREE.Vector3(x, h - 0.5, z), q, new THREE.Vector3(w, ht, d));
        walls.setMatrixAt(i, m);
        walls.setColorAt(i, wallCols[Math.floor(rnd() * wallCols.length)]);
        m.compose(new THREE.Vector3(x, h - 0.5 + ht, z), q, new THREE.Vector3(w * 1.05, 2 + rnd() * 3, d * 1.05));
        roofs.setMatrixAt(i, m);
        roofs.setColorAt(i, roofCols[Math.floor(rnd() * roofCols.length)]);
        i++;
      }
    }
    walls.count = roofs.count = i;
    walls.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = true;
    walls.computeBoundingSphere();
    roofs.computeBoundingSphere();
    walls.receiveShadow = roofs.receiveShadow = true;
    this.group.add(walls, roofs);
  }

  resetTargets() {
    for (const g of this.ground) {
      g.reset();
      g.isMissionTarget = false;
      g.targetable = true;
    }
  }

  update(dt: number, camera: THREE.Camera) {
    this.water.update(dt, camera.position);
    this.clouds?.update(camera);
  }
}
