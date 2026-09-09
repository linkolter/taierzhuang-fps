import { Vector3 } from '@babylonjs/core';
import type { World } from './World';
import type { Level } from './TacticalRouteGraph';
export interface CoverPoint { id:number; position:Vector3; facing:Vector3; height:'standing'|'crouch'; level:Level; peek:Vector3; reservedBy:number|null }
export function buildCoverPoints(w:World){const points:CoverPoint[]=[];
  const add=(x:number,z:number,fx:number,fz:number,height:CoverPoint['height'],px:number,pz:number)=>{const y=w.floorAt(x,z,0),p=new Vector3(x,y,z),peek=new Vector3(px,w.floorAt(px,pz,0),pz);if(!w.canStand(x,y,z,.4,1.2)||!w.canStand(peek.x,peek.y,peek.z,.4))return;points.push({id:points.length,position:p,facing:new Vector3(fx,0,fz),height,level:y>.6?'high':y<-.4?'low':'surface',peek,reservedBy:null});};
  for(const x of [-48,-16,16,48]){const z=x<0?-.8:.8;for(const side of [-1,1])add(x+side*1.05,z, -side,0,'standing',x+side*1.05,z+(x<0?3.6:-3.6));}
  for(const x of [-57,-25,25,57]){const z=x>0?-2.5:2.5;for(const side of [-1,1])add(x,z+side*1.2,0,-side,'crouch',x+2.7,z+side*1.2);}
  for(const x of [-52,-30,30,52]){add(x,20.1,0,-1,'crouch',x+4.5,20.1);add(x,17.9,0,1,'crouch',x-4.5,17.9);}
  for(const x of [-60,-40,-20,20,40,60])add(x,-37,0,1,'crouch',x+1,-35.5);
  return points;
}
