import * as T from 'three';
import type {World,PropKit} from './world';
import {Actor,type Action,type Role} from './cast';
import {smooth,clamp,mark} from './story';
import {NOINK} from './look/ink';

const vec=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const handled=new Set(['poison','robbed','rats','roots','cage','escape','beggar','general','caravan','execute','dispatch','sack']);

/** Choreography for the beats that need hand contact, anticipation, impact and follow-through. */
export class Actions {
 people:Record<string,Actor>={};objects:Record<string,T.Object3D>={};
 constructor(private w:World,private p:PropKit){}
 person(name:string,role:Role,x:number,z:number,size=1,variant=0,mounted=false){return this.people[name]=this.w.actor(role,x,z,size,variant,mounted);}
 prop(name:string,o:T.Object3D){this.objects[name]=o;return o;}
 private weapon(kind:'club'|'sword'){
  const g=new T.Group(),{cyl,box,P}=this.p;
  if(kind==='club'){cyl(g,0,.4,0,.065,.8,P.wood);cyl(g,0,.85,0,.12,.3,'#75614c',.09);}
  else {box(g,0,.06,0,.38,.065,.09,P.dark);cyl(g,0,.49,0,.075,.83,'#c1c7c9',.005,4);cyl(g,0,-.12,0,.04,.3,P.dark);}
  g.userData.length=kind==='club'?1:.91;this.w.root.add(g);return g;
 }
 private aim(o:T.Object3D,start:T.Vector3,end:T.Vector3){o.position.copy(start);o.quaternion.setFromUnitVectors(vec(0,1,0),end.clone().sub(start).normalize());o.scale.y=start.distanceTo(end)/(o.userData.length??1);o.updateMatrixWorld(true);}
 private burst(name:string){
  const cv=document.createElement('canvas');cv.width=cv.height=256;const g=cv.getContext('2d')!;g.beginPath();for(let i=0;i<20;i++){const a=i/20*Math.PI*2,r=i%2?52:114;const x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;if(i)g.lineTo(x,y);else g.moveTo(x,y);}g.closePath();g.fillStyle='#fff0bd';g.fill();g.lineWidth=9;g.strokeStyle='#30212c';g.stroke();
  const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;const m=new T.Mesh(new T.PlaneGeometry(.85,.85),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}));m.layers.set(NOINK);m.renderOrder=6;this.w.root.add(m);return this.prop(name,m);
 }
 private effect(name:string,f:number,at:number,pos:T.Vector3,cam:T.Camera){const o=this.objects[name];const t=(f-at)/7;o.visible=t>=0&&t<1;o.position.copy(pos);o.quaternion.copy(cam.quaternion);o.scale.setScalar(.55+clamp(t)*.75);}
 private rat(x:number,z:number){
  const g=new T.Group(),{mat,cyl}=this.p;g.position.set(x,0,z);this.w.root.add(g);
  const body=new T.Mesh(new T.SphereGeometry(.31,18,12),mat('#85837d'));body.scale.set(1.5,.7,.8);body.position.y=.24;g.add(body);
  const head=new T.Mesh(new T.SphereGeometry(.2,14,10),mat('#9c9890'));head.scale.set(1.2,.9,.85);head.position.set(.37,.32,0);g.add(head);
  for(const side of [-1,1]){const ear=new T.Mesh(new T.SphereGeometry(.105,12,8),mat('#b99b97'));ear.scale.set(.7,1,.45);ear.position.set(.28,.5,side*.11);g.add(ear);const eye=new T.Mesh(new T.SphereGeometry(.028,8,6),mat('#241726'));eye.position.set(.48,.38,side*.13);g.add(eye);}
  const nose=new T.Mesh(new T.SphereGeometry(.054,10,8),mat('#403239'));nose.position.set(.6,.29,0);g.add(nose);
  for(let i=0;i<4;i++){const leg=cyl(g,i%2?.2:-.24,.08,i<2?.15:-.15,.035,.16,'#65585a');leg.rotation.z=i%2?.4:-.4;this.objects['ratleg'+i]=leg;}
  const curve=new T.CatmullRomCurve3([vec(-.38,.17,0),vec(-.7,.13,.04),vec(-1,.06,.16),vec(-1.1,.09,.3)]);const tail=new T.Mesh(new T.TubeGeometry(curve,18,.025,6,false),mat('#ae9490'));g.add(tail);
  for(const side of [-1,1])for(let j=0;j<3;j++)this.p.beam(g,vec(.54,.3,side*.06),vec(.65,.3+(j-1)*.055,side*(.26+j*.04)),.006,'#4d4148');
  return g;
 }
 private roots(){
  const g=new T.Group(),{cyl,beam,mat}=this.p;this.w.root.add(g);
  for(let i=0;i<3;i++){const root=new T.Mesh(new T.ConeGeometry(.09,.5,9),mat('#94704a'));root.rotation.z=Math.PI+(i-1)*.27;root.position.set((i-1)*.09,-.23,0);g.add(root);for(let j=0;j<3;j++)beam(g,vec((i-1)*.09,-.14-j*.1,0),vec((i-1)*.09+(j%2?-.12:.12),-.24-j*.09,.02),.014,'#796345');}
  for(let i=0;i<5;i++){const a=(i-2)*.35;beam(g,vec(0,0,0),vec(Math.sin(a)*.28,.2+Math.cos(a)*.12,Math.cos(i)*.08),.02,'#72865e');const leaf=cyl(g,Math.sin(a)*.26,.25,Math.cos(i)*.08,.08,.18,'#8fa274',.012,7);leaf.rotation.z=-a;}
  return g;
 }
 private vase(parent:T.Object3D,x:number,y:number,c:string){
  const profile=[new T.Vector2(.12,0),new T.Vector2(.19,.1),new T.Vector2(.23,.28),new T.Vector2(.17,.42),new T.Vector2(.08,.5),new T.Vector2(.08,.65),new T.Vector2(.12,.69)];
  const m=new T.Mesh(new T.LatheGeometry(profile,20),this.p.mat(c));m.position.set(x,y,0);parent.add(m);const rim=new T.Mesh(new T.TorusGeometry(.11,.025,8,20),this.p.mat('#d4b489'));rim.rotation.x=Math.PI/2;rim.position.set(x,y+.69,0);parent.add(rim);return m;
 }
 private cargo(a:Actor,bag:boolean|'empty'=false){
  const g=new T.Group(),{box,beam,P}=this.p;a.mesh.add(g);g.position.set(-.62,1.0,.18);
  // The basket sits against the saddle blanket and moves in the horse's own coordinate system.
  box(g,0,.05,0,.82,.48,.42,'#a17c4f','wood');
  for(const x of [-.39,.39])box(g,x,.26,.22,.055,.46,.06,P.wood,'wood');box(g,0,.45,.22,.84,.06,.08,P.wood,'wood');
  if(bag===true)this.p.sack(g,0,.3,.03);else if(bag!=='empty'){this.vase(g,-.22,.22,'#bc7956');this.vase(g,.21,.22,'#63938d');}
  for(const x of [-.32,.32])beam(g,vec(x,.1,.3),vec(x,.92,-.12),.022,'#5b4538');
  beam(a.mesh,vec(-1.05,1.05,.18),vec(.15,1.26,.12),.03,'#604838');return g;
 }
 build(k:string){
  if(!handled.has(k))return false;
  const {box,cyl,beam,chest,sack,rock,P}=this.p,r=this.w.root;
  if(k==='poison'){
   this.w.camp();this.person('father','father',-.25,0,1.04);this.person('child','child',-1.3,.25,.78);
   const table=this.prop('table',new T.Group());r.add(table);box(table,.65,.65,.3,1.1,.12,.9,P.wood,'wood');for(const x of [.25,1.05])box(table,x,.3,.3,.09,.6,.65,P.wood,'wood');
   const cup=this.prop('cup',new T.Group());r.add(cup);cyl(cup,0,0,0,.12,.2,'#a98f66',.17);cyl(cup,0,.105,0,.145,.025,'#6e9f5e');
   for(let i=0;i<3;i++){const m=new T.Mesh(new T.TorusGeometry(.07,.015,6,14),new T.MeshBasicMaterial({color:'#a9c885',transparent:true,opacity:.65,depthWrite:false}));m.layers.set(NOINK);r.add(m);this.prop('fume'+i,m);}
   this.burst('poisonImpact');
  }else if(k==='robbed'){
   this.w.camp();this.person('child','child',-1.05,.3,.8);this.person('mother','wife',-.4,-.5,.95);this.person('thief','guard',.65,.55,1.0,1);
   this.prop('loot',chest(r,0,0)).scale.set(.7,.8,.9);const rug=box(r,-.1,.01,.1,2,.02,1.4,'#9a5549','felt');this.prop('rug',rug);this.burst('theftImpact');
  }else if(k==='rats'){
   this.person('child','child',-.7,0,.9);yurtBackdrop(this.w);
   this.prop('rat',this.rat(.6,.45));this.prop('stone',rock(r,0,0,.13));this.burst('dust');
  }else if(k==='roots'){
   this.person('child','child',-.55,0,.9);yurtBackdrop(this.w);this.prop('roots',this.roots());
   const child=this.people.child,theta=Math.atan2(this.w.shot.camera[0]-child.x,this.w.shot.camera[2]-child.z);
   const x=child.x+child.size*(.588*Math.cos(theta)+.035*Math.sin(theta)),z=child.z+child.size*(-.588*Math.sin(theta)+.035*Math.cos(theta));
   const hole=cyl(r,x,.005,z,.34,.025,'#776b5a',.34);this.prop('hole',hole);
   for(let i=0;i<9;i++){const d=rock(r,0,0,.035+(i%2)*.02);this.prop('dirt'+i,d);}
  }else if(k==='cage'||k==='escape'){
   this.w.camp();this.person('young','young',-.55,0,.96);this.person('guard','guard',.92,.1,1.0,1);
   const cage=this.prop('cage',new T.Group());r.add(cage);cage.position.x=-.55;
   for(const x of [-1.2,1.2])for(const z of [-.9,.9])box(cage,x,1.6,z,.14,3.2,.14,P.wood,'wood');
   for(const z of [-.9,.9]){box(cage,0,3.13,z,2.55,.16,.2,P.wood,'wood');for(let x=-.8;x<1;x+=.4)box(cage,x,1.6,z,.065,2.9,.07,P.wood,'wood');}box(cage,0,.05,0,2.6,.16,2,P.wood,'wood');
   const collar=this.prop('collar',new T.Group());r.add(collar);
   // Two hinged wooden halves around an iron neck ring.
   for(const side of [-1,1]){const half=new T.Group();collar.add(half);this.prop('half'+side,half);box(half,side*.34,0,0,.68,.14,.58,'#a98c63','wood');box(half,side*.48,.085,0,.08,.04,.59,'#4a4548');}
   const ring=new T.Mesh(new T.TorusGeometry(.22,.038,8,24),this.p.mat('#58565a'));ring.rotation.x=Math.PI/2;ring.position.y=.08;collar.add(ring);this.prop('ring',ring);
   this.prop('club',this.weapon('club'));this.burst('impact');
  }else if(k==='beggar'||k==='general'){
   this.w.camp();this.person('hero',k==='beggar'?'beggar':'general',-.25,.3,1.03,1);this.person('khan','khan',-1.45,-1.5,1.0);
   this.person('rival1','guard',1.1,.1,.96,2);this.person('rival2','guard',-1.65,.8,.93,0);
   this.prop('sword',this.weapon('sword'));this.burst('hit1');this.burst('hit2');this.burst('promotion');
   this.prop('standard',this.wStandard());
  }else if(k==='caravan'){
   for(let i=0;i<4;i++){const a=this.person('rider'+i,i===0?'merchant':'warrior',(i-1.5)*2.1,-i*1.8,.95,i,true);this.cargo(a);}
  }else if(k==='execute'){
   this.prop('palace',new T.Group());const palace=this.objects.palace;r.add(palace);
   box(palace,0,2.8,-2.2,9,5.6,.4,'#b69678','stone');box(palace,0,2.8,-1.95,4,5.4,.1,'#f0d5a4');for(const x of [-2.2,2.2])cyl(palace,x,2.8,-1.7,.25,5.6,'#be9f79');
   this.person('messenger','merchant',-.25,.3,1.06,0);this.person('executioner','guard',1.15,-.05,1.07,2);this.person('governor','merchant',-1.7,-1.3,.9,1);
   box(r,-1.7,.3,-1.3,1.5,.6,1.5,'#9b8067','stone');this.prop('blade',this.weapon('sword'));this.burst('executionImpact');
  }else if(k==='dispatch'){
   const courier=this.person('courier','merchant',.55,-.3,1,0,true);this.person('sender','guard',-.65,.6,1,2);this.prop('dispatchBag',sack(r,0,0,0)).scale.setScalar(.65);this.prop('dispatchRack',this.cargo(courier,'empty'));
   box(r,0,2.8,-5,14,5.6,.4,'#bd9c79','stone');for(const x of [-2.2,2.2])cyl(r,x,2.8,-4.6,.25,5.6,'#d0af85');box(r,0,2.5,-4.7,3.7,5,.2,'#6a594e','wood');
  }else if(k==='sack'){
   this.w.camp();this.person('khan','khan',-.95,-.2,1.05);this.person('courier','merchant',1.0,.3,1.0);this.prop('sack',sack(r,0,0,0)).scale.setScalar(.65);box(r,0,.6,.5,1.7,.16,1.2,P.wood,'wood');for(const x of [-.65,.65])box(r,x,.28,.5,.1,.56,1,P.wood,'wood');
  }
  return true;
 }
 private wStandard(){const g=new T.Group();this.w.root.add(g);this.p.cyl(g,0,1.2,0,.04,2.4,'#725439');this.p.box(g,.23,2.1,0,.48,.6,.04,'#dfc493','felt');return g;}
 update(k:string,f:number,global:number,cam:T.PerspectiveCamera){
  if(!handled.has(k))return;
  const a=this.people,o=this.objects;
  const pose=(name:string,expr:Parameters<Actor['pose']>[2]='neutral',action:Action='none',t=0,walk=false,dx=0,dz=0)=>a[name].pose(global,cam,expr,walk,dx,dz,{action,t});
  const hold=(obj:T.Object3D,actor:Actor,offset=vec(0,-.4,.12))=>{obj.position.copy(actor.hand('left').add(actor.hand('right')).multiplyScalar(.5)).add(offset);obj.rotation.y=actor.mesh.rotation.y;};
  if(k==='poison'){
   const react=mark(k,'poison-reaction'),drop=mark(k,'cup-drop'),sick=f>=react,fall=smooth((f-(react+9))/11);pose('father',sick?'dazed':'neutral',sick?'sick':'drink',smooth((f-1)/10));pose('child',sick?'shock':'neutral');
   a.father.root.rotation.z=-fall*.9;a.father.root.position.y=-fall*.15;a.father.root.position.x-=fall*1.4;
   if(f<react){o.cup.position.copy(a.father.hand('right')).add(vec(-.02,.07,.08));o.cup.rotation.z=-smooth((f-7)/6)*.55;}
   else {const h=a.father.point(350,343);o.cup.position.copy(h).add(vec(.18,-smooth((f-react)/(drop-react))*1.65,.18));o.cup.rotation.z=(f-react)*.15;}
   for(let i=0;i<3;i++){o['fume'+i].visible=f<25;o['fume'+i].position.copy(o.cup.position).add(vec(Math.sin(f*.15+i)*.04,.2+((f*.018+i*.12)%.45),0));o['fume'+i].quaternion.copy(cam.quaternion);}
   this.effect('poisonImpact',f,18,a.father.head().add(vec(.25,.25,.1)),cam);
  }else if(k==='robbed'){
   const lift=smooth((f-4)/12),run=smooth((f-18)/30);pose('thief','stern','carry',lift,f>18,run*2.8,0);pose('mother','shock','command',1);pose('child','shock','reach',0);
   hold(o.loot,a.thief,vec(0,-.30,.12));this.effect('theftImpact',f,16,o.loot.position.clone().add(vec(0,.9,0)),cam);
  }else if(k==='rats'){
   const release=mark(k,'stone-release'),contact=mark(k,'rat-hit'),flight=clamp((f-release)/(contact-release)),chase=smooth((f-15)/24);
   pose('child','stern','strike',smooth((f-16)/9),f>25,chase*.3,0);o.rat.position.set(.15+chase*.35,.035+Math.abs(Math.sin(f*.8))*.04,.45);o.rat.rotation.y=-.12;
   for(let i=0;i<4;i++)o['ratleg'+i].rotation.z=Math.sin(f*.8+i*Math.PI)*.65;
   const start=a.child.hand('right'),target=o.rat.position.clone().add(vec(-.4,.1,0));o.stone.position.copy(start.lerp(target,flight));o.stone.position.y+=Math.sin(flight*Math.PI)*.35;o.stone.visible=f<42;
   this.effect('dust',f,contact,target,cam);
  }else if(k==='roots'){
   const pull=smooth((f-8)/22);pose('child',pull>.8?'relief':'pained','reach',1-pull);o.roots.position.copy(a.child.hand('right'));o.roots.rotation.z=-.25+pull*.35;
   for(let i=0;i<9;i++){const t=clamp((f-12)/24);o['dirt'+i].visible=f>=12&&f<37;o['dirt'+i].position.set(o.hole.position.x+Math.sin(i*2)*t*.7,.03+Math.sin(t*Math.PI)*(.2+i%3*.08),o.hole.position.z+Math.cos(i*2)*t*.45);}
  }else if(k==='cage'){
   const hit=mark(k,'collar-contact'),put=smooth((f-(hit-16))/16);pose('young',f>=hit?'shock':'nervous');pose('guard','stern','collar',put);
   const target=a.young.point(300,462);o.collar.position.copy(a.guard.hand('left')).add(vec(-.68,0,0));o.collar.position.z=target.z;
   for(const side of [-1,1])o['half'+side].position.x=side*(1-put)*.23;o.ring.visible=put>.8;
   o.cage.visible=f>=82;o.club.visible=false;
   this.effect('impact',f,hit,target.clone().add(vec(0,.12,.13)),cam);
   if(f>=hit&&f<hit+7)a.young.root.rotation.z=(f%2?1:-1)*.045*(1-(f-hit)/7);
  }else if(k==='escape'){
   const hit=mark(k,'guard-hit'),swing=smooth((f-(hit-10))/10),flee=smooth((f-59)/19);pose('young','stern',f<59?'strike':'none',swing,f>59,-flee*2.8,0);pose('guard',f>=hit?'dazed':'neutral');
   const fall=smooth((f-hit)/15);a.guard.root.rotation.z=-fall*1.5;a.guard.root.position.y=-fall*.18;
   o.cage.visible=false;o.collar.visible=true;o.collar.position.copy(a.young.point(300,462));
   const hand=a.young.hand('right'),head=a.guard.head();const tip=hand.clone().add(vec(-.08,.95,0)).lerp(head,swing);this.aim(o.club,hand,tip);o.club.visible=f<60;
   this.effect('impact',f,hit,head.clone().add(vec(0,.02,.16)),cam);
  }else if(k==='beggar'){
   const hit1=mark(k,'beggar-hit-1'),hit2=mark(k,'beggar-hit-2'),t=f<hit1?smooth((f-12)/11):f<29?1:f<hit2?smooth((f-29)/8):1;
   pose('hero','stern','fight',t);pose('khan',f>37?'grin':'neutral',f>37?'cheer':'none',(Math.sin(f*.65)+1)/2);pose('rival1',f>=hit1?'dazed':'stern');pose('rival2',f>=hit2?'dazed':'stern');
   for(const [name,at,side] of [['rival1',hit1,-1],['rival2',hit2,1]] as const){const fall=smooth((f-at)/9);a[name].root.rotation.z=fall*1.35*side;a[name].root.position.y=-fall*.18;}
   const left=f>=29&&f<hit2+7;if(left)a.hero.mesh.scale.x=-1;else a.hero.mesh.scale.x=1;
   const hand=a.hero.hand('right'),target=a[left?'rival2':'rival1'].head();this.aim(o.sword,hand,hand.clone().add(vec(0,.9,0)).lerp(target,t));
   o.standard.visible=false;o.promotion.visible=false;this.effect('hit1',f,hit1,a.rival1.head(),cam);this.effect('hit2',f,hit2,a.rival2.head(),cam);
  }else if(k==='general'){
   pose('hero',f>9?'grin':'relief','command',1);pose('khan','grin','cheer',(Math.sin(f*.65)+1)/2);pose('rival1','dazed');pose('rival2','dazed');
   a.rival1.root.rotation.z=-1.35;a.rival1.root.position.y=-.18;a.rival2.root.rotation.z=1.35;a.rival2.root.position.y=-.18;
   o.sword.visible=false;o.hit1.visible=o.hit2.visible=false;o.standard.position.copy(a.hero.hand('right')).add(vec(0,-.7,0));this.effect('promotion',f,mark(k,'promotion'),a.hero.point(300,540),cam);
  }else if(k==='caravan'){
   for(let i=0;i<4;i++)pose('rider'+i,'neutral','none',0,true,f/(this.w.shot.b-this.w.shot.a)*1.8,.1);
  }else if(k==='execute'){
   const hit=mark(k,'messenger-hit'),swing=smooth((f-(hit-12))/12);pose('messenger',f>hit?'dazed':'nervous','kneel');pose('executioner','stern','strike',swing);pose('governor','stern','command',1);
   for(const name of ['messenger','executioner','governor'])a[name].mesh.material.color.set('#372c39');
   a.governor.root.position.y=.6;
   const fall=smooth((f-hit)/16);a.messenger.root.rotation.z=-fall*1.25;a.messenger.root.position.y=-fall*.15;
   a.executioner.mesh.scale.x=-1;
   const hand=a.executioner.hand('right'),target=a.messenger.head();this.aim(o.blade,hand,hand.clone().add(vec(-.1,1.0,0)).lerp(target,swing));o.blade.visible=f<hit+4;
   this.effect('executionImpact',f,hit,target.clone().add(vec(0,.05,.1)),cam);
  }else if(k==='dispatch'){
   const handoff=mark(k,'sack-handoff'),lift=smooth((f-1)/8),ride=smooth((f-handoff)/9),pass=smooth((f-(handoff-10))/10);pose('sender','stern',f>18?'none':'carry',lift);pose('courier','neutral','none',0,f>18,ride*2.3,0);
   const carried=a.sender.hand('left').add(a.sender.hand('right')).multiplyScalar(.5).add(vec(0,-.5,.12));
   a.courier.root.updateMatrixWorld(true);const attach=o.dispatchRack.localToWorld(vec(0,.23,0));o.dispatchBag.position.copy(carried.lerp(attach,pass));o.dispatchBag.rotation.y=a.courier.mesh.rotation.y;
  }else if(k==='sack'){
   const contact=mark(k,'sack-drop'),drop=smooth((f-(contact-11))/11);pose('khan',f>12?'shock':'neutral');pose('courier','nervous','carry',1);
   const carried=a.courier.hand('left').add(a.courier.hand('right')).multiplyScalar(.5).add(vec(0,-.45,.1));o.sack.position.copy(carried.lerp(vec(0,.69,.5),drop));o.sack.rotation.z=Math.sin(drop*Math.PI)*.12;
  }
 }
}
function yurtBackdrop(w:World){w.camp();}
