import * as THREE from 'three';

const vertex = /* glsl */ `
varying vec3 vWorldPos;
varying float vFogDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeep;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorldPos;
varying float vFogDepth;

vec2 waveGrad(vec2 p, float t, float fade) {
  vec2 g = vec2(0.0);
  // direction, wavelength (m), amplitude, speed
  vec2 d1 = normalize(vec2(1.0, 0.35));
  vec2 d2 = normalize(vec2(-0.6, 1.0));
  vec2 d3 = normalize(vec2(0.2, -1.0));
  vec2 d4 = normalize(vec2(-1.0, -0.3));
  float k;
  k = 6.2831 / 90.0;  g += d1 * k * 0.9 * cos(dot(d1, p) * k + t * 0.9);
  k = 6.2831 / 47.0;  g += d2 * k * 0.5 * cos(dot(d2, p) * k + t * 1.3);
  k = 6.2831 / 21.0;  g += d3 * k * 0.22 * cos(dot(d3, p) * k + t * 1.9) * fade;
  k = 6.2831 / 9.0;   g += d4 * k * 0.08 * cos(dot(d4, p) * k + t * 2.7) * fade;
  return g;
}

void main() {
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float fade = 1.0 / (1.0 + dist / 1800.0);
  vec2 g = waveGrad(vWorldPos.xz, uTime, fade) * mix(0.35, 1.0, fade);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

  float cosT = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
  vec3 col = mix(uDeep, sky, fres);
  float spec = pow(max(dot(R, uSunDir), 0.0), 380.0) * 6.0 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.12;
  col += uSunColor * spec;

  float alpha = mix(0.72, 1.0, clamp(fres * 1.6 + (1.0 - fade) * 0.6, 0.0, 1.0));
  float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
  col = mix(col, uFogColor, fogF);
  alpha = mix(alpha, 1.0, fogF);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Water {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color('#fff2dd') },
        uDeep: { value: new THREE.Color('#0d2f3d') },
        uHorizon: { value: new THREE.Color('#a8bccd') },
        uZenith: { value: new THREE.Color('#3f6d9e') },
        uFogColor: { value: new THREE.Color('#a8bccd') },
        uFogDensity: { value: 0.00006 },
      },
    });
    const geo = new THREE.PlaneGeometry(160000, 160000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 1;
  }

  sync(fog: THREE.FogExp2, sunDir: THREE.Vector3, sunColor: THREE.Color) {
    const u = this.material.uniforms;
    u.uFogColor.value.copy(fog.color);
    u.uHorizon.value.copy(fog.color);
    u.uFogDensity.value = fog.density;
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(sunColor);
  }

  update(dt: number, focus: THREE.Vector3) {
    this.material.uniforms.uTime.value += dt;
    // Keep the plane centred under the camera so it always reaches the horizon.
    this.mesh.position.set(Math.round(focus.x / 1000) * 1000, 0, Math.round(focus.z / 1000) * 1000);
  }
}
