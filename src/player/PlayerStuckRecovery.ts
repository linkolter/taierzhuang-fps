import { Vector3 } from '@babylonjs/core';
import type { World } from '../map/World';
/** Temporary recovery only: an obstructed movement destination is not penetration. */
export class PlayerStuckRecovery {
  lastSafePosition:Vector3|null=null; recoveries=0; private blockedTime=0;private groundedTime=0;
  reset(){this.lastSafePosition=null;this.blockedTime=this.groundedTime=0;}
  update(dt:number,position:Vector3,input:boolean,moved:number,grounded:boolean,crouching:boolean,world:Pick<World,'canStand'|'floorAt'>){
    grounded=grounded&&Math.abs(position.y-world.floorAt(position.x,position.z,position.y))<.06;
    const standing=world.canStand(position.x,position.y,position.z);
    this.groundedTime=grounded&&standing&&!crouching?this.groundedTime+dt:0;
    if(this.groundedTime>=.3)this.lastSafePosition=position.clone();
    const embedded=!world.canStand(position.x,position.y,position.z,.28,crouching?1.2:1.7);
    this.blockedTime=input&&moved<.05*dt&&embedded?this.blockedTime+dt:0;
    if(this.blockedTime<1)return false;
    this.blockedTime=0;
    for(const radius of [.15,.3,.5])for(let i=0;i<8;i++){
      const x=position.x+Math.cos(i*Math.PI/4)*radius,z=position.z+Math.sin(i*Math.PI/4)*radius,y=world.floorAt(x,z,position.y);
      if(Math.abs(y-position.y)<.4&&world.canStand(x,y,z)){position.set(x,y,z);this.recoveries++;return true;}
    }
    const safe=this.lastSafePosition;
    if(safe&&world.canStand(safe.x,safe.y,safe.z)){position.copyFrom(safe);this.recoveries++;return true;}return false;
  }
}
