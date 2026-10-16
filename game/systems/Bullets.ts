import * as THREE from 'three';
import type { GameContext, Combatant } from '../core/context';
import type { Aircraft } from '../entities/Aircraft';
import type { Team } from '../data/types';
import { segmentPointDistance } from '../core/utils';

interface Bullet {
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  team: Team;
  owner: Aircraft | null;
  damage: number;
  /** Player shots count toward accuracy stats. */
  fromPlayer: boolean;
}

const MAX = 900;

export class Bullets {
  readonly mesh: THREE.InstancedMesh;
  private list: Bullet[] = [];
  private pool: Bullet[] = [];
  private dummy = new THREE.Object3D();
  private dir = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.28, 0.28, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd28a').multiplyScalar(5),
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  clear() {
    this.pool.push(...this.list);
    this.list = [];
    this.mesh.count = 0;
  }

  fire(owner: Aircraft | null, team: Team, pos: THREE.Vector3, vel: THREE.Vector3, damage: number, life: number, fromPlayer = false) {
    if (this.list.length >= MAX) return;
    const b = this.pool.pop() ?? { pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, team, owner, damage, fromPlayer };
    b.pos.copy(pos); b.prev.copy(pos); b.vel.copy(vel);
    b.life = life; b.team = team; b.owner = owner; b.damage = damage; b.fromPlayer = fromPlayer;
    this.list.push(b);
  }

  update(dt: number, ctx: GameContext) {
    const { terrain, effects } = ctx;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.life -= dt;
      b.prev.copy(b.pos);
      b.vel.y -= 4 * dt; // light ballistic drop
      b.pos.addScaledVector(b.vel, dt);
      let dead = b.life <= 0;

      if (!dead) {
        const hit = this.checkHit(b, ctx.aircraft) ?? this.checkHit(b, ctx.ground);
        if (hit) {
          hit.applyDamage(b.damage, b.owner, ctx);
          effects.hitSpark(b.pos);
          ctx.events.hit(hit, b.owner, false);
          dead = true;
        }
      }
      if (!dead) {
        const g = terrain.getHeight(b.pos.x, b.pos.z);
        if (b.pos.y < Math.max(g, 0)) {
          if (Math.random() < 0.35) effects.groundImpact(b.pos.setY(Math.max(g, 0)), g < 0, 0.6);
          dead = true;
        }
      }
      if (dead) {
        this.pool.push(b);
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
      }
    }

    const d = this.dummy;
    for (let i = 0; i < this.list.length; i++) {
      const b = this.list[i];
      d.position.copy(b.pos);
      this.dir.copy(b.vel).normalize();
      d.quaternion.setFromUnitVectors(this.zAxis, this.dir);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.count = this.list.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private checkHit(b: Bullet, targets: Combatant[]): Combatant | null {
    for (const t of targets) {
      if (!t.alive || t.team === b.team) continue;
      const dx = t.position.x - b.pos.x, dy = t.position.y - b.pos.y, dz = t.position.z - b.pos.z;
      if (dx * dx + dy * dy + dz * dz > 250 * 250) continue;
      if (segmentPointDistance(b.prev, b.pos, t.position) < t.radius) return t;
    }
    return null;
  }
}
