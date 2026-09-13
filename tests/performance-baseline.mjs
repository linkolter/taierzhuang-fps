import crypto from 'node:crypto';
import {createRequire} from 'node:module';import fs from 'node:fs';import os from 'node:os';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const seconds=Number(process.env.PERF_SECONDS||120),label=process.env.PERF_LABEL||'before',quality=process.env.PERF_QUALITY||'MEDIUM';
function sourceFiles(path){return fs.readdirSync(path,{withFileTypes:true}).flatMap(d=>d.isDirectory()?sourceFiles(path+'/'+d.name):[path+'/'+d.name]);}
const sourceManifest=Object.fromEntries(sourceFiles('src').map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-precise-memory-info','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1}),errors=[],samples=[],gc=[];
page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('PAGE_CRASH'));
const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
await page.addInitScript(()=>{
 const counts={active:0,peak:0,created:0,types:{}};window.__audioCounts=counts;
 for(const method of ['createGain','createBiquadFilter','createBufferSource','createOscillator','createPanner','createConvolver','createDynamicsCompressor']){
  const old=BaseAudioContext.prototype[method];BaseAudioContext.prototype[method]=function(...args){const node=old.apply(this,args),disconnect=node.disconnect;let counted=true;counts.created++;counts.active++;counts.peak=Math.max(counts.peak,counts.active);counts.types[method]=(counts.types[method]??0)+1;
   node.disconnect=function(...a){const result=disconnect.apply(this,a);if(!a.length&&counted){counted=false;counts.active--;counts.types[method]--;}return result;};return node;};
 }
});
fs.mkdirSync('test-results/performance',{recursive:true});const file=`test-results/performance/${label}.json`;
if(seconds>=900)fs.writeFileSync('test-results/performance/source-manifest.json',JSON.stringify(sourceManifest,null,2));
try{
 await page.goto((process.env.GAME_URL||'http://127.0.0.1:5190')+'/?quality='+quality);await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();
 await page.evaluate(({gpuEnabled})=>{
  const g=window.__game,V=g.player.position.constructor;let seed=1938;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};g.bots.forEach(b=>b.births=0);g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;g.player.locked=true;
  g.player.lock=async()=>{g.player.locked=true;g.player.onLock(true);};g.player.onLock=()=>{g.player.locked=true;if(!g.match.winner){g.paused=false;g.hud.menu.hidden=true;}};
  let decisionAt=0,planAt=0,path=[],index=0,targetId=null,acquired=0,lastShot=-10,totalSeconds=0;const rounds=[];let shots=0,deploys=0;
  const step=g.step.bind(g);g.step=dt=>{const p=g.player;totalSeconds+=dt;
   if(!p.alive){p.keys.clear();path=[];index=0;planAt=0;targetId=null;if(g.time>=p.respawnAt){const options=g.spawns.candidates();g.selectedSpawn=(options.find(o=>o.id!=='BASE'&&o.available)??options[0]).id;if(g.deploy())deploys++;}}
   if(p.alive&&g.time>=decisionAt){decisionAt=g.time+.18;p.keys.clear();let target=null,distance=40;
    for(const b of g.bots){if(!b.alive||b.team===p.team||b.protection>0)continue;const d=V.Distance(p.position,b.position);if(d<distance&&g.combat.visible(p,b)){distance=d;target=b;}}
    if(target){if(targetId!==target.id){targetId=target.id;acquired=g.time;}p.yaw=Math.atan2(target.position.x-p.position.x,target.position.z-p.position.z);p.pitch=-Math.atan2(target.position.y+(target.crouching?.8:1.15)-p.camera.position.y,Math.hypot(target.position.x-p.position.x,target.position.z-p.position.z));g.weapon.select(distance<1.8?2:1);p.ads=distance>7;p.update(0);if(g.time-acquired>.8&&g.time-lastShot>2.8){if(g.weapon.ammo===0)g.weapon.reload();else{g.weapon.attack();lastShot=g.time;shots++;}}}
    else{targetId=null;p.ads=false;if(g.time>=planAt){planAt=g.time+8;const goal=g.capture.points.filter(o=>o.owner!=='cn').sort((a,b)=>Math.hypot(a.x-p.position.x,a.z-p.position.z)-Math.hypot(b.x-p.position.x,b.z-p.position.z))[0]??g.capture.points[1];g.world.routePlanner.enqueue('perf-player',2,function*(){path=yield* g.world.tactical.findSteps(p.position.clone(),new V(goal.x,goal.y??0,goal.z),'main');index=0;});}
     const next=path[index];if(next){p.yaw=Math.atan2(next.x-p.position.x,next.z-p.position.z);p.pitch=0;p.keys.add('KeyW');if(V.DistanceSquared(next,p.position)<.7)index++;}if(g.weapon.ammo<5)g.weapon.reload();}
   }step(dt);if(g.match.winner){rounds.push({seconds:g.time,winner:g.match.winner,tickets:{...g.match.tickets},score:{...g.scores.row(0)}});g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;p.locked=true;decisionAt=planAt=0;lastShot=-10;path=[];index=0;}
  };
  const gpu=[];let gpuCount=0;if(gpuEnabled)g.engine.captureGPUFrameTime(true);
  const buckets={},stack=[],cpu=[],intervals=[],bursts={perception:0,decision:0,losActors:0,routeStarts:0};let frameStart=0,lastFrame=0,frameCount=0,activeBot=null,searchStart=0;const actorsLOS=new Set();let perceptions=0,decisions=0;
  const wrap=(object,key,bucket,enter,leave)=>{const original=object[key];object[key]=function(...args){const context=enter?.(args);const start=performance.now();stack.push(0);try{return original.apply(this,args);}finally{const elapsed=performance.now()-start,children=stack.pop();if(stack.length)stack[stack.length-1]+=elapsed;const b=buckets[bucket]??={self:0,inclusive:0,calls:0,max:0};b.self+=elapsed-children;b.inclusive+=elapsed;b.calls++;b.max=Math.max(b.max,elapsed);leave?.(args,context);}};};
  for(const bot of g.bots){wrap(bot,'update','AI other',args=>{activeBot=bot.id;return bot.alive&&bot.think<=args[0];},(_,due)=>{if(due&&bot.think>0)perceptions++;activeBot=null;});
   wrap(bot,'inView','AI perception filters');wrap(bot.combat,'update','AI combat decision',a=>bot.combat.decisionAt, (a,previous)=>{if(bot.combat.decisionAt>previous)decisions++;});
   wrap(bot.combat,'choose','Cover selection');wrap(bot.combat,'route','Local tactical path');wrap(bot,'syncModel','AI model update');}
  wrap(g.combat,'visible','AI perception / visibility');wrap(g.world,'blocked','LOS query',()=>{if(activeBot!==null)actorsLOS.add(activeBot);});
  wrap(g.world.routePlanner,'tick','Route planning');wrap(g.world.tactical,'nearest','TacticalRouteGraph nearest');wrap(g.world.tactical,'walkableLink','TacticalRouteGraph link');
  for(const key of ['move','canStand','floorAt'])wrap(g.world,key,'Collision / terrain');wrap(g.world,'pickStaticRay','Mesh raycast');
  wrap(g.effects,'update','Particles / world FX');wrap(g.weapon.flash,'update','Particles / smoke');wrap(g.weapon.shells,'update','Shell casings');
  wrap(g.audio,'play','Audio construction');wrap(g.audio,'update','Audio listener');wrap(g.strategy,'update','Strategic director');wrap(g.scores,'presence','Score presence');wrap(g.hud,'update','HUD');wrap(g.scene,'render','Render submission');wrap(g,'step','Game / input driver');
  g.engine.onBeginFrameObservable.add(()=>{frameStart=performance.now();if(lastFrame)intervals.push(frameStart-lastFrame);lastFrame=frameStart;actorsLOS.clear();perceptions=decisions=0;searchStart=g.world.tactical.searches;});
  g.engine.onEndFrameObservable.add(()=>{cpu.push(performance.now()-frameStart);if(gpuEnabled){const counter=g.engine.getGPUFrameTimeCounter();if(counter.count>gpuCount){gpu.push(counter.current/1e6);gpuCount=counter.count;}}frameCount++;bursts.perception=Math.max(bursts.perception,perceptions);bursts.decision=Math.max(bursts.decision,decisions);bursts.losActors=Math.max(bursts.losActors,actorsLOS.size);bursts.routeStarts=Math.max(bursts.routeStarts,g.world.tactical.searches-searchStart);});
  const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b);return {mean:a.reduce((s,x)=>s+x,0)/(a.length||1),p95:sorted[Math.floor((a.length-1)*.95)]??0,p99:sorted[Math.floor((a.length-1)*.99)]??0,max:sorted.at(-1)??0};};let since=performance.now();
  window.__perf={snapshot(){return {stats:g.diagnostics.snapshot(),audio:{...window.__audioCounts,types:{...window.__audioCounts.types}},heap:performance.memory.usedJSHeapSize,routeCache:g.world.tactical.pathCache.size,routeScratch:g.world.tactical.workspaces.length,queue:g.world.routePlanner.pending,quality:g.quality??null,gpuSupported:!!g.engine.getCaps().timerQuery,gpuRenderer:g.engine.getGlInfo(),render:[g.engine.getRenderWidth(),g.engine.getRenderHeight()],scheduler:g.aiWork?.snapshot()??null};},take(){const now=performance.now(),duration=(now-since)/1000,metrics={};for(const [name,b] of Object.entries(buckets))metrics[name]={selfMsPerFrame:b.self/(frameCount||1),inclusiveMsPerFrame:b.inclusive/(frameCount||1),callsPerSecond:b.calls/duration,maxCallMs:b.max};const result={seconds:duration,frames:frameCount,fps:frameCount/duration,cpu:stats(cpu),frame:stats(intervals),gpu:gpu.length?stats(gpu):null,gpuSamples:gpu.length,metrics,bursts:{...bursts},totalSeconds,rounds:[...rounds],shots,deploys,...this.snapshot()};for(const k of Object.keys(buckets))delete buckets[k];for(const k of Object.keys(bursts))bursts[k]=0;gpu.length=cpu.length=intervals.length=0;frameCount=0;since=now;return result;}};
 },{gpuEnabled:process.env.PERF_GPU==='1'});
 // Same 15 s warm-up for before/after; no accelerated game steps.
 await page.waitForTimeout(15000);await cdp.send('HeapProfiler.collectGarbage');const initial=await page.evaluate(()=>{window.__perf.take();return window.__perf.snapshot();});
 let prior=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));const started=Date.now();
 for(let elapsed=0;elapsed<seconds;){const duration=Math.min(30,seconds-elapsed);await page.waitForTimeout(duration*1000);elapsed+=duration;
  const sample=await page.evaluate(()=>window.__perf.take());const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));sample.mainThreadMsPerFrame=(metrics.TaskDuration-prior.TaskDuration)*1000/sample.frames;prior=metrics;
  samples.push(sample);if(elapsed%120===0||elapsed===seconds){await cdp.send('HeapProfiler.collectGarbage');gc.push({elapsed,...await page.evaluate(()=>window.__perf.snapshot())});}
  fs.writeFileSync(file,JSON.stringify({running:true,label,quality,seconds:elapsed,initial,samples,gc,errors},null,2));console.log(JSON.stringify({label,elapsed,fps:sample.fps,cpu:sample.cpu,mainThread:sample.mainThreadMsPerFrame,bursts:sample.bursts,audio:sample.audio.active,heap:sample.stats.heapMB}));
 }
 await page.evaluate(()=>{const g=window.__game;g.paused=true;g.audio.pause(true);});await page.waitForTimeout(2000);await cdp.send('HeapProfiler.collectGarbage');const final=await page.evaluate(()=>window.__perf.snapshot());
 const report={running:false,label,quality,seconds,wallSeconds:(Date.now()-started)/1000,browser:browser.version(),hardware:os.cpus()[0]?.model,initial,final,samples,gc,errors};fs.writeFileSync(file,JSON.stringify(report,null,2));
 for(const [path,hash] of Object.entries(sourceManifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,'source modified during measurement');
 assert.deepEqual(errors,[]);const keys=['meshes','materials','textures','lights','transformNodes','ai','effectPool','shellPool','smokePool'];assert.ok(keys.every(k=>samples.every(s=>s.stats[k]===initial.stats[k])&&final.stats[k]===initial.stats[k]));assert.equal(final.audio.active,9);assert.equal(final.stats.audioVoices,0);assert.ok(samples.every(s=>s.routeCache<=512&&s.routeScratch<=1&&s.stats.audioVoices<=24&&s.audio.active<=321&&s.stats.activeEffects<=28&&s.stats.activeShells<=24));
 if(seconds>=900){const early=samples.slice(2,7),late=samples.slice(-5),avg=(a,k)=>a.reduce((s,x)=>s+x[k],0)/a.length;assert.ok(avg(late,'fps')>=avg(early,'fps')*.95);assert.ok(gc.at(-1).heap-gc[0].heap<8*1048576);assert.ok(samples.every(s=>s.bursts.perception<=3&&s.bursts.decision<=2&&s.bursts.losActors<=5));}
 console.log(JSON.stringify({complete:true,label,seconds,finalHeapMB:final.heap/1048576,audioNodes:final.audio.active}));
}finally{await browser.close();}
