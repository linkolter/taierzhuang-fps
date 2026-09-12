import { Vector3 } from '@babylonjs/core';
import type { Team } from '../config/gameConfig';
import type { Actor } from './types';
import type { CaptureSystem } from '../capture/CaptureSystem';
import type { World } from '../map/World';

export const SPAWN_OFFSETS:Record<string,readonly (readonly [number,number])[]> = {
  A:[[-8,0],[8,0],[0,6],[-6,-4],[6,4]],
  B:[[-8,-2],[8,0],[0,6],[-6,-6],[8,6]],
  C:[[-8,0],[8,0],[0,6],[-6,-4],[6,4]],
};
export interface SpawnAnchor { id:string; point:string; position:Vector3 }
export interface SpawnCandidate { id:string; available:boolean; reason:string; anchor:SpawnAnchor|null }
/** Base courts are a rule volume, not additional map collision. */
export function inBase(position:Vector3, team:Team) {
  return Math.abs(position.x-(team==='cn'?-82:82))<8 && Math.abs(position.z)<5 && Math.abs(position.y)<2;
}
export class SpawnSystem {
  anchors:SpawnAnchor[]=[];
  constructor(private world:World,private capture:CaptureSystem,private actors:Actor[]) {
    for(const p of capture.points) SPAWN_OFFSETS[p.id].forEach(([dx,dz],i)=>{
      const x=p.x+dx,z=p.z+dz;
      this.anchors.push({id:`${p.id}_${['WEST','EAST','REAR','SIDE','FLANK'][i]}`,point:p.id,position:new Vector3(x,world.terrain.height(x,z),z)});
    });
    for(const z of [-3,0,3])this.anchors.push({id:`BASE_${z}`,point:'BASE',position:new Vector3(-82,world.terrain.height(-82,z),z)});
  }
  evaluate(id:string,team:Team='cn'):SpawnCandidate {
    const point=this.capture.points.find(p=>p.id===id);
    const result=(reason:string,anchor:SpawnAnchor|null=null):SpawnCandidate=>({id,reason,anchor,available:!!anchor});
    if(id!=='BASE') {
      if(!point)return result('未知出生点');
      if(point.contested)return result('正在争夺');
      if(point.owner!==team)return result(point.owner?'敌方控制':'尚未控制');
      if(Math.abs(point.progress)<.999)return result('尚未完全控制');
    }
    let best:SpawnAnchor|null=null,bestScore=-Infinity;
    for(const a of this.anchors.filter(a=>a.point===id)) {
      const p=a.position;
      if(!this.world.canStand(p.x,p.y,p.z)||this.world.inRamp(p.x,p.z))continue;
      if(this.actors.some(b=>b.alive&&Vector3.DistanceSquared(b.position,p)<1))continue;
      if(this.capture.points.some(o=>o.owner&&o.owner!==team&&Math.abs(p.y-(o.y??0))<1.1&&Math.hypot(p.x-o.x,p.z-o.z)<7))continue;
      let nearest=160,exposed=false;
      for(const enemy of this.actors)if(enemy.alive&&enemy.team!==team){
        const d=Vector3.Distance(enemy.position,p);nearest=Math.min(nearest,d);
        if(d<55&&!this.world.blocked(enemy.position.add(new Vector3(0,1.4,0)),p.add(new Vector3(0,1.2,0))))exposed=true;
      }
      if(id!=='BASE'&&(nearest<13||exposed))continue;
      const score=nearest-(exposed?80:0);
      if(score>bestScore){bestScore=score;best=a;}
    }
    return best?result('可部署',best):result('出生点受压制');
  }
  candidates(){return ['BASE','A','B','C'].map(id=>this.evaluate(id));}
}
