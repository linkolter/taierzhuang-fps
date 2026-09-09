import { Color3, DynamicTexture, Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { seededRandom } from '../core/math';
import type { World } from './World';
import { buildTopology } from './TopologyGeometry';
import { TUNNEL_BAFFLES,NORTH_SHAFTS,SOUTH_SHAFTS } from './Topology';
type WorldBox=World['box'];
export function buildVillage(w: World) {
  const earth = w.material('earth', '#a89671'), wall = w.material('plaster', '#b6a482'), stone = w.material('stone', '#79766a'), roof = w.material('roof', '#555a55'), wood = w.material('wood', '#65503b'), dark = w.material('openings', '#343830'), straw = w.material('straw', '#b8a36c');
  const dirt = w.material('tunnel-earth', '#65503a'), timber = w.material('tunnel-timber', '#51402d');
  const rng = seededRandom(1938);
  w.terrain.build(w);
  // Farmland remains decorative; follow the same ground height as collision.
  for(const sx of [-1,1]) for(const sz of [-1,1]) {const x=sx*75,z=sz*35;for(let r=0;r<9;r++){const zz=z-5+r*1.25;for(let i=0;i<11;i++){const xx=x-10+i*2;w.box('furrow',xx,w.terrain.height(xx,zz)+.03,zz,1.9,.05,.15,w.material('furrow','#6e6845'),false);}}}
  const house=(x:number,z:number,width:number,depth:number,height=3.7)=>{
    const base=w.terrain.height(x,z);const box:WorldBox=(name,xx,y,zz,...rest)=>w.box(name,xx,y+base,zz,...rest);
    box('stone-foundation',x,.35,z,width+.3,.7,depth+.3,stone);
    box('earthen-house',x,height/2+.3,z,width,height,depth,wall);
    const pitch=.39, roofWidth=depth/2/Math.cos(pitch)+.7;
    for(const side of [-1,1]) { const m=box('tiled-roof',x,height+.55,z+side*depth/4,width+1,.22,roofWidth,roof,false); m.rotation.x=side*pitch; m.metadata={solid:true};m.isPickable=true; }
    box('ridge',x,height+1.32,z,width+1.1,.25,.27,roof,false);
    const front=z>0?z-depth/2-.025:z+depth/2+.025;
    box('wooden-door',x,1.35,front,1.18,2.1,.065,wood,false);
    for(const side of [-1,1]) { box('window-recess',x+side*width*.3,2.05,front,1.2,.9,.08,dark,false); for(let i=0;i<4;i++) box('window-lattice',x+side*width*.3-.45+i*.3,2.05,front+(z>0?-.06:.06),.055,.85,.06,wood,false); }
    for(let i=0;i<Math.floor(width/.5);i++) for(const side of [-1,1]) { const tile=box('tile-seam',x-width/2+i*.5,height+.68,z+side*depth/4,.035,.045,roofWidth,stone,false); tile.rotation.x=side*pitch; }
  };
  // Local courtyards stay within their lane; only the two authored gates connect surface lanes.
  for(const x of [-56,-30,-10,12,30,56]) { house(x,11, x===-30?10:9,9,3.4+rng()*.7); if(Math.abs(x)>15)house(x,-9,8,7,3.5); }
  for(const x of [-49,-16,17,49]) house(x,32,12,9,3.7);
  house(-42,12,8,9,4.1); house(42,12,8,9,4.2);
  // Courtyard side walls and cover break long sight lines without closing the main street.
  for(const x of [-60,-36,-15,17,37,61]) { w.box('courtyard-wall',x,1.15,5.2,7,2.3,.5,wall); w.box('stone-coping',x,2.33,5.2,7.2,.15,.65,stone,false); }
  for(const x of [-57,-25,25,57]) { const z=x>0?-2.5:2.5; w.box('low-stone-cover',x,.65,z,3.7,1.3,1.2,stone); w.box('wood-crate',x+1,.55,-z,1.1,1.1,1.1,wood); }
  for(const x of [-37,36]) { w.box('hay-bale',x,.65,-6,2.6,1.3,1.5,straw); w.box('courtyard-edge',x,3,17,8,2,.5,wall); }
  w.box('well-base',4,1.7,4,2,1,2,stone); w.box('well-dark',4,2.21,4,1.4,.03,1.4,dark,false);
  for(const x of [-4,4]) w.box('drying-grain',x,1.227,4,3,.025,3,straw,false);
  for(const x of [-87,87]) w.box('boundary-wall',x,1.4,0,.6,2.8,89,wall);
  for(const z of [-44,44]) w.box('boundary-wall',0,1.4,z,180,2.8,.6,wall);
  for(const x of [-52,-30,30,52])w.box('high-parapet',x,3.05,19,7,1.3,.65,stone);
  for(const x of [-22])for(let z=13;z<18;z++)w.box('stone-stair-tread',x,w.terrain.height(x,z)+.025,z,3,.05,.12,stone,false);
  for(const x of [-48,0,48])label(w,'北侧高地 ↑',x,3.5,23,3,.65);
  label(w,'南沟连接口 ↓',22,1.2,-32,3,.65);
  label(w,'高地连接口 ↑',-22,3,16,3,.65);
  // Alternating road walls create 30–50 m sight-line breaks with walkable sides.
  for(const x of [-48,-16,16,48]){const z=x<0?-.8:.8,y=w.terrain.height(x,z);w.box('street-chicane',x,y+1.15,z,.8,2.3,5.2,wall);}
  // Actual underground passage, with a small room branching south of the trunk.
  w.box('tunnel-floor',0,-4.2,-29,141,.4,3.8,dirt);
  for(const [a,b] of [[-70,-49.2],[-46.8,16],[24,46.8],[49.2,70]])w.box('tunnel-south-wall',(a+b)/2,-2.55,-31.15,b-a,2.9,.7,dirt);
  const spans=[[-70,-70],[-66,-2],[2,66],[70,70]];
  for(const [a,b] of spans) if(b>a) w.box('tunnel-ceiling',(a+b)/2,-1.5,-29,b-a,.4,4.4,dirt);
  for(const [a,b] of [[-66,-65.2],[-62.8,-2],[2,62.8],[65.2,66]])w.box('tunnel-north-wall',(a+b)/2,-2.55,-26.9,b-a,2.9,.6,dirt);
  w.box('tunnel-end-west',-70.4,-2.5,-29,.6,3,4.8,dirt); w.box('tunnel-end-east',70.4,-2.5,-29,.6,3,4.8,dirt);
  for(const [a,b] of [[-70,-49.2],[-46.8,16],[24,46.8],[49.2,70]])w.box('tunnel-south-liner',(a+b)/2,-2.85,-30.5,b-a,2.3,.6,dirt);
  for(const [a,b] of [[-66,-65.2],[-62.8,-2],[2,62.8],[65.2,66]])w.box('tunnel-north-liner',(a+b)/2,-2.85,-27.5,b-a,2.3,.6,dirt);
  for(const b of TUNNEL_BAFFLES)w.box('tunnel-turn',b.x,-2.85,-29+b.side*.65,.6,2.3,1.35,dirt);
  w.box('chamber-floor',20,-4.2,-34,8,.4,7,dirt); w.box('chamber-west',15.7,-2.65,-34,.6,2.7,7,dirt); w.box('chamber-east',24.3,-2.65,-34,.6,2.7,7,dirt);
  for(const [a,b] of [[15.5,18.8],[21.2,24.5]]){w.box('chamber-end',(a+b)/2,-2.65,-37.5,b-a,2.7,.6,dirt);w.box('chamber-roof',(a+b)/2,-1.5,-34,b-a,.4,7,dirt);}
  w.box('chamber-roof',20,-1.5,-32.5,2.4,.4,4,dirt);
  buildTopology(w,wall,dirt);
  for(const x of NORTH_SHAFTS)label(w,'地道 · 转线 ↓',x,3.3,26.2,2.5,.55);
  for(const x of SOUTH_SHAFTS)label(w,'地道 · 转线 ↓',x,.35,-40.2,2.5,.55);
  for(const x of CONFIG.map.entrances) {
    const ramp=w.box('earthen-ramp',x,-2.12,-20,4,.18,Math.hypot(14,4),dirt,false); ramp.rotation.x=-Math.atan2(4,14); ramp.metadata={solid:true};ramp.isPickable=true;
    w.box('ramp-bottom',x,-4.2,-29,4,.4,4,dirt);
    for(const side of [-1,1]) { w.box('stair-side',x+side*2.3,-1.7,-20,.6,4.6,14,dirt); w.box('entrance-post',x+side*2.25,1.2,-13,.2,2.4,.2,wood,false); }
    w.box('entrance-lintel',x,2.45,-13,4.8,.22,.4,wood,false);
    for(let i=0;i<18;i++) { const z=-13.4-i*.76; w.box('step-edge',x,(z+13)*4/14+.005,z,3.9,.04,.055,timber,false); }
    label(w,`地道入口  ↓`,x,2.05,-12.92,3.3,.65,'#cfbd91');
  }
  for(let x=-64;x<=64;x+=8) { for(const side of [-1,1]) w.box('tunnel-support',x,-2.88,-29+side*1.62,.18,2.24,.18,timber,false); w.box('tunnel-crossbeam',x,-1.78,-29,.2,.18,3.5,timber,false); if(x%16===0){const lamp=MeshBuilder.CreateSphere('oil-lamp',{diameter:.16,segments:6},w.scene);lamp.position.set(x,-2.35,-30.5);lamp.material=w.material('lamp','#efc47b');(lamp.material as any).emissiveColor=Color3.FromHexString('#b17b35');lamp.isPickable=false;w.lamps.push(lamp.position.clone());} }
  label(w,'西村',-72,3.1,2,3,1,'#ddcda4'); label(w,'东村',72,3.1,2,3,1,'#ddcda4');
  // Sparse trees and distant dry hills stay outside playable paths.
  for(let i=0;i<22;i++){const x=-83+rng()*166,z=(i%2?1:-1)*(37+rng()*5);w.box('tree-trunk',x,2+w.terrain.height(x,z),z,.35,4,.4,wood,false);const crown=MeshBuilder.CreateSphere('tree-crown',{diameter:4+rng()*2,segments:4},w.scene);crown.position.set(x,4.8+w.terrain.height(x,z),z);crown.scaling.y=.75;crown.material=w.material('leaves','#777f53');crown.isPickable=false;}
  for(let i=0;i<14;i++){const hill=MeshBuilder.CreateSphere('distant-hill',{diameter:35+rng()*40,segments:5},w.scene);hill.position.set(-180+i*28,-9,100+rng()*30);hill.scaling.y=.55;hill.material=w.material('hills','#929681');hill.isPickable=false;}
}
export function label(w: World,text:string,x:number,y:number,z:number,width=2,height=1,color='#e2d2b0') {
  const texture=new DynamicTexture('sign-'+text,{width:512,height:128},w.scene,false);const ctx=texture.getContext() as CanvasRenderingContext2D;ctx.fillStyle='#4f4838';ctx.fillRect(0,0,512,128);ctx.font='bold 52px Microsoft YaHei';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,256,83);texture.update();
  const mat=w.material('sign-'+text,'#ffffff');mat.diffuseTexture=texture;mat.emissiveColor=new Color3(.12,.12,.1);mat.backFaceCulling=false;
  const mesh=MeshBuilder.CreatePlane('sign-'+text,{width,height,sideOrientation:Mesh.DOUBLESIDE},w.scene);mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;mesh.material=mat;mesh.isPickable=false;return mesh;
}
