import React from 'react';
import {Composition} from 'remotion';
import {StyleTest} from './tests/StyleTest';
import {Empty} from './tests/Empty';
export const Root: React.FC = () => <>
  <Composition id="StyleTest" component={StyleTest} durationInFrames={96} fps={24} width={1920} height={1080}/>
  <Composition id="Empty" component={Empty} durationInFrames={48} fps={24} width={1920} height={1080}/>
</>;
