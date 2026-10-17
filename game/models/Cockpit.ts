import * as THREE from 'three';
import type { FlightKind } from '../data/aircraft';
import { PartBuilder, box, cyl } from './PartBuilder';

/** Minimal cockpit frame seen from the pilot's eye (origin = eye point). */
export function createCockpit(kind: FlightKind): THREE.Group {
  const g = new THREE.Group();
  const b = new PartBuilder();
  const frame = '#25292e', panel = '#1b1e22', trim = '#3a4048';

  // Instrument panel and glare shield.
  b.add(box(1.25, 0.42, 0.5), panel, [0, -0.62, -0.95]);
  b.add(box(1.3, 0.05, 0.4), trim, [0, -0.39, -0.9], [-0.15, 0, 0]);
  // MFD screens (emissive look via bright colours).
  b.add(box(0.2, 0.16, 0.02), '#0f3d2a', [-0.3, -0.56, -0.69]);
  b.add(box(0.2, 0.16, 0.02), '#0f3d2a', [0.3, -0.56, -0.69]);
  b.add(box(0.16, 0.13, 0.02), '#2d2a0f', [0, -0.58, -0.69]);
  // Side consoles.
  b.addPair(box(0.25, 0.12, 1.4), panel, [0.55, -0.55, -0.1]);
  // Stick.
  b.add(cyl(0.025, 0.03, 0.4, 6), '#111', [0, -0.75, -0.35], [0.25, 0, 0]);

  if (kind === 'HELI') {
    b.addPair(box(0.05, 1.2, 0.05), frame, [0.62, 0.05, -0.75], [0, 0, 0.12]);
    b.add(box(1.25, 0.05, 0.05), frame, [0, 0.62, -0.68]);
    b.addPair(box(0.05, 0.05, 1.6), frame, [0.62, 0.62, 0.0]);
  } else {
    // HUD combiner glass frame.
    b.addPair(box(0.01, 0.1, 0.01), trim, [0.13, -0.33, -0.8]);
    // Canopy bow and rails.
    const bow = new THREE.TorusGeometry(0.62, 0.025, 6, 24, Math.PI);
    b.add(bow, frame, [0, -0.3, -0.85], [0, 0, 0], [1.1, 1.05, 1]);
    b.addPair(box(0.04, 0.04, 2.0), frame, [0.6, -0.24, 0.2]);
    if (kind === 'PROP') {
      b.addPair(box(0.03, 0.55, 0.03), frame, [0.32, 0.03, -0.6], [0, 0, -0.5]);
      b.add(box(0.7, 0.03, 0.03), frame, [0, 0.27, -0.55]);
    }
    const aft = new THREE.TorusGeometry(0.62, 0.03, 6, 24, Math.PI);
    b.add(aft, frame, [0, -0.22, 0.45], [0, 0, 0], [1, 1.05, 1]);
  }

  const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }));
  mesh.renderOrder = 30;
  g.add(mesh);
  const hudGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.22),
    new THREE.MeshBasicMaterial({ color: '#7fffd0', transparent: true, opacity: 0.06, depthWrite: false }),
  );
  hudGlass.position.set(0, -0.2, -0.8);
  if (kind !== 'HELI') g.add(hudGlass);
  g.visible = false;
  return g;
}
