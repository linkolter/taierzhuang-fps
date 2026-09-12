import { Mesh,VertexData } from '@babylonjs/core';
import { clamp } from '../core/math';
import type { World } from './World';
import { HIGH_PROFILE,interpolate,RAMPS } from './MapLayout';
import { openShaft } from './Topology';
export class Terrain {
 height=(x:number,z:number)=>interpolate(HIGH_PROFILE,x)*clamp((z-14)/10,0,1)-(1.3+.4*clamp((x+70)/140,0,1))*clamp((-z-14)/12,0,1);
 build(w:World){
  const xs=[...new Set([...Array.from({length:361},(_,i)=>i*.5-90),...RAMPS.flatMap(r=>[r.lip[0]-r.width/2,r.lip[0]+r.width/2,r.bottom[0]-r.width/2,r.bottom[0]+r.width/2])])].sort((a,b)=>a-b);
  const zs=[...new Set([...Array.from({length:181},(_,i)=>i*.5-45),...RAMPS.flatMap(r=>[r.lip[1]-r.width/2,r.lip[1]+r.width/2,r.bottom[1]-r.width/2,r.bottom[1]+r.width/2])])].sort((a,b)=>a-b);
  const chunks:Mesh[]=[];
  // Preserve every original vertex, UV, triangle and shaft opening. Only partition
  // the static visual mesh so frustum and ray bounding tests can discard distant tiles.
  for(let x0=-90;x0<90;x0+=30)for(let z0=-45;z0<45;z0+=15){
   const xx=xs.filter(x=>x>=x0&&x<=x0+30),zz=zs.filter(z=>z>=z0&&z<=z0+15),stride=xx.length;
   const positions:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
   for(const z of zz)for(const x of xx){positions.push(x,this.height(x,z),z);uvs.push(x/5,z/5);}
   for(let zi=0;zi<zz.length-1;zi++)for(let xi=0;xi<xx.length-1;xi++){
    if(openShaft((xx[xi]+xx[xi+1])/2,(zz[zi]+zz[zi+1])/2,this.height))continue;
    const a=zi*stride+xi;indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);
   }
   VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.uvs=uvs;
   const mesh=new Mesh(`terrain-${x0}-${z0}`,w.scene);data.applyToMesh(mesh);mesh.material=w.material('blockout-ground','#626462');mesh.metadata={solid:true,terrain:true,staticChunk:true};mesh.isPickable=true;mesh.receiveShadows=true;chunks.push(mesh);
  }
  return chunks;
 }
}
