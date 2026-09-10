import {Vector3} from '@babylonjs/core';
import type {World} from './World';
import {COVERS,STREET_BLOCKS} from './MapLayout';
import type {Level} from './TacticalRouteGraph';
export interface CoverPoint{id:number;position:Vector3;facing:Vector3;height:'standing'|'crouch';level:Level;peek:Vector3;reservedBy:number|null}
/** Fixed positions around already-authored cover; built once, with collision-checked exits. */
export function buildCoverPoints(w:World){
 const result:CoverPoint[]=[];
 const blocks=[...COVERS,...STREET_BLOCKS.map(c=>({...c,w:.7,h:3}))];
 for(const c of blocks)for(const axis of ['x','z'] as const)for(const side of [-1,1]){
  const x=c.x+(axis==='x'?side*(c.w/2+.65):0),z=c.z+(axis==='z'?side*(c.d/2+.65):0),y=w.terrain.height(x,z),p=new Vector3(x,y,z);
  if(!w.canStand(x,y,z))continue;
  for(const exit of [-1,1]){
   const px=axis==='z'?c.x+exit*(c.w/2+.75):x,pz=axis==='x'?c.z+exit*(c.d/2+.75):z,peek=new Vector3(px,w.terrain.height(px,pz),pz);
   if(!w.canStand(peek.x,peek.y,peek.z)||!w.tactical?.walkableLink(p,peek))continue;
   result.push({id:result.length,position:p,facing:new Vector3(axis==='x'?-side:0,0,axis==='z'?-side:0),height:c.h>1.65?'standing':'crouch',level:y>.6?'high':y<-.4?'low':'surface',peek,reservedBy:null});break;
  }
 }return result;
}
