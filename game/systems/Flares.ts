import * as THREE from 'three';
import type { Effects } from './Effects';
import type { Aircraft } from '../entities/Aircraft';

export interface Flare {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  alive: boolean;
  owner: Aircraft;
}

export class Flares {
  readonly list: Flare[] = [];

  clear() { this.list.length = 0; }

  deploy(owner: Aircraft, count = 6) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(owner.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(owner.quaternion);
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(owner.quaternion);
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const v = owner.velocity.clone().multiplyScalar(0.55)
        .addScaledVector(right, side * (25 + Math.random() * 25))
        .addScaledVector(down, 20 + Math.random() * 25)
        .addScaledVector(back, 15 + i * 6);
      this.list.push({
        position: owner.position.clone().addScaledVector(back, 4),
        velocity: v,
        life: 3.2 + Math.random() * 0.6,
        alive: true,
        owner,
      });
    }
  }

  nearestFor(owner: Aircraft, from: THREE.Vector3): Flare | null {
    let best: Flare | null = null, bd = Infinity;
    for (const f of this.list) {
      if (f.owner !== owner || !f.alive) continue;
      const d = f.position.distanceToSquared(from);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  update(dt: number, effects: Effects) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.life -= dt;
      if (f.life <= 0) { f.alive = false; this.list.splice(i, 1); continue; }
      f.velocity.multiplyScalar(Math.max(0, 1 - 1.4 * dt));
      f.velocity.y -= 9.81 * dt;
      f.position.addScaledVector(f.velocity, dt);
      effects.flareSpark(f.position);
    }
  }
}
