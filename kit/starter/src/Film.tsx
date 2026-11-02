import React,{useEffect,useMemo} from 'react';
import * as T from 'three';
import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame,useVideoConfig,useRemotionEnvironment} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {BloomEffect,BlendFunction,ToneMappingEffect,ToneMappingMode} from 'postprocessing';
import {Actor} from './cast';
import {twoTone,TONE,CHAR,untone} from './look/shade';
import {LIGHTS} from './look/lights';
import {InkPass,NOINK} from './look/ink';
import {LensBlur} from './look/lensblur';
import {GradeEffect,GRADES} from './look/grade';
import {drinkReactDrop,dropToGround,localMark,smooth,type Point} from '../runtime/events';
import project from '../project.json';
import trackManifest from '../audio-tracks.json';
const tracks:ReadonlyArray<{path:string;name:string;version?:string}>=trackManifest;

/** A working action study. Replace the scene/story for the new brief before marking visual review passed. */
const Stage=()=>{
 const frame=useCurrentFrame(),{camera,scene,invalidate}=useThree(),{isRendering}=useRemotionEnvironment();
 const marks=project.shots[0].id;
 const sip=localMark(project,marks,'drink'),react=localMark(project,marks,'sick'),drop=localMark(project,marks,'cup-drop');
 const cameraPosition=(f:number)=>new T.Vector3(1.1-f/project.durationInFrames*.2,2.1,5-f/project.durationInFrames*.4);
 const world=useMemo(()=>{
  const root=new T.Group();const light=new T.DirectionalLight('#fff1d1',2.8),fill=new T.AmbientLight('#8299bb',1.3);light.position.set(5,9,6);light.layers.enable(NOINK);fill.layers.enable(NOINK);root.add(light,fill);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),twoTone(new T.MeshLambertMaterial({color:'#c1b590'})));ground.rotation.x=-Math.PI/2;root.add(ground);
  for(let i=0;i<9;i++){const m=new T.Mesh(new T.BoxGeometry(2,2+i%3,2),twoTone(new T.MeshLambertMaterial({color:['#b29073','#c9b89a','#8d7465'][i%3]})));m.position.set((i-4)*3,1,-7-i%2*3);root.add(m);}
  const father=new Actor(root,'father',0,0,1,0),child=new Actor(root,'child',-1.3,.2,.8);
  const cup=new T.Mesh(new T.CylinderGeometry(.17,.12,.2,16),twoTone(new T.MeshLambertMaterial({color:'#a98f66'})));root.add(cup);
  const releaseCamera=new T.PerspectiveCamera();releaseCamera.position.copy(cameraPosition(react));
  father.pose(react,releaseCamera,'neutral',false,0,0,{action:'drink',t:1});
  const releaseAnchor=father.hand('right').add(new T.Vector3(-.02,.07,.08)).toArray() as Point;
  return {root,father,child,cup,releaseAnchor};
 },[react,project.durationInFrames]);
 const fx=useMemo(()=>({
  ink:new InkPass(scene,camera as T.PerspectiveCamera,{widthNear:4.1,widthFar:2.8,creaseScale:.7}),
  lens:new LensBlur({maxCoC:22,nearScale:1.1}),
  bloom:new BloomEffect({blendFunction:BlendFunction.ADD,intensity:.35,luminanceThreshold:1,mipmapBlur:true,levels:5,radius:.6}),
  tone:new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL}),
  grade:new GradeEffect(GRADES.day,.15),
 }),[camera,scene]);
 const action=drinkReactDrop(frame,sip,react,drop);
 camera.position.copy(cameraPosition(frame));camera.lookAt(0,1.4,0);camera.layers.enable(NOINK);
 scene.background=untone('#b8d0ec');
 TONE.uLitCol.value.fromArray(LIGHTS.day.lit);TONE.uShadeCol.value.fromArray(LIGHTS.day.shade);TONE.uShadeLift.value.fromArray(LIGHTS.day.lift);
 CHAR.uCharTint.value.set(1,.96,.94);CHAR.uCharShade.value=.88;
 world.father.pose(frame,camera,action.sick?'dazed':'neutral',false,0,0,{action:action.sick?'sick':'drink',t:action.lift});
 world.child.pose(frame,camera,action.sick?'shock':'neutral');
 world.father.root.rotation.z=-action.fall*.9;world.father.root.position.x-=action.fall*1.4;
 if(!action.sick){world.cup.position.copy(world.father.hand('right')).add(new T.Vector3(-.02,.07,.08));world.cup.rotation.z=-smooth((frame-sip+4)/6)*.55;}
 else {
  world.cup.position.set(...dropToGround(frame,react,drop,world.releaseAnchor,.1));
  world.cup.rotation.z=-smooth((react-sip+4)/6)*.55*(1-action.drop);
 }
 const forward=new T.Vector3();camera.getWorldDirection(forward);
 fx.lens.focus=Math.max(.3,world.father.head().sub(camera.position).dot(forward));fx.lens.cInf=10;
 useEffect(()=>{invalidate();},[frame,invalidate]);
 useEffect(()=>()=>{world.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});},[world]);
 useEffect(()=>()=>{fx.ink.dispose();fx.lens.pre.dispose();fx.lens.main.dispose();fx.bloom.dispose();fx.tone.dispose();fx.grade.dispose();},[fx]);
 return <><primitive object={world.root} dispose={null}/><EffectComposer multisampling={isRendering?4:2}>
  <primitive object={fx.ink} dispose={null}/><primitive object={fx.lens.pre} dispose={null}/><primitive object={fx.lens.main} dispose={null}/><primitive object={fx.bloom} dispose={null}/><primitive object={fx.tone} dispose={null}/><primitive object={fx.grade} dispose={null}/>
 </EffectComposer></>;
};
export const Film=()=>{const {width,height}=useVideoConfig(),{isRendering}=useRemotionEnvironment();return <AbsoluteFill style={{background:'#b8d0ec'}}>
 <Sequence name="Action study · replace with approved story"><ThreeCanvas width={width} height={height} dpr={isRendering?undefined:.5} frameloop="demand" gl={{antialias:false,stencil:false,powerPreference:'high-performance'}} camera={{fov:40,near:.15,far:200}}><Stage/></ThreeCanvas></Sequence>
 {tracks.map(track=><Audio key={track.path+track.version} name={track.name} src={staticFile(track.path)+(track.version?`?v=${track.version}`:'')} volume={1} useWebAudioApi/>)}
 </AbsoluteFill>;};
