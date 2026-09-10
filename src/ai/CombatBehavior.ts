import {Vector3} from '@babylonjs/core';
import type {Bot} from './Bot';
import type {Actor} from '../game/types';
import type {CoverPoint} from '../map/CoverPoints';
export type CombatTactic='HOLD'|'PUSH'|'FLANK';
/** Local decisions at 2.5 Hz; movement only interpolates the cached goal each frame. */
export class CombatBehavior {
 tactic:CombatTactic='HOLD';decisionAt=0;tacticUntil=0;moveUntil=0;pauseUntil=0;blockedUntil=0;
 goal:Vector3|null=null;private path:Vector3[]=[];private pathIndex=0;private nextCoverAt=0;private relocate=false;
 decisions=0;localSearches=0;blockedShots=0;
 reset(){this.relocate=false;this.goal=null;this.path=[];this.pathIndex=0;this.decisionAt=this.tacticUntil=this.moveUntil=this.pauseUntil=this.blockedUntil=this.nextCoverAt=0;}
 blocked(time:number){this.blockedShots++;this.blockedUntil=time+1;this.decisionAt=0;this.relocate=true;}
 private route(bot:Bot,end:Vector3):Vector3[]{
  const graph=bot.world.tactical!;if(Vector3.DistanceSquared(bot.position,end)>20**2)return [];
  if(graph.walkableLink(bot.position,end))return [end];
  // Bounded traversal of existing local links; never calls strategic find/findSteps.
  this.localSearches++;const start=graph.nearest(bot.position),finish=graph.nearest(end);if(start<0||finish<0)return [];
  const queue=[start],parents=new Map<number,number>([[start,-1]]);let found=false;
  for(let i=0;i<queue.length&&i<320;i++){const id=queue[i];if(id===finish){found=true;break;}for(const edge of graph.edges[id]){const n=graph.nodes[edge.to];if(parents.has(n.id)||Vector3.DistanceSquared(n.position,bot.position)>20**2)continue;parents.set(n.id,id);queue.push(n.id);}}
  if(!found)return [];const result:Vector3[]=[end];for(let id=finish;id!==start;id=parents.get(id)!)result.unshift(graph.nodes[id].position);return result;
 }
 private choose(bot:Bot,enemy:Actor,time:number){
  if(time<this.nextCoverAt)return;this.nextCoverAt=time+1.2;
  const dx=enemy.position.x-bot.position.x,dz=enemy.position.z-bot.position.z,len=Math.hypot(dx,dz)||1;
  const candidates=bot.world.coverPoints.filter(p=> (p.reservedBy===null||p.reservedBy===bot.id)&&Math.abs(p.position.y-bot.position.y)<1.3&&Vector3.DistanceSquared(p.position,bot.position)<20**2&&Vector3.DistanceSquared(p.position,bot.position)>.7);
  const score=(p:CoverPoint)=>{const x=p.position.x-bot.position.x,z=p.position.z-bot.position.z,forward=(x*dx+z*dz)/len,side=Math.abs((x*dz-z*dx)/len);return x*x+z*z-(this.tactic==='PUSH'?forward*15:this.tactic==='FLANK'?side*17:0);};
  candidates.sort((a,b)=>score(a)-score(b));
  // Only three visibility/path candidates per decision; authored cover directions filter first.
  for(const p of candidates.slice(0,3)){
   const toward=enemy.position.subtract(p.position);if(Vector3.Dot(toward,p.facing)<0)continue;
   if(!bot.world.blocked(p.position.add(new Vector3(0,p.height==='crouch'?.85:1.35,0)),enemy.position.add(new Vector3(0,1.15,0))))continue;
   const path=this.route(bot,p.position);if(!path.length)continue;
   bot.cover=p;p.reservedBy=bot.id;bot.coverSince=time;bot.coverArrived=0;this.path=path;this.pathIndex=0;this.goal=null;return;
  }
 }
 update(bot:Bot,dt:number,time:number,enemy:Actor){
  if(this.relocate){this.relocate=false;bot.releaseCover();this.goal=null;this.path=[];this.pauseUntil=time;this.nextCoverAt=time+1.5;}
  if(bot.reloadUntil>0&&!bot.cover){this.goal=null;bot.crouching=true;bot.state='TakeCover';return;}
  if(time>=this.decisionAt){this.decisionAt=time+.4;this.decisions++;
   if(time>=this.tacticUntil&&bot.reloadUntil===0&&bot.ammo>0){bot.releaseCover();this.path=[];this.goal=null;this.tactic=(['HOLD','PUSH','FLANK'] as const)[(bot.id+Math.floor(time/7))%3];this.tacticUntil=time+6+Math.random()*2;}
   if(!bot.cover&&!bot.world.undergroundAt(bot.position.x,bot.position.y,bot.position.z))this.choose(bot,enemy,time);
   if(!bot.cover&&time>=this.pauseUntil&&!this.goal){
    const dx=enemy.position.x-bot.position.x,dz=enemy.position.z-bot.position.z,len=Math.hypot(dx,dz)||1,side=bot.id%2?1:-1;
    const distance=this.tactic==='FLANK'&&time>=this.blockedUntil?5:1.2;
    const goal=new Vector3(bot.position.x+dz/len*side*distance,bot.position.y,bot.position.z-dx/len*side*distance);goal.y=bot.world.floorAt(goal.x,goal.z,goal.y);
    const path=this.route(bot,goal);if(path.length){this.path=path;this.pathIndex=0;this.goal=goal;this.moveUntil=time+(distance>2?3:1.1);}this.pauseUntil=time+3.5;
   }
  }
  if(bot.cover){
   if(!bot.coverArrived){const next=this.path[this.pathIndex];if(next){bot.state='MoveToCover';bot.walkTo(next,dt,4.3);if(Vector3.DistanceSquared(next,bot.position)<.12)this.pathIndex++;}else{bot.coverArrived=time;this.pauseUntil=time+1;}return;}
   const reload=bot.ammo===0||bot.reloadUntil>0;
   const peek=!reload&&time>=bot.boltUntil&&(time-bot.coverArrived)%3.4>1.0;
   const goal=peek?bot.cover.peek:bot.cover.position;bot.state=peek?'Peek':'HoldCover';bot.crouching=!peek&&bot.cover.height==='crouch';
   if(Vector3.DistanceSquared(bot.position,goal)>.06)bot.walkTo(goal,dt,2);
   if(!reload&&this.tactic!=='HOLD'&&time-bot.coverArrived>3.4){bot.releaseCover();this.path=[];this.nextCoverAt=time;}
   return;
  }
  if(this.goal&&time<this.moveUntil){const next=this.path[this.pathIndex];if(next){bot.state=this.tactic==='FLANK'?'Flank':'Strafe';bot.walkTo(next,dt,2.6);if(Vector3.DistanceSquared(next,bot.position)<.1)this.pathIndex++;}else this.goal=null;}
  else{this.goal=null;bot.state=bot.ammo===0?'TakeCover':'EngageEnemy';bot.crouching=bot.ammo===0;}
 }
}
