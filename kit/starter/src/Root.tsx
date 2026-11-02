import React from 'react';
import {Composition} from 'remotion';
import project from '../project.json';
import {Film} from './Film';
export const Root=()=> <Composition id={project.id} component={Film} fps={project.fps} width={project.width} height={project.height} durationInFrames={project.durationInFrames}/>;
