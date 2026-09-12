import {CombatBehavior} from './CombatBehavior';
import type {StrategicRole} from './StrategicDirector';
import {inBase} from '../game/SpawnSystem';
import {rampAt} from '../map/Topology';
import {BOLT_EVENTS,RELOAD_EVENTS} from '../weapons/BoltTimeline';
import { Vector3 } from '@babylonjs/core';
import { CONFIG, type Team } from '../config/gameConfig';
import type { Actor, Objective } from '../game/types';
import { World } from '../map/World';
import { SoldierModel } from './SoldierModel';
import type { PlanningPriority } from './RoutePlanningScheduler';
import type { CoverPoint } from '../map/CoverPoints';
export type AIState = 'Spawn' | 'MoveToObjective' | 'SearchEnemy' | 'EngageEnemy' | 'TakeCover' | 'Capture' | 'Melee' | 'Dead' | 'Respawn'|'MoveToCover'|'HoldCover'|'Peek'|'Advance'|'Fallback'|'TraverseTunnel'|'Flank'|'Strafe';
export type Route = 'main' | 'north' | 'south' | 'tunnel';
export class Bot implements Actor {
  health: number = CONFIG.player.health; alive = true; position = new Vector3(); respawnAt = 0; protection = 0;
  state: AIState = 'Spawn'; model: SoldierModel; route: Route; target: Actor | null = null;
  path: Vector3[] = []; pathIndex = 0; think = 0; nextShot = 0; ammo: number = CONFIG.rifle.capacity; reloadUntil = 0; deadAt = -1; shot = 0; objective = ''; replanAt = 0; moving = false; stuck = 0;
  crouching=false;cover:CoverPoint|null=null;coverPath:Vector3[]=[];coverIndex=0;coverSince=0;coverArrived=0;coverCheckAt=0;lastSeen=-100;engagedSince=-100;roster:Actor[]=[];births=0;dirty=true;recoveries=0;combat=new CombatBehavior();preciseAgainstPlayer=false;reactionUntil=0;boltUntil=0;private boltEvent=0;private damagedAt=-100;private emptySince=0;private fireCheckAt=0;private knownTarget=-1;
  private stepDistance=0;private planPriority:PlanningPriority=1;private currentTime=0;
  private get planKey(){return `objective:${this.id}`;}
  private get coverKey(){return `cover:${this.id}`;}
  canFire=(_bot:Bot,_target:Actor)=>true;onSound=(_name:string,_position:Vector3)=>{};
  onFire = (_bot: Bot, _target: Actor, _melee: boolean) => {};
  routeAnchor:Vector3|null=null;anchorVisited=false;
  strategicObjective='';strategicRole:StrategicRole='ATTACK';
  private reloadEvent=0;
  constructor(public id: number, public team: Team, public world: World) {
    const routes: Route[] = ['main', 'north', 'main', 'south', 'tunnel', 'north', 'main', 'south']; this.route = routes[(id - 1) % 8];
    this.model = new SoldierModel(world.scene, world, team, id); this.respawn(0);
  }
  respawn(time: number) { this.combat.reset();this.boltUntil=0;this.boltEvent=0;this.reactionUntil=0;this.knownTarget=-1;this.emptySince=0;this.fireCheckAt=0;this.stepDistance=0; this.world.routePlanner.cancel(this.planKey);this.currentTime=time;this.planPriority=1; this.routeAnchor=null;this.anchorVisited=false;this.releaseCover();this.births++;this.dirty=true;this.crouching=false;this.lastSeen=-100;this.engagedSince=-100;this.coverCheckAt=0;this.stuck=0;this.think=this.id*.012;this.position.set(this.team === 'cn' ? -82 : 82, 0, ((this.id % 4) - 1.5) * 1.1); this.health = CONFIG.player.health; this.alive = true; this.state = 'Spawn'; this.target = null; this.path = []; this.pathIndex = 0; this.ammo = CONFIG.rifle.capacity; this.protection = CONFIG.match.spawnProtection; this.nextShot = time + 2; this.reloadUntil = 0; this.replanAt = time; this.deadAt = -1; this.model.root.setEnabled(true); }
  releaseCover(){this.world.routePlanner.cancel(this.coverKey);if(this.cover?.reservedBy===this.id)this.cover.reservedBy=null;this.cover=null;this.coverPath.length=0;this.coverArrived=0;}
  requestReplan(time:number,priority:PlanningPriority=2){
    this.world.routePlanner.cancel(this.planKey);this.dirty=true;this.planPriority=priority;this.replanAt=time;
  }
  queuePlan(objectives:Objective[]){
    if(!this.world.routePlanner.has(this.planKey))this.world.routePlanner.enqueue(this.planKey,this.planPriority,()=>this.plan(objectives));
  }
  chooseRoute(){if(this.world.undergroundAt(this.position.x,this.position.y,this.position.z))return;const routes:Route[]=['main','north','south','tunnel'];const preference:Route[]=['main','north','main','south','tunnel','north','main','south'];const preferred=preference[(this.id+Math.max(0,this.births-1)*3-1)%8];let best:Route=preferred,bestScore=Infinity;
    const bPressure=this.roster.filter(a=>a.alive&&a.team!==this.team&&Math.hypot(a.position.x,a.position.z)<15).length;const highThreat=this.roster.filter(a=>a.alive&&a.team!==this.team&&a.position.y>1.5&&a.position.z>16).length;
    for(const route of routes){const count=this.roster.filter(a=>a instanceof Bot&&a.id!==this.id&&a.team===this.team&&a.alive&&a.route===route).length;let score=count*CONFIG.ai.routeCrowding+(route===preferred?-14:0)+Math.random()*10;if(route==='tunnel')score+=count*9+4;if(this.strategicRole==='FLANK'&&route==='main')score+=25;if(bPressure>=2&&(route==='south'||route==='tunnel'))score-=15;if(highThreat>0&&route==='north'&&count<2)score-=16;if(score<bestScore){bestScore=score;best=route;}}this.route=best;
  }
  private *plan(objectives: Objective[]):Generator<void,void,void> {

    if(!this.routeAnchor)this.chooseRoute();this.dirty=false;
    const sorted = [...objectives].sort((a, b) => this.score(a) - this.score(b)); const obj = objectives.find(o=>o.id===this.strategicObjective)??sorted[0]; if (!obj) return; this.objective = obj.id;
    const offsets=[[0,0],[2,2],[-2,2],[2,-2],[-2,-2],[4,0],[-4,0],[0,4],[0,-4]];
    const goals=offsets.map(([x,z])=>new Vector3(obj.x+x,obj.y??0,obj.z+z)).filter(p=>!rampAt(p.x,p.z)&&this.world.canStand(p.x,p.y,p.z)&&Math.abs(this.world.floorAt(p.x,p.z,p.y)-p.y)<.15);
    const end=goals[this.id%goals.length];if(!end){this.replanAt=this.currentTime+2;return;}
    // One authored staging point ensures a lane preference actually visits that lane.
    // Replanning retains this point until reached; the existing objective/combat FSM continues normally.
    if(!this.anchorVisited&&!this.routeAnchor&&(this.route==='north'||this.route==='south')){const c=CONFIG.tactics,x=(this.team==='cn'?-1:1)*(this.route==='north'?c.northAnchorX:c.southAnchorX),zz=this.route==='north'?c.northAnchorZ:c.southAnchorZ;this.routeAnchor=new Vector3(x,this.world.terrain.height(x,zz),zz);}
    if(this.routeAnchor){const first=(yield* this.world.tactical!.findSteps(this.position.clone(),this.routeAnchor,this.route)),last=(yield* this.world.tactical!.findSteps(this.routeAnchor,end,this.route));this.path=first.length&&last.length?[...first,...last]:[];if(!this.path.length){this.routeAnchor=null;this.anchorVisited=true;this.replanAt=this.currentTime+.1;return;}}
    if(!this.routeAnchor)this.path=(yield* this.world.tactical!.findSteps(this.position.clone(),end,this.route));
    this.planPriority=2;this.pathIndex = 0; this.replanAt = this.currentTime + 12 + this.id % 5; this.state = 'MoveToObjective';
  }
  score(o: Objective) { const danger=this.roster.filter(a=>a.alive&&a.team!==this.team&&Math.hypot(a.position.x-o.x,a.position.z-o.z)<10).length;return Math.hypot(o.x - this.position.x, o.z - this.position.z) + (o.owner === this.team ? danger>0?-35:65 : o.owner ? -10 : 0) + ((this.id * (o.id.charCodeAt(0) + 3)) % 23)+(this.route==='tunnel'&&o.id===(this.team==='cn'?'C':'A')?-32:0); }
  update(dt: number, time: number, actors: Actor[], objectives: Objective[], visible: (a: Actor, b: Actor) => boolean) {
    this.currentTime=time;
    if(!this.world.routePlanner.has(this.planKey)&&this.routeAnchor&&Vector3.Distance(this.position,this.routeAnchor)<CONFIG.tactics.anchorRadius){this.routeAnchor=null;this.anchorVisited=true;}
    this.roster=actors;this.moving = false;this.crouching=false; this.shot = Math.max(0, this.shot - dt * 2.8); this.protection = Math.max(0, this.protection - dt);
    if (!this.alive) {this.world.routePlanner.cancel(this.planKey);this.releaseCover(); this.state = 'Dead'; this.model.update(time, false, false, false, 0, time - this.deadAt); return; }
    if(this.reloadUntil>0){const phase=1-(this.reloadUntil-time)/CONFIG.rifle.reload;while(this.reloadEvent<RELOAD_EVENTS.length&&phase>=RELOAD_EVENTS[this.reloadEvent].at)this.onSound(RELOAD_EVENTS[this.reloadEvent++].sound,this.position);if(time>=this.reloadUntil){this.ammo=CONFIG.rifle.capacity;this.reloadUntil=0;this.emptySince=0;}}
    if(this.dirty&&time>=this.replanAt)this.queuePlan(objectives);
    if(this.boltUntil>0){const phase=1-(this.boltUntil-time)/CONFIG.rifle.cycle;while(this.boltEvent<BOLT_EVENTS.length&&phase>=BOLT_EVENTS[this.boltEvent].at)this.onSound(BOLT_EVENTS[this.boltEvent++].sound,this.position);if(time>=this.boltUntil)this.boltUntil=0;}
    this.think -= dt;
    if (this.think <= 0) {

      const previousTarget=this.target;
      this.think = CONFIG.ai.thinkInterval + this.id * .003; let closest: number = Infinity; this.target = null;
      const strategic=objectives.find(o=>o.id===this.strategicObjective);
      for (const a of actors) { if (a.team === this.team || !a.alive || a.protection > 0 || inBase(a.position,a.team)) continue; const d = Vector3.Distance(a.position, this.position);
        if(strategic&&d>18&&Math.hypot(a.position.x-strategic.x,a.position.z-strategic.z)>16)continue;
        const score=d*(a.id===0&&!this.preciseAgainstPlayer?1.9:1);if (d<CONFIG.ai.sight&&score<closest&&this.inView(a)&&visible(this,a)){this.target=a;closest=score;} }
      if(this.target){if(this.knownTarget!==this.target.id||time-this.lastSeen>CONFIG.ai.lostSightWait){this.engagedSince=time;const attacked=time-this.damagedAt<1;this.reactionUntil=time+(attacked?.2:time-this.lastSeen<3?.3:.5)+Math.random()*(attacked?.2:time-this.lastSeen<3?.2:.3);this.nextShot=Math.max(this.nextShot,this.reactionUntil);this.knownTarget=this.target.id;}this.lastSeen=time;}else if(previousTarget?.alive&&time-this.lastSeen<CONFIG.ai.lostSightWait)this.target=previousTarget;
    }
    if (this.target?.alive) {
      const dx=this.target.position.x-this.position.x,dz=this.target.position.z-this.position.z,distance=Vector3.Distance(this.target.position,this.position);this.model.root.rotation.y=Math.atan2(dx,dz);
      const melee=distance<CONFIG.ai.meleeDistance&&(this.ammo===0||this.health<50||distance<1.8);this.state=melee?'Melee':'EngageEnemy';
      if(!melee)this.combatMove(dt,time,this.target);else this.releaseCover();
      if(this.ammo===0&&!this.emptySince)this.emptySince=time;
      if(this.ammo===0&&this.reloadUntil===0&&!melee&&time>=this.boltUntil){
        const safe=this.cover?this.coverArrived>0&&Vector3.DistanceSquared(this.position,this.cover.position)<.18:time-this.emptySince>2&&!this.moving;
        if(safe){this.reloadEvent=0;this.reloadUntil=time+CONFIG.rifle.reload;this.onSound('reload',this.position);}
      }
      const ready=time>=this.nextShot&&time>=this.reactionUntil&&time>=this.boltUntil&&(melee||this.ammo>0&&this.reloadUntil===0);
      if(ready&&!this.crouching&&(!this.moving||melee)&&time>=this.fireCheckAt){
        this.fireCheckAt=time+.15;
        if(visible(this,this.target)){
          if(melee||this.canFire(this,this.target)){
            this.onFire(this,this.target,melee);this.shot=1;
            if(!melee){this.ammo--;this.boltUntil=time+CONFIG.rifle.cycle;this.boltEvent=0;}
            const pressure=this.target.id===0&&!this.preciseAgainstPlayer;
            this.nextShot=time+(melee?CONFIG.melee[this.team].cycle:Math.max(CONFIG.rifle.cycle+.35,CONFIG.ai.fireInterval)+Math.random()*1.2+(pressure?1.8:0));
          }else{this.combat.blocked(time);this.nextShot=time+.3;}
        }
      }
      if (melee && distance > 1.65) this.walkTo(this.target.position, dt, 2);
      else if(melee)this.state='Melee';
    } else {
      this.target = null;
      if(time-this.lastSeen<CONFIG.ai.lostSightWait){this.state='SearchEnemy';this.crouching=!!this.cover;this.syncModel(time);return;}
      this.releaseCover();this.combat.reset();if(this.ammo===0&&this.reloadUntil===0&&time>=this.boltUntil){this.reloadEvent=0;this.reloadUntil=time+CONFIG.rifle.reload;this.onSound('reload',this.position);}if (time >= this.replanAt) this.queuePlan(objectives);
      const goal = this.path[this.pathIndex];
      if (goal) { this.state = this.world.undergroundAt(this.position.x,this.position.y,this.position.z) ? 'TraverseTunnel':'MoveToObjective';this.followObjective(dt); }
      else { this.state = 'Capture'; if (!objectives.some(o => o.id === this.objective && o.owner !== this.team)) this.replanAt = Math.min(this.replanAt, time + 1); }
    }
    this.syncModel(time);
  }
  inView(actor:Actor){const dx=actor.position.x-this.position.x,dz=actor.position.z-this.position.z;
    if(dx*dx+dz*dz<CONFIG.ai.meleeDistance**2)return true;
    return dx*Math.sin(this.model.root.rotation.y)+dz*Math.cos(this.model.root.rotation.y)>=0;
  }
  followObjective(dt:number,speed:number=CONFIG.ai.speed){const goal=this.path[this.pathIndex];if(!goal||this.world.routePlanner.has(this.planKey))return;this.walkTo(goal,dt,this.world.undergroundAt(this.position.x,this.position.y,this.position.z)?CONFIG.ai.tunnelSpeed:speed);if(Vector3.Distance(this.position,goal)<(this.world.undergroundAt(this.position.x,this.position.y,this.position.z)?.22:.38))this.pathIndex++;}
  syncModel(time:number){this.position.y=this.world.floorAt(this.position.x,this.position.z,this.position.y);this.model.root.position.copyFrom(this.position);this.model.root.scaling.y=this.crouching?.72:1;this.model.update(time+this.id,this.moving,!!this.target,this.state==='Melee',this.shot,-1,this.boltUntil>0?1-(this.boltUntil-time)/CONFIG.rifle.cycle:0,this.reloadUntil>0);}
  damaged(time:number){this.damagedAt=time;this.reactionUntil=Math.max(this.reactionUntil,time+.2+Math.random()*.2);}
  combatMove(dt:number,time:number,enemy:Actor){this.combat.update(this,dt,time,enemy);}
  walkTo(goal: Vector3, dt: number, speed: number) { if(!this.target&&this.world.routePlanner.has(this.planKey))return;const dx=goal.x-this.position.x,dz=goal.z-this.position.z,length=Math.hypot(dx,dz);if(length<.1)return;const x=this.position.x,z=this.position.z;this.world.move(this.position,dx/length*Math.min(length,speed*dt),dz/length*Math.min(length,speed*dt));const moved=Math.hypot(this.position.x-x,this.position.z-z);this.moving=moved>.00001;this.stepDistance+=moved;if(this.stepDistance>1.8){this.stepDistance=0;this.onSound('step-'+this.world.footstepAt(this.position),this.position);}if(!this.target)this.model.root.rotation.y=Math.atan2(dx,dz);this.stuck=this.moving?0:this.stuck+dt;if(this.stuck>1.5){this.recoveries++;this.releaseCover();this.path=[];this.pathIndex=0;this.requestReplan(this.currentTime,0);this.stuck=0;} }
}


