import React from 'react';
import {useCurrentFrame, AbsoluteFill} from 'remotion';
import {Stage, Camera, Env, Fog, Glow} from '../kit/core';
import {Humanoid, DOOM, Baby} from '../chars/Humanoid';
import {toon} from '../kit/materials';
export const CharTest: React.FC = () => {
  const f = useCurrentFrame(); const t = f / 24;
  return <AbsoluteFill style={{background: '#000'}}>
    <Stage>
      <Fog color="#0b1018" density={0.04}/>
      <Env/>
      <ambientLight intensity={0.25} color="#8aa0c8"/>
      <directionalLight position={[-4, 6, 3]} intensity={2.2} color="#bcd0ff" castShadow shadow-mapSize={[2048,2048]}/>
      <pointLight position={[2.5, 1.5, 2]} intensity={12} color="#ff9a4a" distance={10}/>
      <Camera pos={[0.4, 1.5, 4.6]} look={[0.2, 1.1, 0]} fov={34}/>
      <Humanoid look={DOOM} pose={{t, walk: t*5, stride: 0.0, wind: 0.6, headYaw: 0.2}} rotation={0.35}/>
      <Humanoid look={{kind:'person', skin:'#c48d6a', shirt:'#5b2338', coat:'#3b1626', hood:'#2a1020', hair:'#1a1210', longHair:true, dress:true, height:0.95}} pose={{t, wind:0.5, headYaw:-0.3}} position={[-1.2,0,-0.5]} rotation={0.5}/>
      <Humanoid look={{kind:'person', skin:'#b88462', shirt:'#4a3b2a', coat:'#3a2e22', pants:'#2b2622', hair:'#3a2a1c', beard:'#3a2a1c', height:1}} pose={{t, walk:t*6, stride:1}} position={[1.4,0,-0.8]} rotation={-0.4}/>
      <mesh rotation={[-Math.PI/2,0,0]} receiveShadow material={toon('#c9d3e0')}><planeGeometry args={[40,40]}/></mesh>
    </Stage>
  </AbsoluteFill>;
};
