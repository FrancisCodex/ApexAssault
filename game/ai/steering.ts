import * as THREE from 'three';
import type { Aircraft, Controls } from '../entities/Aircraft';
import { clamp, smoothstep } from '../core/utils';
import { BULLET_SPEED } from '../data/weapons';

const _inv = new THREE.Quaternion();
const _local = new THREE.Vector3();

/**
 * Converts a desired world-space flight direction into stick inputs:
 * roll the target into the lift vector, then pull. Used by the AI pilots
 * and by the "Mouse Aim" control mode.
 */
export function steerToward(ac: Aircraft, desired: THREE.Vector3, out: Controls, gain = 1) {
  _inv.copy(ac.quaternion).invert();
  _local.copy(desired).applyQuaternion(_inv).normalize();
  const fwd = -_local.z;
  const angle = Math.acos(clamp(fwd, -1, 1));
  const rollErr = Math.atan2(_local.x, _local.y);
  const align = smoothstep(0.03, 0.22, angle);

  // Wings-level preference for small corrections.
  const bank = ac.bankAngle();
  const levelCmd = clamp(-bank * 1.2, -1, 1);
  const rollCmd = clamp(rollErr * 2.4 * gain, -1, 1);
  out.roll = levelCmd + (rollCmd - levelCmd) * align;

  const pitchErr = Math.atan2(_local.y, Math.max(fwd, 0.05));
  let pitch = clamp(pitchErr * 4.5 * gain, -0.6, 1);
  if (Math.abs(rollErr) > Math.PI * 0.55 && angle > 0.3) pitch = 0.15; // roll first, then pull
  if (fwd < 0 && Math.abs(rollErr) < 0.6) pitch = 1;
  out.pitch = pitch;

  out.yaw = clamp(Math.atan2(_local.x, Math.max(fwd, 0.05)) * 3, -1, 1) * (1 - align * 0.8);
  return angle;
}

/** Where to point the gun to hit a target (bullets inherit shooter velocity). */
export function leadPoint(
  shooterPos: THREE.Vector3, shooterVel: THREE.Vector3, targetPos: THREE.Vector3, targetVel: THREE.Vector3,
  out: THREE.Vector3, speed = BULLET_SPEED,
): number {
  let t = shooterPos.distanceTo(targetPos) / speed;
  for (let i = 0; i < 3; i++) {
    out.copy(targetVel).sub(shooterVel).multiplyScalar(t).add(targetPos);
    t = out.distanceTo(shooterPos) / speed;
  }
  out.y += 0.5 * 4 * t * t; // compensate bullet drop
  return t;
}
