import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Stage} from '../kit/stage';
export const Empty: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{background:'#000'}}><Stage>
    <ambientLight intensity={1}/>
    <mesh rotation={[0, f*0.05, 0]}><boxGeometry/><meshBasicMaterial color="red"/></mesh>
  </Stage></AbsoluteFill>;
};
