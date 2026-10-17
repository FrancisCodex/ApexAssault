import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { DEG } from '../core/utils';

export interface TimeOfDay {
  elevation: number; // degrees above horizon
  azimuth: number; // degrees, 0 = north (-Z), 90 = east (+X)
  fog: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  turbidity: number;
  exposure: number;
}

export const TIMES: Record<'MIDDAY' | 'DAWN', TimeOfDay> = {
  MIDDAY: {
    elevation: 38, azimuth: 150, fog: '#a8bccd', fogDensity: 0.000055,
    sunColor: '#fff4e2', sunIntensity: 3.2, hemiSky: '#b8d0ea', hemiGround: '#5a5440',
    turbidity: 5, exposure: 0.55,
  },
  // Enemy raids come out of the rising sun in the east.
  DAWN: {
    elevation: 9, azimuth: 95, fog: '#c7b49e', fogDensity: 0.00006,
    sunColor: '#ffc68a', sunIntensity: 2.8, hemiSky: '#c6b7b0', hemiGround: '#3f3428',
    turbidity: 8, exposure: 0.5,
  },
};

/** Sky dome, sun, ambient lighting, fog and image-based reflections. */
export class Atmosphere {
  readonly sky: Sky;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sunDir = new THREE.Vector3();
  readonly fog: THREE.FogExp2;
  private envRT: THREE.WebGLRenderTarget | null = null;
  time: TimeOfDay = TIMES.MIDDAY;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.sky = new Sky();
    this.sky.scale.setScalar(400000);
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -160; sc.right = 160; sc.top = 160; sc.bottom = -160; sc.near = 10; sc.far = 3000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#bcd', '#554', 0.9);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2('#a8bccd', 0.00006);
    scene.fog = this.fog;
  }

  apply(time: TimeOfDay) {
    this.time = time;
    const u = this.sky.material.uniforms;
    u.turbidity.value = time.turbidity;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.82;
    const phi = (90 - time.elevation) * DEG;
    const theta = time.azimuth * DEG;
    // azimuth 0 = -Z (north), 90 = +X (east)
    this.sunDir.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), -Math.sin(phi) * Math.cos(theta)).normalize();
    u.sunPosition.value.copy(this.sunDir);

    this.sun.color.set(time.sunColor);
    this.sun.intensity = time.sunIntensity;
    this.hemi.color.set(time.hemiSky);
    this.hemi.groundColor.set(time.hemiGround);
    this.hemi.intensity = 0.9;
    this.fog.color.set(time.fog);
    this.fog.density = time.fogDensity;
    this.renderer.toneMappingExposure = time.exposure;

    // Image based lighting from the sky for metallic airframes.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const skyClone = new Sky();
    skyClone.scale.setScalar(1000);
    const cu = skyClone.material.uniforms;
    for (const k of Object.keys(u)) {
      const val = u[k].value;
      cu[k].value = val && val.clone ? val.clone() : val;
    }
    envScene.add(skyClone);
    const groundMat = new THREE.MeshBasicMaterial({ color: time.hemiGround, side: THREE.BackSide });
    const ground = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), groundMat);
    envScene.add(ground);
    this.envRT?.dispose();
    this.envRT = pmrem.fromScene(envScene, 0, 1, 2000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();
    skyClone.geometry.dispose();
    skyClone.material.dispose();
    ground.geometry.dispose();
    groundMat.dispose();
  }

  /** Keep the shadow frustum centred on the focus point (the player). */
  update(focus: THREE.Vector3) {
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 1500);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(focus);
  }

  setShadows(enabled: boolean) {
    this.sun.castShadow = enabled;
  }
}
