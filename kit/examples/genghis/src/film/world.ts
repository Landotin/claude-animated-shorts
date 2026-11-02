import * as T from 'three';
import {Actor,type Role} from './cast';
import {cameraAt,clamp,smooth,type Shot} from './story';
import {twoTone,TONE,CHAR,untone} from './look/shade';
import {LIGHTS} from './look/lights';
import {NOINK} from './look/ink';
import {Actions} from './actions';

const P={wood:'#8d6946',dark:'#403339',felt:'#dfcdb0',red:'#9a4e40',stone:'#b6ac95',green:'#9aab71',gold:'#c59b51'};
const textures=new Map<string,T.CanvasTexture>();
function paint(color:string,kind='earth'){
 const key=color+kind;if(textures.has(key))return textures.get(key)!;
 const cv=document.createElement('canvas');cv.width=cv.height=512;const g=cv.getContext('2d')!;g.fillStyle=color;g.fillRect(0,0,512,512);
 for(let i=0;i<3600;i++){
  const r=(Math.sin(i*127.1)*43758.5453)%1,x=Math.abs(r)*512,y=Math.abs((Math.sin(i*311.7)*19417.3)%1)*512;
  g.fillStyle=i%2?'rgba(255,240,205,.055)':'rgba(44,32,34,.045)';g.fillRect(x,y,kind==='wood'?2:8,kind==='wood'?35:3);
 }
 if(kind==='wood'){g.strokeStyle='rgba(44,31,31,.35)';g.lineWidth=3;for(let x=0;x<=512;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x+3,512);g.stroke();}}
 if(kind==='stone'){g.strokeStyle='rgba(46,37,36,.22)';g.lineWidth=4;for(let y=0;y<512;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();for(let x=(y/128)%2*128;x<512;x+=256){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+128);g.stroke();}}}
 if(kind==='felt'){g.strokeStyle='rgba(76,46,34,.23)';g.lineWidth=4;for(let x=0;x<=512;x+=128){g.beginPath();g.moveTo(x,0);g.bezierCurveTo(x+7,170,x-3,350,x,512);g.stroke();}}
 const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;textures.set(key,tex);return tex;
}
function mat(c:string,k='earth'){return twoTone(new T.MeshLambertMaterial({map:paint(c,k)}));}
function box(p:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,c:string,k='earth'){
 const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c,k));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m;
}
function cyl(p:T.Object3D,x:number,y:number,z:number,r:number,h:number,c:string,rt=r,n=16){
 const m=new T.Mesh(new T.CylinderGeometry(rt,r,h,n),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m;
}
function beam(p:T.Object3D,a:T.Vector3,b:T.Vector3,r=.06,c=P.wood){const m=cyl(p,0,0,0,r,a.distanceTo(b),c);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
function yurt(p:T.Object3D,x:number,z:number,r=2.3){
 const g=new T.Group();g.position.set(x,0,z);p.add(g);
 const wall=new T.Mesh(new T.CylinderGeometry(r,r,1.9,32),mat(P.felt,'felt'));wall.position.y=.95;wall.castShadow=wall.receiveShadow=true;g.add(wall);
 cyl(g,0,1.65,0,r*1.006,.15,P.red);const roof=cyl(g,0,2.45,0,r*1.06,1.1,P.felt,.4,32);roof.material=mat('#e8d9bf','felt');
 cyl(g,0,3.03,0,.42,.1,P.dark);box(g,0,.86,r+.01,.96,1.72,.1,'#503a2c','wood');
 for(const s of [-1,1])box(g,s*.53,.9,r+.09,.1,1.8,.12,'#a35a43','wood');box(g,0,1.8,r+.1,1.18,.13,.15,'#a35a43','wood');
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;beam(g,v(Math.sin(a)*r,1.9,Math.cos(a)*r),v(Math.sin(a)*.4,2.99,Math.cos(a)*.4),.018,'#8e7153');}
 return g;
}
function standard(p:T.Object3D,x:number,z:number,c='#d7ccb5',h=4.2){
 const g=new T.Group();g.position.set(x,0,z);p.add(g);cyl(g,0,h/2,0,.045,h,P.wood);beam(g,v(-.4,h-.4,0),v(.4,h-.4,0),.035,P.dark);
 const top=cyl(g,0,h+.03,0,.13,.45,P.gold,0,8);for(let i=0;i<5;i++){
  const m=new T.Mesh(new T.PlaneGeometry(.16,.85+(i%2)*.25),mat(c,'felt'));m.position.set((i-2)*.13,h-.8,0);m.material.side=T.DoubleSide;g.add(m);
 }return {g,top};
}
function bowl(p:T.Object3D,x:number,y:number,z:number){const m=new T.Mesh(new T.SphereGeometry(.25,20,12,0,Math.PI*2,Math.PI/2,Math.PI/2),mat('#9a7050'));m.position.set(x,y,z);m.rotation.x=Math.PI;p.add(m);cyl(p,x,y+.02,z,.22,.035,'#426b57');return m;}
function chest(p:T.Object3D,x:number,z:number){const g=new T.Group();g.position.set(x,0,z);p.add(g);box(g,0,.4,0,1.3,.8,.8,P.wood,'wood');for(const sx of [-.42,.42])box(g,sx,.4,.415,.07,.81,.035,P.dark);box(g,0,.45,.45,.15,.19,.08,P.gold);return g;}
function sack(p:T.Object3D,x:number,y:number,z:number){const g=new T.Group();g.position.set(x,y,z);p.add(g);const m=new T.Mesh(new T.SphereGeometry(.5,16,12),mat('#b29970','felt'));m.scale.set(.9,1.2,.7);m.position.y=.5;g.add(m);cyl(g,0,1.05,0,.13,.25,'#a18a62',.18);cyl(g,0,1.02,0,.18,.06,P.dark);return g;}
function rock(p:T.Object3D,x:number,z:number,r=.5){const m=new T.Mesh(new T.DodecahedronGeometry(r,0),mat('#9a9e96'));m.position.set(x,r*.32,z);m.scale.y=.6;m.rotation.set(.2,x,.3);p.add(m);return m;}
function tree(p:T.Object3D,x:number,z:number,s=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);p.add(g);cyl(g,0,1,0,.14,2,'#6c6254');for(let j=0;j<3;j++){const m=new T.Mesh(new T.ConeGeometry(1.0-j*.17,1.9,7),mat(j%2?'#567470':'#66857b'));m.position.y=2+j*.7;g.add(m);}return g;}
function fireTexture(phase:number){
 const key='fire'+phase;if(textures.has(key))return textures.get(key)!;const cv=document.createElement('canvas');cv.width=192;cv.height=384;const g=cv.getContext('2d')!;
 for(const [c,off,scale] of [['#bb4e33',0,1],['#ee9250',45,.74],['#ffd58b',140,.44]] as [string,number,number][]){g.save();g.translate(96,384);g.scale(scale,scale);g.translate(-96,-384+off);g.beginPath();g.moveTo(25,370);g.bezierCurveTo(-4,230,90,160,93+Math.sin(phase)*17,17);g.bezierCurveTo(195,140,115,194,172,245);g.bezierCurveTo(220,342,148,392,25,370);g.fillStyle=c;g.fill();g.restore();}
 const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;textures.set(key,t);return t;
}
function city(p:T.Object3D,china:boolean){
 const g=new T.Group();g.position.z=-9;p.add(g);const color=china?'#b7b49c':'#c8a47c';
 // A gate opening is physically open between the two masonry wings.
 for(const s of [-1,1]){box(g,s*7,3.8,0,9,7.6,1.65,color,'stone');for(let x=3.1;x<12;x+=1.1)box(g,s*x,7.9,0,.65,.75,1.85,color,'stone');}
 box(g,0,6.6,0,5,2.0,1.65,color,'stone');box(g,0,2.8,.2,4.3,5.5,.24,'#765742','wood');
 for(const s of [-1,1]){
  box(g,s*11.5,4.3,-.2,3.8,8.6,4,color,'stone');box(g,s*11.5,8.65,-.2,4.4,.3,4.6,'#d0c3a6');
  if(china){for(let j=0;j<2;j++){box(g,s*11.5,9.2+j*1.6,-.2,2.8-j*.5,1.2,2.8-j*.5,'#9c5843','wood');const roof=cyl(g,s*11.5,10+j*1.6,-.2,2.7-j*.35,.7,'#4e6969',.9-j*.2,4);roof.rotation.y=Math.PI/4;}}
  else {const dome=new T.Mesh(new T.SphereGeometry(1.65,20,12,0,Math.PI*2,0,Math.PI/2),mat('#568f8a'));dome.position.set(s*11.5,8.8,-.2);g.add(dome);}
 }
 for(let j=0;j<3;j++)for(let i=0;i<5;i++){
  const x=(i-2)*4.2,z=-5-j*5,h=2.7+(i+j)%3*.9;
  box(g,x,h/2,z,3.2,h,3.6,china?'#c1b09a':'#c7ad87','stone');
  if(china){const roof=cyl(g,x,h+.5,z,2.6,.8,'#597775',.7,4);roof.rotation.y=Math.PI/4;}
  else {const dome=new T.Mesh(new T.SphereGeometry(1.25,16,10,0,Math.PI*2,0,Math.PI/2),mat('#65958b'));dome.position.set(x,h,z);g.add(dome);}
 }
 return g;
}
function catapult(p:T.Object3D,x:number,z:number){
 const g=new T.Group();g.position.set(x,0,z);p.add(g);
 for(const sx of [-1,1]){box(g,sx*.86,.7,0,.24,.3,3.3,P.wood,'wood');for(const sz of [-1.05,1.05]){const wh=cyl(g,sx*1.05,.42,sz,.48,.2,P.dark,.48,16);wh.rotation.z=Math.PI/2;}}
 for(const sx of [-.66,.66]){beam(g,v(sx,.8,-1.2),v(sx,2.5,0),.12);beam(g,v(sx,.8,1.2),v(sx,2.5,0),.12);}
 beam(g,v(-1,2.3,0),v(1,2.3,0),.12,P.dark);
 const arm=new T.Group();arm.position.set(0,2.3,0);g.add(arm);box(arm,0,0,-.7,.2,.23,4.7,P.wood,'wood');sack(arm,0,-.5,1.05);bowl(arm,0,.1,-2.9);return {g,arm};
}

