import * as THREE from 'three';

// 4-step light ramp = the "2D cel" look on 3D shapes.
let _grad: THREE.DataTexture | null = null;
export const toonGradient = () => {
  if (_grad) return _grad;
  const v = [22, 70, 150, 255];
  const d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  _grad = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
};

const cache = new Map<string, THREE.Material>();
const memo = <T extends THREE.Material>(key: string, make: () => T): T => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
};

export const toon = (color: string, emissive = '#000000', ei = 0) =>
  memo(`toon${color}${emissive}${ei}`, () => new THREE.MeshToonMaterial({color, gradientMap: toonGradient(), emissive, emissiveIntensity: ei}));

export const metal = (color = '#9aa3ad', rough = 0.32, env = 1.2) =>
  memo(`metal${color}${rough}${env}`, () => new THREE.MeshStandardMaterial({color, metalness: 0.95, roughness: rough, envMapIntensity: env}));

export const glow = (color: string, intensity = 3) =>
  memo(`glow${color}${intensity}`, () => new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false, fog: false}));

export const flat = (color: string) => memo(`flat${color}`, () => new THREE.MeshBasicMaterial({color}));

export const stone = (color = '#5a6270', rough = 0.95) =>
  memo(`stone${color}${rough}`, () => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: 0.0}));

// Ink outline: inverted hull pushed along normals (works with fog).
export const outline = (thickness = 0.012, color = '#07080b') =>
  memo(`outline${thickness}${color}`, () => {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {thickness: {value: thickness}, color: {value: new THREE.Color(color)}}]),
      vertexShader: `
        uniform float thickness;
        #include <fog_pars_vertex>
        void main(){
          vec3 p = position + normalize(normal) * thickness;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 color;
        #include <fog_pars_fragment>
        void main(){
          gl_FragColor = vec4(color, 1.0);
          #include <fog_fragment>
        }`,
      side: THREE.BackSide,
      fog: true,
    });
    return m;
  });

// Soft round glow sprite texture (fake bloom halos for torches, eyes, windows)
let _glowTex: THREE.Texture | null = null;
export const glowTexture = () => {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
};

// Soft cloud / smoke puff texture
const puffs = new Map<number, THREE.Texture>();
export const puffTexture = (seed = 1) => {
  if (puffs.has(seed)) return puffs.get(seed)!;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 36; i++) {
    const x = 128 + (rnd() - 0.5) * 140, y = 140 + (rnd() - 0.5) * 70, rad = 30 + rnd() * 60;
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(255,255,255,0.22)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  puffs.set(seed, t);
  return t;
};
