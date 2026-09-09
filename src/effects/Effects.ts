import { Color3, Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import type { World } from '../map/World';
export class Effects {
  pool:{mesh:Mesh;life:number;duration:number}[]=[];index=0;
  constructor(public world:World){const mat=world.material('flash','#ffcf80');mat.emissiveColor=new Color3(1,.68,.25);mat.disableLighting=true;for(let i=0;i<28;i++){const mesh=MeshBuilder.CreateSphere('shot-effect',{diameter:1,segments:4},world.scene);mesh.material=mat;mesh.isPickable=false;mesh.setEnabled(false);this.pool.push({mesh,life:0,duration:0});}}
  flash(position:Vector3,size:number,duration:number){const p=this.pool[this.index++%this.pool.length];p.life=p.duration=duration;p.mesh.position.copyFrom(position);p.mesh.scaling.set(size,size,size);p.mesh.setEnabled(true);}
  shot(origin:Vector3,end:Vector3,melee:boolean){if(melee)return;const direction=end.subtract(origin).normalize();this.flash(origin.add(direction.scale(.8)),.13,.055);this.flash(end,.11,.13);}
  update(dt:number){for(const p of this.pool)if(p.life>0){p.life-=dt;if(p.life<=0)p.mesh.setEnabled(false);}}
  reset(){for(const p of this.pool){p.life=0;p.mesh.setEnabled(false);}}
}
