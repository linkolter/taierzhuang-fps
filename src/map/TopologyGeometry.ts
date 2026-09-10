import type { World } from './World';
import { GROUND_PORTALS,rampAt,rampFloor } from './Topology';
import { HOUSES,laneZ,laneWidth,RAMPS,type Lane } from './MapLayout';
export function buildTopology(w:World){
 const wall=w.material('plaster','#b6a482'),stone=w.material('stone','#79766a');
 for(const gate of GROUND_PORTALS)for(const [a,b] of [[-90,gate.x-gate.width/2],[gate.x+gate.width/2,90]])for(let x=a;x<b;x+=2){const end=Math.min(b,x+2),cx=(x+end)/2,base=Math.min(w.terrain.height(x,gate.z),w.terrain.height(end,gate.z))-.1,r=rampAt(cx,gate.z),bottom=r?Math.max(base,rampFloor(r,cx,gate.z,w.terrain.height)+2.2):base,top=base+3.4;w.box('continuous-lane-divider',cx,(bottom+top)/2,gate.z,end-x,top-bottom,.65,wall);}
 const previous=new Map<string,{x:number;z:number;base:number;h:number}>();
 for(const lane of ['main','north','south'] as Lane[])for(let x=-89.5;x<90;x++)for(const side of [-1,1]){
  const z=laneZ(lane,x)+side*(laneWidth(lane,x)/2+.25),base=w.terrain.height(x,z);
  if(GROUND_PORTALS.some(p=>Math.abs(x-p.x)<p.width/2+.15&&z>=Math.min(p.from,p.to)&&z<=Math.max(p.from,p.to)))continue;
  if(lane==='main'&&HOUSES.some(h=>h.enter&&Math.sign(h.z)===side&&Math.abs(x-h.x)<h.w/2-.4))continue;
  if(RAMPS.some(r=>Math.abs(x-r.lip[0])<1.6&&Math.abs(z-r.lip[1])<8&&Math.sign(r.lip[1]-laneZ(lane,x))===side))continue;
  const h=lane==='main'?2.8:lane==='north'?(side<0&&(Math.abs(x+34)<3||Math.abs(x-46)<3)?1.1:2.8):2.65;
  w.box(lane==='south'?'trench-bank':lane==='north'?'high-courtyard-wall':'street-courtyard-wall',x,base+h/2,z,1.1,h,.8,lane==='south'?w.material('earth','#a89671'):((Math.floor(x/12)%3===0)?stone:wall));
  const key=lane+side,last=previous.get(key);if(last&&x-last.x<1.1){const bottom=Math.min(base,last.base);w.box('wall-corner-joint',x-.5,bottom+Math.max(h,last.h)/2,(z+last.z)/2,.22,Math.max(h,last.h),Math.abs(z-last.z)+.8,lane==='south'?w.material('earth','#a89671'):wall);}previous.set(key,{x,z,base,h});
 }
 for(const p of GROUND_PORTALS){for(let z=Math.min(p.from,p.to);z<=Math.max(p.from,p.to);z+=.65)w.box('stoneStep',p.x,w.terrain.height(p.x,z)+.025,z,p.width,.05,.16,stone,false);for(const side of [-1,1])w.box('woodGate',p.x+side*1.48,w.terrain.height(p.x,p.z)+1.4,p.z,.18,2.8,.3,w.material('wood','#65503b'));w.box('gate-lintel',p.x,w.terrain.height(p.x,p.z)+2.85,p.z,3.1,.2,.3,w.material('wood','#65503b'));}
 for(const x of [-89.7,89.7])w.box('boundary-earth-wall',x,2,0,.6,10,90,wall);
 for(const z of [-44.7,44.7])w.box('boundary-earth-wall',0,2,z,180,10,.6,wall);
}
