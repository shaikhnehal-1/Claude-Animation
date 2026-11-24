import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Part, Glow} from '../kit/core';
import {toon, metal, glow, flat, toonGradient} from '../kit/materials';
import {Rigged, Motion, toonFrom} from './Rigged';
import {V3} from '../kit/util';

export const DOOM_GREEN = '#1f5f30';
export const DOOM_GREEN_DARK = '#123a1c';

/** Sculpted iron mask: a sphere pushed and pulled into Doom's face plate. Unit ~ head radius 1. */
const makeMask = () => {
  const g = new THREE.SphereGeometry(1, 64, 48);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const bump = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    return Math.exp(-d * 2.5);
  };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let {x, y, z} = v;
    const front = Math.max(0, z);
    // flatten the face plane and square the jaw
    z = z > 0 ? z * (0.82 + 0.1 * (1 - Math.abs(x))) : z * 0.95;
    if (y < 0) {
      const k = 1 - 0.22 * Math.min(1, -y * 1.2);
      x *= k;
      z = z > 0 ? z * (1 - 0.06 * -y) : z;
    }
    y *= 1.12;
    // brow ridge
    const brow = bump(Math.abs(x), y, 0.33, 0.32, 0.42, 0.1) * front;
    // eye sockets
    const eye = bump(Math.abs(x), y, 0.36, 0.17, 0.22, 0.09) * front;
    // nose bridge ridge
    const nose = bump(x, y, 0, 0.02, 0.09, 0.32) * front;
    // cheek plates
    const cheek = bump(Math.abs(x), y, 0.48, -0.18, 0.22, 0.22) * front;
    // mouth recess
    const mouth = bump(x, y, 0, -0.5, 0.3, 0.1) * front;
    const s = 1 + brow * 0.09 - eye * 0.1 + nose * 0.07 + cheek * 0.035 - mouth * 0.05;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  g.computeVertexNormals();
  return g;
};

let _mask: THREE.BufferGeometry | null = null;
const maskGeo = () => (_mask ??= makeMask());

export const DoomMask: React.FC<{eyes?: string | null; eyeI?: number; r?: number}> = ({eyes = '#5cff7c', eyeI = 1, r = 0.115}) => {
  const steel = metal('#9aa4b0', 0.28, 1.6);
  const dark = metal('#4a525c', 0.4, 1.2);
  return (
    <group scale={r}>
      <mesh geometry={maskGeo()} material={steel} castShadow receiveShadow />
      <mesh geometry={maskGeo()} material={(() => {
        const m = new THREE.MeshBasicMaterial({color: '#05060a', side: THREE.BackSide});
        return m;
      })()} scale={1.045} />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          {/* eye slit */}
          <mesh position={[sd * 0.34, 0.19, 0.84]} rotation={[0, sd * 0.32, sd * -0.08]} material={flat('#010202')}>
            <boxGeometry args={[0.36, 0.085, 0.12]} />
          </mesh>
          {eyes ? (
            <>
              <mesh position={[sd * 0.34, 0.19, 0.9]} rotation={[0, sd * 0.32, sd * -0.08]} material={glow(eyes, 3 * eyeI)}>
                <boxGeometry args={[0.2, 0.03, 0.02]} />
              </mesh>
              <Glow position={[sd * 0.34, 0.19, 1.0]} color={eyes} size={0.75 * eyeI} opacity={Math.min(1, eyeI)} />
            </>
          ) : null}
          {/* rivets */}
          {[[0.62, 0.42], [0.72, 0.0], [0.6, -0.42], [0.28, -0.78]].map(([x, y], k) => (
            <mesh key={k} position={[sd * x, y, Math.sqrt(Math.max(0.05, 0.9 - x * x - y * y)) * 0.86]} material={dark}>
              <sphereGeometry args={[0.045, 8, 6]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* mouth grille */}
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} position={[0, -0.42 - k * 0.075, 0.79 - k * 0.025]} rotation={[-0.15, 0, 0]} material={flat('#030405')}>
          <boxGeometry args={[0.42 - k * 0.04, 0.025, 0.08]} />
        </mesh>
      ))}
    </group>
  );
};

