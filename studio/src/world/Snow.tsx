import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {usePBR, pbrMat, PBR} from './assets';
import {Flame} from './Fire';
import {Tower} from './Castle';
import {Glow} from '../kit/core';
import {V3, rng, fbm, flash} from '../kit/util';

/** Falling snow (deterministic): positions are a pure function of t. */
export const Snowfall: React.FC<{t: number; center: V3; size?: V3; count?: number; wind?: number; speed?: number}> = ({t, center, size = [30, 14, 30], count = 2500, wind = 1.2, speed = 1}) => {
  const base = useMemo(() => {
    const r = rng(77);
    return Float32Array.from({length: count * 4}, () => r());
  }, [count]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return g;
  }, [count]);
  const tex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < count; i++) {
    const a = base[i * 4], b = base[i * 4 + 1], c = base[i * 4 + 2], d = base[i * 4 + 3];
    const fall = (0.6 + d * 0.8) * speed;
    const y = ((b * size[1] - t * fall) % size[1] + size[1]) % size[1];
    const x = ((a * size[0] + t * wind * (0.6 + d) + Math.sin(t * 1.3 + i) * 0.3) % size[0] + size[0]) % size[0];
    p.setXYZ(i, center[0] + x - size[0] / 2, center[1] + y - size[1] / 2, center[2] + c * size[2] - size[2] / 2);
  }
  p.needsUpdate = true;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial map={tex} size={0.07} sizeAttenuation transparent opacity={0.85} depthWrite={false} color="#dfe8ff" />
    </points>
  );
};

/** Instanced pine forest (cone stacks with snow caps) that sways in the wind. */
export const Pines: React.FC<{t: number; spots: [number, number, number][]; wind?: number; snowy?: boolean; ground?: (x: number, z: number) => number}> = ({t, spots, wind = 1, snowy = true, ground = () => 0}) => {
  const layers = 4;
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const geos = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (let l = 0; l < layers; l++) {
      const g = new THREE.ConeGeometry(1.25 - l * 0.24, 1.5, 9, 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < 0.7) {
          const ang = Math.atan2(p.getZ(i), p.getX(i));
          const k = 1 + 0.18 * Math.sin(ang * 5 + l);
          p.setX(i, p.getX(i) * k);
          p.setZ(i, p.getZ(i) * k);
          if (y < -0.7) p.setY(i, y - 0.12 * Math.abs(Math.sin(ang * 5 + l)));
        }
      }
      g.computeVertexNormals();
      g.translate(0, 1.2 + l * 0.85, 0);
      out.push(g);
    }
    return out;
  }, []);
  const snowGeos = useMemo(() => geos.map((g) => {
    const s = g.clone();
    s.scale(0.86, 0.6, 0.86);
    s.translate(0, 0.62, 0);
    return s;
  }), [geos]);
  const trunk = useMemo(() => new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6).translate(0, 0.7, 0), []);
  const mats = useMemo(() => ({
    needle: new THREE.MeshStandardMaterial({color: '#1d3a2a', roughness: 0.95}),
    snow: new THREE.MeshStandardMaterial({color: '#dfe6f2', roughness: 0.8}),
    bark: new THREE.MeshStandardMaterial({color: '#2b1d14', roughness: 1}),
  }), []);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  useLayoutEffect(() => {
    spots.forEach(([x, z, s], i) => {
      const sway = Math.sin(t * 1.4 + x * 0.3 + z * 0.2) * 0.025 * wind + Math.sin(t * 3.1 + i) * 0.008 * wind;
      e.set(sway * 0.6, i * 1.7, sway);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, ground(x, z), z), q, new THREE.Vector3(s, s * (1.1 + (i % 3) * 0.12), s));
      refs.current.forEach((r) => r?.setMatrixAt(i, m));
    });
    refs.current.forEach((r) => {
      if (r) r.instanceMatrix.needsUpdate = true;
    });
  });
  let k = 0;
  return (
    <group>
      <instancedMesh ref={(r) => (refs.current[k++] = r)} args={[trunk, mats.bark, spots.length]} castShadow receiveShadow frustumCulled={false} />
      {geos.map((g, i) => (
        <instancedMesh key={i} ref={(r) => (refs.current[1 + i] = r)} args={[g, mats.needle, spots.length]} castShadow receiveShadow frustumCulled={false} />
      ))}
      {snowy
        ? snowGeos.map((g, i) => (
            <instancedMesh key={`s${i}`} ref={(r) => (refs.current[1 + layers + i] = r)} args={[g, mats.snow, spots.length]} receiveShadow frustumCulled={false} />
          ))
        : null}
    </group>
  );
};

