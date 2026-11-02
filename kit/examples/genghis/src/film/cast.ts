import * as T from 'three';
import {blinkAt} from './events';
import {Pen,bodyFront,headBlob,type Outfit,type Expr,INK} from './look/toon';
import {cardShade,CARD_K} from './look/cardshade';
import {NOINK} from './look/ink';

export type Role='child'|'young'|'father'|'khan'|'old'|'wife'|'warrior'|'guard'|'beggar'|'general'|'merchant'|'son'|'engineer';
export type Action='none'|'drink'|'sick'|'carry'|'reach'|'collar'|'strike'|'fight'|'cheer'|'kneel'|'command';
export type Acting={action:Action;t:number};
type XY=[number,number];
type Arm=[XY,XY,XY];
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function skeleton(role:Role,variant:number,act:Action){
 const kid=role==='child',royal=role==='khan'||role==='old',seed=kid?13:royal?17:23+variant%3;
 const h=headBlob(seed,kid?112:118,0),hh=2*h.b;
 const chin=975-(act==='kneel'?.2:kid?1:1.4)*hh-(kid?.85:1.1)*hh;
 return {chin,hh};
}
function actionArms(role:Role,variant:number,act:Action,t:number):[Arm,Arm]{
 const {chin:c,hh}=skeleton(role,variant,act),sy=c+.12*hh;
 const L:Arm=[[225,sy],[190,sy+95],[185,c+hh]],R:Arm=[[375,sy],[410,sy+95],[415,c+hh]];
 if(act==='drink')R.splice(1,2,[445,lerp(c+100,c+40,t)],[lerp(415,350,t),lerp(c+hh,c-77,t)]);
 if(act==='sick'){L.splice(1,2,[180,c+100],[275,c+110]);R.splice(1,2,[425,c+95],[320,c+105]);}
 if(act==='carry'){L.splice(1,2,[170,c+95],[155,lerp(850,c+.75*hh,t)]);R.splice(1,2,[430,c+95],[445,lerp(850,c+.75*hh,t)]);}
 if(act==='reach')R.splice(1,2,[440,c+125],[lerp(420,510,t),lerp(c+80,890,t)]);
 if(act==='collar'){L.splice(1,2,[120,c+50],[lerp(175,12,t),lerp(c-50,c+61,t)]);R.splice(1,2,[330,c+100],[lerp(410,180,t),c+35]);}
 if(act==='strike'||act==='fight'){R.splice(1,2,[440,lerp(c-30,c+50,t)],[lerp(405,580,t),lerp(c-150,c-18,t)]);L.splice(1,2,[190,c+20],[245,c-10]);}
 if(act==='cheer'){L.splice(1,2,[180,c-20],[lerp(235,287,t),c-50]);R.splice(1,2,[420,c-20],[lerp(365,313,t),c-50]);}
 if(act==='kneel'){L.splice(1,2,[245,c+120],[287,c+150]);R.splice(1,2,[355,c+120],[313,c+150]);}
 if(act==='command')R.splice(1,2,[445,c+10],[580,c-10]);
 return [L,R];
}
// LRU keeps long stories and repeated preview revisions from retaining every card on the GPU.
const cache=new Map<string,T.CanvasTexture>();
const MAX_CARD_TEXTURES=64;
function cached(key:string){const tex=cache.get(key);if(tex){cache.delete(key);cache.set(key,tex);}return tex;}
function remember(key:string,tex:T.CanvasTexture){cache.set(key,tex);while(cache.size>MAX_CARD_TEXTURES){const oldest=cache.keys().next().value!;cache.get(oldest)!.dispose();cache.delete(oldest);}return tex;}
const coats=['#4c747c','#865746','#64734f','#5b5674'];
function person(role:Role,expression:Expr,blink:boolean,phase:number,variant:number,act:Action='none',t=0) {
 const key=[role,expression,blink,phase,variant%3,act,t].join('/');const hit=cached(key);if(hit)return hit;
 const cv=document.createElement('canvas');cv.width=600;cv.height=1000;const g=cv.getContext('2d')!;const p=new Pen(g);
 const royal=role==='khan'||role==='old',kid=role==='child',female=role==='wife';
 const o:Outfit={jacket:royal?'#b98737':kid?'#8b6f55':female?'#97544d':role==='general'?'#4b7782':coats[variant%4],pants:'#45404a',boots:'#302731',skin:'#f5d0a5',sash:royal?'#88403c':'#b49463',hat:royal?'mongol_hat':role==='warrior'||role==='guard'||role==='general'||role==='father'?'mongol_warrior':'hair',hair:role==='old'?'#c1b5a1':'#352a2a',build:kid?'kid':'adult',moustache:royal?role==='old'?'#c1b5a1':'#332527':role==='father'?'#453331':undefined};
 if(female){o.dress='#90504a';o.hat='hair';}
 if(role==='beggar'){o.jacket='#8a8171';o.hat='hair';o.sash=undefined;}
 if(act==='sick')o.skin='#bad2a1';
 bodyFront(p,o,{mode:act==='kneel'?'sit':phase<0?'stand':'stroll',phase:Math.max(0,phase)/8,expr:expression,blink,seed:kid?13:royal?17:23+variant%3,look:.1,lift:48,arms:act==='none'?undefined:actionArms(role,variant,act,t)});p.rot=null;
 if(!kid&&!female){
  const h=headBlob(royal?17:23+variant%3,118,0),hh=2*h.b,torso=975-1.4*hh,chin=torso-1.1*hh;
  p.stroke([[254,chin+18],[333,chin+107],[336,torso-42]],5,'#3e3233');
  if(royal){p.poly([[273,chin+110],[327,chin+110],[337,chin+145],[300,chin+168],[264,chin+145]],'#c9a354',5);}
  if(role==='old') {p.poly([[271,chin-38],[328,chin-38],[318,chin+16],[300,chin+38],[282,chin+14]],'#bdb29e',4);}
 }
 if(kid){p.stroke([[250,614],[350,614]],15,'#d0b591');}
 if(role==='beggar'){const c=skeleton(role,variant,act).chin;p.poly([[250,c+90],[280,c+94],[276,c+131],[245,c+126]],'#665d55',3);p.stroke([[247,c+101],[279,c+106]],3,'#b5a58b');}
 if(role==='general'){const c=skeleton(role,variant,act).chin;p.poly([[258,c+35],[282,c+24],[300,c+47],[281,c+67]],'#d8b35d',4);p.stroke([[257,c+125],[343,c+125]],17,'#9b4640');}
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;return remember(key,tex);
}

