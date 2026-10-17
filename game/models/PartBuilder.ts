import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V3 = [number, number, number];

/**
 * Collects primitive parts with per-vertex colours and merges them into one
 * geometry so each aircraft / building is a single draw call.
 */
export class PartBuilder {
  private parts: THREE.BufferGeometry[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    this.e.set(rot[0], rot[1], rot[2]);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...pos), this.q, new THREE.Vector3(...scale));
    g.applyMatrix4(this.m);
    if (scale[0] * scale[1] * scale[2] < 0) flipWinding(g);
    const c = new THREE.Color(color);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    this.parts.push(g);
    geo.dispose();
    return this;
  }

  /** Adds the part and its mirror image across the X axis. */
  addPair(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
    const copy = geo.clone();
    this.add(geo, color, pos, rot, scale);
    this.add(copy, color, [-pos[0], pos[1], pos[2]], [rot[0], -rot[1], -rot[2]], [-scale[0], scale[1], scale[2]]);
    return this;
  }

  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false)!;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

function flipWinding(g: THREE.BufferGeometry) {
  const attrs = Object.values(g.attributes) as THREE.BufferAttribute[];
  for (const a of attrs) {
    const arr = a.array as Float32Array;
    const s = a.itemSize;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < s; k++) {
        const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k;
        const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- primitives

/**
 * Body of revolution along -Z (nose at -length/2).
 * profile: [t (0 nose → 1 tail), radius] pairs.
 */
export function fuselage(length: number, profile: [number, number][], radial = 12, squashY = 1, squashX = 1): THREE.BufferGeometry {
  // Lathe expects points ordered by increasing Y for outward-facing triangles.
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(r, 0.001), (1 - t) * length)).reverse();
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, length / 2);
  g.scale(squashX, squashY, 1);
  return g;
}

/**
 * Trapezoid wing panel extending along +X from the root.
 * The root leading edge sits at the local origin; chord runs aft (+Z).
 */
export function wing(rootChord: number, tipChord: number, span: number, sweep: number, thick: number, dihedral = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i) + 0.5;
    const zc = p.getZ(i) + 0.5;
    const chord = rootChord + (tipChord - rootChord) * s;
    const t = thick * (1 - 0.55 * s);
    p.setXYZ(i, s * span, p.getY(i) * t + s * span * Math.tan(dihedral), sweep * s + zc * chord);
  }
  g.computeVertexNormals();
  return g;
}

/** Vertical fin: same as wing but standing up along +Y. */
export function fin(rootChord: number, tipChord: number, height: number, sweep: number, thick: number): THREE.BufferGeometry {
  const g = wing(rootChord, tipChord, height, sweep, thick);
  g.rotateZ(Math.PI / 2);
  return g;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
/** Cylinder lying along Z. */
export const tube = (rt: number, rb: number, len: number, seg = 10) => {
  const g = new THREE.CylinderGeometry(rt, rb, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
};
export const sphere = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
