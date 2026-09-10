import { Color3,DynamicTexture,Mesh,MeshBuilder } from '@babylonjs/core';
import type { World } from './World';
import { HOUSES,COVERS,STREET_BLOCKS } from './MapLayout';
import { buildTopology } from './TopologyGeometry';
import { dressVillage } from './EnvironmentProps';
import { buildTunnels } from './TunnelGeometry';
export function buildVillage(w:World){
 w.terrain.build(w);
 const wall=w.material('plaster','#b6a482'),stone=w.material('stone','#79766a'),roof=w.material('roof','#555a55'),wood=w.material('wood','#65503b'),dark=w.material('openings','#343830');
 for(const h of HOUSES){
  const base=w.terrain.height(h.x,h.z),front=h.z>0?h.z-h.d/2:h.z+h.d/2,back=h.z>0?h.z+h.d/2:h.z-h.d/2;
  if(h.enter){
   // One door, simple empty interior. Terrain stays continuous through the doorway.
   for(const side of [-1,1])w.box('house-side',h.x+side*(h.w/2-.2),base+h.h/2,h.z,.4,h.h,h.d,wall);
   w.box('house-back',h.x,base+h.h/2,back,h.w,h.h,.4,wall);
   for(const side of [-1,1])w.box('door-jamb',h.x+side*(h.w/4+.55),base+h.h/2,front,h.w/2-1.1,h.h,.4,wall);
   w.box('door-header',h.x,base+(h.h+2.3)/2,front,2.2,h.h-2.3,.4,wood);
  }else{w.box('earthen-house',h.x,base+h.h/2,h.z,h.w,h.h,h.d,wall);w.box('closed-wood-door',h.x,base+1.1,front,1.2,2.2,.12,wood,false);}
  for(const side of [-1,1]){const z=h.z+side*h.d/4,m=w.box('roof-tile',h.x,base+h.h+.6,z,h.w+.7,.22,h.d/2/Math.cos(.38)+.4,roof,false);m.rotation.x=side*.38;m.metadata={solid:true};m.isPickable=true;}
  w.box('roof-ridge',h.x,base+h.h+1.2,h.z,h.w+.9,.22,.3,roof,false);
  for(const side of [-1,1]){w.box('window-dark',h.x+side*h.w*.31,base+1.9,front,1,.85,.08,dark,false);for(let i=0;i<3;i++)w.box('window-lattice',h.x+side*h.w*.31-.35+i*.35,base+1.9,front+(front<h.z?-.08:.08),.045,.85,.07,wood,false);}
 }
 buildTopology(w);buildTunnels(w);
 for(const b of STREET_BLOCKS)w.box('street-sight-break',b.x,w.terrain.height(b.x,b.z)+1.5,b.z,.7,3,b.d,wall);
 dressVillage(w);
 for(const c of COVERS)w.box('stoneWall',c.x,w.terrain.height(c.x,c.z)+c.h/2,c.z,c.w,c.h,c.d,stone);
 // Spawn courtyards have offset entrances and full-height protection.
 for(const x of [-77,77])w.box('spawn-screen',x,1.6,.8,.6,3.2,3.4,wall);
 for(let i=0;i<15;i++){const x=-84+i*12,z=i%2?42:-41;w.box('tree-trunk',x,w.terrain.height(x,z)+1.8,z,.3,3.6,.3,wood,false);const m=MeshBuilder.CreateSphere('sparse-tree',{diameter:4,segments:4},w.scene);m.position.set(x,w.terrain.height(x,z)+4,z);m.scaling.y=.65;m.material=w.material('leaves','#777f53');m.isPickable=false;}
}
export function label(w: World,text:string,x:number,y:number,z:number,width=2,height=1,color='#e2d2b0') {
  const texture=new DynamicTexture('sign-'+text,{width:512,height:128},w.scene,false);const ctx=texture.getContext() as CanvasRenderingContext2D;ctx.fillStyle='#4f4838';ctx.fillRect(0,0,512,128);ctx.font='bold 52px Microsoft YaHei';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,83);texture.update();
  const mat=w.material('sign-'+text,'#ffffff');mat.diffuseTexture=texture;mat.emissiveColor=new Color3(.12,.12,.1);mat.backFaceCulling=false;
  const mesh=MeshBuilder.CreatePlane('sign-'+text,{width,height,sideOrientation:Mesh.DOUBLESIDE},w.scene);mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;mesh.material=mat;mesh.isPickable=false;return mesh;
}