/** Cloth cloak: half-cylinder that hangs from the shoulders, rippled by wind + drag (deterministic). */
export const Cloak: React.FC<{color: string; t: number; wind?: number; drag?: number; len?: number; topR?: number; botR?: number; open?: number}> = ({
  color, t, wind = 0.4, drag = 0, len = 1.3, topR = 0.24, botR = 0.6, open = 1.25,
}) => {
  const WS = 18, HS = 22;
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, WS, HS), []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color, side: THREE.DoubleSide, gradientMap: toonGradient()}), [color]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let j = 0; j <= HS; j++) {
    const v = j / HS;
    for (let i = 0; i <= WS; i++) {
      const u = i / WS;
      const ang = (-0.5 + u) * open * Math.PI;
      const r = topR + (botR - topR) * Math.pow(v, 0.75);
      let x = Math.sin(ang) * r * 1.15;
      let z = -Math.cos(ang) * r * 0.7;
      let y = -v * len;
      const vv = Math.pow(v, 1.35);
      const w = wind + drag;
      z -= vv * (0.32 * w + 0.04);
      y += vv * 0.2 * drag * drag;
      // folds: vertical pleats
      z += Math.sin(u * Math.PI * 7) * 0.025 * v;
      x += Math.sin(t * 2.4 + v * 5 + u * 7) * 0.055 * vv * (0.4 + w);
      z += Math.sin(t * 3.0 + v * 6.3 - u * 5) * 0.075 * vv * (0.3 + w);
      y += Math.sin(t * 2.1 + u * 9) * 0.025 * vv * w;
      pos.setXYZ(j * (WS + 1) + i, x, y, z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
};

export const Hood: React.FC<{color: string; r?: number}> = ({color, r = 0.16}) => (
  <group>
    <Part mat={toon(color)} ol={0.006} position={[0, 0.0, -0.02]} scale={[1, 1.12, 1.1]}>
      <sphereGeometry args={[r, 32, 20, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.74]} />
    </Part>
    {/* hood drape onto shoulders */}
    <Part mat={toon(color)} ol={0.006} position={[0, -r * 1.05, -0.03]}>
      <cylinderGeometry args={[r * 0.95, r * 1.7, r * 0.9, 28, 1, true, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5]} />
    </Part>
  </group>
);

export type DoomProps = {
  t: number;
  motion: Motion;
  position?: V3;
  rotation?: number;
  scale?: number;
  wind?: number;
  drag?: number;
  eyes?: string | null;
  eyeI?: number;
  bones?: Record<string, V3>;
  bot?: boolean; // Doombot: no hood/cloak tint differences, brighter eyes
};

/** Doom = Mixamo body in steel + green tunic, belt, hood, cloak and the sculpted mask. */
export const Doom: React.FC<DoomProps> = ({t, motion, position, rotation, scale = 1.06, wind = 0.4, drag = 0, eyes = '#5cff7c', eyeI = 0.8, bones, bot = false}) => {
  const steel = useMemo(() => new THREE.MeshStandardMaterial({color: bot ? '#7d8791' : '#8f99a4', metalness: 0.95, roughness: 0.3, envMapIntensity: 1.5}), [bot]);
  const joints = useMemo(() => new THREE.MeshStandardMaterial({color: '#3d444c', metalness: 0.9, roughness: 0.45, envMapIntensity: 1.2}), []);
  const green = bot ? '#1a4a28' : DOOM_GREEN;
  const greenD = bot ? '#0f2c18' : DOOM_GREEN_DARK;
  return (
    <Rigged
      model="Xbot"
      t={t}
      motion={motion}
      position={position}
      rotation={rotation}
      scale={scale}
      bones={bones}
      mats={(name) => (name.includes('Joints') ? joints : steel)}
      attach={{
        head: (
          <group position={[0, 0.085, 0.012]}>
            <DoomMask eyes={eyes} eyeI={eyeI} r={0.112} />
            <Hood color={greenD} r={0.15} />
          </group>
        ),
        chest: (
          <group>
            {/* green tunic over chest */}
            <Part mat={toon(green)} ol={0.007} position={[0, 0.02, 0.005]} scale={[1.18, 1, 0.82]}>
              <capsuleGeometry args={[0.15, 0.16, 6, 18]} />
            </Part>
            <group position={[0, 0.2, -0.04]}>
              <Cloak color={greenD} t={t} wind={wind} drag={drag} len={1.32} topR={0.2} botR={0.56} />
            </group>
          </group>
        ),
        hips: (
          <group>
            <Part mat={toon(green)} ol={0.007} position={[0, -0.14, 0.0]}>
              <cylinderGeometry args={[0.165, 0.25, 0.4, 20, 1, true]} />
            </Part>
            <Part mat={toon('#4a3518')} ol={0.006} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.165, 0.028, 8, 28]} />
            </Part>
            <Part mat={metal('#b8923c', 0.35, 1.6)} ol={0.005} position={[0, 0.05, 0.17]}>
              <boxGeometry args={[0.08, 0.06, 0.025]} />
            </Part>
            <Part mat={toon('#3b2a14')} ol={0.006} position={[0.16, -0.02, 0.06]} rotation={[0, 0.3, 0]}>
              <boxGeometry args={[0.06, 0.11, 0.07]} />
            </Part>
          </group>
        ),
      }}
    />
  );
};

/** Doombot = robot copy of Doom; mostly steel with burning eyes. */
export const Doombot: React.FC<Omit<DoomProps, 'bot'>> = (p) => <Doom {...p} bot eyes={p.eyes ?? '#7dff95'} eyeI={p.eyeI ?? 1.2} />;

export {toonFrom};
