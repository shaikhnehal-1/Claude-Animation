import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {drawCharacter, CANVAS_W, CANVAS_H, Costume, Pose2D} from './draw';
import {V3} from '../kit/util';

/** A 2D character living in the 3D world: lit by scene lights, casts a shadow, faces the camera (yaw only). */
export const Toon: React.FC<{
  costume: Costume;
  pose: Pose2D;
  position: V3;
  height?: number; // world height of the full canvas
  flip?: boolean;
  selfLight?: number; // keeps characters readable in dark scenes
}> = ({costume, pose, position, height = 2.15, flip = false, selfLight = 0.45}) => {
  const {camera} = useThree();
  const ref = useRef<THREE.Mesh>(null);
  const res = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = CANVAS_W;
    cv.height = CANVAS_H;
    const gv = document.createElement('canvas');
    gv.width = CANVAS_W / 2;
    gv.height = CANVAS_H / 2;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const gtex = new THREE.CanvasTexture(gv);
    gtex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: gtex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 1,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const w = height * (CANVAS_W / CANVAS_H);
    const geo = new THREE.PlaneGeometry(w, height);
    geo.translate(0, height / 2 - height * (40 / CANVAS_H), 0);
    return {cv, gv, tex, gtex, mat, geo, ctx: cv.getContext('2d')!, gctx: gv.getContext('2d')!};
  }, [height]);

  useLayoutEffect(() => {
    const {ctx, gctx, cv, gv} = res;
    // draw at half-res glow canvas via a scaled context
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gv.width, gv.height);
    gctx.fillStyle = '#000';
    gctx.fillRect(0, 0, gv.width, gv.height);
    drawCharacter(ctx, {costume, pose}, null);
    // emissive = dim copy of the art (readability) + bright parts (eyes)
    gctx.globalAlpha = selfLight;
    gctx.drawImage(cv, 0, 0, gv.width, gv.height);
    gctx.globalAlpha = 1;
    if (costume.kind === 'doom') {
      const tmp = document.createElement('canvas');
      tmp.width = CANVAS_W;
      tmp.height = CANVAS_H;
      const tctx = tmp.getContext('2d')!;
      drawCharacter(ctx, {costume, pose}, tctx);
      gctx.globalCompositeOperation = 'lighter';
      gctx.drawImage(tmp, 0, 0, gv.width, gv.height);
      gctx.globalCompositeOperation = 'source-over';
    }
    if (ref.current) ref.current.rotation.y = Math.atan2(camera.position.x - position[0], camera.position.z - position[2]);
    res.tex.needsUpdate = true;
    res.gtex.needsUpdate = true;
  });

  return (
    <mesh
      ref={ref}
      geometry={res.geo}
      material={res.mat}
      position={position}
      scale={[flip ? -1 : 1, 1, 1]}
      castShadow
      receiveShadow={false}
    />
  );
};