const propKit={P,box,cyl,beam,bowl,chest,sack,rock,mat};
export type PropKit=typeof propKit;

export class World {
 root=new T.Group();actors:Actor[]=[];props:Record<string,T.Object3D>={};fires:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];smoke:T.Mesh[]=[];
 sun:T.DirectionalLight;sky:T.Mesh;water?:T.Mesh<T.PlaneGeometry,T.MeshPhongMaterial>;shot:Shot;
 actions:Actions;
 constructor(s:Shot){
  this.shot=s;const night=s.light==='night',winter=s.light==='winter',gold=s.light==='golden';
  const top=night?'#253c68':winter?'#588db8':gold?'#ae7890':'#4e8fd4',hor=night?'#879cb8':winter?'#c7dce6':gold?'#ffcf9d':'#b8d0ec';
  const sm=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:untone(top)},hor:{value:untone(hor)}},vertexShader:'varying vec3 p; void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p; uniform vec3 top;uniform vec3 hor;void main(){float h=clamp(normalize(p).y,0.,1.);gl_FragColor=vec4(mix(hor,top,pow(h,.55)),1.);}'});
  this.sky=new T.Mesh(new T.SphereGeometry(240,24,16),sm);this.sky.layers.set(NOINK);this.root.add(this.sky);
  const hemi=new T.HemisphereLight(night?'#9fb9dd':'#dcecff','#a38d71',.6);hemi.layers.enable(NOINK);this.root.add(hemi);
  this.sun=new T.DirectionalLight(night?'#bacfe8':gold?'#ffcf94':'#fff1d9',night?1.2:2.5);this.sun.position.set(-10,18,12);this.sun.castShadow=true;this.sun.layers.enable(NOINK);this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-24;this.sun.shadow.camera.right=24;this.sun.shadow.camera.top=24;this.sun.shadow.camera.bottom=-24;this.sun.shadow.camera.far=100;this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.025;this.root.add(this.sun,this.sun.target);
  const desert=s.place==='desert'||s.place==='persia',ground=winter?'#d4dce0':desert?'#c4ab7c':s.place==='river'?'#8b9f87':s.place==='mountain'?'#829884':'#8e9873';
  const floor=new T.Mesh(new T.PlaneGeometry(400,400),mat(ground));floor.rotation.x=-Math.PI/2;floor.position.y=-.06;floor.receiveShadow=true;this.root.add(floor);
  this.ridges(winter,desert);if(!night)this.clouds();
  this.actions=new Actions(this,propKit);this.build();
 }
 actor(role:Role,x:number,z:number,size=1,variant=0,mounted=false){const a=new Actor(this.root,role,x,z,size,variant,mounted);this.actors.push(a);return a;}
 ridges(winter:boolean,desert:boolean){
  for(let layer=0;layer<3;layer++){
   const shape=new T.Shape();shape.moveTo(-110,-1);for(let i=0;i<=16;i++){const x=-110+i*14,y=2+Math.abs(Math.sin(i*1.7+layer*.8))*((desert?3:6)+layer*2);shape.lineTo(x,y);}shape.lineTo(114,-1);shape.closePath();
   const m=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:10,bevelEnabled:false}),mat(winter?['#adbcc3','#9eb3c1','#91adbf'][layer]:desert?['#b59c7b','#b7a58c','#bdaf9e'][layer]:['#708e84','#81a199','#98b3ad'][layer]));m.position.set(0,0,-70-layer*28);this.root.add(m);
  }
  for(let i=0;i<14;i++){const x=(i-7)*4.3,z=-17-Math.abs(Math.sin(i*3.4))*15;rock(this.root,x,z,.35+(i%4)*.2);}
  if(!winter&&!desert)for(let i=0;i<24;i++){const x=(i%2?1:-1)*(3.7+(i%5)*2.8),z=-2-Math.floor(i/2)*2;for(let j=0;j<3;j++)beam(this.root,v(x,.02,z),v(x+(j-1)*.11,.17+(j%2)*.12,z+.02),.012,'#6e7957');}
 }
 clouds(){
  const cv=document.createElement('canvas');cv.width=512;cv.height=192;const g=cv.getContext('2d')!;g.fillStyle='#e5e7e7';for(let i=0;i<6;i++){g.beginPath();g.ellipse(90+i*62,119,69,36,0,0,Math.PI*2);g.fill();}g.fillStyle='#f7f1df';for(let i=0;i<5;i++){g.beginPath();g.ellipse(92+i*67,102-(i%3)*18,65,43,0,0,Math.PI*2);g.fill();}
  const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;
  for(let i=0;i<5;i++){const m=new T.Mesh(new T.PlaneGeometry(18,6.75),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,fog:false}));m.position.set(-45+i*22,22+i%2*5,-66-i*12);m.layers.set(NOINK);this.root.add(m);}
 }
 camp(){for(const [x,z,r]of [[-6,-6,2.8],[5,-8,2.3],[0,-13,3.0]])yurt(this.root,x,z,r);standard(this.root,-3,-3);}
 army(n=24,mounted=true){this.actor('khan',0,1.9,1.08,0,mounted);for(let i=0;i<n-1;i++){const row=Math.floor(i/6),col=i%6;this.actor('warrior',(col-2.5)*2.5,-2-row*3.2,.78+(row===0?.12:0),i%3,mounted);}}
 river(){
  const wm=new T.MeshPhongMaterial({color:untone(this.shot.light==='night'?'#527d9b':'#5baaba'),shininess:85,specular:'#c2dcdd'});this.water=new T.Mesh(new T.PlaneGeometry(13,80,18,40),wm);this.water.rotation.x=-Math.PI/2;this.water.position.set(0,.11,-3);this.water.layers.set(NOINK);this.root.add(this.water);
  for(let i=0;i<30;i++){const x=(i%2?1:-1)*(6.6+(i%3)*.35),z=(i-15)*1.2;rock(this.root,x,z,.35);}
  for(let i=0;i<24;i++){const x=1.0+(i%8)*.2,z=.4+Math.floor(i/8)*.35;const h=.7+(i%5)*.13;beam(this.root,v(x,.12,z),v(x-.1,h,z),.018,'#a6a36f');cyl(this.root,x-.1,h,z,.045,.2,'#725c44');}
  for(let i=0;i<7;i++)tree(this.root,10+(i%2)*2,-10-i*4,.7+i*.04);
 }
 flames(n:number){for(let i=0;i<n;i++){
  const m=new T.Mesh(new T.PlaneGeometry(1.8,4.5),new T.MeshBasicMaterial({map:fireTexture(i%6),transparent:true,alphaTest:.05,depthWrite:false,side:T.DoubleSide,toneMapped:false}));m.position.set((i%7-3)*2.5,4.8+Math.floor(i/7),-10-Math.floor(i/7)*5);m.layers.set(NOINK);this.root.add(m);this.fires.push(m);
  const puff=new T.Mesh(new T.SphereGeometry(1,10,8),new T.MeshBasicMaterial({color:'#74747c',transparent:true,opacity:.62,depthWrite:false}));puff.layers.set(NOINK);this.root.add(puff);this.smoke.push(puff);
 }}
 build(){
  const k=this.shot.key;
  if(this.actions.build(k))return;
  if(['abandoned','roots','nothing'].includes(k)){
   this.actor('child',0,0,.85);yurt(this.root,-9,-16,2.2);for(let i=0;i<6;i++)this.actor('warrior',-7+i*1.5,-13, .55,i,true);
   if(k==='roots'){const g=new T.Group();this.root.add(g);this.props.roots=g;for(let i=0;i<5;i++)beam(g,v(-.1,0,.65),v(.2+(i-2)*.12,.35+i*.03,.65),.035,'#85694b');const rat=new T.Mesh(new T.SphereGeometry(.16,12,8),mat('#665e59'));rat.position.set(-1,.12,.7);rat.scale.set(1.8,.7,.8);this.root.add(rat);this.props.rat=rat;}
   for(let i=0;i<40;i++){const m=new T.Mesh(new T.SphereGeometry(.025+(i%3)*.009,4,4),new T.MeshBasicMaterial({color:'#edf5f6'}));m.layers.set(NOINK);this.root.add(m);this.props['snow'+i]=m;}
  }else if(k==='poison'){
   this.camp();box(this.root,0,.65,0,2,.15,1.5,P.wood,'wood');for(const x of [-.7,.7])box(this.root,x,.3,0,.13,.6,1,P.wood,'wood');this.props.cup=bowl(this.root,0,.77,.15);this.actor('father',0,-1,.8);this.actor('child',1.7,.4,.7);
  }else if(k==='robbed'){
   this.camp();this.actor('child',-1,1,.8);this.actor('wife',.3,.7,.9);this.props.chest=chest(this.root,1.8,0);this.actor('guard',2,-.5,1,1,true);this.props.loot=sack(this.root,2.7,1,-.5);
  }else if(k==='raiders') {this.army(12);}
  else if(['cage','escape'].includes(k)){
   this.camp();this.actor('young',0,0,.9);this.actor('guard',2.0,.6,1,1);
   const cage=new T.Group();this.root.add(cage);this.props.cage=cage;
   for(const x of [-1.2,1.2])for(const z of [-.9,.9])box(cage,x,1.6,z,.15,3.2,.15,P.wood,'wood');
   for(const z of [-.9,.9]){box(cage,0,3.13,z,2.55,.16,.2,P.wood,'wood');for(let x=-.8;x<1;x+=.4)box(cage,x,1.6,z,.065,2.9,.07,P.wood,'wood');}box(cage,0,.05,0,2.6,.16,2,P.wood,'wood');
   const collar=new T.Group();collar.position.set(0,1.36,.12);this.root.add(collar);box(collar,0,0,0,1.28,.14,.63,'#a58a61','wood');cyl(collar,0,.09,0,.24,.06,P.dark);this.props.collar=collar;
   this.props.club=beam(this.root,v(.4,.5,.3),v(1.1,.9,.3),.1,P.wood);
  }else if(['dive','reeds','temujin'].includes(k)){
   this.river();const a=this.actor('young',k==='reeds'?-.15:0,k==='temujin'?2:0,.9);if(k==='reeds')a.root.position.y=-1.75;
   if(k==='reeds'){
    box(this.root,0,.04,-3.8,11,.2,3.5,'#8a9580');
    beam(this.root,v(-.15,.13,.58),v(.24,.68,.65),.024,'#c7bd85');
   }
   for(let i=0;i<3;i++){
    const x=k==='reeds'?-2+i*1.65:7.4+i*.9,z=k==='reeds'?-3.6-i*.2:-5-i*1.2;const guard=this.actor('guard',x,z,k==='reeds'?.68:.85,i);
    cyl(guard.root,.43,1.55,0,.04,.8,P.wood);
    const flame=new T.Mesh(new T.PlaneGeometry(.27,.6),new T.MeshBasicMaterial({map:fireTexture(i),transparent:true,alphaTest:.1,depthWrite:false,side:T.DoubleSide}));flame.position.set(.43,2.2,0);flame.layers.set(NOINK);guard.root.add(flame);this.fires.push(flame);
   }
  }else if(['khan','mistake','wrath'].includes(k)) {this.camp();this.actor('khan',0,0,1.1);for(let i=0;i<6;i++)this.actor('warrior',(i-2.5)*1.8,-4,.85,i);standard(this.root,2,-1,P.felt,4.8);}
  else if(k==='outcasts'||k==='rules'||k==='general'){
   this.camp();this.actor('khan',-.8,0,1.0);this.actor(k==='general'?'general':'young',1.0,.1,.95,1);
   for(let i=0;i<7;i++)this.actor(i%3===0?'merchant':'warrior',(i-3)*1.3,-3.3,.83,i);
   if(k==='rules'){this.props.chest=chest(this.root,0,.4);box(this.root,0,.86,.4,1,.035,.75,'#e3d4b4');}
   if(k==='general'){this.props.standard=standard(this.root,1.75,.15,'#f1e1b9',3.8).g;}
  }else if(k==='kidnap'){
   this.camp();this.actor('wife',.2,.3,1.0);this.actor('guard',1.8,.2,.92,1,true);this.actor('guard',-2,-.5,.9,2,true);this.props.chest=chest(this.root,-1.3,.5);
  }else if(['charge','united','legacy'].includes(k)){this.army(k==='charge'?30:42);for(let i=0;i<5;i++)standard(this.root,(i-2)*5,-9-i*2,i%2?'#eee0bd':'#51423d',4.4);for(let i=0;i<6;i++)yurt(this.root,(i-3)*6,-25,2.2);}
  else if(['china','walls','siege','engineers','catapult','burning'].includes(k)){
   this.props.city=city(this.root,true);
   if(k==='walls'){for(let i=0;i<4;i++)this.actor('guard',-4+i*2.5,-8.7,.75,i);this.actor('khan',0,2,.85,0,true);}
   if(k==='siege'){for(let i=0;i<8;i++)yurt(this.root,(i-3.5)*3.8,6+(i%2)*4,1.2);}
   if(k==='engineers'){const c=catapult(this.root,-1.4,-1);this.props.arm=c.arm;this.actor('engineer',.5,.4);this.actor('khan',2,.4);box(this.root,.3,.9,.9,1.1,.06,.8,'#d8c69f');}
   if(k==='catapult'){const c=catapult(this.root,0,0);this.props.arm=c.arm;this.actor('engineer',2,0,.9);this.props.projectile=rock(this.root,0,-2,.3);}
   if(k==='burning')this.flames(17);
  }else if(k==='caravan'||k==='desert'){
   if(k==='desert')this.army(36);else {for(let i=0;i<5;i++){this.actor(i===0?'merchant':'warrior',(i-2)*2.3,-i*.9,.95,i,true);sack(this.root,(i-2)*2.3+.4,1.5,-i*.9);}}for(let i=0;i<12;i++)rock(this.root,(i%2?1:-1)*(8+i),-i*3,.5);
  }else if(k==='sack'){this.props.city=city(this.root,false);box(this.root,0,.45,0,2.2,.85,1.6,'#b9a180','stone');this.props.sack=sack(this.root,0,.9,0);this.actor('khan',-1.8,-.2,1.05);this.actor('merchant',1.8,.2,.95);}
  else if(k==='flood'){
   this.props.city=city(this.root,false);const water=new T.Mesh(new T.PlaneGeometry(17,55,12,32),new T.MeshPhongMaterial({color:'#4a9ba9',shininess:70,transparent:true,opacity:.88}));water.rotation.x=-Math.PI/2;water.position.set(0,.17,5);water.layers.set(NOINK);this.root.add(water);this.props.flood=water;for(let i=0;i<9;i++)box(this.root,(i-4)*1.8,.5,5,.5,1.0,.8,'#806d55');
  }else if(k==='conquest'){
   this.army(42);for(let i=0;i<12;i++){const x=(i%4-1.5)*8,z=-10-Math.floor(i/4)*11;standard(this.root,x,z,i%3?'#dfd1a9':'#6f4840',3+i%3);yurt(this.root,x+2,z-2,1.3);}
  }else if(['fever','order','secret'].includes(k)){
   box(this.root,0,-.01,0,24,.1,24,'#a78b69','wood');
   const wallMat=mat('#c5af8c','felt');wallMat.side=T.DoubleSide;
   const back=new T.Mesh(new T.CylinderGeometry(7,7,6,32,1,true,Math.PI*.52,Math.PI*.96),wallMat);back.position.set(0,3,-3);this.root.add(back);
   for(let i=-3;i<=3;i++)beam(this.root,v(i*1.7,0,-5),v(i*.7,6,-5),.07,P.wood);
   box(this.root,0,.65,0,3,.4,1.65,P.wood,'wood');box(this.root,0,.91,0,3.2,.22,1.75,'#8c5147','felt');box(this.root,.95,1.08,0,.65,.2,1.6,'#c9ab72','felt');
   this.actor('old',0,0,.93);for(let i=0;i<(k==='fever'?1:3);i++)this.actor('son',(i-1)*1.5,1.7,.9,i);
   for(const x of [-2.6,2.6]){cyl(this.root,x,.6,0,.3,1.2,P.wood);bowl(this.root,x,1.24,0);}
  }else if(['grave','procession','bones'].includes(k)){
   for(let i=0;i<20;i++){const side=i%2?1:-1;tree(this.root,side*(6+(i%4)*2),-3-Math.floor(i/2)*4,.65+(i%3)*.2);}
   if(k==='grave'){const m=new T.Mesh(new T.SphereGeometry(1,20,12),mat('#8f8065'));m.scale.set(1.5,.21,.8);m.position.y=.04;this.root.add(m);this.props.grave=m;}
   if(k==='procession'){for(let i=0;i<8;i++)this.actor('warrior',(i%2?1:-1)*1.4,-Math.floor(i/2)*2.5,.8,i,true);this.props.bier=box(this.root,0,1.0,-2.6,1.5,.35,3,'#675350','wood');box(this.props.bier,0,.3,0,1.6,.25,3.1,'#c7b894','felt');}
   // The final location is deliberately unmarked, with no identified tomb.
  }
 }
 update(f:number,cam:T.PerspectiveCamera,scene:T.Scene){
  const s=this.shot,k=s.key,u=clamp(f/(s.b-s.a)),global=f+s.a,c=cameraAt(s,f);
  cam.position.set(...c.pos);cam.lookAt(...c.look);cam.rotateZ(c.roll);cam.fov=c.fov;cam.layers.enable(NOINK);cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
  const gold=s.light==='golden',night=s.light==='night',l=LIGHTS[gold?'golden':'day'];
  TONE.uLitCol.value.fromArray(night?[.62,.75,.98]:gold?[1.5,.98,.65]:l.lit);TONE.uShadeCol.value.fromArray(night?[.19,.29,.47]:s.light==='winter'?[.45,.53,.65]:l.shade);TONE.uShadeLift.value.fromArray(l.lift);TONE.uSideK.value=l.sideK;TONE.uTerm.value=l.term;TONE.uSat.value=1.02;TONE.uLambert.value=.35;
  CHAR.uCharTint.value.fromArray(night?[.78,.86,1]:gold?[1,.88,.76]:[1,.96,.94]);CHAR.uCharShade.value=.88;CHAR.uGrad.value=.05;CHAR.uBodyGrad.value=.14;CHAR.uSideTint.value.set(.94,.92,1);
  const fog=night?'#8294ac':gold?'#d5b4a0':s.light==='winter'?'#c7dce6':'#b8d0ec';scene.fog=new T.Fog(untone(fog),38,180);
  // Sun direction is anchored to the shot's opening camera, so moving the camera never moves the light.
  const theta=Math.atan2(s.camera[0]-s.look[0],s.camera[2]-s.look[2]);this.sun.position.set(Math.sin(theta-1.0)*25,gold?10:28,Math.cos(theta-1.0)*25);
  for(let i=0;i<this.actors.length;i++){
   const a=this.actors[i];let expr:Parameters<Actor['pose']>[2]=['mistake','wrath','rules','charge'].includes(k)?'stern':['abandoned','nothing','roots','cage'].includes(k)?'nervous':'neutral';
   let walk=['raiders','charge','desert','caravan','procession','kidnap'].includes(k),dx=0,dz=0;
   if(['abandoned','nothing'].includes(k)&&i>0){walk=true;dz=-u*6;dx=-u*3;}
   if(k==='roots'&&i===0){expr='pained';}
   if(k==='robbed'&&i===2){walk=true;dx=u*4;}
   if(k==='kidnap'){dx=u*3.6;expr=i===0?'shock':'stern';}
   if(['raiders','charge'].includes(k))dz=u*3.8;
   if(['desert','caravan','procession'].includes(k)){dx=u*2;dz=u*.5;}
   if(k==='escape'&&i===0){dx=smooth((f-42)/22)*-3;walk=f>42;expr=f>40?'stern':'nervous';}
   if(k==='escape'&&i===1){expr=f>44?'dazed':'neutral';}
   a.pose(global,cam,expr,walk,dx,dz);
   if(k==='escape'&&i===1&&f>43){a.root.rotation.z=-smooth((f-43)/12)*1.4;a.root.position.y=-smooth((f-43)/12)*.15;}
   if(k==='dive'&&i===0){const d=smooth((f-7)/20);a.root.position.y=-d*2.0;a.root.position.z=-d*2.0;a.root.rotation.z=d*-.8;}
   if(k==='reeds'&&i===0){a.root.position.y=-1.53;a.root.position.z=.5;}
   if(k==='reeds'&&i>0){a.pose(global,cam,'neutral',true,u*2.7,0);}
   if(k==='roots'&&i===0){a.root.rotation.z=-.18;a.root.position.y=-.19;}
   if(['fever','order','secret'].includes(k)&&i===0){a.root.rotation.z=-Math.PI/2+.08;a.root.position.set(-1.1,1.16,.5);a.blob.visible=false;}
   if(k==='walls'&&i<4){a.root.position.y=7.75;a.blob.visible=false;}
   if(k==='general'&&i===1){a.root.position.y=smooth((f-12)/22)*.12;}
  }
  if(this.props.snow0)for(let i=0;i<40;i++){const m=this.props['snow'+i];m.position.set(((i*2.31-f*.018+15)%16+16)%16-8,((i*.67-f*.018)%7+7)%7,-5+(i%7)*1.3);}
  if(this.props.rat)this.props.rat.position.x=-1-u*2;
  if(this.props.loot)this.props.loot.position.x=2.7+u*4;
  if(this.props.cage&&k==='escape')this.props.cage.visible=f<40;
  if(this.props.collar&&k==='escape')this.props.collar.position.x=smooth((f-42)/22)*-3;
  if(this.props.club){this.props.club.rotation.z=k==='escape'?-smooth((f-35)/10)*2:0;this.props.club.visible=k!=='cage';}
  if(this.water){const a=this.water.geometry.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,Math.sin(i*.9+f*.08)*.022);a.needsUpdate=true;this.water.geometry.computeVertexNormals();}
  if(this.props.arm){this.props.arm.rotation.x=k==='catapult'?smooth((f-30)/9)*1.7:-.18;}
  if(this.props.projectile){const t=clamp((f-31)/22);this.props.projectile.position.set(0,2.5+Math.sin(t*Math.PI)*7,-2-t*12);}
  if(this.props.flood){this.props.flood.scale.y=.25+u*.9;this.props.flood.position.y=.12+smooth(u)*1.8;this.props.flood.position.z=8-u*6;}
  if(this.props.bier){this.props.bier.position.x=u*2;this.props.bier.position.z=-2.6+u*.5;}
  this.fires.forEach((m,i)=>{m.material.map=fireTexture((Math.floor(f/3)+i)%6);m.rotation.y=Math.atan2(cam.position.x-m.position.x,cam.position.z-m.position.z);m.scale.set(1+Math.sin(f*.2+i)*.08,1+Math.sin(f*.17+i)*.1,1);});
  this.smoke.forEach((m,i)=>{const t=(f*.018+i*.43)%4;m.position.set((i%7-3)*2.5+t*.6,6+t*2.4,-11-Math.floor(i/7)*4);m.scale.setScalar(1+t*.45);});
  this.actions.update(k,f,global,cam);
  return new T.Vector3(...c.look);
 }
 dispose(){this.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
}
