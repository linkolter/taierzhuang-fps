import { Color3, Mesh, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import type { World } from '../map/World';
import { label } from '../map/Village';
import type { CaptureSystem } from './CaptureSystem';
export class CaptureVisuals {
  colors={cn:Color3.FromHexString(CONFIG.colors.cn),jp:Color3.FromHexString(CONFIG.colors.jp),neutral:Color3.FromHexString(CONFIG.colors.neutral)};
  flags:{mesh:Mesh;mat:StandardMaterial}[]=[];
  constructor(world:World,public capture:CaptureSystem){for(const p of capture.points){const mat=world.material('capture-'+p.id,CONFIG.colors.neutral);const ring=MeshBuilder.CreateTorus('capture-boundary-'+p.id,{diameter:CONFIG.match.captureRadius*2,thickness:.055,tessellation:48},world.scene);ring.position.set(p.x,(p.y??0)+.04,p.z);ring.material=mat;ring.isPickable=false;
    world.box('flagpole',p.x+3,(p.y??0)+2.5,p.z+3,.08,5,.08,world.material('wood','#65503b'),false);
    const flag=world.box('cloth-banner',p.x+3.65,(p.y??0)+4.25,p.z+3,1.3,.8,.035,mat,false);this.flags.push({mesh:flag,mat});label(world,p.id+' · '+p.name,p.x+3,(p.y??0)+3.3,p.z+3.1,2.5,.65);
  }}
  update(time:number){this.flags.forEach((f,i)=>{const p=this.capture.points[i];f.mat.diffuseColor.copyFrom(this.colors[p.owner??'neutral']);f.mesh.rotation.y=Math.sin(time*2+i)*.06;f.mesh.position.y=(p.y??0)+3.5+Math.abs(p.progress)*.75;});}
}
