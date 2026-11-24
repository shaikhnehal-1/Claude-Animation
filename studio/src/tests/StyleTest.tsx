import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Stage, Post, Sky} from '../kit/stage';
import {Camera} from '../kit/core';
import {CastleWall} from '../world/Castle';
import {Toon} from '../chars2d/Billboard';
import {lerp3, easeInOut} from '../kit/util';

/** Style test: Doom on the castle battlements at night, a guard behind him. */
export const StyleTest: React.FC<{post?: boolean; shadows?: boolean; chars?: boolean; skip?: string[]; dpr?: number; blur?: number}> = ({post = true, shadows = true, chars = true, skip = [], dpr = 1, blur = 2.5}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  const k = easeInOut(f / durationInFrames);
  const cam = lerp3([-0.2, 1.55, 3.6], [0.1, 1.5, 3.1], k);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Stage dpr={dpr} post={post ? <Post focus={3.6} blur={blur} bloom={1.2} /> : null}>
        {skip.includes('sky') ? null : <Sky hdri="rogland_moonlit_night_2k" intensity={0.2} envIntensity={0.16} fog="#060b16" fogDensity={0.02} rotation={2.2} />}
        <hemisphereLight args={['#4a68a8', '#08090d', 0.22]} />
        <directionalLight
          position={[18, 30, -25]}
          intensity={1.5}
          color="#9fb8ff"
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-camera-far={120}
          shadow-bias={-0.0004}
        />
        <Camera pos={cam} look={[0.35, 1.25, -2]} fov={40} />
        <CastleWall t={t} skip={skip} />
        {chars ? <><Toon costume={{kind: 'doom'}} pose={{t, expr: 'angry', armL: 0.25, armR: 0.5, bendR: 0.6, look: -0.3, wind: 0.7, eyeGlow: 1}} position={[0.35, 0, -0.6]} height={2.3} />
        <Toon costume={{kind: 'guard'}} pose={{t: t + 3, expr: 'scared', holdSpear: true, armR: 0.25, look: 0.6, talk: 0}} position={[-0.7, 0, -5.2]} height={2.0} />
        <Toon costume={{kind: 'guard'}} pose={{t: t + 7, expr: 'neutral', holdSpear: true, armR: 0.2, look: -0.4}} position={[0.9, 0, -11]} height={2.0} /></> : null}
      </Stage>
    </AbsoluteFill>
  );
};
