import {Vector3} from '@babylonjs/core';import type {World} from './World';import {COVERS} from './MapLayout';import type {Level} from './TacticalRouteGraph';
export interface CoverPoint{id:number;position:Vector3;facing:Vector3;height:'standing'|'crouch';level:Level;peek:Vector3;reservedBy:number|null}
export function buildCoverPoints(w:World){const result:CoverPoint[]=[];for(const c of COVERS)for(const side of [-1,1]){
 const x=c.x,z=c.z+side*(c.d/2+.6),y=w.terrain.height(x,z),p=new Vector3(x,y,z),peek=new Vector3(x+c.w/2+.7,y,z);
 if(!w.canStand(x,y,z)||!w.canStand(peek.x,y,z)||!w.tactical?.walkableLink(p,peek))continue;
 result.push({id:result.length,position:p,facing:new Vector3(0,0,-side),height:'crouch',level:y>.6?'high':y<-.4?'low':'surface',peek,reservedBy:null});
 }return result;}
