import React, {useMemo} from 'react';
import * as THREE from 'three';
import {usePBR, pbrMat, usePHModel} from './assets';
import {Brazier, WallTorch} from './Fire';
import {Glow} from '../kit/core';
import {V3, rng, fbm} from '../kit/util';

const WALK_W = 3.6;

/** Box with world-scaled texture repeat. */
const StoneBox: React.FC<{size: V3; position: V3; mat: THREE.Material; rot?: V3}> = ({size, position, mat, rot}) => (
  <mesh position={position} rotation={rot as any} material={mat} castShadow receiveShadow>
    <boxGeometry args={size} />
  </mesh>
);

/** Arched window glowing warm from inside. */
const LitWindow: React.FC<{position: V3; rotY?: number; w?: number; h?: number; on?: number}> = ({position, rotY = 0, w = 0.6, h = 1.0, on = 1}) => {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true);
    s.lineTo(w / 2, 0);
    s.closePath();
    return s;
  }, [w, h]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={new THREE.Color('#ffae55').multiplyScalar(1.6 * on)} toneMapped={false} />
      </mesh>
      <mesh position={[0, h * 0.45, 0.01]}>
        <boxGeometry args={[0.05, h * 0.9, 0.02]} />
        <meshBasicMaterial color="#1a120c" />
      </mesh>
      <mesh position={[0, h * 0.5, 0.01]}>
        <boxGeometry args={[w, 0.05, 0.02]} />
        <meshBasicMaterial color="#1a120c" />
      </mesh>
      <Glow position={[0, h / 2, 0.2]} color="#ff9a40" size={w * 3.2} opacity={0.35 * on} />
    </group>
  );
};

export const Tower: React.FC<{position: V3; r: number; h: number; wall: THREE.Material; roof: THREE.Material; windows?: number; seed?: number}> = ({position, r, h, wall, roof, windows = 3, seed = 1}) => {
  const rr = rng(seed);
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={wall} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 1.08, h, 32]} />
      </mesh>
      {/* crenellated ring */}
      {Array.from({length: 14}, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * r * 1.02, h + 0.35, Math.sin(a) * r * 1.02]} rotation={[0, -a, 0]} material={wall} castShadow>
            <boxGeometry args={[0.5, 0.7, r * 0.45 * 0.7]} />
          </mesh>
        );
      })}
      <mesh position={[0, h + 0.15, 0]} material={wall}>
        <cylinderGeometry args={[r * 1.12, r * 1.02, 0.3, 32]} />
      </mesh>
      <mesh position={[0, h + 0.7 + r * 1.3, 0]} material={roof} castShadow>
        <coneGeometry args={[r * 0.95, r * 2.6, 32]} />
      </mesh>
      {Array.from({length: windows}, (_, i) => {
        const a = Math.PI * 0.5 + (rr() - 0.5) * 1.6;
        const y = h * (0.35 + 0.5 * rr());
        return <LitWindow key={i} position={[Math.cos(a) * (r + 0.02), y, Math.sin(a) * (r + 0.02)]} rotY={Math.PI / 2 - a} w={0.45} h={0.8} on={rr() > 0.25 ? 1 : 0.15} />;
      })}
    </group>
  );
};

const Mountains: React.FC<{mat: THREE.Material}> = ({mat}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 500, 160, 90);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const d = Math.max(0, -z - 40) / 200; // rise with distance
      const ridge = Math.pow(fbm(x * 0.012 + 3, z * 0.012, 5), 1.6) * 140 * Math.min(1, d);
      p.setY(i, ridge - 2 + fbm(x * 0.05, z * 0.05, 3) * 6);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return <mesh geometry={geo} material={mat} position={[0, -26, -120]} receiveShadow />;
};

/** Distant village lights scattered in the valley */
const VillageLights: React.FC<{t: number}> = ({t}) => {
  const pts = useMemo(() => {
    const r = rng(42);
    return Array.from({length: 70}, () => [(r() - 0.5) * 120 + 40, -24 + r() * 1.5, -40 - r() * 110, r()] as const);
  }, []);
  return (
    <>
      {pts.map(([x, y, z, k], i) => (
        <Glow key={i} position={[x, y, z]} color={k > 0.8 ? '#ffd28a' : '#ff9a40'} size={1.6 + k * 1.5} opacity={0.55 + 0.25 * Math.sin(t * 2 + i)} />
      ))}
    </>
  );
};

