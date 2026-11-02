import project from '../../project.json';
import {localMark} from './events';
export const FPS=project.fps;
export const TOTAL=project.durationInFrames;
export const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
export type V3=[number,number,number];
export type Place='winter'|'camp'|'river'|'steppe'|'china'|'desert'|'persia'|'tent'|'mountain'|'empire';
export type Light='day'|'golden'|'night'|'winter';
type Def={key:string;name:string;sec:number;place:Place;light:Light;camera:V3;look:V3;end?:V3;dof?:number;roll?:number};
export const SHOTS=project.shots.map((s,i)=>({...s,id:i,key:s.id,a:s.start,b:s.end,place:s.place as Place,light:s.light as Light,camera:s.camera as V3,look:s.look as V3,end:s.cameraEnd as V3|undefined}));
export const mark=(shot:string,id:string)=>localMark(project,shot,id);
export type Shot=typeof SHOTS[number];
export const shotAt=(f:number)=>SHOTS.find(s=>f>=s.a&&f<s.b)??SHOTS[SHOTS.length-1];
export function cameraAt(s:Shot,f:number){
 const u=clamp(f/(s.b-s.a)),v=smooth(u),end=s.end??[s.camera[0]*.86,s.camera[1]*.93,s.camera[2]*.88] as V3;
 const pos=s.camera.map((n,i)=>n+(end[i]-n)*(.12*u+.88*v)) as V3;
 let roll=s.roll??0;
 const kickIds:Record<string,string>={cage:'collar-contact',escape:'guard-hit',beggar:'beggar-hit-1',general:'promotion',execute:'messenger-hit',mistake:'mistake-kick',charge:'charge-kick',catapult:'catapult-release',wrath:'wrath-cut'};
 const kicks=Object.fromEntries(Object.entries(kickIds).map(([key,id])=>[key,mark(key,id)]));
 const k=f-(kicks[s.key]??-100);if(k>=0&&k<7){const shake=(k%2?1:-1)*.07*(1-k/7);pos[0]+=shake;pos[1]+=shake*.4;roll+=shake*.22;}
 return {pos,look:s.look,fov:s.key==='china'||s.key==='conquest'?46:40,roll};
}
