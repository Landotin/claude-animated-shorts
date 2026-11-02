/** Pure frame clocks. Evaluating frame N never depends on previously visited frames. */
export type Event = {id:string; shot:string; frame:number; type:string; visual?:string; sound?:unknown};
export type Project = {fps:number;durationInFrames:number;shots:ReadonlyArray<{id:string;start:number;end:number}>;events:ReadonlyArray<Event>};
export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
export function eventFrame(project:Project,id:string):number {
 const event=project.events.find(e=>e.id===id);if(!event)throw new Error(`Unknown event: ${id}`);return event.frame;
}
export function localMark(project:Project,shot:string,id:string):number {
 const s=project.shots.find(s=>s.id===shot);const e=project.events.find(e=>e.id===id);
 if(!s||!e||e.shot!==shot)throw new Error(`Event ${id} does not belong to ${shot}`);
 return e.frame-s.start;
}
export function progress(frame:number,start:number,end:number):number {
 if(end<=start)throw new Error('Action end must follow start');return smooth((frame-start)/(end-start));
}
export function strike(frame:number,contact:number,windup=10,fall=15){
 return {swing:progress(frame,contact-windup,contact),fall:progress(frame,contact,contact+fall),burst:frame>=contact&&frame<contact+7};
}
export function drinkReactDrop(frame:number,sip:number,react:number,drop:number){
 if(!(sip<react&&react<drop))throw new Error('Expected sip < reaction < drop');
 return {lift:progress(frame,sip-10,sip),sick:frame>=react,drop:progress(frame,react,drop),fall:progress(frame,react+9,drop+8)};
}
export function gripPullRelease(frame:number,grip:number,release:number){
 return {pull:progress(frame,grip,release),gripped:frame>=grip,free:frame>=release,dirt:frame>=release&&frame<release+12};
}
export function fasten(frame:number,contact:number,reach=16){return {close:progress(frame,contact-reach,contact),latched:frame>=contact};}
export function carryTransfer(frame:number,lift:number,handoff:number,leave:number){
 if(!(lift<handoff&&handoff<leave))throw new Error('Expected lift < handoff < departure');
 return {lift:progress(frame,lift-12,lift),transfer:progress(frame,lift,handoff),attached:frame>=handoff,depart:progress(frame,handoff,leave)};
}
export function promotion(frame:number,approval:number,transform:number){
 if(transform<approval)throw new Error('Promotion must follow approval');
 return {approved:frame>=approval,uniform:frame>=transform,burst:frame>=transform&&frame<transform+7};
}
export type Point=[number,number,number];
/** A released object keeps its sampled world anchor and rests on its own bottom at contact. */
export function dropToGround(frame:number,release:number,contact:number,from:Point,halfHeight=.1,groundY=0):Point {
 if(contact<=release)throw new Error('Ground contact must follow release');
 if(halfHeight<0)throw new Error('Object half-height cannot be negative');
 const rest=groundY+halfHeight;
 if(frame<=release)return [...from];
 if(frame>=contact)return [from[0],rest,from[2]];
 const t=(frame-release)/(contact-release);
 return [from[0],from[1]+(rest-from[1])*t*t,from[2]];
}
export function throwAt(frame:number,release:number,contact:number,from:Point,to:Point,height=.35):Point {
 if(contact<=release)throw new Error('Contact must follow release');const t=clamp((frame-release)/(contact-release));
 return from.map((v,i)=>v+(to[i]-v)*t+(i===1?Math.sin(Math.PI*t)*height:0)) as Point;
}
export function blinkAt(frame:number,variant=0,period=59,duration=3){return ((frame+variant*17)%period+period)%period<duration;}
export function blinkFrames(start:number,end:number,variant=0,period=59){
 const frames:number[]=[];for(let f=Math.max(1,start);f<end;f++)if((f+variant*17)%period===0)frames.push(f);return frames;
}
