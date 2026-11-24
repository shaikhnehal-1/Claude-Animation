import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {glowTexture, outline as outlineMat} from './materials';
import {V3} from './util';

export const W = 1920;
export const H = 1080;
export const CANVAS_H = 818; // 2.35:1 cinematic frame inside 16:9
export const BAR = (H - CANVAS_H) / 2;

/** A mesh with optional ink outline. Pass a geometry element as child. */
export const Part: React.FC<{
  children: React.ReactElement;
  mat: THREE.Material;
  ol?: number;
  position?: V3;
  rotation?: V3;
  scale?: V3 | number;
  cast?: boolean;
  receive?: boolean;
}> = ({children, mat, ol = 0, position, rotation, scale, cast = true, receive = true}) => (
  <group position={position} rotation={rotation as any} scale={scale as any}>
    <mesh castShadow={cast} receiveShadow={receive} material={mat}>
      {children}
    </mesh>
    {ol > 0 ? <mesh material={outlineMat(ol)}>{children}</mesh> : null}
  </group>
);

export const Glow: React.FC<{position: V3; color: string; size: number; opacity?: number}> = ({position, color, size, opacity = 1}) => (
  <sprite position={position} scale={[size, size, 1]}>
    <spriteMaterial map={glowTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
  </sprite>
);

export const Camera: React.FC<{pos: V3; look: V3; fov?: number; roll?: number}> = ({pos, look, fov = 35, roll = 0}) => {
  const {camera} = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(...pos);
    c.up.set(Math.sin(roll), Math.cos(roll), 0);
    c.lookAt(...look);
    c.fov = fov;
    c.near = 0.05;
    c.far = 2000;
    c.updateProjectionMatrix();
  });
  return null;
};

/** Dark environment map so metal (Doom's armor) reflects a stormy sky + warm torch spots. */
export const Env: React.FC<{warm?: number; cold?: number}> = ({warm = 1, cold = 1}) => {
  const {gl, scene} = useThree();
  const tex = useMemo(() => {
    const s = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {cold: {value: cold}},
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform float cold; varying vec3 vP; void main(){ float h = normalize(vP).y;
          vec3 top = vec3(0.18,0.26,0.38)*cold; vec3 hor = vec3(0.05,0.07,0.1); vec3 bot = vec3(0.01,0.012,0.016);
          vec3 c = h>0.0 ? mix(hor, top, pow(h,0.6)) : mix(hor, bot, pow(-h,0.4)); gl_FragColor = vec4(c,1.0);}`,
      }),
    );
    s.add(sky);
    const add = (color: string, i: number, p: V3, sz: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 8), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(i)}));
      m.position.set(...p);
      s.add(m);
    };
    add('#ffb46a', 4 * warm, [6, 1, 4], 1.2);
    add('#ff9a4a', 3 * warm, [-7, 0.5, -3], 1.0);
    add('#bcd4ff', 5 * cold, [-3, 8, 4], 1.6);
    add('#7dff9a', 1.5, [0, -2, 8], 0.8);
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(s, 0.02);
    pm.dispose();
    return rt.texture;
  }, [gl, warm, cold]);
  useLayoutEffect(() => {
    scene.environment = tex;
    return () => {
      scene.environment = null;
    };
  }, [scene, tex]);
  return null;
};

export const Fog: React.FC<{color: string; density: number}> = ({color, density}) => {
  const {scene} = useThree();
  useLayoutEffect(() => {
    scene.fog = new THREE.FogExp2(color, density);
    scene.background = new THREE.Color(color);
  });
  return null;
};

/** The 3D viewport for one shot: cinematic 2.35:1, ACES tone mapping, soft shadows. */
export const Stage: React.FC<{children: React.ReactNode; exposure?: number}> = ({children, exposure = 1}) => (
  <ThreeCanvas
    width={W}
    height={CANVAS_H}
    style={{position: 'absolute', top: BAR, left: 0}}
    shadows
    gl={{antialias: true, preserveDrawingBuffer: true}}
    onCreated={({gl}) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = exposure;
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }}
    camera={{fov: 35, position: [0, 2, 8]}}
  >
    {children}
  </ThreeCanvas>
);
