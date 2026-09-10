import {Color3,DynamicTexture,Mesh,MeshBuilder,PointLight,Texture,TransformNode} from '@babylonjs/core';
import {MuzzleLightPool} from './MuzzleLightPool';
import type {World} from '../map/World';
/** One shared light, one flash and eight smoke quads; all have bounded lifetimes. */
export class MuzzleEffect {
 flash:Mesh;light:PointLight;private lightPool:MuzzleLightPool;smoke:{mesh:Mesh;life:number}[]=[];life=0;private cursor=0;
 constructor(world:World,parent:TransformNode){
  const texture=new DynamicTexture('muzzle-radial',64,world.scene,false,Texture.BILINEAR_SAMPLINGMODE),c=texture.getContext();const g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(255,245,207,1)');g.addColorStop(.25,'rgba(255,187,76,.85)');g.addColorStop(1,'rgba(255,120,20,0)');c.fillStyle=g;c.fillRect(0,0,64,64);texture.hasAlpha=true;texture.update();
  const mat=world.material('muzzle-sprite','#ffffff');mat.diffuseTexture=texture;mat.opacityTexture=texture;mat.emissiveColor=Color3.White();mat.disableLighting=true;mat.backFaceCulling=false;
  this.flash=MeshBuilder.CreatePlane('pooled-muzzle',{size:.22},world.scene);this.flash.parent=parent;this.flash.position.set(0,.06,1.05);this.flash.material=mat;this.flash.isPickable=false;this.flash.renderingGroupId=2;this.flash.setEnabled(false);
  this.lightPool=MuzzleLightPool.forScene(world.scene);this.light=this.lightPool.light;
  const smokeTexture=new DynamicTexture('smoke-radial',64,world.scene,false),sc=smokeTexture.getContext(),sg=sc.createRadialGradient(32,32,0,32,32,32);sg.addColorStop(0,'rgba(155,150,139,.45)');sg.addColorStop(1,'rgba(155,150,139,0)');sc.fillStyle=sg;sc.fillRect(0,0,64,64);smokeTexture.hasAlpha=true;smokeTexture.update();
  const sm=world.material('muzzle-smoke','#aaa79b');sm.diffuseTexture=smokeTexture;sm.opacityTexture=smokeTexture;sm.backFaceCulling=false;
  for(let i=0;i<8;i++){const mesh=MeshBuilder.CreatePlane('pooled-smoke',{size:.18},world.scene);mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.material=sm;mesh.isPickable=false;mesh.setEnabled(false);this.smoke.push({mesh,life:0});}
 }
 fire(){this.life=.045;this.flash.rotation.z=Math.random()*6;this.flash.setEnabled(true);this.flash.computeWorldMatrix(true);this.lightPool.pulse(this.flash.getAbsolutePosition());const p=this.smoke[this.cursor++%this.smoke.length];p.life=.4;p.mesh.position.copyFrom(this.light.position);p.mesh.visibility=.5;p.mesh.setEnabled(true);}
 update(dt:number){if(this.life>0){this.life-=dt;if(this.life<=0){this.flash.setEnabled(false);}}for(const p of this.smoke)if(p.life>0){p.life-=dt;p.mesh.position.y+=dt*.25;p.mesh.scaling.setAll(1+(.4-p.life)*3);p.mesh.visibility=Math.max(0,p.life);if(p.life<=0)p.mesh.setEnabled(false);}}
 reset(){this.lightPool.reset();this.life=0;this.flash.setEnabled(false);for(const p of this.smoke){p.life=0;p.mesh.setEnabled(false);}}
}