/** The castle battlement walkway at night (camera looks down -Z). */
export const CastleWall: React.FC<{t: number; torches?: boolean; skip?: string[]}> = ({t, torches = true, skip = []}) => {
  const brick = usePBR('castle_wall_varriation');
  const slates = usePBR('castle_wall_slates');
  const cobble = usePBR('cobblestone_floor_04');
  const rock = usePBR('defense_wall');
  const barrels = usePHModel('wooden_barrels_01');
  const crate = usePHModel('wooden_crate_01');
  const door = usePHModel('large_castle_door');

  const M = useMemo(() => {
    if (!brick || !slates || !cobble || !rock) return null;
    return {
      floor: pbrMat(cobble, 2.2, 28, {color: '#5a616c'}),
      wallLong: pbrMat(brick, 30, 4, {color: '#9aa2ad'}),
      wallTall: pbrMat(brick, 24, 5, {color: '#9aa2ad'}),
      merlon: pbrMat(brick, 0.6, 0.5, {color: '#9aa2ad'}),
      parapet: pbrMat(brick, 28, 0.9, {color: '#9aa2ad'}),
      drop: pbrMat(brick, 30, 14, {color: '#8a929c'}),
      tower: pbrMat(brick, 8, 9, {color: '#8a929c'}),
      roof: pbrMat(slates, 4, 3, {color: '#3d434d'}),
      rock: pbrMat(rock, 40, 24, {color: '#4a515c'}),
    };
  }, [brick, slates, cobble, rock]);
  if (!M) return null;

  const L = 48;
  const merlons = Array.from({length: Math.floor(L / 1.3)}, (_, i) => -i * 1.3 + 2);
  const model = (g: any, pos: V3, rot = 0, s = 1) =>
    g ? <primitive object={g.scene.clone()} position={pos} rotation={[0, rot, 0]} scale={s} /> : null;

  return (
    <group>
      {/* walkway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -L / 2 + 4]} material={M.floor} receiveShadow>
        <planeGeometry args={[WALK_W, L]} />
      </mesh>
      {/* outer parapet (right) + merlons */}
      <StoneBox size={[0.55, 1.0, L]} position={[WALK_W / 2 + 0.27, 0.5, -L / 2 + 4]} mat={M.parapet} />
      {merlons.map((z, i) => (
        <StoneBox key={i} size={[0.6, 0.72, 0.78]} position={[WALK_W / 2 + 0.27, 1.36, z]} mat={M.merlon} />
      ))}
      {/* wall face dropping to the valley */}
      <StoneBox size={[0.6, 26, L]} position={[WALK_W / 2 + 0.6, -13, -L / 2 + 4]} mat={M.drop} />
      {/* inner tall keep wall (left) */}
      <StoneBox size={[1.0, 7, L]} position={[-WALK_W / 2 - 0.5, 3.5, -L / 2 + 4]} mat={M.wallTall} />
      {[-4, -11, -18, -25].map((z, i) => (
        <LitWindow key={i} position={[-WALK_W / 2 + 0.005, 3.2, z]} rotY={Math.PI / 2} w={0.7} h={1.3} on={i === 2 ? 0.2 : 1} />
      ))}
      {door ? <primitive object={door.scene.clone()} position={[-WALK_W / 2 + 0.02, 0, -8]} rotation={[0, Math.PI / 2, 0]} scale={0.75} /> : null}
      {skip.includes('towers') ? null : <>
      <Tower position={[0.6, -26, -L + 2]} r={3.4} h={44} wall={M.tower} roof={M.roof} windows={4} seed={3} />
      {/* far towers across the valley */}
      <Tower position={[34, -26, -70]} r={3} h={40} wall={M.tower} roof={M.roof} windows={5} seed={7} />
      <Tower position={[52, -26, -95]} r={2.6} h={34} wall={M.tower} roof={M.roof} windows={4} seed={9} />
      </>}
      {/* valley + mountains */}
      {skip.includes('mountains') ? null : <Mountains mat={M.rock} />}
      {skip.includes('lights') ? null : <VillageLights t={t} />}
      {skip.includes('models') ? null : <>
      {model(barrels, [-1.25, 0, -3.2], 0.4, 1)}
      {model(crate, [-1.3, 0, -5.0], 0.2, 0.9)}
      {model(crate, [-1.25, 0.62, -5.0], 0.9, 0.7)}
      </>}
      {/* fire */}
      {torches && !skip.includes('fire') ? (
        <>
          <Brazier t={t} position={[1.15, 0, -1.2]} seed={1} />
          <Brazier t={t} position={[1.15, 0, -14]} seed={2} />
          <WallTorch t={t} position={[-WALK_W / 2, 2.2, -6.0]} rotY={Math.PI / 2} seed={3} />
          <WallTorch t={t} position={[-WALK_W / 2, 2.2, -21]} rotY={Math.PI / 2} seed={4} light={false} />
          <Brazier t={t} position={[1.1, 0, -27]} seed={5} light={false} />
        </>
      ) : null}
    </group>
  );
};
