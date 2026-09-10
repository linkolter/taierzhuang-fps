import { Mesh,Vector3,VertexData } from '@babylonjs/core';
import type { World } from './World';
import { MAP,RAMPS,TUNNEL_PATHS,TUNNEL_ROOMS } from './MapLayout';
import { rampAt,rampFloor } from './Topology';
export interface TunnelRect {x0:number;x1:number;z0:number;z1:number}
export const TUNNEL_RECTS:TunnelRect[]=[];
for(const path of TUNNEL_PATHS)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],h=path.width/2;TUNNEL_RECTS.push({x0:Math.min(a[0],b[0])-h,x1:Math.max(a[0],b[0])+h,z0:Math.min(a[1],b[1])-h,z1:Math.max(a[1],b[1])+h});}
for(const r of TUNNEL_ROOMS)TUNNEL_RECTS.push({x0:r.x-r.w/2,x1:r.x+r.w/2,z0:r.z-r.d/2,z1:r.z+r.d/2});
for(const r of RAMPS){const dx=r.lip[0]===r.bottom[0]?r.width/2:0,dz=dx===0?r.width/2:0;TUNNEL_RECTS.push({x0:Math.min(r.lip[0],r.bottom[0])-dx,x1:Math.max(r.lip[0],r.bottom[0])+dx,z0:Math.min(r.lip[1],r.bottom[1])-dz,z1:Math.max(r.lip[1],r.bottom[1])+dz});}
export const inTunnel=(x:number,z:number)=>TUNNEL_RECTS.some(r=>x>=r.x0-.001&&x<=r.x1+.001&&z>=r.z0-.001&&z<=r.z1+.001);
export function tunnelContains(x:number,z:number,radius=0){return [[0,0],[-radius,-radius],[-radius,radius],[radius,-radius],[radius,radius]].every(([dx,dz])=>inTunnel(x+dx,z+dz));}
/** Construct the union, so branches never get walls across their junctions. */
export function buildTunnels(w:World){
 const mat=w.material('tunnel-earth','#65503a'),wood=w.material('wood','#65503b');
 const xs=[...new Set(TUNNEL_RECTS.flatMap(r=>[r.x0,r.x1]).concat(RAMPS.flatMap(r=>Array.from({length:Math.abs(r.bottom[0]-r.lip[0])+1},(_,i)=>Math.min(r.lip[0],r.bottom[0])+i))))].sort((a,b)=>a-b);
 const zs=[...new Set(TUNNEL_RECTS.flatMap(r=>[r.z0,r.z1]).concat(RAMPS.flatMap(r=>Array.from({length:Math.abs(r.bottom[1]-r.lip[1])+1},(_,i)=>Math.min(r.lip[1],r.bottom[1])+i))))].sort((a,b)=>a-b);
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[];
 const quad=(p:number[][])=>{const n=positions.length/3;for(const v of p){positions.push(...v);uvs.push((v[0]+v[1])/2,v[2]/2);}indices.push(n,n+1,n+2,n,n+2,n+3);};
 const floor=(x:number,z:number)=>{const r=rampAt(x,z);return r?rampFloor(r,x,z,w.terrain.height):MAP.tunnelFloor;};
 const occupied=(i:number,j:number)=>i>=0&&j>=0&&i<xs.length-1&&j<zs.length-1&&inTunnel((xs[i]+xs[i+1])/2,(zs[j]+zs[j+1])/2);
 for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
  if(!occupied(i,j))continue;const a=xs[i],b=xs[i+1],c=zs[j],d=zs[j+1],x=(a+b)/2,z=(c+d)/2;
  const r=rampAt(x,z),fy=(xx:number,zz:number)=>r?rampFloor(r,xx,zz,w.terrain.height):-4;
  quad([[a,fy(a,c),c],[b,fy(b,c),c],[b,fy(b,d),d],[a,fy(a,d),d]]);
  const y=floor(x,z),covered=w.terrain.height(x,z)-y>=2.55;
  if(covered){quad([[a,fy(a,d)+2.2,d],[b,fy(b,d)+2.2,d],[b,fy(b,c)+2.2,c],[a,fy(a,c)+2.2,c]]);w.obstacles.push({x,z,w:b-a,d:d-c,bottom:Math.min(fy(a,c),fy(b,d))+2.2,top:Math.max(fy(a,c),fy(b,d))+2.35});}
  for(const [di,dj] of [[-1,0],[1,0],[0,-1],[0,1]])if(!occupied(i+di,j+dj)){
   // The upper mouth remains open; all other union boundaries are physical earth walls.
   if(r&&Math.hypot(x-r.lip[0],z-r.lip[1])<1.2&&((di!==0&&r.lip[1]===r.bottom[1])||(dj!==0&&r.lip[0]===r.bottom[0])))continue;
   const xx=di?(di<0?a:b):x,zz=dj?(dj<0?c:d):z;
   const width=di?.18:b-a,depth=dj?.18:d-c;
   const bottom=Math.min(fy(a,c),fy(b,d))-.1,top=Math.max(fy(a,c),fy(b,d))+2.2;
   w.box('tunnel-liner',xx,(bottom+top)/2,zz,width,top-bottom,depth,mat);
  }
 }
 VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.uvs=uvs;data.normals=normals;const mesh=new Mesh('tunnel-floor-ceiling',w.scene);data.applyToMesh(mesh);mesh.material=mat;mesh.metadata={solid:true};mesh.isPickable=true;
 for(const path of TUNNEL_PATHS)for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let s=3;s<len;s+=7){const x=a[0]+(b[0]-a[0])*s/len,z=a[1]+(b[1]-a[1])*s/len,alongX=a[1]===b[1];for(const side of [-1,1])w.box('tunnelBeam',x+(alongX?0:side*(path.width/2-.09)),-2.95,z+(alongX?side*(path.width/2-.09):0),.12,2.1,.12,wood,false);w.box('tunnelBeam',x,-1.88,z,alongX?.12:path.width,.14,alongX?path.width:.12,wood,false);const lamp=new Vector3(x,-2.55,z);w.lamps.push(lamp);w.box('oilLampPlaceholder',x,-2.5,z,.12,.2,.12,w.material('lamp','#d4af6b'),false);}}
}
