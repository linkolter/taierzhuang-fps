import { Vector3 } from '@babylonjs/core';
import { CONFIG, type Team } from '../config/gameConfig';
import type { Actor, Objective } from '../game/types';
import { World } from '../map/World';
import { SoldierModel } from './SoldierModel';
import type { CoverPoint } from '../map/CoverPoints';
export type AIState = 'Spawn' | 'MoveToObjective' | 'SearchEnemy' | 'EngageEnemy' | 'TakeCover' | 'Capture' | 'Melee' | 'Dead' | 'Respawn'|'MoveToCover'|'HoldCover'|'Peek'|'Advance'|'Fallback'|'TraverseTunnel';
export type Route = 'main' | 'north' | 'south' | 'tunnel';
export class Bot implements Actor {
  health: number = CONFIG.player.health; alive = true; position = new Vector3(); respawnAt = 0; protection = 0;
  state: AIState = 'Spawn'; model: SoldierModel; route: Route; target: Actor | null = null;
  path: Vector3[] = []; pathIndex = 0; think = 0; nextShot = 0; ammo: number = CONFIG.rifle.capacity; reloadUntil = 0; deadAt = -1; shot = 0; objective = ''; replanAt = 0; moving = false; stuck = 0;
  crouching=false;cover:CoverPoint|null=null;coverPath:Vector3[]=[];coverIndex=0;coverSince=0;coverArrived=0;coverCheckAt=0;lastSeen=-100;engagedSince=-100;roster:Actor[]=[];births=0;dirty=true;recoveries=0;private coverGoal=new Vector3();
  onFire = (_bot: Bot, _target: Actor, _melee: boolean) => {};
  routeAnchor:Vector3|null=null;anchorVisited=false;
  constructor(public id: number, public team: Team, public world: World) {
    const routes: Route[] = ['main', 'north', 'main', 'south', 'tunnel', 'north', 'main', 'south']; this.route = routes[(id - 1) % 8];
    this.model = new SoldierModel(world.scene, world, team, id); this.respawn(0);
  }
  respawn(time: number) { this.routeAnchor=null;this.anchorVisited=false;this.releaseCover();this.births++;this.dirty=true;this.crouching=false;this.lastSeen=-100;this.engagedSince=-100;this.coverCheckAt=0;this.stuck=0;this.think=this.id*.012;this.position.set(this.team === 'cn' ? -82 : 82, 0, ((this.id % 4) - 1.5) * 1.1); this.health = CONFIG.player.health; this.alive = true; this.state = 'Spawn'; this.target = null; this.path = []; this.pathIndex = 0; this.ammo = CONFIG.rifle.capacity; this.protection = CONFIG.match.spawnProtection; this.nextShot = time + 2; this.reloadUntil = 0; this.replanAt = 0; this.deadAt = -1; this.model.root.setEnabled(true); }
  releaseCover(){if(this.cover?.reservedBy===this.id)this.cover.reservedBy=null;this.cover=null;this.coverPath.length=0;this.coverArrived=0;}
  requestReplan(time:number){this.dirty=true;this.replanAt=time+this.id*.07;}
  chooseRoute(){if(this.world.undergroundAt(this.position.x,this.position.y,this.position.z))return;const routes:Route[]=['main','north','south','tunnel'];const preference:Route[]=['main','north','main','south','tunnel','north','main','south'];const preferred=preference[(this.id+Math.max(0,this.births-1)*3-1)%8];let best:Route=preferred,bestScore=Infinity;
    const bPressure=this.roster.filter(a=>a.alive&&a.team!==this.team&&Math.hypot(a.position.x,a.position.z)<15).length;const highThreat=this.roster.filter(a=>a.alive&&a.team!==this.team&&a.position.y>1.5&&a.position.z>16).length;
    for(const route of routes){const count=this.roster.filter(a=>a instanceof Bot&&a.id!==this.id&&a.team===this.team&&a.alive&&a.route===route).length;let score=count*CONFIG.ai.routeCrowding+(route===preferred?-14:0)+Math.random()*10;if(route==='tunnel')score+=count*9+4;if(bPressure>=2&&(route==='south'||route==='tunnel'))score-=15;if(highThreat>0&&route==='north'&&count<2)score-=16;if(score<bestScore){bestScore=score;best=route;}}this.route=best;
  }
  plan(objectives: Objective[], time: number) {
    if(!this.routeAnchor)this.chooseRoute();this.dirty=false;
    const sorted = [...objectives].sort((a, b) => this.score(a) - this.score(b)); const obj = sorted[0]; if (!obj) return; this.objective = obj.id;
    const z = this.route === 'north' ? 22 : this.route === 'south' ? -19 : 0;
    const end=new Vector3(obj.x + (this.id % 3 - 1) * 2, obj.y??0, obj.z + (this.id % 2 ? 2 : -2));
    // One authored staging point ensures a lane preference actually visits that lane.
    // Replanning retains this point until reached; the existing objective/combat FSM continues normally.
    if(!this.anchorVisited&&!this.routeAnchor&&(this.route==='north'||this.route==='south')){const c=CONFIG.tactics,x=(this.team==='cn'?-1:1)*(this.route==='north'?c.northAnchorX:c.southAnchorX),zz=this.route==='north'?c.northAnchorZ:c.southAnchorZ;this.routeAnchor=new Vector3(x,this.world.terrain.height(x,zz),zz);}
    if(this.routeAnchor){const first=this.world.route(this.position,this.routeAnchor,this.route,z),last=this.world.route(this.routeAnchor,end,this.route,z);this.path=first.length&&last.length?[...first,...last]:[];if(!this.path.length){this.routeAnchor=null;this.anchorVisited=true;}}
    if(!this.routeAnchor)this.path=this.world.route(this.position,end,this.route,z);
    this.pathIndex = 0; this.replanAt = time + 12 + this.id % 5; this.state = 'MoveToObjective';
  }
  score(o: Objective) { const danger=this.roster.filter(a=>a.alive&&a.team!==this.team&&Math.hypot(a.position.x-o.x,a.position.z-o.z)<10).length;return Math.hypot(o.x - this.position.x, o.z - this.position.z) + (o.owner === this.team ? danger>0?-35:65 : o.owner ? -10 : 0) + ((this.id * (o.id.charCodeAt(0) + 3)) % 23)+(this.route==='tunnel'&&o.id===(this.team==='cn'?'C':'A')?-32:0); }
  update(dt: number, time: number, actors: Actor[], objectives: Objective[], visible: (a: Actor, b: Actor) => boolean) {
    if(this.routeAnchor&&Vector3.Distance(this.position,this.routeAnchor)<CONFIG.tactics.anchorRadius){this.routeAnchor=null;this.anchorVisited=true;}
    this.roster=actors;this.moving = false;this.crouching=false; this.shot = Math.max(0, this.shot - dt * 2.8); this.protection = Math.max(0, this.protection - dt);
    if (!this.alive) {this.releaseCover(); this.state = 'Dead'; this.model.update(time, false, false, false, 0, time - this.deadAt); return; }
    if(this.reloadUntil>0&&time>=this.reloadUntil){this.ammo=CONFIG.rifle.capacity;this.reloadUntil=0;}
    this.think -= dt;
    if (this.think <= 0) {
      if(this.dirty)this.plan(objectives,time);
      this.think = CONFIG.ai.thinkInterval + this.id * .003; let closest: number = CONFIG.ai.sight; this.target = null;
      for (const a of actors) { if (a.team === this.team || !a.alive || a.protection > 0) continue; const d = Vector3.Distance(a.position, this.position); if (d < closest && visible(this, a)) { this.target = a; closest = d; } }
      if(this.target){if(time-this.lastSeen>CONFIG.ai.lostSightWait){this.engagedSince=time;this.nextShot=Math.max(this.nextShot,time+CONFIG.ai.aimDelay+Math.random()*.4);}this.lastSeen=time;}
    }
    if (this.target?.alive) {
      const dx=this.target.position.x-this.position.x,dz=this.target.position.z-this.position.z,distance=Vector3.Distance(this.target.position,this.position);this.model.root.rotation.y=Math.atan2(dx,dz);
      const melee = distance < CONFIG.ai.meleeDistance; this.state = melee ? 'Melee' : 'EngageEnemy';
      if (this.ammo <= 0 && this.reloadUntil === 0) { this.reloadUntil = time + CONFIG.rifle.reload; this.state = 'TakeCover'; }
      if (this.reloadUntil > 0) { this.state = 'TakeCover'; if (time >= this.reloadUntil) { this.ammo = CONFIG.rifle.capacity; this.reloadUntil = 0; } }
      if(!melee)this.combatMove(dt,time,this.target);else this.releaseCover();
      if (time >= this.nextShot && (melee || this.reloadUntil === 0) && !this.crouching && (this.state as AIState)!=='MoveToCover' && visible(this, this.target)) {
        this.onFire(this, this.target, melee); this.shot = 1; if (!melee) this.ammo--; this.nextShot = time + (melee ? CONFIG.melee[this.team].cycle : Math.max(CONFIG.rifle.cycle, CONFIG.ai.fireInterval) + Math.random() * 1.5);
      }
      if (melee && distance > 1.65) this.walkTo(this.target.position, dt, 2);
      else if(melee)this.state='Melee';
    } else {
      this.target = null;
      if(time-this.lastSeen<CONFIG.ai.lostSightWait){this.state='SearchEnemy';this.crouching=!!this.cover;this.syncModel(time);return;}
      this.releaseCover();if (time >= this.replanAt) this.plan(objectives, time);
      const goal = this.path[this.pathIndex];
      if (goal) { this.state = this.world.undergroundAt(this.position.x,this.position.y,this.position.z) ? 'TraverseTunnel':'MoveToObjective';this.followObjective(dt); }
      else { this.state = 'Capture'; if (!objectives.some(o => o.id === this.objective && o.owner !== this.team)) this.replanAt = Math.min(this.replanAt, time + 1); }
    }
    this.syncModel(time);
  }
  followObjective(dt:number,speed:number=CONFIG.ai.speed){const goal=this.path[this.pathIndex];if(!goal)return;this.walkTo(goal,dt,this.world.undergroundAt(this.position.x,this.position.y,this.position.z)?CONFIG.ai.tunnelSpeed:speed);if(Vector3.Distance(this.position,goal)<(this.world.undergroundAt(this.position.x,this.position.y,this.position.z)?.22:.38))this.pathIndex++;}
  syncModel(time:number){this.position.y=this.world.floorAt(this.position.x,this.position.z,this.position.y);this.model.root.position.copyFrom(this.position);this.model.root.scaling.y=this.crouching?.72:1;this.model.update(time+this.id,this.moving,!!this.target,this.state==='Melee',this.shot,-1);}
  combatMove(dt:number,time:number,enemy:Actor){
    const phase=(time-this.engagedSince)%11;
    if(this.cover&&time-this.coverSince>CONFIG.ai.advanceAfter){this.releaseCover();this.coverCheckAt=time+5;}
    if(!this.cover&&time>=this.coverCheckAt&&!this.world.undergroundAt(this.position.x,this.position.y,this.position.z)){this.coverCheckAt=time+2;const point=this.world.chooseCover(this.position,enemy.position,this.id);if(point){const path=this.world.tactical!.find(this.position,point.position,this.route);if(path.length){this.cover=point;point.reservedBy=this.id;this.coverPath=path;this.coverIndex=0;this.coverSince=time;}}}
    if(this.cover){
      if(!this.coverArrived){const goal=this.coverPath[this.coverIndex];if(goal){this.state='MoveToCover';this.walkTo(goal,dt,CONFIG.ai.sprint);if(Vector3.Distance(goal,this.position)<.3)this.coverIndex++;}else this.coverArrived=time;return;}
      const peek=(time-this.coverArrived)%(CONFIG.ai.holdCover+CONFIG.ai.peekSeconds)>CONFIG.ai.holdCover;
      const goal=peek?this.cover.peek:this.cover.position;this.state=peek?'Peek':'HoldCover';if(Vector3.Distance(this.position,goal)>.25)this.walkTo(goal,dt,2.3);this.crouching=!peek&&this.cover.height==='crouch';return;
    }
    if(this.health<=25&&phase<1.3){this.state='Fallback';const dx=this.position.x-enemy.position.x,dz=this.position.z-enemy.position.z,len=Math.hypot(dx,dz)||1;this.coverGoal.set(this.position.x+dx/len*2,this.position.y,this.position.z+dz/len*2);this.walkTo(this.coverGoal,dt,2.6);return;}
    if(phase>CONFIG.ai.advanceAfter){this.state='Advance';this.followObjective(dt,CONFIG.ai.sprint);}
    else if(phase>3&&phase<5&&!this.world.undergroundAt(this.position.x,this.position.y,this.position.z)){this.state='Peek';const dx=enemy.position.x-this.position.x,dz=enemy.position.z-this.position.z,len=Math.hypot(dx,dz)||1,side=this.id%2?1:-1;this.coverGoal.set(this.position.x+dz/len*side,this.position.y,this.position.z-dx/len*side);this.walkTo(this.coverGoal,dt,1.15);}
    else this.state='EngageEnemy';
  }
  walkTo(goal: Vector3, dt: number, speed: number) { const dx=goal.x-this.position.x,dz=goal.z-this.position.z,length=Math.hypot(dx,dz);if(length<.1)return;const x=this.position.x,z=this.position.z;this.world.move(this.position,dx/length*Math.min(length,speed*dt),dz/length*Math.min(length,speed*dt));this.moving=Math.hypot(this.position.x-x,this.position.z-z)>.00001;if(!this.target)this.model.root.rotation.y=Math.atan2(dx,dz);this.stuck=this.moving?0:this.stuck+dt;if(this.stuck>1.5){this.recoveries++;this.releaseCover();this.dirty=true;this.replanAt=0;this.stuck=0;} }
}


