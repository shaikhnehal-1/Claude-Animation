import React, {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import {EffectComposer, Bloom, DepthOfField, Vignette, Noise, ToneMapping} from '@react-three/postprocessing';
import {ToneMappingMode, BlendFunction} from 'postprocessing';
import {useHDRI} from '../world/assets';

export const W = 1920;
export const H = 1080;

/** Full-frame 16:9 3D viewport with filmic post-processing. */
export const Stage: React.FC<{children: React.ReactNode; post?: React.ReactNode; dpr?: number}> = ({children, post, dpr = (globalThis as any).__DPR ?? 1}) => (
  <ThreeCanvas
    width={W}
    height={H}
    style={{position: 'absolute', top: 0, left: 0}}
    shadows
    dpr={dpr}
    gl={{antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'}}
    onCreated={({gl}) => {
      gl.toneMapping = THREE.NoToneMapping; // tone mapping happens in post
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }}
    camera={{fov: 35, position: [0, 2, 8], near: 0.05, far: 3000}}
  >
    {children}
    {post}
  </ThreeCanvas>
);

/** Bloom + depth of field + vignette + grain + ACES. focus = distance to subject in world units. */
export const Post: React.FC<{focus?: number; blur?: number; bloom?: number; vignette?: number}> = ({focus = 5, blur = 3, bloom = 1.1, vignette = 0.55}) => {
  const {camera} = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  // postprocessing's DoF takes normalized focus distance
  const fd = Math.min(1, (focus - cam.near) / (cam.far - cam.near));
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {blur > 0 ? <DepthOfField focusDistance={fd} focalLength={0.004} bokehScale={blur} height={270} /> : <></>}
      <Bloom mipmapBlur intensity={bloom} luminanceThreshold={0.62} luminanceSmoothing={0.25} radius={0.75} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.25} darkness={vignette} />
      <Noise opacity={0.045} blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  );
};

/** HDRI sky as background + reflection environment, plus distance fog. */
export const Sky: React.FC<{hdri: string; intensity?: number; envIntensity?: number; fog?: string; fogDensity?: number; rotation?: number; blur?: number}> = ({
  hdri, intensity = 1, envIntensity = 1, fog = '#0a1220', fogDensity = 0.012, rotation = 0, blur = 0,
}) => {
  const tex = useHDRI(hdri);
  const {scene} = useThree();
  useLayoutEffect(() => {
    if (!tex) return;
    scene.background = tex;
    scene.environment = tex;
    scene.backgroundIntensity = intensity;
    scene.environmentIntensity = envIntensity;
    scene.backgroundBlurriness = blur;
    scene.backgroundRotation.set(0, rotation, 0);
    scene.environmentRotation.set(0, rotation, 0);
    if (fogDensity <= 0) scene.fog = null;
    else if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.set(fog);
      scene.fog.density = fogDensity;
    } else scene.fog = new THREE.FogExp2(fog, fogDensity);
  });
  return null;
};
