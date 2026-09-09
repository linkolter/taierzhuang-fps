import { Color3, Mesh, VertexData } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { clamp } from '../core/math';
import type { World } from './World';
import { openShaft,NORTH_SHAFTS,SOUTH_SHAFTS } from './Topology';
/** Hand-authored ramps and terraces; the same height function drives rendering, collision and navigation. */
export class Terrain {
  height(x:number,z:number){
    const c=CONFIG.terrain;
    const highX=clamp((80-Math.abs(x))/14,0,1),highZ=Math.min(clamp((z-12)/6,0,1),clamp((43-z)/5,0,1));
    const high=c.high*highX*highZ;
    const b=c.centre*Math.min(clamp((14-Math.abs(x))/6,0,1),clamp((12-Math.abs(z))/6,0,1));
    const low=-c.lowDepth*clamp((84-Math.abs(x))/8,0,1)*Math.min(clamp((z+43)/3,0,1),clamp((-32-z)/4,0,1));
    return Math.max(high,b)+low;
  }
  build(w:World){
    const positions:number[]=[],indices:number[]=[],colors:number[]=[],normals:number[]=[];
    // Include exact shaft edges instead of rounding narrow holes to the metre grid.
    const xs=[...new Set([...Array.from({length:181},(_,i)=>i-90),...[...NORTH_SHAFTS,...SOUTH_SHAFTS].flatMap(x=>[x-1.2,x+1.2])])].sort((a,b)=>a-b),stride=xs.length;
    const earth=Color3.FromHexString('#a89671'),road=Color3.FromHexString('#b2a17e'),low=Color3.FromHexString('#887958');
    for(let z=-45;z<=45;z++)for(const x of xs){positions.push(x,this.height(x,z),z);const c=z>=-3&&z<=3?road:z>=20&&z<=24?road:z<=-36&&z>=-40?low:earth;colors.push(c.r,c.g,c.b,1);}
    for(let z=0;z<90;z++)for(let x=0;x<stride-1;x++){const wx=(xs[x]+xs[x+1])/2,wz=z-44.5;if(openShaft(wx,wz))continue;const a=z*stride+x;indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);}
    VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;const mesh=new Mesh('tactical-terrain',w.scene);data.applyToMesh(mesh);mesh.material=w.material('terrain','#ffffff');mesh.metadata={solid:true,terrain:true};mesh.isPickable=true;mesh.receiveShadows=true;return mesh;
  }
}
