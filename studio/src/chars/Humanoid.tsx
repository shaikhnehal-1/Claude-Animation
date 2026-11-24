import React, {useMemo} from 'react';
import * as THREE from 'three';
import {Part, Glow} from '../kit/core';
import {toon, metal, glow, flat} from '../kit/materials';
import {V3} from '../kit/util';

export type Look = {
  kind: 'doom' | 'person';
  skin?: string;
  shirt?: string; // torso
  coat?: string; // skirt / tunic / dress
  pants?: string;
  boots?: string;
  hood?: string | null; // hood colour
  cloak?: string | null;
  hair?: string | null;
  longHair?: boolean;
  beard?: string | null;
  hat?: string | null;
  eyeGlow?: string | null; // doom eyes
  height?: number; // scale
  build?: number; // shoulder width multiplier
  dress?: boolean; // long skirt to the ground
  armorTint?: string;
};

export type Pose = {
  t: number; // seconds (for cloth / hair / breathing)
  walk?: number; // phase in radians
  stride?: number; // 0 idle .. 1 walk .. 1.6 run
  lean?: number;
  headYaw?: number;
  headPitch?: number;
  armL?: V3 | null; // shoulder rotation override (x,y,z)
  armR?: V3 | null;
  elbowL?: number | null;
  elbowR?: number | null;
  wind?: number; // cloak/hair wind strength
  windDir?: number; // radians, world-ish (local)
  crouch?: number;
};

const DOOM_GREEN = '#1d5e2e';
const DOOM_GREEN_DARK = '#123d1d';

export const DOOM: Look = {
  kind: 'doom',
  shirt: DOOM_GREEN,
  coat: DOOM_GREEN,
  hood: DOOM_GREEN_DARK,
  cloak: DOOM_GREEN_DARK,
  eyeGlow: '#59ff7a',
  armorTint: '#8f99a5',
  height: 1.08,
  build: 1.12,
};

