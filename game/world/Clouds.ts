import * as THREE from 'three';
import { mulberry32 } from '../core/utils';
import { MAP } from './layout';

const vertex = /* glsl */ `
attribute vec3 aOffset;
attribute float aScale;
attribute float aShade;
attribute float aRot;
uniform float uFogDensity;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFade;
void main() {
  vUv = uv;
  vec4 mv = viewMatrix * vec4(aOffset, 1.0);
  float c = cos(aRot), s = sin(aRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  mv.xy += p * aScale;
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  vFog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  vFade = smoothstep(aScale * 0.15, aScale * 0.9, d);
  vShade = aShade;
}
`;

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLit;
uniform vec3 uShadow;
uniform vec3 uFogColor;
uniform float uOpacity;
varying vec2 vUv;
varying float vShade;
varying float vFog;
varying float vFade;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float light = clamp(vShade * (0.55 + 0.6 * vUv.y), 0.0, 1.0);
  vec3 col = mix(uShadow, uLit, light);
  col = mix(col, uFogColor, vFog * 0.9);
  float a = t.a * uOpacity * vFade * (1.0 - vFog * 0.5);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface Puff { x: number; y: number; z: number; s: number }

/** Billboard cumulus clusters, sorted back-to-front for clean blending. */
export class Clouds {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private puffs: Puff[] = [];
  private order: number[] = [];
  private frame = 0;
  private material: THREE.ShaderMaterial;

  constructor(clusterCount: number) {
    const rnd = mulberry32(4242);
    for (let c = 0; c < clusterCount; c++) {
      const cx = (rnd() * 2 - 1) * MAP.half * 1.2;
      const cz = (rnd() * 2 - 1) * MAP.half * 1.2;
      const cy = 2900 + rnd() * 1500;
      const n = 8 + Math.floor(rnd() * 10);
      const spread = 500 + rnd() * 700;
      for (let i = 0; i < n; i++) {
        this.puffs.push({
          x: cx + (rnd() - 0.5) * spread * 2,
          y: cy + (rnd() - 0.3) * 160,
          z: cz + (rnd() - 0.5) * spread,
          s: 260 + rnd() * 420,
        });
      }
    }
    const count = this.puffs.length;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
    this.geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    this.geo.setAttribute('aShade', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    this.geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
    this.geo.instanceCount = count;
    this.order = this.puffs.map((_, i) => i);
    const shades = this.puffs.map(() => 0.75 + rnd() * 0.25);
    const rots = this.puffs.map(() => rnd() * Math.PI * 2);
    (this.geo as any)._shades = shades;
    (this.geo as any)._rots = rots;

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: makeCloudTexture() },
        uLit: { value: new THREE.Color('#ffffff') },
        uShadow: { value: new THREE.Color('#8f9aa8') },
        uFogColor: { value: new THREE.Color('#a8bccd') },
        uFogDensity: { value: 0.00006 },
        uOpacity: { value: 0.72 },
      },
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.writeAttributes();
  }

  sync(fog: THREE.FogExp2, sunColor: THREE.Color) {
    const u = this.material.uniforms;
    u.uFogColor.value.copy(fog.color);
    u.uFogDensity.value = fog.density;
    u.uLit.value.copy(sunColor).lerp(new THREE.Color('#ffffff'), 0.6);
    u.uShadow.value.copy(fog.color).multiplyScalar(0.9);
  }

  private writeAttributes() {
    const off = this.geo.getAttribute('aOffset') as THREE.InstancedBufferAttribute;
    const sc = this.geo.getAttribute('aScale') as THREE.InstancedBufferAttribute;
    const sh = this.geo.getAttribute('aShade') as THREE.InstancedBufferAttribute;
    const ro = this.geo.getAttribute('aRot') as THREE.InstancedBufferAttribute;
    const shades = (this.geo as any)._shades as number[];
    const rots = (this.geo as any)._rots as number[];
    this.order.forEach((pi, i) => {
      const p = this.puffs[pi];
      off.setXYZ(i, p.x, p.y, p.z);
      sc.setX(i, p.s);
      sh.setX(i, shades[pi]);
      ro.setX(i, rots[pi]);
    });
    off.needsUpdate = sc.needsUpdate = sh.needsUpdate = ro.needsUpdate = true;
  }

  update(camera: THREE.Camera) {
    if (++this.frame % 20 !== 0) return;
    const c = camera.position;
    const d = this.puffs.map((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 + (p.z - c.z) ** 2);
    this.order.sort((a, b) => d[b] - d[a]);
    this.writeAttributes();
  }

  /** 0..1 how deep inside a cloud a point is (for the whiteout effect). */
  densityAt(p: THREE.Vector3): number {
    let best = 0;
    for (const c of this.puffs) {
      const dy = Math.abs(p.y - c.y);
      if (dy > c.s * 0.45) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const r = c.s * 0.45;
      const d2 = dx * dx + dz * dz + dy * dy * 2;
      if (d2 < r * r) best = Math.max(best, 1 - Math.sqrt(d2) / r);
    }
    return best;
  }
}

function makeCloudTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = mulberry32(11);
  for (let i = 0; i < 26; i++) {
    const x = size * (0.22 + rnd() * 0.56);
    const y = size * (0.3 + rnd() * 0.45);
    const r = size * (0.1 + rnd() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
