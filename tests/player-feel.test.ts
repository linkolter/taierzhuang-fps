import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine, Scene, Vector3} from '@babylonjs/core';
import {Player} from '../src/player/Player';
import {World} from '../src/map/World';
import {CONFIG} from '../src/config/gameConfig';

// Exercise the real Player and World collision code without a browser renderer.
const doc=new EventTarget(),win=new EventTarget();
Object.assign(globalThis,{document:doc,window:win});
const engine=new NullEngine(),scene=new Scene(engine);
after(()=>{scene.dispose();engine.dispose();});
function fixture(){
 const world=new World(scene),player=new Player(scene,new EventTarget() as HTMLCanvasElement,world);
 player.respawn(new Vector3(0,0,0));player.locked=true;player.yaw=Math.PI/2;
 return {world,player,run:(seconds:number,hz=120)=>{for(let i=0;i<Math.round(seconds*hz);i++)player.update(1/hz);}};
}
test('Player Feel: vector acceleration preserves speeds, brakes smoothly and agrees across frame rates',()=>{
 const samples=[];
 for(const hz of [30,60,120]){
  const {player:p,run}=fixture();p.keys.add('KeyW');p.update(1/hz);
  assert.ok(p.moveSpeed>0&&p.moveSpeed<CONFIG.player.walk);run(1-1/hz,hz);
  assert.ok(Math.abs(p.currentVelocity.length()-4.2)<1e-8);
  const atRelease=p.position.x;p.keys.clear();run(.5,hz);const stop=p.position.x-atRelease;
  assert.ok(stop>.10&&stop<.25);assert.equal(p.currentVelocity.length(),0);
  p.keys.add('KeyS');run(.5,hz);p.keys.clear();run(.5,hz);
  samples.push({x:p.position.x,stop});p.dispose();
 }
 for(const key of ['x','stop'] as const)assert.ok(Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]))<=.05);
 const {player:p,run}=fixture();p.keys.add('KeyW');p.keys.add('KeyD');run(1);
 assert.ok(p.currentVelocity.length()<=4.2+1e-8);p.keys.add('ShiftLeft');run(1);assert.ok(p.currentVelocity.length()<=6.5+1e-8);
 p.keys.add('KeyC');run(.1);assert.ok(p.currentVelocity.length()<=2.2+1e-8);p.dispose();
});
test('Player Feel: real wall collision cannot store velocity or launch the player when released',()=>{
 const {player:p,world,run}=fixture();world.obstacles.push({x:1,z:0,w:.2,d:10,bottom:0,top:4});
 p.keys.add('KeyW');run(2);assert.ok(p.position.x<.6);assert.ok(Math.abs(p.currentVelocity.x)<1e-8);
 const atWall=p.position.x;world.obstacles.length=0;p.update(1/60);
 assert.ok(p.position.x-atWall<.01);assert.ok(p.currentVelocity.x<1);p.dispose();
});
test('Player Feel: death, blur, pointer unlock, respawn and recovery clear horizontal velocity',()=>{
 for(const reason of ['death','blur','unlock','respawn','recovery']){
  const {player:p,run}=fixture();p.keys.add('KeyW');run(.25);assert.ok(p.currentVelocity.length()>0);
  if(reason==='death'){p.alive=false;p.update(1/60);}
  if(reason==='blur')win.dispatchEvent(new Event('blur'));
  if(reason==='unlock')doc.dispatchEvent(new Event('pointerlockchange'));
  if(reason==='respawn')p.respawn();
  if(reason==='recovery'){p.stuckRecovery.update=()=>{p.position.x=0;return true;};p.update(1/60);assert.equal(p.moveSpeed,0);}
  assert.equal(p.currentVelocity.length(),0,reason);p.dispose();
 }
});
test('Player Feel: visual crouch takes 150/180ms, a low roof still enforces crouch',()=>{
 const {player:p,world}=fixture();p.keys.add('KeyC');p.update(.075);
 assert.equal(p.crouching,true);assert.ok(Math.abs(p.eyeHeight-1.295)<1e-8);
 p.update(.075);assert.equal(p.eyeHeight,1.03);p.keys.clear();p.update(.09);
 assert.equal(p.crouching,false);assert.ok(Math.abs(p.eyeHeight-1.295)<1e-8);p.update(.09);assert.equal(p.eyeHeight,1.56);
 world.obstacles.push({x:0,z:0,w:4,d:4,bottom:1.3,top:2});p.update(.01);
 assert.equal(p.crouching,true);assert.ok(p.eyeHeight<=1.22);p.dispose();
});
test('Player Feel: jump height is unchanged at each rate and a ceiling hit is not a landing',()=>{
 for(const [hz,baseline] of [[30,.76],[60,.8022222222222225],[120,.8233333333333325]]){
  const {player:p}=fixture();let lands=0,peak=0;p.onLand=()=>lands++;p.jumpQueued=true;
  for(let i=0;i<hz;i++){p.update(1/hz);peak=Math.max(peak,p.position.y);}
  assert.ok(Math.abs(peak-baseline)<1e-9);assert.equal(lands,1);assert.equal(p.grounded,true);p.dispose();
 }
 const {player:p,world,run}=fixture();world.obstacles.push({x:0,z:0,w:6,d:6,bottom:2,top:3});let lands=0,hit=false;p.onLand=()=>lands++;p.jumpQueued=true;
 for(let i=0;i<60;i++){const vy=p.velocityY;p.update(1/120);if(vy>0&&p.velocityY===0&&p.position.y>.02){hit=true;assert.equal(lands,0);assert.equal(p.grounded,false);break;}}
 assert.ok(hit);run(1);assert.equal(lands,1);run(1);assert.equal(lands,1);p.dispose();
});
