import tracks from '../../audio-tracks.json';
const audioTracks:ReadonlyArray<{name:string;path:string;version?:string}>=tracks;
import React,{useEffect,useMemo,useState} from 'react';
import * as T from 'three';
import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame,useDelayRender,useVideoConfig,useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {BloomEffect,BlendFunction,ToneMappingEffect,ToneMappingMode} from 'postprocessing';
import {World} from './world';
import {SHOTS,TOTAL,type Shot} from './story';
import {InkPass} from './look/ink';
import {LensBlur} from './look/lensblur';
import {GradeEffect,GRADES} from './look/grade';

const Ready:React.FC<{done:()=>void}>=({done})=>{
 const {advance}=useThree();
 useEffect(()=>{let active=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(active){advance(performance.now());done();}}));return()=>{active=false;};},[advance,done]);return null;
};
const Inner:React.FC<{shot:Shot}>=({shot})=>{
 const {isRendering}=useRemotionEnvironment();
 const f=useCurrentFrame(),{camera,scene,invalidate}=useThree();
 const {delayRender,continueRender}=useDelayRender();const [handle]=useState(()=>delayRender('Preparing the painted world'));
 const done=useMemo(()=>()=>continueRender(handle),[continueRender,handle]);
 const world=useMemo(()=>new World(shot),[shot]);
 const fx=useMemo(()=>({
  ink:new InkPass(scene,camera as T.PerspectiveCamera,{widthNear:4.1,widthFar:2.8,creaseScale:.7}),
  lens:new LensBlur({maxCoC:22,nearScale:1.1}),
  bloom:new BloomEffect({blendFunction:BlendFunction.ADD,intensity:.35,luminanceThreshold:1.0,mipmapBlur:true,levels:5,radius:.6}),
  tone:new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL}),
  grade:new GradeEffect(GRADES[shot.light==='golden'?'golden':'day'],shot.light==='golden'?.2:.15),
 }),[camera,scene,shot]);
 const focus=world.update(f,camera as T.PerspectiveCamera,scene);const forward=new T.Vector3();camera.getWorldDirection(forward);
 fx.lens.focus=Math.max(.3,focus.sub(camera.position).dot(forward));fx.lens.cInf=shot.dof??0;
 useEffect(()=>{invalidate();},[f,invalidate]);
 useEffect(()=>()=>{world.dispose();fx.ink.dispose();fx.lens.pre.dispose();fx.lens.main.dispose();fx.bloom.dispose();fx.tone.dispose();fx.grade.dispose();},[world,fx]);
 return <><primitive object={world.root} dispose={null}/><EffectComposer multisampling={isRendering?4:2}>
  <primitive object={fx.ink} dispose={null}/><primitive object={fx.lens.pre} dispose={null}/><primitive object={fx.lens.main} dispose={null}/><primitive object={fx.bloom} dispose={null}/><primitive object={fx.tone} dispose={null}/><primitive object={fx.grade} dispose={null}/><Ready done={done}/>
 </EffectComposer></>;
};
const Scene:React.FC<{shot:Shot}>=({shot})=>{
 const {width,height}=useVideoConfig();
 const {isRendering}=useRemotionEnvironment();
 return <AbsoluteFill><ThreeCanvas width={width} height={height} dpr={isRendering?undefined:.5} frameloop="demand" shadows gl={{antialias:false,stencil:false,powerPreference:'high-performance'}} camera={{fov:40,near:.15,far:500}}><Inner shot={shot}/></ThreeCanvas></AbsoluteFill>;
};
export const GenghisKhanLife:React.FC=()=> <AbsoluteFill style={{background:'#c7dce6'}}>
 {SHOTS.map(shot=><Sequence key={shot.key} from={shot.a} durationInFrames={shot.b-shot.a} name={shot.name}><Scene shot={shot}/></Sequence>)}
 {audioTracks.map(track=><Audio key={track.path+track.version} name={track.name} src={staticFile(track.path)+(track.version?`?v=${track.version}`:'')} volume={1} useWebAudioApi/>)}
</AbsoluteFill>;
export const GENGHIS_LIFE_FRAMES=TOTAL;
