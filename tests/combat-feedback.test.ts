import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3} from '@babylonjs/core';
import {World} from '../src/map/World';
import {Bot} from '../src/ai/Bot';
import {Combat} from '../src/game/Combat';
import {PlayerPressureDirector} from '../src/ai/PlayerPressureDirector';
import {BOLT_EVENTS,boltPose} from '../src/weapons/BoltTimeline';
import type {Actor} from '../src/game/types';
const engine=new NullEngine(),scene=new Scene(engine),world=new World(scene);world.buildVillage();
after(()=>{scene.dispose();engine.dispose();});
const actor=(id:number,x:number,z:number):Actor=>({id,team:'cn',position:new Vector3(x,world.terrain.height(x,z),z),alive:true,health:100,protection:0,respawnAt:0});
function bot(id=8){const b=new Bot(id,'jp',world);b.position.set(-75,0,0);b.protection=0;b.dirty=false;b.replanAt=Infinity;b.nextShot=0;b.think=0;b.model.root.rotation.y=Math.PI/2;return b;}
test('new contact has 500–800 ms reaction and every shot respects bolt plus re-aim',()=>{
 const b=bot(),enemy=actor(0,-70,0),shots:number[]=[];b.combatMove=()=>{};b.onFire=()=>shots.push(now);let now=0;
 b.update(.01,0,[b,enemy],[],()=>true);assert.equal(shots.length,0);assert.ok(b.reactionUntil>=.5&&b.reactionUntil<=.8);
 for(now=.02;now<18;now+=.02)b.update(.02,now,[b,enemy],[],()=>true);
 assert.ok(shots.length>=4);for(let i=1;i<shots.length;i++)assert.ok(shots[i]-shots[i-1]>=1.85);assert.ok(b.ammo>=0&&b.ammo<=5);
});
test('target switches restart reaction; perception rays are throttled and filtered by distance and FOV',()=>{
 const b=bot(9),first=actor(0,-70,0),behind=actor(1,-80,0),far=actor(2,70,0);b.combatMove=()=>{};let queries=0;
 const visible=()=>{queries++;return true;};for(let t=0;t<1;t+=.01)b.update(.01,t,[b,first,behind,far],[],visible);
 assert.ok(queries<15);first.alive=false;const next=actor(3,-71,0);b.think=0;b.update(.01,1,[b,next],[],visible);assert.ok(b.reactionUntil>=1.3);assert.equal(b.target?.id,3);
});
test('blocked muzzle neither consumes ammunition nor calls fire and requests reposition',()=>{
 const b=bot(10),enemy=actor(0,-70,0);b.combatMove=()=>{};b.canFire=()=>false;let fired=0;b.onFire=()=>fired++;
 for(let t=0;t<2;t+=.02)b.update(.02,t,[b,enemy],[],()=>true);
 assert.equal(fired,0);assert.equal(b.ammo,5);assert.ok(b.combat.blockedShots>0);
});
test('chest-to-muzzle obstruction is rejected even when muzzle extends past a thin wall',()=>{
 const w=new World(scene),b=bot(11),enemy=actor(0,3,0);b.position.set(0,0,0);b.model.root.rotation.y=Math.PI/2;
 w.box('muzzle-wall',.45,.7,0,.1,1.4,2,w.material('test-wall','#777777'));
 const combat=new Combat(w,[b,enemy]);assert.equal(combat.muzzleClear(b,enemy),false);
});
test('pressure cap permits three precise attackers and does not alter AI-vs-AI targets',()=>{
 const bots=Array.from({length:8},(_,i)=>bot(i+8)),player=actor(0,-70,0),ally=actor(2,-65,0);for(const b of bots)b.target=player;
 const d=new PlayerPressureDirector();d.update(.3,bots,player);assert.equal(bots.filter(b=>b.preciseAgainstPlayer).length,3);
 bots[0].target=ally;d.update(.3,bots,player);assert.equal(bots[0].target,ally);assert.equal(d.active.size,3);d.reset();assert.equal(d.active.size,0);
});
test('local combat uses existing connections without launching strategic route searches',()=>{
 const b=bot(14),enemy=actor(0,-70,1),searches=world.tactical!.searches;b.target=enemy;
 for(let t=0;t<10;t+=.02)b.combat.update(b,.02,t,enemy);
 assert.equal(world.tactical!.searches,searches);assert.ok(b.combat.decisions<=26);assert.ok(world.canStand(b.position.x,b.position.y,b.position.z));b.releaseCover();
});
test('bolt phases lift before pull, eject at full rear travel, then push and lock',()=>{
 assert.equal(BOLT_EVENTS.length,5);assert.equal(boltPose(0).lift,0);assert.ok(boltPose(.24).lift>.99);assert.equal(boltPose(.24).back,0);assert.ok(boltPose(.43).back>.99);assert.equal(boltPose(.83).back,0);assert.deepEqual(boltPose(1),{lift:0,back:0,tilt:0});
});
