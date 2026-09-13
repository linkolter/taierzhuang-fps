import {Mesh,Vector3,VertexBuffer} from '@babylonjs/core';

/** Metric face projection; Babylon's six box faces do not share a width/height UV order. */
export function projectSurfaceUV(mesh:Mesh,metres=2.5,worldSpace=false,swapTop=false){
 const p=mesh.getVerticesData(VertexBuffer.PositionKind),n=mesh.getVerticesData(VertexBuffer.NormalKind);if(!p||!n)return;
 const matrix=mesh.computeWorldMatrix(true),uv:number[]=[];
 for(let i=0;i<p.length;i+=3){
  let v=Vector3.FromArray(p,i),normal=Vector3.FromArray(n,i);
  if(worldSpace){v=Vector3.TransformCoordinates(v,matrix);normal=Vector3.TransformNormal(normal,matrix);}
  const ax=Math.abs(normal.x),ay=Math.abs(normal.y),az=Math.abs(normal.z);
  if(ay>ax&&ay>az)uv.push((swapTop?v.z:v.x)/metres,(swapTop?v.x:v.z)/metres);
  else if(ax>az)uv.push(v.z/metres,v.y/metres);
  else uv.push(v.x/metres,v.y/metres);
 }
 mesh.setVerticesData(VertexBuffer.UVKind,uv);
}
