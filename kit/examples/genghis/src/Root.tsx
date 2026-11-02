import React from 'react';
import {Composition} from 'remotion';
import p from '../project.json';
import {GenghisKhanLife} from './film/Film';
export const Root=()=> <Composition id={p.id} component={GenghisKhanLife} fps={p.fps} width={p.width} height={p.height} durationInFrames={p.durationInFrames}/>;
