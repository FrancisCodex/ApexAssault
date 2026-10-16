import * as THREE from 'three';
import type { Aircraft } from './entities/Aircraft';
import type { PlayerController } from './PlayerController';
import type { CameraMode } from './data/types';
import type { Terrain } from './world/Terrain';
import { clamp, damp, rand } from './core/utils';
import { FRIENDLY_BASE } from './world/layout';
import { createCockpit } from './models/Cockpit';

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

/** Chase / cockpit / HUD-only cameras plus cinematic menu and death cams. */
export class CameraRig {
  mode: CameraMode = 'CHASE';
  private smoothQ = new THREE.Quaternion();
  private shake = 0;
  private cineAngle = 0;
  private deathTimer = 0;
  private cockpit: THREE.Group | null = null;
  private cockpitFor = '';
  baseFov = 65;

  constructor(public camera: THREE.PerspectiveCamera) {}

  cycle() {
    const order: CameraMode[] = ['CHASE', 'CHASE_FAR', 'COCKPIT', 'HUD'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
  }

  addShake(amount: number) { this.shake = Math.min(1.5, this.shake + amount); }

  reset(ac: Aircraft) {
    this.smoothQ.copy(ac.quaternion);
    this.deathTimer = 0;
    this.ensureCockpit(ac);
  }

  private ensureCockpit(ac: Aircraft) {
    if (this.cockpitFor === ac.id) return;
    if (this.cockpit) this.cockpit.parent?.remove(this.cockpit);
    this.cockpit = createCockpit(ac.spec.kind);
    this.cockpit.position.set(...ac.spec.cockpit);
    ac.model.root.add(this.cockpit);
    this.cockpitFor = ac.id;
  }

  /** Menu background: slow orbit over Port Ardent. */
  updateCinematic(dt: number, terrain: Terrain) {
    this.cineAngle += dt * 0.025;
    const r = 3200;
    _pos.set(FRIENDLY_BASE.x + Math.cos(this.cineAngle) * r, 0, FRIENDLY_BASE.z + Math.sin(this.cineAngle) * r);
    _pos.y = Math.max(terrain.getSurface(_pos.x, _pos.z) + 400, 650);
    if (this.camera.position.distanceTo(_pos) > 1500) this.camera.position.copy(_pos);
    else this.camera.position.lerp(_pos, damp(2, dt));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(FRIENDLY_BASE.x + 1500, 150, FRIENDLY_BASE.z - 800);
    this.setFov(55, dt);
  }

  update(dt: number, ac: Aircraft, pc: PlayerController, terrain: Terrain, mouseAim: boolean) {
    this.ensureCockpit(ac);
    const cam = this.camera;
    if (!ac.alive) { this.updateDeath(dt, ac, terrain); return; }

    const inside = this.mode === 'COCKPIT' || this.mode === 'HUD';
    ac.model.body.visible = !inside;
    for (const r of ac.model.rotors) r.visible = !inside || this.mode === 'COCKPIT';
    if (this.cockpit) this.cockpit.visible = this.mode === 'COCKPIT';

    // Speed-sensitive FOV and G-shake.
    const ab = clamp((ac.throttle - 0.85) / 0.15, 0, 1);
    this.setFov(this.baseFov + ab * 6 + clamp((ac.speed - 200) / 40, 0, 5), dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const gShake = clamp((ac.gForce - 6) / 4, 0, 0.4) + ab * 0.08;
    const sh = (this.shake + gShake) * (inside ? 0.4 : 1);

    if (inside) {
      // Head position in the cockpit, with look-around.
      _pos.set(...ac.spec.cockpit).applyQuaternion(ac.quaternion).add(ac.position);
      cam.position.copy(_pos);
      let yaw = pc.look.yaw, pitch = pc.look.pitch;
      if (pc.look.back) { yaw = Math.PI * 0.92; pitch = 0.15; }
      if (pc.look.target && pc.target) {
        _q.copy(ac.quaternion).invert();
        _tmp.copy(pc.target.position).sub(_pos).applyQuaternion(_q).normalize();
        yaw = Math.atan2(-_tmp.x, -_tmp.z);
        pitch = Math.asin(clamp(_tmp.y, -1, 1));
      }
      _e.set(pitch, yaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      cam.quaternion.copy(ac.quaternion).multiply(_q);
      if (sh > 0) {
        cam.rotateX(rand(-1, 1) * 0.004 * sh);
        cam.rotateY(rand(-1, 1) * 0.004 * sh);
      }
      cam.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      return;
    }

    const far = this.mode === 'CHASE_FAR';
    const s = ac.spec.size * (far ? 1.7 : 1);
    const dist = (ac.isHeli ? 24 : 21) * s;
    const height = (ac.isHeli ? 6.5 : 4.8) * s;

    if (mouseAim) {
      // Camera follows the aim direction, horizon stays level-ish.
      _tmp.copy(pc.aimDir);
      _pos.copy(ac.position).addScaledVector(_tmp, -dist).add(_up.set(0, height, 0));
      cam.position.lerp(_pos, damp(14, dt));
      _look.copy(ac.position).addScaledVector(_tmp, 300);
      cam.up.set(0, 1, 0);
      cam.lookAt(_look);
      this.applyShake(sh);
      return;
    }

    // Lagging orientation gives a sense of rotation speed.
    this.smoothQ.slerp(ac.quaternion, damp(ac.isHeli ? 4 : 7, dt));
    let q = this.smoothQ;
    if (pc.look.target && pc.target) {
      // Target view: keep both the aircraft and the target in frame.
      _tmp.copy(pc.target.position).sub(ac.position).normalize();
      _pos.copy(ac.position).addScaledVector(_tmp, -dist * 1.3);
      _up.set(0, 1, 0).applyQuaternion(ac.quaternion);
      _pos.addScaledVector(_up, height * 1.2);
      cam.position.lerp(_pos, damp(10, dt));
      cam.up.copy(_up);
      cam.lookAt(_look.copy(ac.position).addScaledVector(_tmp, 200));
      this.applyShake(sh);
      return;
    }

    let yaw = pc.look.yaw, pitch = pc.look.pitch;
    if (pc.look.back) { yaw = Math.PI; pitch = 0.1; }
    _e.set(pitch * 0.9, yaw, 0, 'YXZ');
    _q.setFromEuler(_e);
    const orbitQ = _tmp2q.copy(q).multiply(_q);

    _pos.set(0, height, dist).applyQuaternion(orbitQ).add(ac.position);
    // Don't clip into terrain.
    const ground = terrain.getSurface(_pos.x, _pos.z) + 3;
    if (_pos.y < ground) _pos.y = ground;
    cam.position.copy(_pos);
    _up.set(0, 1, 0).applyQuaternion(q);
    cam.up.copy(_up);
    _look.set(0, height * 0.55, -60).applyQuaternion(orbitQ).add(ac.position);
    if (yaw !== 0 || pitch !== 0) _look.copy(ac.position);
    _m.lookAt(cam.position, _look, cam.up);
    cam.quaternion.setFromRotationMatrix(_m);
    this.applyShake(sh);
  }

  private applyShake(sh: number) {
    if (sh <= 0) return;
    this.camera.position.x += rand(-1, 1) * 0.35 * sh;
    this.camera.position.y += rand(-1, 1) * 0.35 * sh;
    this.camera.position.z += rand(-1, 1) * 0.35 * sh;
  }

  private updateDeath(dt: number, ac: Aircraft, terrain: Terrain) {
    this.deathTimer += dt;
    ac.model.body.visible = true;
    if (this.cockpit) this.cockpit.visible = false;
    const a = this.deathTimer * 0.4;
    _pos.set(Math.cos(a) * 90, 45, Math.sin(a) * 90).add(ac.position);
    _pos.y = Math.max(_pos.y, terrain.getSurface(_pos.x, _pos.z) + 20);
    this.camera.position.lerp(_pos, damp(3, dt));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(ac.position);
  }

  private setFov(target: number, dt: number) {
    const cam = this.camera;
    const f = cam.fov + (target - cam.fov) * damp(3, dt);
    if (Math.abs(f - cam.fov) > 0.01) {
      cam.fov = f;
      cam.updateProjectionMatrix();
    }
  }
}

const _tmp2q = new THREE.Quaternion();
