import {Mesh,MeshBuilder,Vector3,VertexData,type StandardMaterial} from '@babylonjs/core';
import type {World} from './World';
import {HOUSES,OBJECTIVES} from './MapLayout';
import {openShaft} from './Topology';
import {projectSurfaceUV} from './SurfaceUV';

/** Additive visual dressing only. Never calls World.box or changes collision arrays. */
export function dressVillageArt(w:World){
 const pieces:Mesh[]=[];
 const mat=(name:string,color:string)=>w.material(name,color);
 const roof=mat('art-roof','#8b7956'),timber=mat('art-timber','#4b3929'),planks=mat('art-planks','#84705a'),stone=mat('art-stone','#b3a58c'),metal=mat('art-metal','#6d5541');
 const box=(name:string,x:number,y:number,z:number,width:number,height:number,depth:number,material:StandardMaterial)=>{
  const m=MeshBuilder.CreateBox('art-'+name,{width,height,depth},w.scene);m.position.set(x,y,z);m.material=material;m.isPickable=false;m.receiveShadows=true;
  projectSurfaceUV(m,2);pieces.push(m);return m;
 };
 for(const [index,h]of HOUSES.entries()){
  const top=Math.max(...[-1,1].flatMap(sx=>[-1,1].map(sz=>w.terrain.height(h.x+sx*h.w/2,h.z+sz*h.d/2))))+h.h;
  const alongX=h.w>=h.d,long=alongX?h.w:h.d,short=alongX?h.d:h.w,half=short/2+.25,rise=Math.min(1.8,short*.27);
  const slope=Math.hypot(half,rise),angle=Math.atan2(rise,half);
  for(const side of [-1,1]){
   const m=box('thatch-roof',h.x+(alongX?0:side*half/2),top+rise/2+.08,h.z+(alongX?side*half/2:0),alongX?long+.5:slope,.18,alongX?slope:long+.5,roof);
   projectSurfaceUV(m,1.5,false,!alongX);
   if(alongX)m.rotation.x=side*angle;else m.rotation.z=-side*angle;
   box('eave',h.x+(alongX?0:side*(short/2+.02)),top-.08,h.z+(alongX?side*(short/2+.02):0),alongX?long+.2:.14,.18,alongX?.14:long+.2,timber);
  }
  box('ridge',h.x,top+rise+.13,h.z,alongX?long+.45:.21,.18,alongX?.21:long+.45,roof);
  // Gable infill closes the roof ends; old gameplay building masses stay intact below.
  for(const side of [-1,1]){
   const pos=alongX?[side*long/2,0,-short/2,side*long/2,0,short/2,side*long/2,rise,0]:[-short/2,0,side*long/2,short/2,0,side*long/2,0,rise,side*long/2];
   const data=new VertexData();data.positions=pos.concat(pos);data.indices=[0,1,2,5,4,3];data.uvs=[0,0,short/2,0,short/4,rise/2,0,0,short/2,0,short/4,rise/2];const normals:number[]=[];VertexData.ComputeNormals(data.positions,data.indices,normals);data.normals=normals;
   const g=new Mesh('art-gable',w.scene);data.applyToMesh(g);g.position.set(h.x,top,h.z);g.material=planks;g.isPickable=false;g.receiveShadows=true;pieces.push(g);
  }
  // Closed panels keep the original impassable building contract visually honest.
  const facade=alongX?h.d/2:h.w/2;
  for(const side of [-1,1]){
   const point=(along:number,up:number,out:number)=>new Vector3(h.x+(alongX?along:side*(facade+out)),up,h.z+(alongX?side*(facade+out):along));
   const panel=(name:string,along:number,base:number,width:number,height:number,material:StandardMaterial,out=.024)=>{const p=point(along,base+height/2,out);return box(name,p.x,p.y,p.z,alongX?width:.035,height,alongX?.035:width,material);};
   const doorBase=w.terrain.height(h.x+(alongX?0:side*facade),h.z+(alongX?side*facade:0));
   panel('closed-door',0,doorBase,1.16,2.03,planks);
   for(const dx of [-.64,.64])panel('door-frame',dx,doorBase,.11,2.15,timber,.047);
   panel('door-lintel',0,doorBase+2.04,1.39,.14,timber,.047);
   const count=Math.max(1,Math.floor(long/5));
   for(let j=0;j<count;j++){
    const along=(j-(count-1)/2)*4.4;if(Math.abs(along)<1.5)continue;
    const p=point(along,0,0),base=w.terrain.height(p.x,p.z)+1.03;
    panel('closed-shutter',along,base,1.03,1.03,planks);
    for(const dx of [-.57,.57])panel('shutter-frame',along+dx,base-.06,.1,1.16,timber,.05);
    for(const dy of [-.06,1.03])panel('shutter-frame',along,base+dy,1.22,.1,timber,.05);
    panel('shutter-bar',along,base+.43,1.06,.075,timber,.06);
   }
   // Weathered masonry plinth following the existing terrain height at each section.
   for(let x=-long/2;x<long/2;x+=2){const span=Math.min(2,long/2-x),p=point(x+span/2,0,0),base=w.terrain.height(p.x,p.z);panel('foundation',x+span/2,base,span,.34,stone,.022);}
  }
  if(index%3===0){const z=h.z-h.d/2-.035,y=w.terrain.height(h.x,z)+.12;box('door-footplate',h.x,y,z,1.05,.16,.035,metal);}
 }
 // Courtyard paving conforms to terrain; all seven shaft openings remain unfilled.
 for(const o of OBJECTIVES.filter(o=>o.id!=='B')){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[],normals:number[]=[];
  for(let z=o.z-3;z<o.z+4;z+=.5)for(let x=o.x-5;x<o.x+5;x+=.5){
   if(openShaft(x+.25,z+.25,w.terrain.height))continue;
   const n=positions.length/3;for(const [xx,zz]of [[x,z],[x+.5,z],[x+.5,z+.5],[x,z+.5]]){positions.push(xx,w.terrain.height(xx,zz)+.018,zz);uvs.push(xx/2.5,zz/2.5);}indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();data.positions=positions;data.indices=indices;data.uvs=uvs;data.normals=normals;
  const m=new Mesh('art-courtyard-'+o.id,w.scene);data.applyToMesh(m);m.material=mat(o.id==='A'?'art-court-stone':'art-court-path','#b1a68d');m.isPickable=false;m.receiveShadows=true;pieces.push(m);
 }
 // Merge by material and 30m column once. Never merge/rebuild during play/reset.
 const groups=new Map<string,Mesh[]>();for(const m of pieces){const key=m.material!.uniqueId+':'+Math.floor(m.position.x/30);const list=groups.get(key)??[];list.push(m);groups.set(key,list);}
 const merged:Mesh[]=[];for(const list of groups.values()){const materialName=list[0].material!.name;const m=list.length===1?list[0]:Mesh.MergeMeshes(list,true,true)!;m.name='village-art-'+materialName;m.metadata={visualOnly:true};m.isPickable=false;m.receiveShadows=true;m.freezeWorldMatrix();merged.push(m);}
 return merged;
}
