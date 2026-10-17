import * as THREE from 'three';
import { SimplexNoise } from '../core/noise';
import { clamp, lerp, smoothstep, mulberry32 } from '../core/utils';
import {
  MAP, FRIENDLY_BASE, ENEMY_BASE, PASS, SITES, PAD_RADIUS, RIDGE_PEAK_HINT, RUNWAYS, TOWNS,
} from './layout';
import type { Quality } from '../data/types';

interface Pad { x: number; z: number; r: number; h: number; inner: number }

const C = (hex: string) => new THREE.Color(hex);
const PALETTE = {
  deep: C('#1d4f57'),
  shallow: C('#4f9c8f'),
  sand: C('#cbb98c'),
  grassA: C('#5f7f34'),
  grassB: C('#47662a'),
  dry: C('#958556'),
  dirt: C('#7c6a4c'),
  forest: C('#2c4420'),
  rock: C('#6d675e'),
  rockDark: C('#4b4741'),
  snow: C('#eef1f4'),
  pad: C('#6f8448'),
  padDry: C('#8f8458'),
};

/**
 * Procedural island heightfield. Heights are generated once into a grid and
 * sampled bilinearly for collision, AI terrain avoidance and line-of-sight.
 */
export class Terrain {
  readonly size = MAP.half * 2;
  readonly res: number;
  readonly cell: number;
  readonly heights: Float32Array;
  readonly padMask: Float32Array;
  readonly forestMask: Float32Array;
  readonly noise = new SimplexNoise(1337);
  private pads: Pad[] = [];
  /** Resolved radar position on the ridge peak. */
  ridgePeak = new THREE.Vector3();

  constructor(res = 513) {
    this.res = res;
    this.cell = this.size / (res - 1);
    this.heights = new Float32Array(res * res);
    this.padMask = new Float32Array(res * res);
    this.forestMask = new Float32Array(res * res);
    this.setupPads();
    this.generate();
  }

  // ------------------------------------------------------------------ generation

  private natural(x: number, z: number): number {
    const n = this.noise;
    const nx = x / 15500, nz = z / 12500;
    let r = Math.sqrt(nx * nx + nz * nz);
    r += n.fbm(x / 9000 + 3.1, z / 9000 - 1.7, 3) * 0.16;
    const land = 1 - smoothstep(0.76, 1.0, r);

    let h = 55 + n.fbm(x / 5200 + 10, z / 5200, 5) * 150 + n.fbm(x / 1300, z / 1300, 3) * 28;

    // Greyspine ridge — runs north/south through the middle of the island.
    const ridgeX = 600 + 1800 * Math.sin(z / 5200);
    const rd = (x - ridgeX) / 3200;
    let ridge = Math.exp(-rd * rd);
    const pd = (z - PASS.z) / 1500;
    ridge *= 1 - 0.74 * Math.exp(-pd * pd);
    h += ridge * (420 + n.ridged(x / 3600, z / 3600, 5) * 2100);

    // Northern highlands, southern coastal hills.
    const nh = Math.exp(-(((x + 3000) / 4500) ** 2) - (((z - 8500) / 2500) ** 2));
    h += nh * (250 + n.ridged(x / 2500 + 7, z / 2500, 4) * 700);

    // Eastern plateau (enemy territory) — higher and drier.
    h += smoothstep(1500, 6500, x) * 270 * (1 - ridge * 0.4);

    h = lerp(MAP.seaFloor, h, land);
    if (land > 0.02 && land < 0.98) {
      // Gentle beaches.
      h = lerp(h, Math.min(h, 6 + (h - 6) * 0.35), 1 - Math.abs(land - 0.5) * 2);
    }
    return h;
  }

  private setupPads() {
    const pads: Pad[] = [];
    pads.push({ x: FRIENDLY_BASE.x, z: FRIENDLY_BASE.z, r: FRIENDLY_BASE.radius, inner: 0.62, h: 0 });
    pads.push({ x: ENEMY_BASE.x, z: ENEMY_BASE.z, r: ENEMY_BASE.radius, inner: 0.62, h: 0 });
    for (const p of pads) p.h = Math.max(22, this.natural(p.x, p.z));

    // Radar sits on the highest point near the hint.
    let best = -Infinity, bx = RIDGE_PEAK_HINT.x, bz = RIDGE_PEAK_HINT.z;
    for (let i = -12; i <= 12; i++) {
      for (let j = -12; j <= 12; j++) {
        const x = RIDGE_PEAK_HINT.x + i * 110, z = RIDGE_PEAK_HINT.z + j * 110;
        const h = this.natural(x, z);
        if (h > best) { best = h; bx = x; bz = z; }
      }
    }
    for (const s of SITES) {
      if (s.group === 'RIDGE') { s.x = bx; s.z = bz; }
    }

    for (const s of SITES) {
      if (s.group === 'FB' || s.group === 'EB') continue; // covered by base pad
      const r = PAD_RADIUS[s.kind];
      pads.push({ x: s.x, z: s.z, r: r * 4, inner: 0.4, h: Math.max(15, this.natural(s.x, s.z)) });
    }
    this.pads = pads;
  }

