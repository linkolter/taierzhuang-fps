import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const phase=process.env.FEEL_PHASE||'P0',output=`test-results/player-feel/${phase}`;
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady());
 const report=await page.evaluate(()=>{
  const g=window.__game,p=g.player,w=g.weapon;g.engine.stopRenderLoop();g.paused=true;g.started=true;g.hud.menu.hidden=true;
  const reset=()=>{p.respawn();w.reset();p.locked=true;p.position.set(-82,0,0);p.yaw=Math.PI/2;};
  const step=dt=>{p.update(dt);w.update(dt,g.time);};
  const profiles=[];
  for(const hz of [30,60,120]){
   const dt=1/hz;reset();p.keys.add('KeyW');let startTime=null;
   for(let i=0;i<hz;i++){step(dt);if(startTime===null&&p.moveSpeed>=4.2-1e-6)startTime=(i+1)*dt;}
   const stopStart=p.position.x;p.keys.clear();let stopTime=null;
   for(let i=0;i<hz/2;i++){step(dt);if(stopTime===null&&p.moveSpeed<1e-6)stopTime=(i+1)*dt;}
   const stopDistance=p.position.x-stopStart;
   reset();p.keys.add('KeyW');for(let i=0;i<hz/2;i++)step(dt);
   p.keys.clear();p.keys.add('KeyS');const reverseStart=p.position.x;let reversedAt=null;
   for(let i=0;i<hz/2;i++){const old=p.position.x;step(dt);if(reversedAt===null&&p.position.x<old)reversedAt=(i+1)*dt;}
   p.keys.clear();for(let i=0;i<hz/2;i++)step(dt);
   const end=p.position.asArray();reset();p.jumpQueued=true;let peak=0;
   for(let i=0;i<hz;i++){step(dt);peak=Math.max(peak,p.position.y);}
   profiles.push({hz,startTime,stopTime,stopDistance,reversedAt,reverseStart,end,jumpPeak:peak});
  }
  reset();const eyes=[];p.keys.add('KeyC');for(let i=0;i<15;i++){step(.01);eyes.push({ms:(i+1)*10,eye:p.camera.position.y-p.position.y,crouching:p.crouching});}
  p.keys.clear();for(let i=0;i<18;i++){step(.01);eyes.push({ms:150+(i+1)*10,eye:p.camera.position.y-p.position.y,crouching:p.crouching});}
  reset();p.ads=true;for(let i=0;i<21;i++)step(.01);const ads={blend:p.adsBlend,fov:p.camera.fov,root:w.root.position.asArray()};
  w.attack();const fire={ammo:w.ammo,cooldown:w.cooldown};for(let i=0;i<160;i++)step(.01);
  w.reload();const reloadStart=w.reloadTime;for(let i=0;i<319;i++)step(.01);const beforeReload=w.ammo;step(.02);const afterReload=w.ammo;
  w.select(2);const immediateSlot=w.slot;for(let i=0;i<35;i++)step(.01);const switchedSlot=w.slot;
  reset();g.scene.render();return {profiles,eyes,ads,fire,reload:{seconds:reloadStart,beforeReload,afterReload},switch:{immediateSlot,switchedSlot}};
 });
 fs.writeFileSync(`${output}/measurements.json`,JSON.stringify({phase,report,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(report.ads.blend,1);assert.equal(report.fire.cooldown,1.5);assert.equal(report.reload.seconds,3.2);assert.equal(report.reload.beforeReload,4);assert.equal(report.reload.afterReload,5);
 if(phase!=='P0'){
  const positions=report.profiles.map(p=>p.end[0]),stops=report.profiles.map(p=>p.stopDistance);
  assert.ok(Math.max(...positions)-Math.min(...positions)<=.05,'30/60/120Hz endpoint divergence');
  assert.ok(Math.max(...stops)-Math.min(...stops)<=.05,'30/60/120Hz stopping divergence');
  for(const p of report.profiles){assert.ok(p.startTime>.08&&p.startTime<.18);assert.ok(p.stopDistance>.10&&p.stopDistance<.25);assert.ok(p.reversedAt>.03&&p.reversedAt<.15);}
  const baseline=JSON.parse(fs.readFileSync('test-results/player-feel/P0/measurements.json')).report;
  report.profiles.forEach((p,i)=>assert.ok(Math.abs(p.jumpPeak-baseline.profiles[i].jumpPeak)<1e-9));
 }
 if(['P2','P3','P4'].includes(phase)){
  assert.ok(report.eyes[0].eye>1.03&&report.eyes[0].eye<1.56);
  assert.ok(Math.abs(report.eyes[14].eye-1.03)<1e-8);assert.ok(Math.abs(report.eyes.at(-1).eye-1.56)<1e-8);
 }
 console.log(JSON.stringify({phase,...report,errors},null,2));
}finally{await browser.close();}
