import * as THREE from 'three';
import { ParticlePool, makeSoftTexture } from './Particles';
import { rand, randomUnitVector } from '../core/utils';

const col = (hex: string) => new THREE.Color(hex);
const FIRE = col('#ffb347').multiplyScalar(3);
const FIRE_END = col('#ff3a0a');
const SMOKE_DARK = col('#2a2622');
const SMOKE_GREY = col('#6f6a64');
const SMOKE_LIGHT = col('#d8d4cc');
const WHITE = col('#ffffff');
const FLARE_COL = col('#ffd27a').multiplyScalar(6);
const TRACER = col('#ffcf7a').multiplyScalar(4);
const DUST = col('#9b8a6a');
const WATER = col('#e4eef2');

interface Emitter { pos: THREE.Vector3; timer: number; life: number; rate: number; size: number }

/** High level visual effects built on two particle pools (alpha + additive). */
export class Effects {
  readonly smoke: ParticlePool;
  readonly glow: ParticlePool;
  private emitters: Emitter[] = [];
  private lights: { light: THREE.PointLight; t: number; max: number }[] = [];
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, capacity: number) {
    this.smoke = new ParticlePool(capacity, makeSoftTexture('smoke'), false);
    this.glow = new ParticlePool(Math.floor(capacity * 0.6), makeSoftTexture('glow'), true);
    scene.add(this.smoke.mesh, this.glow.mesh);
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight('#ffaa55', 0, 600, 1.6);
      scene.add(light);
      this.lights.push({ light, t: 0, max: 0 });
    }
  }

  syncFog(fog: THREE.FogExp2) {
    this.smoke.syncFog(fog);
    this.glow.syncFog(fog);
  }

  clear() {
    this.smoke.clear();
    this.glow.clear();
    this.emitters = [];
    for (const l of this.lights) { l.light.intensity = 0; l.t = 0; }
  }

  private flash(pos: THREE.Vector3, intensity: number, duration: number) {
    const slot = this.lights.reduce((a, b) => (a.t < b.t ? a : b));
    slot.light.position.copy(pos);
    slot.light.intensity = intensity;
    slot.t = duration;
    slot.max = duration;
  }

  explosion(pos: THREE.Vector3, scale = 1, vel?: THREE.Vector3) {
    const v = this.tmp;
    const bx = vel ? vel.x * 0.3 : 0, by = vel ? vel.y * 0.3 : 0, bz = vel ? vel.z * 0.3 : 0;
    for (let i = 0; i < 18 * scale; i++) {
      randomUnitVector(v).multiplyScalar(rand(6, 30) * scale);
      this.glow.emit(pos.x, pos.y, pos.z, v.x + bx, v.y + by, v.z + bz, {
        life: rand(0.35, 0.9), size: 10 * scale, endSize: 32 * scale,
        color: FIRE, endColor: FIRE_END, alpha: 1, endAlpha: 0, drag: 2.5,
      });
    }
    for (let i = 0; i < 14 * scale; i++) {
      randomUnitVector(v).multiplyScalar(rand(4, 18) * scale);
      this.smoke.emit(pos.x, pos.y, pos.z, v.x + bx, v.y + by + 4, v.z + bz, {
        life: rand(2.5, 5), size: 14 * scale, endSize: 55 * scale,
        color: SMOKE_DARK, endColor: SMOKE_GREY, alpha: 0.85, endAlpha: 0, drag: 1.2, gravity: 3,
      });
    }
    // Sparks / debris.
    for (let i = 0; i < 16 * scale; i++) {
      randomUnitVector(v).multiplyScalar(rand(40, 140));
      this.glow.emit(pos.x, pos.y, pos.z, v.x + bx, v.y + by, v.z + bz, {
        life: rand(0.5, 1.3), size: 2.2, endSize: 0.8, color: TRACER, alpha: 1, drag: 1, gravity: -40,
      });
    }
    this.flash(pos, 900 * scale, 0.35);
  }

  hitSpark(pos: THREE.Vector3) {
    const v = this.tmp;
    for (let i = 0; i < 4; i++) {
      randomUnitVector(v).multiplyScalar(rand(20, 60));
      this.glow.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, { life: 0.25, size: 3, endSize: 1, color: TRACER, alpha: 1 });
    }
    this.smoke.emit(pos.x, pos.y, pos.z, 0, 2, 0, { life: 1.2, size: 3, endSize: 10, color: SMOKE_GREY, alpha: 0.5 });
  }

  flak(pos: THREE.Vector3) {
    const v = this.tmp;
    this.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.2, size: 14, endSize: 24, color: FIRE, alpha: 1 });
    for (let i = 0; i < 6; i++) {
      randomUnitVector(v).multiplyScalar(rand(3, 10));
      this.smoke.emit(pos.x, pos.y, pos.z, v.x, v.y, v.z, {
        life: rand(3, 5), size: 12, endSize: 30, color: col('#151412'), endColor: SMOKE_DARK, alpha: 0.85, drag: 1.5,
      });
    }
  }

  groundImpact(pos: THREE.Vector3, water: boolean, scale = 1) {
    const v = this.tmp;
    for (let i = 0; i < 5 * scale; i++) {
      v.set(rand(-6, 6), rand(10, 40), rand(-6, 6)).multiplyScalar(scale);
      this.smoke.emit(pos.x, pos.y + 1, pos.z, v.x, v.y, v.z, {
        life: rand(0.8, 1.8), size: 3 * scale, endSize: 12 * scale,
        color: water ? WATER : DUST, alpha: 0.7, drag: 2, gravity: -20,
      });
    }
  }

  muzzle(pos: THREE.Vector3) {
    this.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.05, size: 2.5, endSize: 1.5, color: FIRE, alpha: 1 });
  }

  missileTrail(pos: THREE.Vector3, vel: THREE.Vector3, burning: boolean, scale = 1) {
    if (burning) {
      this.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.08, size: 3.5 * scale, endSize: 1.5, color: FIRE, alpha: 1 });
    }
    this.smoke.emit(pos.x + rand(-0.4, 0.4), pos.y, pos.z + rand(-0.4, 0.4), vel.x * 0.02, vel.y * 0.02 + 0.6, vel.z * 0.02, {
      life: burning ? rand(1.6, 2.6) : 0.6, size: 1.6 * scale, endSize: 9 * scale,
      color: SMOKE_LIGHT, endColor: SMOKE_GREY, alpha: burning ? 0.55 : 0.25, drag: 0.6,
    });
  }

  flareSpark(pos: THREE.Vector3) {
    this.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.12, size: 9, endSize: 5, color: FLARE_COL, alpha: 1 });
    this.smoke.emit(pos.x, pos.y, pos.z, 0, 0.5, 0, { life: 1.8, size: 2, endSize: 9, color: SMOKE_LIGHT, alpha: 0.35, drag: 0.4 });
  }

  damageSmoke(pos: THREE.Vector3, vel: THREE.Vector3, burning: boolean) {
    this.smoke.emit(pos.x, pos.y, pos.z, vel.x * 0.05, vel.y * 0.05 + 1, vel.z * 0.05, {
      life: burning ? 3 : 2, size: 2.5, endSize: burning ? 16 : 10,
      color: burning ? SMOKE_DARK : SMOKE_GREY, endColor: SMOKE_GREY, alpha: 0.6, drag: 0.8,
    });
    if (burning) this.glow.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 0.15, size: 5, endSize: 2, color: FIRE, alpha: 1 });
  }

  vapor(pos: THREE.Vector3, vel: THREE.Vector3, strength: number) {
    this.smoke.emit(pos.x, pos.y, pos.z, vel.x * 0.15, vel.y * 0.15, vel.z * 0.15, {
      life: 0.45, size: 0.7, endSize: 2.5, color: WHITE, alpha: 0.5 * strength, drag: 3,
    });
  }

  contrail(pos: THREE.Vector3) {
    this.smoke.emit(pos.x, pos.y, pos.z, 0, 0, 0, { life: 3.5, size: 1.4, endSize: 7, color: WHITE, alpha: 0.28, drag: 0 });
  }

  /** Persistent column of smoke from a destroyed structure. */
  addFire(pos: THREE.Vector3, size = 1, life = 120) {
    this.emitters.push({ pos: pos.clone(), timer: 0, life, rate: 0.12, size });
    if (this.emitters.length > 40) this.emitters.shift();
  }

  update(dt: number) {
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.life -= dt;
      if (e.life <= 0) { this.emitters.splice(i, 1); continue; }
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = e.rate;
        const s = e.size;
        this.smoke.emit(e.pos.x + rand(-4, 4) * s, e.pos.y, e.pos.z + rand(-4, 4) * s, rand(-1, 1) + 3, rand(9, 16), rand(-1, 1), {
          life: rand(7, 11), size: 10 * s, endSize: 70 * s, color: SMOKE_DARK, endColor: SMOKE_GREY,
          alpha: 0.7, endAlpha: 0, drag: 0.1,
        });
        if (Math.random() < 0.5) {
          this.glow.emit(e.pos.x + rand(-5, 5) * s, e.pos.y + 2, e.pos.z + rand(-5, 5) * s, 0, rand(4, 9), 0, {
            life: 0.7, size: 9 * s, endSize: 3 * s, color: FIRE, endColor: FIRE_END, alpha: 0.9,
          });
        }
      }
    }
    for (const l of this.lights) {
      if (l.t > 0) {
        l.t -= dt;
        l.light.intensity = Math.max(0, l.t / l.max) * l.light.intensity;
        if (l.t <= 0) l.light.intensity = 0;
      }
    }
    this.smoke.update(dt);
    this.glow.update(dt);
  }
}
