import * as THREE from 'three';

const vertex = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aColor;
attribute vec2 aSizeRot;
uniform float uFogDensity;
varying vec2 vUv;
varying vec4 vColor;
varying float vFog;
void main() {
  vUv = uv;
  vColor = aColor;
  vec4 mv = viewMatrix * vec4(aPos, 1.0);
  float c = cos(aSizeRot.y), s = sin(aSizeRot.y);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  mv.xy += p * aSizeRot.x;
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  vFog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
}
`;

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uFogColor;
uniform float uAdditive;
varying vec2 vUv;
varying vec4 vColor;
varying float vFog;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vColor.a;
  if (a < 0.004) discard;
  vec3 col = vColor.rgb * mix(vec3(1.0), t.rgb, 0.5);
  if (uAdditive > 0.5) {
    col *= (1.0 - vFog);
    gl_FragColor = vec4(col * a, a);
  } else {
    col = mix(col, uFogColor, vFog);
    gl_FragColor = vec4(col, a);
  }
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface ParticleOpts {
  life: number;
  size: number;
  endSize: number;
  color: THREE.Color;
  endColor?: THREE.Color;
  alpha: number;
  endAlpha?: number;
  drag?: number;
  gravity?: number;
  rotSpeed?: number;
}

/**
 * GPU billboard particle pool. One draw call per pool; CPU simulates
 * positions and writes instance attributes each frame.
 */
export class ParticlePool {
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private cap: number;
  private count = 0;
  // Struct-of-arrays state.
  private px: Float32Array; private py: Float32Array; private pz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private age: Float32Array; private life: Float32Array;
  private s0: Float32Array; private s1: Float32Array;
  private c0: Float32Array; private c1: Float32Array;
  private a0: Float32Array; private a1: Float32Array;
  private drag: Float32Array; private grav: Float32Array;
  private rot: Float32Array; private rotV: Float32Array;
  private aPos: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aSizeRot: THREE.InstancedBufferAttribute;
  private material: THREE.ShaderMaterial;

  constructor(cap: number, texture: THREE.Texture, additive: boolean) {
    this.cap = cap;
    const f = (n = 1) => new Float32Array(cap * n);
    this.px = f(); this.py = f(); this.pz = f();
    this.vx = f(); this.vy = f(); this.vz = f();
    this.age = f(); this.life = f(); this.s0 = f(); this.s1 = f();
    this.c0 = f(3); this.c1 = f(3); this.a0 = f(); this.a1 = f();
    this.drag = f(); this.grav = f(); this.rot = f(); this.rotV = f();

    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.aSizeRot = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    this.aPos.setUsage(THREE.DynamicDrawUsage);
    this.aColor.setUsage(THREE.DynamicDrawUsage);
    this.aSizeRot.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aPos', this.aPos);
    this.geo.setAttribute('aColor', this.aColor);
    this.geo.setAttribute('aSizeRot', this.aSizeRot);
    this.geo.instanceCount = 0;

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: {
        uMap: { value: texture },
        uFogColor: { value: new THREE.Color() },
        uFogDensity: { value: 0.00006 },
        uAdditive: { value: additive ? 1 : 0 },
      },
    });
    this.mesh = new THREE.Mesh(this.geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;
  }

  syncFog(fog: THREE.FogExp2) {
    this.material.uniforms.uFogColor.value.copy(fog.color);
    this.material.uniforms.uFogDensity.value = fog.density;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, o: ParticleOpts) {
    let i: number;
    if (this.count < this.cap) i = this.count++;
    else i = Math.floor(Math.random() * this.cap); // overwrite a random particle when full
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = o.life;
    this.s0[i] = o.size; this.s1[i] = o.endSize;
    const ec = o.endColor ?? o.color;
    this.c0[i * 3] = o.color.r; this.c0[i * 3 + 1] = o.color.g; this.c0[i * 3 + 2] = o.color.b;
    this.c1[i * 3] = ec.r; this.c1[i * 3 + 1] = ec.g; this.c1[i * 3 + 2] = ec.b;
    this.a0[i] = o.alpha; this.a1[i] = o.endAlpha ?? 0;
    this.drag[i] = o.drag ?? 0; this.grav[i] = o.gravity ?? 0;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.rotV[i] = (Math.random() - 0.5) * (o.rotSpeed ?? 0.6);
  }

  private kill(i: number) {
    const j = --this.count;
    if (i === j) return;
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j];
    this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
    for (let k = 0; k < 3; k++) { this.c0[i * 3 + k] = this.c0[j * 3 + k]; this.c1[i * 3 + k] = this.c1[j * 3 + k]; }
    this.a0[i] = this.a0[j]; this.a1[i] = this.a1[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
    this.rot[i] = this.rot[j]; this.rotV[i] = this.rotV[j];
  }

  update(dt: number) {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this.kill(i); continue; }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt; this.vz[i] *= d;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      this.rot[i] += this.rotV[i] * dt;
      i++;
    }
    const P = this.aPos.array as Float32Array;
    const C = this.aColor.array as Float32Array;
    const S = this.aSizeRot.array as Float32Array;
    for (let k = 0; k < this.count; k++) {
      const t = this.age[k] / this.life[k];
      P[k * 3] = this.px[k]; P[k * 3 + 1] = this.py[k]; P[k * 3 + 2] = this.pz[k];
      C[k * 4] = this.c0[k * 3] + (this.c1[k * 3] - this.c0[k * 3]) * t;
      C[k * 4 + 1] = this.c0[k * 3 + 1] + (this.c1[k * 3 + 1] - this.c0[k * 3 + 1]) * t;
      C[k * 4 + 2] = this.c0[k * 3 + 2] + (this.c1[k * 3 + 2] - this.c0[k * 3 + 2]) * t;
      // Quick fade-in avoids popping.
      const fadeIn = Math.min(1, this.age[k] * 30);
      C[k * 4 + 3] = (this.a0[k] + (this.a1[k] - this.a0[k]) * t) * fadeIn;
      S[k * 2] = this.s0[k] + (this.s1[k] - this.s0[k]) * Math.sqrt(t);
      S[k * 2 + 1] = this.rot[k];
    }
    this.geo.instanceCount = this.count;
    this.aPos.needsUpdate = this.aColor.needsUpdate = this.aSizeRot.needsUpdate = true;
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, this.count * 3);
    this.aColor.clearUpdateRanges(); this.aColor.addUpdateRange(0, this.count * 4);
    this.aSizeRot.clearUpdateRanges(); this.aSizeRot.addUpdateRange(0, this.count * 2);
  }

  clear() { this.count = 0; this.geo.instanceCount = 0; }
}

export function makeSoftTexture(kind: 'smoke' | 'glow'): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  if (kind === 'glow') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else {
    for (let i = 0; i < 9; i++) {
      const x = 20 + Math.random() * 24, y = 20 + Math.random() * 24, r = 12 + Math.random() * 10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const v = 200 + Math.floor(Math.random() * 55);
      g.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
