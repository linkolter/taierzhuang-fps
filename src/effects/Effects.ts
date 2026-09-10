import {Color3,Mesh,MeshBuilder,Vector3} from '@babylonjs/core';
import {MuzzleLightPool} from './MuzzleLightPool';
import type {World} from '../map/World';
export class Effects {
 pool:{mesh:Mesh;life:number;duration:number}[]=[];index=0;
 private lightPool:MuzzleLightPool;
 constructor(public world:World){
  const mat=world.material('flash','#ffcf80');mat.emissiveColor=new Color3(1,.68,.25);mat.disableLighting=true;mat.backFaceCulling=false;
  mat.diffuseTexture=world.materials.get('muzzle-sprite')?.diffuseTexture??null;mat.opacityTexture=mat.diffuseTexture;
  for(let i=0;i<28;i++){const mesh=MeshBuilder.CreatePlane('shot-effect',{size:1},world.scene);mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.material=mat;mesh.isPickable=false;mesh.setEnabled(false);this.pool.push({mesh,life:0,duration:0});}
  this.lightPool=MuzzleLightPool.forScene(world.scene);
 }
 flash(position:Vector3,size:number,duration:number){const p=this.pool[this.index++%this.pool.length];p.life=p.duration=duration;p.mesh.position.copyFrom(position);p.mesh.scaling.setAll(size);p.mesh.setEnabled(true);}
 shot(origin:Vector3,end:Vector3,melee:boolean){if(melee)return;this.flash(origin,.18,.045);this.flash(end,.09,.1);this.lightPool.pulse(origin,.04,1.2);}
 update(dt:number){for(const p of this.pool)if(p.life>0){p.life-=dt;if(p.life<=0)p.mesh.setEnabled(false);}this.lightPool.update(dt);}
 reset(){for(const p of this.pool){p.life=0;p.mesh.setEnabled(false);}this.lightPool.reset();}
}