/** Romani wagon (vardo): painted body, curved roof, spoked wheels, glowing window, chimney. */
export const Wagon: React.FC<{position: V3; rot?: number; body?: string; trim?: string; lit?: number; wood: PBR | null; t: number; smoke?: boolean}> = ({position, rot = 0, body = '#6d1f1f', trim = '#c9a24a', lit = 1, wood, t}) => {
  const M = useMemo(() => ({
    body: pbrMat(wood, 1.5, 1, {color: body}),
    roof: pbrMat(wood, 2, 1, {color: '#3a2a20'}),
    trim: new THREE.MeshStandardMaterial({color: trim, metalness: 0.6, roughness: 0.35}),
    wheel: new THREE.MeshStandardMaterial({color: '#4a2e18', roughness: 0.8}),
    iron: new THREE.MeshStandardMaterial({color: '#222', metalness: 0.8, roughness: 0.45}),
  }), [wood, body, trim]);
  const Wheel = ({p, r}: {p: V3; r: number}) => (
    <group position={p} rotation={[0, Math.PI / 2, 0]}>
      <mesh material={M.wheel} castShadow>
        <torusGeometry args={[r, 0.05, 6, 20]} />
      </mesh>
      {Array.from({length: 8}, (_, i) => (
        <mesh key={i} material={M.wheel} rotation={[0, 0, (i / 8) * Math.PI]} castShadow>
          <boxGeometry args={[r * 2, 0.035, 0.035]} />
        </mesh>
      ))}
      <mesh material={M.iron} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.14, 10]} />
      </mesh>
    </group>
  );
  return (
    <group position={position} rotation={[0, rot, 0]}>
      <mesh material={M.body} position={[0, 1.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.4, 3.4]} />
      </mesh>
      <mesh material={M.roof} position={[0, 2.15, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.05, 3.6, 18, 1, false, -Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh position={[0, 2.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 3.5, 12, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#e8eef8" roughness={0.9} />
      </mesh>
      {/* trim bands */}
      {[0.78, 2.12].map((y) => (
        <mesh key={y} material={M.trim} position={[0, y, 0]}>
          <boxGeometry args={[1.96, 0.07, 3.46]} />
        </mesh>
      ))}
      {/* glowing window + door */}
      {[[0.96, 1.6, 0.6, Math.PI / 2], [-0.96, 1.6, -0.6, -Math.PI / 2]].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, r, 0]}>
          <mesh>
            <planeGeometry args={[0.55, 0.5]} />
            <meshBasicMaterial color={new THREE.Color('#ffb060').multiplyScalar(1.4 * lit)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.01]} material={M.trim}>
            <boxGeometry args={[0.62, 0.05, 0.03]} />
          </mesh>
          <mesh position={[0, 0, 0.01]} material={M.trim}>
            <boxGeometry args={[0.05, 0.55, 0.03]} />
          </mesh>
          <Glow position={[0, 0, 0.3]} color="#ff9a40" size={1.6} opacity={0.4 * lit} />
        </group>
      ))}
      <mesh position={[0, 1.35, 1.71]} material={M.roof}>
        <boxGeometry args={[0.7, 1.2, 0.04]} />
      </mesh>
      <mesh position={[0, 1.65, 1.74]}>
        <planeGeometry args={[0.3, 0.35]} />
        <meshBasicMaterial color={new THREE.Color('#ffb060').multiplyScalar(1.2 * lit)} toneMapped={false} />
      </mesh>
      {/* chimney */}
      <mesh material={M.iron} position={[0.5, 2.9, -1]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.7, 8]} />
      </mesh>
      {/* steps + shafts */}
      <mesh material={M.wheel} position={[0, 0.55, 1.95]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.6]} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} material={M.wheel} position={[x, 0.55, 2.6]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 2.0]} />
        </mesh>
      ))}
      <Wheel p={[1.02, 0.55, 1.1]} r={0.55} />
      <Wheel p={[-1.02, 0.55, 1.1]} r={0.55} />
      <Wheel p={[1.02, 0.65, -1.1]} r={0.65} />
      <Wheel p={[-1.02, 0.65, -1.1]} r={0.65} />
    </group>
  );
};

