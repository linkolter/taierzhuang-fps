import { Color3,DynamicTexture,Mesh,MeshBuilder } from '@babylonjs/core';
import type { World } from './World';
import { buildTopology } from './TopologyGeometry';
import { buildTunnels } from './TunnelGeometry';
import { buildBlockoutSurface } from './BlockoutSurface';
export function buildVillage(w:World){
 w.terrain.build(w);
 buildTopology(w);buildTunnels(w);buildBlockoutSurface(w);
}
export function label(w: World,text:string,x:number,y:number,z:number,width=2,height=1,color='#e2d2b0') {
  const texture=new DynamicTexture('sign-'+text,{width:512,height:128},w.scene,false);const ctx=texture.getContext() as CanvasRenderingContext2D;ctx.fillStyle='#4f4838';ctx.fillRect(0,0,512,128);ctx.font='bold 52px Microsoft YaHei';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,83);texture.update();
  const mat=w.material('sign-'+text,'#ffffff');mat.diffuseTexture=texture;mat.emissiveColor=new Color3(.12,.12,.1);mat.backFaceCulling=false;
  const mesh=MeshBuilder.CreatePlane('sign-'+text,{width,height,sideOrientation:Mesh.DOUBLESIDE},w.scene);mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;mesh.material=mat;mesh.isPickable=false;return mesh;
}


