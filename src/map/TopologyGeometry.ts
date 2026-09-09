import { Vector3,type StandardMaterial } from '@babylonjs/core';
import type { World } from './World';
import { GROUND_PORTALS,NORTH_SHAFTS,SOUTH_SHAFTS,northRampFloor,southRampFloor } from './Topology';
/** Physical barriers and ramps use the same portals as the tactical graph. */
export function buildTopology(w:World,wall:StandardMaterial,dirt:StandardMaterial){
  for(const gate of GROUND_PORTALS){
    for(const [a,b] of [[-90,gate.x-gate.width/2],[gate.x+gate.width/2,90]]){
      for(let x=a;x<b;x+=2){const end=Math.min(b,x+2),cx=(x+end)/2;
        const bottom=Math.min(w.terrain.height(x,gate.z),w.terrain.height(end,gate.z))-.12;
        const top=gate.z>0?3.55:1.8;
        w.box('lane-divider',cx,(top+bottom)/2,gate.z,end-x,top-bottom,.6,wall);
      }
    }
  }
  for(const x of NORTH_SHAFTS){
    w.box('north-tunnel-floor',x,-4.2,-11.3,2.4,.4,35.4,dirt);
    // Begin beyond the trunk north edge so the branch remains open at its T junction.
    for(const side of [-1,1])w.box('north-tunnel-side',x+side*1.5,-2.85,-10.4,.6,2.3,32.8,dirt);
    w.box('north-tunnel-roof',x,-1.5,-10.4,3.6,.4,32.8,dirt);
    w.box('branch-turn',x-.65,-2.85,-17,1.35,2.3,.6,dirt);
    w.box('branch-turn',x+.65,-2.85,-5,1.35,2.3,.6,dirt);
    for(const z of [-21,-9,3]){w.box('branch-oil-lamp',x+.95,-2.5,z,.13,.2,.13,w.material('lamp','#efc47b'),false);w.lamps.push(new Vector3(x+.95,-2.5,z));}
    ramp(x,6,26,northRampFloor,19,true);
  }
  for(const x of SOUTH_SHAFTS){if(x!==20){w.box('south-branch-floor',x,-4.2,-31.5,2.4,.4,5,dirt);for(const side of [-1,1])w.box('south-branch-wall',x+side*1.5,-2.85,-32.1,.6,2.3,3.8,dirt);w.box('south-branch-roof',x,-1.5,-32.1,3.6,.4,3.8,dirt);}ramp(x,-34,-40,southRampFloor,-35,false);}
  function ramp(x:number,start:number,end:number,floor:(z:number)=>number,opening:number,north:boolean){
    const rise=floor(end)-floor(start),length=Math.abs(end-start);
    const mesh=w.box('branch-earth-ramp',x,(floor(start)+floor(end))/2-.1,(start+end)/2,2.4,.18,Math.hypot(length,rise),dirt,false);
    mesh.rotation.x=(north?-1:1)*Math.atan2(rise,length);mesh.metadata={solid:true};mesh.isPickable=true;
    for(let i=0;i<length;i++){
      const z=start+(north?1:-1)*(i+.5),y=floor(z);
      for(const side of [-1,1])w.box('branch-ramp-side',x+side*1.5,y+1.15,z,.6,2.3,1,dirt);
      if(north?z<opening:z>opening){
        const ceiling=Math.min(y+2.3,w.terrain.height(x,z)-.05);
        w.box('branch-ramp-roof',x,ceiling+.02,z,2.4,.04,1,dirt);
      }
    }
  }
}