/** Cloth surface driven by time: wind ripples + drag. Rebuilt every frame (cheap: ~300 verts). */
const Cloak: React.FC<{color: string; t: number; wind: number; drag: number; len: number; topR: number; botR: number}> = ({color, t, wind, drag, len, topR, botR}) => {
  const W = 16, Hs = 20;
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1, W, Hs), []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({color, side: THREE.DoubleSide, gradientMap: (toon(color) as THREE.MeshToonMaterial).gradientMap}), [color]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let j = 0; j <= Hs; j++) {
    const v = j / Hs; // 0 top .. 1 bottom
    for (let i = 0; i <= W; i++) {
      const u = i / W; // 0..1 across
      const ang = (-0.55 + u * 1.1) * Math.PI; // wrap behind the body
      const r = topR + (botR - topR) * Math.pow(v, 0.8);
      let x = Math.sin(ang) * r;
      let z = -Math.cos(ang) * r * 0.75;
      let y = -v * len;
      const vv = Math.pow(v, 1.4);
      const w = wind + drag;
      z -= vv * (0.25 * w + 0.03);
      y += vv * 0.18 * drag * drag;
      x += Math.sin(t * 2.6 + v * 5 + u * 7) * 0.06 * vv * (0.4 + w);
      z += Math.sin(t * 3.1 + v * 6.3 - u * 5) * 0.08 * vv * (0.3 + w);
      y += Math.sin(t * 2.2 + u * 9) * 0.02 * vv * w;
      pos.setXYZ(j * (W + 1) + i, x, y, z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
};

/** Hair strand chain that lags and sways (spring-like via phase delay). */
const Strand: React.FC<{color: string; t: number; seed: number; len: number; wind: number; pos: V3}> = ({color, t, seed, len, wind, pos}) => {
  const segs = 5;
  const seg = len / segs;
  let node: React.ReactNode = null;
  for (let k = segs - 1; k >= 0; k--) {
    const sway = Math.sin(t * 2.4 - k * 0.7 + seed) * (0.08 + 0.12 * wind) * (k / segs + 0.3);
    const back = -0.1 * wind * (k / segs);
    node = (
      <group position={[0, k === 0 ? 0 : -seg, 0]} rotation={[0.08 + back + sway * 0.5, 0, sway]}>
        <Part mat={toon(color)} ol={0.004} position={[0, -seg / 2, 0]}>
          <capsuleGeometry args={[0.028 * (1 - k * 0.12), seg * 0.8, 4, 8]} />
        </Part>
        {node}
      </group>
    );
  }
  return <group position={pos}>{node}</group>;
};

export const Humanoid: React.FC<{look: Look; pose: Pose; position?: V3; rotation?: number; scale?: number}> = ({look, pose, position = [0, 0, 0], rotation = 0, scale = 1}) => {
  const L = look;
  const isDoom = L.kind === 'doom';
  const s = (L.height ?? 1) * scale;
  const b = L.build ?? 1;
  const t = pose.t;
  const ph = pose.walk ?? 0;
  const st = pose.stride ?? 0;
  const run = Math.max(0, st - 1);
  const breathe = Math.sin(t * 1.6) * 0.008;
  const bob = st > 0.01 ? Math.abs(Math.cos(ph)) * 0.035 * st - 0.02 * st : 0;
  const crouch = pose.crouch ?? 0;

  // legs: negative x = forward swing
  const thighA = -Math.sin(ph) * 0.5 * Math.min(st, 1.3);
  const thighB = Math.sin(ph) * 0.5 * Math.min(st, 1.3);
  const kneeA = 0.05 + st * 0.9 * Math.max(0, Math.sin(ph + 0.9)) + crouch * 1.2;
  const kneeB = 0.05 + st * 0.9 * Math.max(0, Math.sin(ph + 0.9 + Math.PI)) + crouch * 1.2;
  const armSwing = 0.45 * Math.min(st, 1.4);
  const armL: V3 = pose.armL ?? [Math.sin(ph) * armSwing, 0, 0.1 + run * 0.15];
  const armR: V3 = pose.armR ?? [-Math.sin(ph) * armSwing, 0, -0.1 - run * 0.15];
  const elbowL = pose.elbowL ?? -0.2 - st * 0.35 - run * 0.6;
  const elbowR = pose.elbowR ?? -0.2 - st * 0.35 - run * 0.6;
  const lean = (pose.lean ?? 0) + run * 0.18 + crouch * 0.3;

  const skinM = toon(L.skin ?? '#c99a7a');
  const armorM = metal(L.armorTint ?? '#8f99a5', 0.3, 1.4);
  const armorDark = metal('#5d6670', 0.38, 1.2);
  const limbM = isDoom ? armorM : toon(L.shirt ?? '#555');
  const legM = isDoom ? armorM : toon(L.pants ?? '#3a3330');
  const bootM = isDoom ? armorDark : toon(L.boots ?? '#2a211c');
  const handM = isDoom ? armorDark : skinM;
  const ol = 0.008;

  const Leg = (x: number, thigh: number, knee: number) => (
    <group position={[x, 0, 0]} rotation={[thigh - crouch * 0.9, 0, 0]}>
      <Part mat={legM} ol={ol} position={[0, -0.22, 0]}>
        <capsuleGeometry args={[isDoom ? 0.088 : 0.075, 0.3, 4, 10]} />
      </Part>
      <group position={[0, -0.45, 0]} rotation={[knee, 0, 0]}>
        {isDoom ? (
          <Part mat={armorDark} ol={ol}>
            <sphereGeometry args={[0.075, 12, 8]} />
          </Part>
        ) : null}
        <Part mat={legM} ol={ol} position={[0, -0.22, 0]}>
          <capsuleGeometry args={[isDoom ? 0.082 : 0.065, 0.3, 4, 10]} />
        </Part>
        <group position={[0, -0.45, 0]} rotation={[-knee * 0.35, 0, 0]}>
          <Part mat={bootM} ol={ol} position={[0, -0.02, 0.05]}>
            <boxGeometry args={[0.13, 0.09, 0.25]} />
          </Part>
          {isDoom ? (
            <Part mat={toon(DOOM_GREEN)} ol={ol} position={[0, 0.06, 0]}>
              <cylinderGeometry args={[0.092, 0.085, 0.07, 12]} />
            </Part>
          ) : null}
        </group>
      </group>
    </group>
  );

  const Arm = (side: 1 | -1, rot: V3, elbow: number) => (
    <group position={[side * 0.27 * b, 0.5, 0]} rotation={rot}>
      <Part mat={isDoom ? armorM : limbM} ol={ol}>
        <sphereGeometry args={[isDoom ? 0.095 : 0.07, 12, 10]} />
      </Part>
      <Part mat={limbM} ol={ol} position={[0, -0.17, 0]}>
        <capsuleGeometry args={[isDoom ? 0.068 : 0.055, 0.22, 4, 10]} />
      </Part>
      <group position={[0, -0.33, 0]} rotation={[elbow, 0, 0]}>
        <Part mat={limbM} ol={ol} position={[0, -0.14, 0]}>
          <capsuleGeometry args={[isDoom ? 0.072 : 0.05, 0.2, 4, 10]} />
        </Part>
        {isDoom ? (
          <Part mat={armorDark} ol={ol} position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.085, 0.075, 0.12, 12]} />
          </Part>
        ) : null}
        <Part mat={handM} ol={ol} position={[0, -0.32, 0.01]} scale={[1, 1.15, 0.8]}>
          <sphereGeometry args={[isDoom ? 0.075 : 0.058, 12, 10]} />
        </Part>
      </group>
    </group>
  );

  const eye = L.eyeGlow;
  const Head = (
    <group position={[0, 0.66, 0.01]} rotation={[pose.headPitch ?? 0, pose.headYaw ?? 0, 0]}>
      <Part mat={isDoom ? armorDark : skinM} ol={ol} position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.12, 10]} />
      </Part>
      <group position={[0, 0.17, 0]}>
        {isDoom ? (
          <>
            {/* iron mask */}
            <Part mat={armorM} ol={ol} scale={[0.92, 1.1, 1]}>
              <sphereGeometry args={[0.15, 28, 20]} />
            </Part>
            <Part mat={armorM} ol={0.005} position={[0, 0.048, 0.128]} rotation={[0.25, 0, 0]}>
              <boxGeometry args={[0.18, 0.026, 0.05]} />
            </Part>
            <Part mat={armorM} ol={0.004} position={[0, -0.005, 0.145]}>
              <boxGeometry args={[0.024, 0.07, 0.03]} />
            </Part>
            {[-1, 1].map((sd) => (
              <group key={sd}>
                <mesh position={[sd * 0.048, 0.022, 0.138]} material={flat('#020303')}>
                  <boxGeometry args={[0.055, 0.016, 0.02]} />
                </mesh>
                {eye ? (
                  <>
                    <mesh position={[sd * 0.048, 0.022, 0.149]} material={glow(eye, 4)}>
                      <boxGeometry args={[0.03, 0.006, 0.002]} />
                    </mesh>
                    <Glow position={[sd * 0.048, 0.022, 0.16]} color={eye} size={0.09} opacity={0.9} />
                  </>
                ) : null}
                <Part mat={armorDark} ol={0} position={[sd * 0.105, -0.03, 0.09]}>
                  <sphereGeometry args={[0.012, 8, 6]} />
                </Part>
                <Part mat={armorDark} ol={0} position={[sd * 0.1, 0.06, 0.1]}>
                  <sphereGeometry args={[0.01, 8, 6]} />
                </Part>
              </group>
            ))}
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[0, -0.06 - k * 0.014, 0.142 - k * 0.006]} material={flat('#050607')}>
                <boxGeometry args={[0.07 - k * 0.008, 0.005, 0.01]} />
              </mesh>
            ))}
          </>
        ) : (
          <>
            <Part mat={skinM} ol={ol} scale={[0.95, 1.08, 1]}>
              <sphereGeometry args={[0.14, 24, 18]} />
            </Part>
            {[-1, 1].map((sd) => (
              <group key={sd} position={[sd * 0.048, 0.02, 0.125]}>
                <mesh material={flat('#f1ece4')} scale={[1, 1.15, 0.6]}>
                  <sphereGeometry args={[0.022, 10, 8]} />
                </mesh>
                <mesh position={[0, -0.002, 0.012]} material={flat('#120d0a')}>
                  <sphereGeometry args={[0.012, 8, 6]} />
                </mesh>
                <mesh position={[0, 0.038, 0.004]} rotation={[0, 0, sd * -0.15]} material={flat(L.hair ?? '#2a1d14')}>
                  <boxGeometry args={[0.045, 0.009, 0.01]} />
                </mesh>
              </group>
            ))}
            <Part mat={skinM} ol={0.004} position={[0, -0.02, 0.138]}>
              <sphereGeometry args={[0.022, 10, 8]} />
            </Part>
            <mesh position={[0, -0.065, 0.122]} material={flat('#5a2b22')}>
              <boxGeometry args={[0.04, 0.007, 0.01]} />
            </mesh>
            {L.hair ? (
              <Part mat={toon(L.hair)} ol={0.005} position={[0, 0.035, -0.012]} scale={[1.02, 1, 1.05]}>
                <sphereGeometry args={[0.145, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              </Part>
            ) : null}
            {L.longHair && L.hair
              ? [-0.09, -0.045, 0, 0.045, 0.09].map((x, k) => (
                  <Strand key={k} color={L.hair!} t={t} seed={k * 1.7} len={0.42} wind={pose.wind ?? 0.3} pos={[x, 0.02, -0.11]} />
                ))
              : null}
            {L.beard ? (
              <Part mat={toon(L.beard)} ol={0.005} position={[0, -0.075, 0.07]} scale={[1, 0.9, 0.8]}>
                <sphereGeometry args={[0.105, 16, 12, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6]} />
              </Part>
            ) : null}
            {L.hat ? (
              <group position={[0, 0.1, 0]}>
                <Part mat={toon(L.hat)} ol={0.006}>
                  <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
                </Part>
                <Part mat={toon(L.hat)} ol={0.006} position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.12, 0.14, 0.14, 20]} />
                </Part>
              </group>
            ) : null}
          </>
        )}
        {L.hood ? (
          <Part mat={toon(L.hood)} ol={0.007} position={[0, 0.015, -0.015]} scale={[1, 1.12, 1.08]}>
            <sphereGeometry args={[isDoom ? 0.2 : 0.19, 24, 16, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.72]} />
          </Part>
        ) : null}
      </group>
    </group>
  );

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={s}>
      <group position={[0, 0.98 + bob - crouch * 0.3, 0]}>
        {/* legs */}
        {Leg(0.11, thighA, kneeA)}
        {Leg(-0.11, thighB, kneeB)}
        {/* belt + skirt / tunic */}
        <Part mat={toon(L.coat ?? L.shirt ?? '#444')} ol={ol} position={[0, L.dress ? -0.42 : -0.12, 0]}>
          <cylinderGeometry args={[0.2 * b, L.dress ? 0.36 : 0.27 * b, L.dress ? 1.02 : 0.48, 18, 1, false]} />
        </Part>
        <Part mat={isDoom ? toon('#4d3a1c') : toon('#2a1f17')} ol={0.006} position={[0, 0.1, 0]}>
          <torusGeometry args={[0.205 * b, 0.032, 8, 24]} />
        </Part>
        {isDoom ? (
          <>
            <Part mat={metal('#b08d3a', 0.35, 1.5)} ol={0.005} position={[0, 0.1, 0.215 * b]}>
              <boxGeometry args={[0.09, 0.07, 0.03]} />
            </Part>
            <Part mat={toon('#3b2c15')} ol={0.006} position={[0.2 * b, 0.02, 0.06]}>
              <boxGeometry args={[0.07, 0.12, 0.08]} />
            </Part>
          </>
        ) : null}
        {/* torso */}
        <group rotation={[lean, 0, 0]}>
          <Part mat={toon(L.shirt ?? '#555')} ol={ol} position={[0, 0.33 + breathe, 0]} scale={[1.28 * b, 1, 0.82]}>
            <capsuleGeometry args={[0.19, 0.26, 6, 16]} />
          </Part>
          {Arm(1, armL, elbowL)}
          {Arm(-1, [armR[0], armR[1], armR[2]], elbowR)}
          {Head}
          {L.cloak ? (
            <group position={[0, 0.6, -0.04]}>
              <Cloak color={L.cloak} t={t} wind={pose.wind ?? 0.3} drag={st * 0.7} len={1.42} topR={0.3 * b} botR={0.62 * b} />
              <Part mat={toon(L.cloak)} ol={0.006} position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.2 * b, 0.05, 8, 20]} />
              </Part>
            </group>
          ) : null}
        </group>
      </group>
    </group>
  );
};

/** Swaddled baby bundle */
export const Baby: React.FC<{t: number; position?: V3; rotation?: V3}> = ({t, position, rotation}) => (
  <group position={position} rotation={rotation as any}>
    <Part mat={toon('#d8c8a8')} ol={0.006} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.09, 0.22, 6, 12]} />
    </Part>
    <Part mat={toon('#8b2f2f')} ol={0.005} position={[0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.095, 0.095, 0.05, 14]} />
    </Part>
    <group position={[0.2, 0.03 + Math.sin(t * 3) * 0.004, 0]}>
      <Part mat={toon('#d9a888')} ol={0.006}>
        <sphereGeometry args={[0.075, 16, 12]} />
      </Part>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0.03, 0.015, sd * 0.025]} material={flat('#140c08')}>
          <boxGeometry args={[0.005, 0.004, 0.018]} />
        </mesh>
      ))}
      <mesh position={[0.07, -0.025, 0]} material={flat('#4a1d18')} scale={[0.5, 1, 1.2]}>
        <sphereGeometry args={[0.014 + 0.006 * Math.abs(Math.sin(t * 7)), 8, 6]} />
      </mesh>
    </group>
  </group>
);