/** Storm: dark cloud deck + lightning bolt + flash light. */
export const Lightning: React.FC<{t: number; strikes: number[]; boltAt?: V3; seed?: number}> = ({t, strikes, boltAt = [-30, 0, -80], seed = 3}) => {
  const f = flash(t, strikes);
  const active = strikes.find((s) => t - s >= 0 && t - s < 0.35);
  const pts = useMemo(() => {
    const r = rng(seed + Math.floor((active ?? 0) * 10));
    const out: THREE.Vector3[] = [];
    let x = 0, y = 60;
    while (y > 0) {
      out.push(new THREE.Vector3(x, y, 0));
      x += (r() - 0.5) * 6;
      y -= 2 + r() * 4;
    }
    out.push(new THREE.Vector3(x, -2, 0));
    return out;
  }, [active, seed]);
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 80, 0.25, 5, false), [pts]);
  return (
    <group>
      <directionalLight position={[boltAt[0], 60, boltAt[2] + 40]} intensity={f * 6} color="#cfe0ff" />
      <ambientLight intensity={f * 0.5} color="#b8ccff" />
      {active !== undefined && f > 0.2 ? (
        <group position={boltAt}>
          <mesh geometry={geo}>
            <meshBasicMaterial color={new THREE.Color('#e8f0ff').multiplyScalar(4 * f)} toneMapped={false} fog={false} />
          </mesh>
          <Glow position={[0, 30, 0]} color="#9fb8ff" size={90 * f} opacity={0.6} />
        </group>
      ) : null}
    </group>
  );
};

/** Ground height for the valley camp */
export const campGround = (x: number, z: number) => {
  const hill = Math.max(0, -z - 60) * 0.5 * Math.exp(-((x - 35) ** 2) / 2500);
  return fbm(x * 0.04, z * 0.04, 3) * 1.6 - 0.8 + hill + Math.max(0, Math.abs(x) - 40) * 0.25;
};

const Terrain: React.FC<{mat: THREE.Material}> = ({mat}) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(400, 400, 160, 160);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, campGround(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    return g;
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow position={[0, 0, -100]} />;
};

/** Distant castle on the hill: a cluster of towers and walls with lit windows. */
export const HillCastle: React.FC<{position: V3; scale?: number; wall: THREE.Material; roof: THREE.Material}> = ({position, scale = 1, wall, roof}) => (
  <group position={position} scale={scale}>
    <Tower position={[0, 0, 0]} r={3.2} h={26} wall={wall} roof={roof} windows={6} seed={11} />
    <Tower position={[-11, 0, 4]} r={2.4} h={18} wall={wall} roof={roof} windows={3} seed={12} />
    <Tower position={[10, 0, 3]} r={2.6} h={20} wall={wall} roof={roof} windows={4} seed={13} />
    <Tower position={[4, 0, -8]} r={2.0} h={30} wall={wall} roof={roof} windows={3} seed={14} />
    <mesh position={[0, 6, 4]} material={wall} castShadow>
      <boxGeometry args={[22, 12, 2]} />
    </mesh>
    <mesh position={[-3, 9, -2]} material={wall} castShadow>
      <boxGeometry args={[12, 18, 9]} />
    </mesh>
    <mesh position={[-3, 18 + 2.5, -2]} material={roof} rotation={[0, Math.PI / 4, 0]} castShadow>
      <coneGeometry args={[8.5, 5, 4]} />
    </mesh>
    {Array.from({length: 9}, (_, i) => (
      <Glow key={i} position={[-8 + (i % 5) * 3, 5 + Math.floor(i / 5) * 4, 5.2]} color="#ffaa50" size={1.6} opacity={0.8} />
    ))}
  </group>
);

