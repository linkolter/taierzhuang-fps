import {Mesh,MeshBuilder,Vector3} from '@babylonjs/core';
import type {World} from '../map/World';
export class ShellCasingPool {
 readonly pool:{mesh:Mesh;velocity:Vector3;life:number;settled:boolean;bounces:number}[]=[];private cursor=0;
 onLand=(_position:Vector3)=>{};
 constructor(private world:World){const material=world.material('shell-brass','#ad8944');for(let i=0;i<24;i++){const mesh=MeshBuilder.CreateCylinder('pooled-shell',{height:.052,diameter:.012,tessellation:6},world.scene);mesh.material=material;mesh.isPickable=false;mesh.setEnabled(false);this.pool.push({mesh,velocity:new Vector3(),life:0,settled:false,bounces:0});}}
 eject(position:Vector3,yaw:number){const p=this.pool[this.cursor++%this.pool.length];p.mesh.position.copyFrom(position);p.mesh.rotation.set(.5,yaw,Math.PI/2);p.velocity.set(Math.cos(yaw)*1.8,1.3+Math.random()*.4,-Math.sin(yaw)*1.8);p.life=4.5;p.settled=false;p.bounces=0;p.mesh.setEnabled(true);}
 update(dt:number){for(const p of this.pool){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.mesh.setEnabled(false);continue;}if(p.settled)continue;
  p.velocity.y-=9.8*dt;p.mesh.position.addInPlaceFromFloats(p.velocity.x*dt,p.velocity.y*dt,p.velocity.z*dt);p.mesh.rotation.x+=dt*9;p.mesh.rotation.z+=dt*7;
  const floor=this.world.floorAt(p.mesh.position.x,p.mesh.position.z,p.mesh.position.y)+.012;if(p.mesh.position.y<=floor){p.mesh.position.y=floor;if(p.bounces++===0)this.onLand(p.mesh.position);if(p.bounces>=2||Math.abs(p.velocity.y)<.4){p.settled=true;p.mesh.rotation.z=Math.PI/2;}else{p.velocity.y=-p.velocity.y*.23;p.velocity.x*=.45;p.velocity.z*=.45;}}
 }}
 reset(){for(const p of this.pool){p.life=0;p.mesh.setEnabled(false);}this.cursor=0;}
}