function horse(phase:number,variant:number,leader:boolean) {
 const key=`horse/${phase}/${variant%3}/${leader}`;const hit=cached(key);if(hit)return hit;
 const cv=document.createElement('canvas');cv.width=900;cv.height=900;const g=cv.getContext('2d')!;const p=new Pen(g);
 const c=['#a77850','#dac5a2','#6b5551'][variant%3],dark='#3a2c30';
 const theta=phase/8*Math.PI*2;
 for(let i=0;i<4;i++){
  const xx=[285,338,585,635][i],ss=i%2?1:-1,k=Math.sin(theta+(i%2)*Math.PI)*62;
  p.stroke([[xx,635],[xx+k*.65,726],[xx-k,840]],24,dark);p.stroke([[xx,635],[xx+k*.65,726],[xx-k,831]],14,i%2?c:'#785b4f');p.stroke([[xx-k-12,842],[xx-k+22,842]],27,dark);
 }
 p.stroke([[276,564],[195,600],[157,677]],38,dark);
 p.ell(450,589,219,116,c,10);p.ell(460,570,156,70,c,0);
 p.poly([[588,594],[627,429],[655,363],[705,349],[752,406],[774,458],[745,498],[691,485],[672,610]],c,10);
 p.poly([[649,386],[644,326],[665,354],[680,321],[686,370]],c,8);
 p.stroke([[633,407],[614,462],[603,531]],23,dark);p.dot(704,414,7,dark);p.ell(756,465,5,4,dark,0);
 p.stroke([[682,440],[747,477]],8,'#a7403c');p.stroke([[678,442],[641,509],[530,496]],5,dark);
 p.poly([[367,525],[542,525],[564,634],[351,635]],leader?'#8f443b':'#4e6f78',8);p.stroke([[364,550],[547,550]],9,'#d2b47a');
 // The rider is a smaller version of the same original flat cast.
 g.save();g.translate(319,-34);g.scale(.42,.55);
 bodyFront(new Pen(g),{jacket:leader?'#b98737':coats[variant%4],pants:'#423b40',boots:dark,skin:'#f5d0a5',hat:leader?'mongol_hat':'mongol_warrior',sash:'#a1463c',moustache:leader?'#332527':undefined},{mode:'sit',expr:'stern',seed:leader?17:23+variant%3,blink:false,look:.25});g.restore();
 p.stroke([[424,462],[411,558],[383,628]],13,dark);p.stroke([[523,461],[546,549],[559,620]],13,dark);
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;return remember(key,tex);
}