  private padBlend(x: number, z: number, h: number): [number, number] {
    let mask = 0;
    for (const p of this.pads) {
      const dx = x - p.x, dz = z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > p.r * p.r) continue;
      const t = smoothstep(p.r, p.r * p.inner, Math.sqrt(d2));
      h = lerp(h, p.h, t);
      mask = Math.max(mask, t);
    }
    return [h, mask];
  }

  private generate() {
    const { res, cell, heights, padMask, forestMask, noise } = this;
    const half = MAP.half;
    for (let j = 0; j < res; j++) {
      const z = -half + j * cell;
      for (let i = 0; i < res; i++) {
        const x = -half + i * cell;
        const [h, m] = this.padBlend(x, z, this.natural(x, z));
        const k = j * res + i;
        heights[k] = h;
        padMask[k] = m;
        forestMask[k] = noise.fbm(x / 1700 + 40, z / 1700 - 20, 4);
      }
    }
    const peak = SITES.find((s) => s.group === 'RIDGE')!;
    this.ridgePeak.set(peak.x, this.getHeight(peak.x, peak.z), peak.z);
  }

  // ------------------------------------------------------------------ queries

  getHeight(x: number, z: number): number {
    const fx = (x + MAP.half) / this.cell;
    const fz = (z + MAP.half) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.res - 1 || fz >= this.res - 1) return MAP.seaFloor;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const r = this.res, H = this.heights;
    const k = j * r + i;
    const a = H[k], b = H[k + 1], c = H[k + r], d = H[k + r + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  /** Height of the ground or the sea surface, whichever is higher. */
  getSurface(x: number, z: number): number {
    return Math.max(0, this.getHeight(x, z));
  }

  getNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = this.cell;
    const hl = this.getHeight(x - e, z), hr = this.getHeight(x + e, z);
    const hd = this.getHeight(x, z - e), hu = this.getHeight(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  sampleMask(arr: Float32Array, x: number, z: number): number {
    const i = clamp(Math.round((x + MAP.half) / this.cell), 0, this.res - 1);
    const j = clamp(Math.round((z + MAP.half) / this.cell), 0, this.res - 1);
    return arr[j * this.res + i];
  }

  /** True when nothing (terrain) blocks the straight line between a and b. */
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3, steps = 14): boolean {
    // The last stretch next to either end is ignored so ground clutter around
    // a site doesn't hide it completely; only real ridgelines block.
    for (let s = 1; s < steps; s++) {
      const t = 0.04 + (s / steps) * 0.84;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t;
      if (y < this.getHeight(x, z) - 6) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ rendering

  buildMesh(quality: Quality): THREE.Mesh {
    const step = quality === 'LOW' ? 2 : 1;
    const n = Math.floor((this.res - 1) / step) + 1;
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const uvs = new Float32Array(n * n * 2);
    const tmp = new THREE.Color();
    const nrm = new THREE.Vector3();
    const half = MAP.half;

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gi = i * step, gj = j * step;
        const k = gj * this.res + gi;
        const x = -half + gi * this.cell;
        const z = -half + gj * this.cell;
        const h = this.heights[k];
        const v = j * n + i;
        positions[v * 3] = x;
        positions[v * 3 + 1] = h;
        positions[v * 3 + 2] = z;
        uvs[v * 2] = i / (n - 1);
        uvs[v * 2 + 1] = j / (n - 1);
        this.getNormal(x, z, nrm);
        this.colorAt(x, z, h, nrm.y, this.padMask[k], this.forestMask[k], tmp);
        colors[v * 3] = tmp.r;
        colors[v * 3 + 1] = tmp.g;
        colors[v * 3 + 2] = tmp.b;
      }
    }

    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let p = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        index[p++] = a; index[p++] = c; index[p++] = b;
        index[p++] = b; index[p++] = c; index[p++] = d;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const detail = makeDetailTexture();
    detail.repeat.set(this.size / 60, this.size / 60);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: detail,
      roughness: 0.96,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = quality === 'HIGH';
    mesh.name = 'terrain';
    return mesh;
  }

  private colorAt(x: number, z: number, h: number, ny: number, pad: number, forest: number, out: THREE.Color) {
    const n = this.noise;
    const slope = 1 - ny;
    const v = n.fbm(x / 700, z / 700, 3);
    const arid = smoothstep(1500, 8000, x) * 0.75 + smoothstep(0.2, 0.6, n.fbm(x / 4000 - 9, z / 4000, 2)) * 0.25;

    if (h < 0) {
      out.copy(PALETTE.deep).lerp(PALETTE.shallow, smoothstep(-28, -1, h));
      return out;
    }
    if (h < 9) {
      out.copy(PALETTE.sand);
      out.lerp(PALETTE.grassA, smoothstep(5, 9, h));
      return out;
    }
    out.copy(PALETTE.grassA).lerp(PALETTE.grassB, smoothstep(-0.3, 0.4, v));
    out.lerp(PALETTE.dry, arid * 0.85);
    if (v > 0.35) out.lerp(PALETTE.dirt, (v - 0.35) * 1.2 * (0.4 + arid));

    const forestAmt = smoothstep(0.08, 0.3, forest) * (1 - smoothstep(700, 1000, h)) * (1 - arid * 0.6);
    out.lerp(PALETTE.forest, forestAmt * 0.85);

    const rockAmt = Math.max(smoothstep(0.22, 0.42, slope), smoothstep(950, 1350, h + v * 120));
    out.lerp(v > 0 ? PALETTE.rock : PALETTE.rockDark, rockAmt);

    const snowLine = 1650 + v * 220;
    const snowAmt = smoothstep(snowLine, snowLine + 180, h) * (1 - smoothstep(0.45, 0.65, slope));
    out.lerp(PALETTE.snow, snowAmt);

    if (pad > 0) out.lerp(arid > 0.5 ? PALETTE.padDry : PALETTE.pad, pad * 0.8);
    return out;
  }

  // ------------------------------------------------------------------ placement helpers

  /** Random scatter points for trees, deterministic. */
  scatterTrees(count: number): { x: number; y: number; z: number; s: number; t: number }[] {
    const rnd = mulberry32(99);
    const out: { x: number; y: number; z: number; s: number; t: number }[] = [];
    const nrm = new THREE.Vector3();
    let tries = 0;
    while (out.length < count && tries < count * 25) {
      tries++;
      const x = (rnd() * 2 - 1) * (MAP.half - 400);
      const z = (rnd() * 2 - 1) * (MAP.half - 400);
      const h = this.getHeight(x, z);
      if (h < 12 || h > 1100) continue;
      if (this.sampleMask(this.padMask, x, z) > 0.05) continue;
      if (this.nearRunwayOrTown(x, z)) continue;
      const f = this.sampleMask(this.forestMask, x, z);
      const density = f > 0.08 ? 0.9 : 0.05;
      if (rnd() > density) continue;
      this.getNormal(x, z, nrm);
      if (nrm.y < 0.82) continue;
      // Cluster: drop a few neighbours around accepted points.
      const cluster = 1 + Math.floor(rnd() * 4);
      for (let c = 0; c < cluster && out.length < count; c++) {
        const cx = x + (rnd() - 0.5) * 60, cz = z + (rnd() - 0.5) * 60;
        out.push({ x: cx, y: this.getHeight(cx, cz), z: cz, s: 0.7 + rnd() * 0.7, t: rnd() });
      }
    }
    return out;
  }

  nearRunwayOrTown(x: number, z: number): boolean {
    for (const r of RUNWAYS) {
      if (Math.abs(x - r.x) < r.length * 0.6 && Math.abs(z - r.z) < r.length * 0.6) return true;
    }
    for (const t of TOWNS) {
      const dx = x - t.x, dz = z - t.z;
      if (dx * dx + dz * dz < t.radius * t.radius) return true;
    }
    return false;
  }

  /** Small coloured overview image for the tactical map and briefing screen. */
  renderMapImage(size = 512): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const nrm = new THREE.Vector3();
    const c = new THREE.Color();
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = -MAP.half + (px / (size - 1)) * this.size;
        const z = -MAP.half + (py / (size - 1)) * this.size;
        const h = this.getHeight(x, z);
        this.getNormal(x, z, nrm);
        if (h < 0) c.setRGB(0.05, 0.14, 0.2);
        else {
          this.colorAt(x, z, h, nrm.y, this.sampleMask(this.padMask, x, z), this.sampleMask(this.forestMask, x, z), c);
          const shade = clamp(0.55 + (nrm.x - nrm.z) * 1.6, 0.25, 1.25);
          c.multiplyScalar(shade);
        }
        c.convertLinearToSRGB();
        const o = (py * size + px) * 4;
        img.data[o] = clamp(c.r * 255, 0, 255);
        img.data[o + 1] = clamp(c.g * 255, 0, 255);
        img.data[o + 2] = clamp(c.b * 255, 0, 255);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}

function makeDetailTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const noise = new SimplexNoise(7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable noise via 4D torus trick approximated with blended samples.
      const u = x / size, v = y / size;
      const a = noise.fbm(u * 8, v * 8, 4);
      const b = noise.fbm((u - 1) * 8, v * 8, 4);
      const c2 = noise.fbm(u * 8, (v - 1) * 8, 4);
      const d = noise.fbm((u - 1) * 8, (v - 1) * 8, 4);
      const n = lerp(lerp(a, b, u), lerp(c2, d, u), v);
      const val = clamp(232 + n * 40 + (Math.random() - 0.5) * 14, 175, 255);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = val;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  return tex;
}
