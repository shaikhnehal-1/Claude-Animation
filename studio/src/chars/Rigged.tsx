import React, {useEffect, useLayoutEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {createPortal} from '@react-three/fiber';
import {GLTFLoader, GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {continueRender, delayRender, staticFile} from 'remotion';
import {toonGradient} from '../kit/materials';
import {V3} from '../kit/util';

const cache: Record<string, Promise<GLTF>> = {};
export const loadGLTF = (name: string) => {
  if (!cache[name]) cache[name] = new GLTFLoader().loadAsync(staticFile(`models/${name}.glb`));
  return cache[name];
};

export const useGLTF = (name: string) => {
  const [g, setG] = useState<GLTF | null>(null);
  const [h] = useState(() => delayRender(`gltf ${name}`));
  useEffect(() => {
    loadGLTF(name).then((x) => {
      setG(x);
      continueRender(h);
    });
  }, [name, h]);
  return g;
};

// Skinned ink outline (inverted hull that follows the skeleton)
const skinOutline = (thickness: number, color = '#06070a') =>
  new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {thickness: {value: thickness}, color: {value: new THREE.Color(color)}}]),
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      #include <fog_pars_vertex>
      uniform float thickness;
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        transformed += normalize(objectNormal) * thickness;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 color;
      #include <fog_pars_fragment>
      void main(){ gl_FragColor = vec4(color,1.0);
      #include <fog_fragment>
      }`,
    side: THREE.BackSide,
    fog: true,
  });

export type Motion = {
  idle?: number;
  walk?: number;
  run?: number;
  sneak?: number;
  sad?: number;
  /** playback time for locomotion clips (lets you sync steps to travel speed) */
  cycle?: number;
};

export type MatFn = (meshName: string, orig: THREE.MeshStandardMaterial) => THREE.Material | null; // null = hide

export const toonFrom = (color: string | null, orig?: THREE.MeshStandardMaterial, keepMap = true) =>
  new THREE.MeshToonMaterial({
    color: color ?? '#ffffff',
    map: keepMap && orig?.map ? orig.map : null,
    gradientMap: toonGradient(),
  });

const CLIP_NAMES: Record<keyof Omit<Motion, 'cycle'>, string> = {idle: 'idle', walk: 'walk', run: 'run', sneak: 'sneak_pose', sad: 'sad_pose'};

/**
 * A Mixamo-rigged character (Xbot / Soldier / Michelle) driven by Xbot's animation library,
 * cel-shaded + inked, with costume pieces portaled onto bones.
 */
export const Rigged: React.FC<{
  model: 'Xbot' | 'Soldier' | 'Michelle';
  mats: MatFn;
  t: number;
  motion: Motion;
  position?: V3;
  rotation?: number;
  scale?: number;
  outline?: number;
  bones?: Record<string, V3>; // extra rotation (radians) added after animation
  attach?: Partial<Record<'head' | 'neck' | 'spine' | 'chest' | 'hips' | 'handL' | 'handR' | 'footL' | 'footR', React.ReactNode>>;
}> = ({model, mats, t, motion, position = [0, 0, 0], rotation = 0, scale = 1, outline = 0.007, bones = {}, attach = {}}) => {
  const body = useGLTF(model);
  const lib = useGLTF('Xbot');

  const inst = useMemo(() => {
    if (!body || !lib) return null;
    const root = SkeletonUtils.clone(body.scene) as THREE.Object3D;
    root.updateMatrixWorld(true);
    const skinned: THREE.SkinnedMesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) skinned.push(m);
    });
    for (const m of skinned) {
      const nm = mats(m.name, m.material as THREE.MeshStandardMaterial);
      if (!nm) {
        m.visible = false;
        continue;
      }
      m.material = nm;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      if (outline > 0) {
        const ws = new THREE.Vector3();
        m.getWorldScale(ws);
        const o = new THREE.SkinnedMesh(m.geometry, skinOutline(outline / ws.x));
        o.bind(m.skeleton, m.bindMatrix);
        o.frustumCulled = false;
        m.parent!.add(o);
      }
    }
    const mixer = new THREE.AnimationMixer(root);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const [k, clipName] of Object.entries(CLIP_NAMES)) {
      const clip = lib.animations.find((a) => a.name === clipName);
      if (!clip) continue;
      const a = mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      actions[k] = a;
    }
    const bone = (n: string) => root.getObjectByName(`mixamorig:${n}`) ?? root.getObjectByName(`mixamorig${n}`);
    const slots = {
      head: bone('Head'),
      neck: bone('Neck'),
      spine: bone('Spine1'),
      chest: bone('Spine2'),
      hips: bone('Hips'),
      handL: bone('LeftHand'),
      handR: bone('RightHand'),
      footL: bone('LeftFoot'),
      footR: bone('RightFoot'),
    };
    // world scale of bones (Mixamo armatures are often 0.01) -> counter-scale attachments
    const bs = new THREE.Vector3();
    slots.head?.getWorldScale(bs);
    return {root, mixer, actions, slots, boneScale: bs.x || 1, bone};
  }, [body, lib]);

  useLayoutEffect(() => {
    if (!inst) return;
    const {mixer, actions} = inst;
    const w: Record<string, number> = {idle: motion.idle ?? 0, walk: motion.walk ?? 0, run: motion.run ?? 0, sneak: motion.sneak ?? 0, sad: motion.sad ?? 0};
    const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    if (tot === 1 && Object.values(w).every((x) => x === 0)) w.idle = 1;
    for (const [k, a] of Object.entries(actions)) {
      const clipT = k === 'walk' || k === 'run' ? motion.cycle ?? t : t;
      a.time = clipT % a.getClip().duration;
      a.setEffectiveWeight(w[k] / tot);
    }
    mixer.update(0);
    for (const [n, r] of Object.entries(bones)) {
      const b = inst.bone(n);
      if (b) {
        b.rotation.x += r[0];
        b.rotation.y += r[1];
        b.rotation.z += r[2];
      }
    }
  });

  if (!inst) return null;
  const inv = 1 / inst.boneScale;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <primitive object={inst.root} />
      {Object.entries(attach).map(([k, node]) => {
        const b = (inst.slots as any)[k] as THREE.Object3D | undefined;
        if (!b || !node) return null;
        return <React.Fragment key={k}>{createPortal(<group scale={inv}>{node}</group>, b)}</React.Fragment>;
      })}
    </group>
  );
};