/** The wagon camp in the snowy valley at night, castle on the hill above. */
export const SnowCamp: React.FC<{t: number; strikes?: number[]; snow?: number; fire?: boolean; castle?: boolean; children?: React.ReactNode}> = ({t, strikes = [], snow = 1, fire = true, castle = true, children}) => {
  const snowT = usePBR('snow_02');
  const wood = usePBR('brown_planks_05');
  const stone = usePBR('castle_wall_varriation');
  const slates = usePBR('castle_wall_slates');
  const M = useMemo(() => {
    if (!snowT || !stone || !slates) return null;
    return {
      ground: pbrMat(snowT, 80, 80, {color: '#c9d3e4'}),
      wall: pbrMat(stone, 6, 6, {color: '#7a828e'}),
      roof: pbrMat(slates, 3, 3, {color: '#343a44'}),
    };
  }, [snowT, stone, slates]);
  const trees = useMemo(() => {
    const r = rng(5);
    const out: [number, number, number][] = [];
    for (let i = 0; i < 260; i++) {
      const x = (r() - 0.5) * 180, z = 20 - r() * 170;
      if (Math.abs(x) < 16 && z > -26) continue; // camp clearing
      out.push([x, z, 1.1 + r() * 1.4]);
    }
    return out;
  }, []);
  if (!M) return null;
  const wagons: [V3, number, string, string][] = [
    [[-5, 0, -6], 0.5, '#6d1f1f', '#c9a24a'],
    [[4.5, 0, -9], -0.6, '#1f4d3a', '#d8b45a'],
    [[-9, 0, -15], 0.9, '#2a3466', '#c9a24a'],
    [[8, 0, -18], -1.1, '#6a3a1a', '#e0c070'],
    [[0, 0, -22], 0.1, '#5a1a3a', '#c9a24a'],
  ];
  return (
    <group>
      <Terrain mat={M.ground} />
      <Pines t={t} spots={trees} wind={1.3} ground={campGround} />
      {wagons.map(([p, r, b, tr], i) => (
        <Wagon key={i} position={[p[0], campGround(p[0], p[2]), p[2]]} rot={r} body={b} trim={tr} wood={wood} t={t} lit={i === 2 ? 0.2 : 1} />
      ))}
      {fire ? (
        <group position={[0, campGround(0, -12), -12]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, 0.1, 0]} rotation={[0, (i / 5) * Math.PI, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 1.1, 6]} />
              <meshStandardMaterial color="#2a1a10" roughness={1} />
            </mesh>
          ))}
          <Flame t={t} position={[0, 0.15, 0]} size={1.0} seed={8} intensity={14} />
        </group>
      ) : null}
      {castle ? <HillCastle position={[35, campGround(35, -150) + 2, -150]} scale={1.4} wall={M.wall} roof={M.roof} /> : null}
      {snow > 0 ? <Snowfall t={t} center={[0, 6, -8]} size={[40, 14, 40]} count={Math.floor(3000 * snow)} wind={2} /> : null}
      <Lightning t={t} strikes={strikes} boltAt={[-20, 0, -140]} />
      {children}
    </group>
  );
};
