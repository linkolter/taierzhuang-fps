import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine,Scene,Vector3 } from '@babylonjs/core';
import { World } from '../src/map/World';
import { RAMPS } from '../src/map/MapLayout';
import { rampFloor } from '../src/map/Topology';
import { CaptureSystem,captureState } from '../src/capture/CaptureSystem';
import { SpawnSystem } from '../src/game/SpawnSystem';
import { ScoreSystem } from '../src/game/ScoreSystem';
import { Match } from '../src/game/Match';
import { Combat } from '../src/game/Combat';
import { PlayerStuckRecovery } from '../src/player/PlayerStuckRecovery';
import { StrategicDirector } from '../src/ai/StrategicDirector';
import { Bot } from '../src/ai/Bot';
import { RELOAD_EVENTS } from '../src/weapons/BoltTimeline';
import {FootstepTracker} from '../src/audio/Footsteps';
import { CONFIG } from '../src/config/gameConfig';
import type { Actor } from '../src/game/types';
const engine=new NullEngine(),scene=new Scene(engine),world=new World(scene);world.buildVillage();
after(()=>{scene.dispose();engine.dispose();});
const actor=(id:number,team:'cn'|'jp',x=0,y=0,z=-7):Actor=>({id,team,position:new Vector3(x,y,z),alive:true,health:100,protection:0,respawnAt:0});
test('respawn-selection: only fully owned, uncontested points can deploy; re-evaluation catches loss',()=>{
  const c=new CaptureSystem(),sp=new SpawnSystem(world,c,[]);
  assert.equal(sp.evaluate('B').available,false);const p=c.points[1];p.owner='cn';p.progress=.8;assert.equal(sp.evaluate('B').available,false);
  p.progress=1;assert.equal(sp.evaluate('B').available,true);p.contested=true;assert.equal(sp.evaluate('B').available,false);
  p.contested=false;p.owner='jp';assert.equal(sp.evaluate('B').reason,'敌方控制');assert.equal(sp.evaluate('BASE').available,true);
});
test('spawn-safety: authored noncentral anchors have at least three standing positions per objective',()=>{
  const c=new CaptureSystem(),sp=new SpawnSystem(world,c,[]);
  for(const p of c.points){const valid=sp.anchors.filter(a=>a.point===p.id&&world.canStand(a.position.x,a.position.y,a.position.z)&&!world.inRamp(a.position.x,a.position.z));
    console.log(p.id,'valid anchors',valid.map(a=>a.id));assert.ok(valid.length>=3,p.id);assert.ok(valid.every(a=>Vector3.Distance(a.position,new Vector3(p.x,p.y,p.z))>4));}
});
test('spawn-safety: nearby enemies and direct LOS suppress all forward anchors, allies block occupancy',()=>{
  const c=new CaptureSystem();c.points[1].owner='cn';c.points[1].progress=1;
  const enemy=actor(8,'jp'),sp=new SpawnSystem(world,c,[enemy]);assert.equal(sp.evaluate('B').available,false);assert.equal(sp.evaluate('B').reason,'出生点受压制');
  enemy.position.set(0,0,-37);const fake={...world,terrain:world.terrain,canStand:()=>true,inRamp:()=>false,blocked:()=>false} as unknown as World;
  assert.equal(new SpawnSystem(fake,c,[enemy]).evaluate('B').available,false);
});
test('capture-state: four explicit states, contested pauses and capture speed saturates at three soldiers',()=>{
  const c=new CaptureSystem(),p=c.points[1];assert.equal(captureState(p),'NEUTRAL');c.update(2,[actor(0,'cn'),actor(8,'jp')]);assert.equal(captureState(p),'CONTESTED');assert.equal(p.progress,0);
  const speed=(n:number)=>{c.reset();c.update(1,Array.from({length:n},(_,i)=>actor(i,'cn')));return p.progress;};assert.ok(speed(2)>speed(1));assert.equal(speed(3),speed(8));
  c.update(30,[actor(0,'cn')]);assert.equal(captureState(p),'CHINESE');c.update(30,[actor(8,'jp')]);assert.equal(captureState(p),'JAPANESE');
});
test('ticket-bleed: one death charged once by combat and respawn is free; two and three points drain slowly',()=>{
  const c=new CaptureSystem(),m=new Match(),a=actor(0,'cn'),b=actor(8,'jp'),combat=new Combat(world,[a,b]);combat.onDeath=v=>m.death(v.team);
  combat.damage(b,a,100);combat.damage(b,a,100);assert.equal(m.tickets.jp,99);b.alive=true;b.health=100;assert.equal(m.tickets.jp,99);
  c.points[0].owner='cn';m.update(CONFIG.match.bleedInterval,c);assert.equal(m.tickets.jp,99);c.points[1].owner='cn';m.update(CONFIG.match.bleedInterval,c);assert.equal(m.tickets.jp,98);c.points[2].owner='cn';m.update(CONFIG.match.bleedInterval,c);assert.equal(m.tickets.jp,96);
});
test('scoreboard / round-end: kill, recent assist, capture, defense, bounded feed and clean reset',()=>{
  const a=actor(0,'cn'),ally=actor(1,'cn'),enemy=actor(8,'jp'),c=new CaptureSystem(),s=new ScoreSystem([a,ally,enemy]);
  s.hit(enemy,a,1);s.death(enemy,ally,2,'三八式',c.points);assert.equal(s.row(0).score,50);assert.equal(s.row(1).score,100);assert.equal(s.row(8).deaths,1);
  s.presence(1,c.points,[a,ally]);s.capture(c.points[1],'cn');assert.equal(s.row(0).score,250);assert.equal(s.row(1).score,200);
  c.points[1].owner='cn';s.death(enemy,a,3,'三八式',c.points);assert.equal(s.row(0).defenses,1);assert.equal(s.row(0).score,400);
  for(let i=0;i<8;i++)s.death(enemy,a,4+i,'大刀',c.points);assert.equal(s.feed.length,5);assert.equal(s.sorted('cn')[0].id,0);
  const m=new Match();m.tickets.jp=1;m.death('jp');assert.equal(m.winner,'cn');m.reset();s.reset();assert.equal(m.tickets.jp,100);assert.ok(s.rows.every(r=>r.score===0&&r.deaths===0));assert.equal(s.feed.length,0);
});
test('spawn protection: incoming damage rejected, rifle and melee cancel protection immediately',()=>{
  for(const melee of [false,true]){const a=actor(0,'cn'),b=actor(8,'jp',30);a.protection=1.8;const combat=new Combat(world,[a,b]);combat.damage(a,b,100);assert.equal(a.health,100);combat.shoot(a,new Vector3(0,1.5,-7),new Vector3(0,1,0),melee);assert.equal(a.protection,0);combat.damage(a,b,100);assert.equal(a.alive,false);}
});
test('base court rules prevent spawn camping and invulnerable shooting out of the base',()=>{
  const a=actor(0,'cn',-82,0,0),b=actor(8,'jp',-68,0,0),c=new Combat(world,[a,b]);c.damage(a,b,100);c.damage(b,a,100);assert.equal(a.health,100);assert.equal(b.health,100);a.position.x=-72;c.damage(b,a,100);assert.equal(b.alive,false);
});
test('tunnel-transition: all seven portals remain surface above ground and blend continuously along ramp',()=>{
  for(const r of RAMPS){let previous=0,portal=false;
    for(let i=0;i<=100;i++){const t=i/100,x=r.lip[0]+(r.bottom[0]-r.lip[0])*t,z=r.lip[1]+(r.bottom[1]-r.lip[1])*t,y=rampFloor(r,x,z,world.terrain.height);
      assert.equal(world.environmentAt(x,world.terrain.height(x,z),z).state,'SURFACE',r.id);
      const e=world.environmentAt(x,y,z);assert.ok(Math.abs(e.blend-previous)<.13,`${r.id} discontinuity ${i}`);previous=e.blend;if(e.state==='PORTAL')portal=true;
    }assert.ok(portal,r.id);assert.equal(previous,1,r.id);
  }assert.equal(world.environmentAt(85,-4,-40).state,'SURFACE');
});
test('StuckRecovery does not trigger for walls, crouching, airborne movement or missing input',()=>{
  const p=new Vector3(),r=new PlayerStuckRecovery(),fake={canStand:()=>true,floorAt:()=>0};
  for(let i=0;i<180;i++)assert.equal(r.update(1/60,p,true,0,true,false,fake),false);
  assert.ok(r.lastSafePosition);assert.equal(r.recoveries,0);
  fake.canStand=()=>false;for(let i=0;i<180;i++)r.update(1/60,p,false,0,true,false,fake);assert.equal(r.recoveries,0);
});
test('StuckRecovery: verified penetration nudges out then falls back to last validated position',()=>{
  const p=new Vector3(),r=new PlayerStuckRecovery(),fake={canStand:(x:number)=>x<.5,floorAt:()=>0};
  r.update(.4,p,false,0,true,false,fake);p.x=3;for(let i=0;i<21;i++)r.update(.05,p,true,0,true,false,fake);assert.equal(p.x,0);assert.equal(r.recoveries,1);
  p.x=.6;for(let i=0;i<21;i++)r.update(.05,p,true,0,true,false,fake);assert.ok(p.x<.5);assert.equal(r.recoveries,2);
});
test('audio-event: reload timeline opens, inserts clip, presses rounds and closes in animation order',()=>{
  assert.deepEqual(RELOAD_EVENTS.map(e=>e.sound),['reload-open','reload-clip','reload-press','reload-press','reload-feed','reload-close']);assert.ok(RELOAD_EVENTS.every((e,i)=>!i||e.at>RELOAD_EVENTS[i-1].at));
});
test('audio-event: four whitebox surfaces, distance-driven walk/sprint/crouch; no steps at rest or airborne',()=>{
  for(const [p,surface] of [[new Vector3(-82,0,0),'earth'],[new Vector3(0,0,-7),'stone'],[new Vector3(48,5,28),'wood'],[new Vector3(0,-4,0),'tunnel']] as const)assert.equal(world.footstepAt(p),surface);
  const counter=(mode:'walk'|'sprint'|'crouch',speed:number)=>{const t=new FootstepTracker();let count=0;for(let i=0;i<600;i++)if(t.advance(speed/60,true,mode))count++;return count;};
  assert.ok(counter('sprint',6.5)>counter('walk',4.2));assert.ok(counter('walk',4.2)>counter('crouch',2.2));
  const t=new FootstepTracker();for(let i=0;i<600;i++){assert.equal(t.advance(0,true,'walk'),false);assert.equal(t.advance(.1,false,'walk'),false);}assert.equal(t.distance,0);
});
test('StuckRecovery only records safe grounded standing positions, never airborne or crouching',()=>{
  const p=new Vector3(1,1,1),r=new PlayerStuckRecovery(),fake={canStand:()=>true,floorAt:()=>0};
  r.update(.5,p,true,1,true,false,fake);assert.equal(r.lastSafePosition,null);p.y=0;r.update(.5,p,true,1,true,true,fake);assert.equal(r.lastSafePosition,null);r.update(.5,p,true,1,true,false,fake);assert.deepEqual(r.lastSafePosition,p);
});
test('strategic assignment: all three objectives staffed, attacked friendly point defended, 1.5-second cadence',()=>{
  const bots=Array.from({length:15},(_,i)=>new Bot(i+1,i<7?'cn':'jp',world)),c=new CaptureSystem(),d=new StrategicDirector();c.points[0].owner='cn';c.points[0].progress=.5;c.points[0].present.jp=2;
  d.update(.1,0,bots,c.points);for(const team of ['cn','jp']){const roster=bots.filter(b=>b.team===team);assert.equal(new Set(roster.map(b=>b.strategicObjective)).size,3);for(const p of c.points)assert.ok(roster.filter(b=>b.strategicObjective===p.id).length<=4);}
  assert.ok(bots.some(b=>b.team==='cn'&&b.strategicObjective==='A'&&b.strategicRole==='DEFEND'));const runs=d.assignments;d.update(.5,.5,bots,c.points);assert.equal(d.assignments,runs);
  world.routePlanner.clear();bots.forEach(b=>b.model.root.dispose());
});
