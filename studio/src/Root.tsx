import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from './tests/StyleTest';
export const Root: React.FC = () => <>
  <Composition id="StyleTest" component={StyleTest} durationInFrames={96} fps={24} width={1920} height={1080}/>
</>;
