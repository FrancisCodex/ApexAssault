import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createAircraftModel } from '../game/models/AircraftModels';
import type { AircraftId } from '../game/data/aircraft';
import { AIRCRAFT } from '../game/data/aircraft';

/** Small turntable render of the selected airframe for the hangar screen. */
export const AircraftPreview = ({ id }: { id: AircraftId }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.6;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 500);
    scene.add(new THREE.HemisphereLight('#cfe3ff', '#3a3326', 1.6));
    const sun = new THREE.DirectionalLight('#fff2dd', 2.6);
    sun.position.set(20, 30, 15);
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#8fb8ff', 1.2);
    rim.position.set(-20, 10, -25);
    scene.add(rim);

    const model = createAircraftModel(id, 'BLUE');
    const box = new THREE.Box3().setFromObject(model.root);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    model.root.position.sub(center);
    const pivot = new THREE.Group();
    pivot.add(model.root);
    scene.add(pivot);
    camera.position.set(size * 0.72, size * 0.34, size * 0.88);
    camera.lookAt(0, 0, 0);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.6, 48),
      new THREE.MeshBasicMaterial({ color: '#8dffb6', transparent: true, opacity: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -size * 0.18;
    scene.add(ground);

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      pivot.rotation.y = t * 0.45;
      pivot.rotation.z = Math.sin(t * 0.7) * 0.06;
      for (const p of model.props) p.rotation.z += dt * 20;
      for (const r of model.rotors) r.rotation.y += dt * 12;
      for (const r of model.tailRotors) r.rotation.x += dt * 30;
      renderer.render(scene, camera);
    };
    loop();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [id]);

  return <canvas ref={ref} className="w-full h-full block" aria-label={`${AIRCRAFT[id].name} preview`} />;
};