let shadowTex:T.CanvasTexture|undefined;
function shadow(){if(shadowTex)return shadowTex;const cv=document.createElement('canvas');cv.width=cv.height=64;const g=cv.getContext('2d')!;const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(27,22,35,.4)');gr.addColorStop(1,'rgba(27,22,35,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);shadowTex=new T.CanvasTexture(cv);return shadowTex;}

export class Actor {
 mesh:T.Mesh<T.PlaneGeometry,T.MeshLambertMaterial>;blob:T.Mesh;root=new T.Group();
 acting:Acting={action:'none',t:0};
 constructor(parent:T.Object3D,public role:Role,public x:number,public z:number,public size=1,public variant=0,public mounted=false){
  const geo=new T.PlaneGeometry(mounted?3.2:1.68,mounted?3.2:2.8);geo.translate(0,mounted?1.52:1.33,0);
  this.mesh=new T.Mesh(geo,cardShade(new T.MeshLambertMaterial({map:mounted?horse(0,variant,role==='khan'):person(role,'neutral',false,-1,variant),alphaTest:.5,side:T.DoubleSide})));this.mesh.layers.set(NOINK);this.root.add(this.mesh);this.root.scale.setScalar(size);parent.add(this.root);
  this.mesh.onBeforeRender=r=>{const rt=r.getRenderTarget();CARD_K.uPx.value=(rt?rt.height:r.domElement.height)/1920;};
  this.blob=new T.Mesh(new T.PlaneGeometry(mounted?2.5:1.0,.7),new T.MeshBasicMaterial({map:shadow(),transparent:true,depthWrite:false,toneMapped:false}));this.blob.rotation.x=-Math.PI/2;this.blob.layers.set(NOINK);parent.add(this.blob);
 }
 pose(f:number,cam:T.Camera,expr:Expr='neutral',walk=false,dx=0,dz=0,acting:Acting={action:'none',t:0}){
  this.root.rotation.set(0,0,0);
  this.acting={action:acting.action,t:Math.round(Math.max(0,Math.min(1,acting.t))*12)/12};
  const blink=blinkAt(f,this.variant),phase=walk?Math.floor((f+this.variant*3)%24/3):-1;
  this.mesh.material.map=this.mounted?horse(walk?Math.max(0,phase):0,this.variant,this.role==='khan'):person(this.role,expr,blink,phase,this.variant,this.acting.action,this.acting.t);
  this.root.position.set(this.x+dx,walk?Math.abs(Math.sin((f+this.variant*3)/24*Math.PI*2))*(this.mounted?.1:.035):Math.sin((f+this.variant*13)*.04)*.006,this.z+dz);
  this.mesh.rotation.y=Math.atan2(cam.position.x-this.root.position.x,cam.position.z-this.root.position.z);
  this.blob.position.set(this.x+dx,.018,this.z+dz);this.blob.scale.setScalar(this.size);
 }
 point(x:number,y:number,z=.035){this.root.updateMatrixWorld(true);return this.mesh.localToWorld(new T.Vector3((x-300)*.0028,(975-y)*.0028,z));}
 hand(side:'left'|'right'){const a=actionArms(this.role,this.variant,this.acting.action,this.acting.t)[side==='left'?0:1];return this.point(...a[2]);}
 head(){const {chin,hh}=skeleton(this.role,this.variant,this.acting.action);return this.point(300,chin-hh*.5);}
}
