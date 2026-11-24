import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Glow} from '../kit/core';
import {noise1, V3, rng} from '../kit/util';

let _flame: THREE.Texture | null = null;
const flameTex = () => {
  if (_flame) return _flame;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 190, 4, 64, 170, 120);
  grd.addColorStop(0, 'rgba(255,255,230,1)');
  grd.addColorStop(0.2, 'rgba(255,220,120,0.95)');
  grd.addColorStop(0.5, 'rgba(255,120,30,0.6)');
  grd.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(64, 10);
  g.bezierCurveTo(100, 90, 124, 150, 112, 200);
  g.bezierCurveTo(100, 250, 28, 250, 16, 200);
  g.bezierCurveTo(4, 150, 28, 90, 64, 10);
  g.fill();
  _flame = new THREE.CanvasTexture(c);
  _flame.colorSpace = THREE.SRGBColorSpace;
  return _flame;
};

/** Flickering flame made of additive sprites + embers + a glow halo. */
export const Flame: React.FC<{t: number; position: V3; size?: number; seed?: number; light?: boolean; intensity?: number}> = ({t, position, size = 0.5, seed = 1, light = true, intensity = 7}) => {
  const r = useMemo(() => rng(seed * 7919), [seed]);
  const embers = useMemo(() => Array.from({length: 7}, () => ({o: r() * 10, x: (r() - 0.5) * 0.3, s: 0.6 + r() * 0.8})), [r]);
  const fl = 0.75 + 0.25 * noise1(t * 9 + seed * 3) + 0.1 * Math.sin(t * 23 + seed);
  const mat = (op: number, col: string) => (
    <spriteMaterial map={flameTex()} color={col} transparent opacity={op} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  );
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((k) => {
        const w = size * (0.55 - k * 0.08) * (0.9 + 0.2 * noise1(t * 7 + k * 5 + seed));
        const h = size * (1.15 - k * 0.12) * fl * (0.85 + 0.3 * noise1(t * 6 + k * 3 + seed));
        const x = (noise1(t * 4 + k * 11 + seed) - 0.5) * size * 0.25;
        return (
          <sprite key={k} position={[x, h * 0.42, 0]} scale={[w, h, 1]}>
            {mat(0.9 - k * 0.12, k === 0 ? '#ff7a26' : k === 3 ? '#fff3c4' : '#ffb04a')}
          </sprite>
        );
      })}
      {embers.map((e, i) => {
        const life = (t * e.s + e.o) % 1.6;
        return (
          <sprite key={`e${i}`} position={[e.x + Math.sin(t * 3 + i) * 0.08, life * size * 2.2, Math.cos(t * 2 + i) * 0.05]} scale={[0.03, 0.03, 1]}>
            <spriteMaterial color="#ffb050" transparent opacity={Math.max(0, 1 - life / 1.6)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        );
      })}
      <Glow position={[0, size * 0.45, 0]} color="#ff8a33" size={size * 5 * fl} opacity={0.5} />
      {light ? <pointLight position={[0, size * 0.6, 0]} color="#ff9440" intensity={intensity * fl} distance={size * 22} decay={2} /> : null}
    </group>
  );
};

/** Iron brazier bowl on a stand with fire. */
export const Brazier: React.FC<{t: number; position: V3; seed?: number; light?: boolean; scale?: number}> = ({t, position, seed = 1, light = true, scale = 1}) => {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({color: '#2b2622', metalness: 0.7, roughness: 0.5}), []);
  return (
    <group position={position} scale={scale}>
      <mesh material={iron} position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.07, 0.9, 8]} />
      </mesh>
      <mesh material={iron} position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.12, 0.22, 16, 1, true]} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
        <meshBasicMaterial color={new THREE.Color('#ff5a10').multiplyScalar(0.9)} toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.3) * 0.12, 1.0, Math.sin(i * 1.3) * 0.12]} rotation={[0, i, 0.3]} castShadow>
          <boxGeometry args={[0.22, 0.05, 0.05]} />
          <meshStandardMaterial color="#1a0f08" roughness={1} />
        </mesh>
      ))}
      <Flame t={t} position={[0, 1.0, 0]} size={0.55} seed={seed} light={light} />
    </group>
  );
};

/** Wall torch: wooden handle in an iron bracket. */
export const WallTorch: React.FC<{t: number; position: V3; rotY?: number; seed?: number; light?: boolean}> = ({t, position, rotY = 0, seed = 1, light = true}) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0, 0.12]} rotation={[0.35, 0, 0]} castShadow>
      <cylinderGeometry args={[0.035, 0.025, 0.5, 8]} />
      <meshStandardMaterial color="#4a2f18" roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.22, 0.2]} castShadow>
      <cylinderGeometry args={[0.06, 0.045, 0.1, 8]} />
      <meshStandardMaterial color="#222" metalness={0.8} roughness={0.4} />
    </mesh>
    <Flame t={t} position={[0, 0.27, 0.21]} size={0.32} seed={seed} light={light} intensity={5} />
  </group>
);
