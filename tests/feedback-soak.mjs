import {createRequire} from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const seconds=Number(process.env.SOAK_SECONDS||900),browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-precise-memory-info','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('PAGE CRASH'));
const samples=[],file='test-results/feedback-soak.json';
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();await page.waitForTimeout(3000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
 const initial=await page.evaluate(()=>({heap:performance.memory.usedJSHeapSize,stats:window.__game.diagnostics.snapshot()}));
 await page.evaluate(()=>{
  const g=window.__game,V=g.player.position.constructor;g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;g.player.onLock=()=>{g.player.locked=true;};g.player.locked=true;
  const state={gameSeconds:0,steps:0,matches:[],shots:0,playerShots:0,reloads:0,melee:0,collisions:[],pressureMax:0,states:new Set(),tactics:new Set(),lanes:new Set(),tunnelBots:new Set(),boltViolations:[],lastShot:new Map(),sounds:{},frames:[],intervals:[],cpu:[],heap:[],restartCount:0};
  let begin=0,last=0,decisionAt=0,checkAt=0,playerPath=[],pathIndex=0,planAt=0,controlledTarget=null,acquired=0;
  const originalSound=g.audio.play.bind(g.audio);g.audio.play=(name,...args)=>{state.sounds[name]=(state.sounds[name]||0)+1;originalSound(name,...args);};
  const originalFire=g.weapon.onFire;g.weapon.onFire=(...args)=>{state.playerShots++;originalFire(...args);};
  for(const b of g.bots){const fire=b.onFire;b.onFire=(bot,target,melee)=>{state.shots++;if(melee)state.melee++;else{const old=state.lastShot.get(bot.id);if(old!==undefined&&g.time-old<1.49)state.boltViolations.push({id:bot.id,gap:g.time-old});state.lastShot.set(bot.id,g.time);}fire(bot,target,melee);};}
  const originalStep=g.step.bind(g);g.step=dt=>{
   const p=g.player;state.gameSeconds+=dt;state.steps++;
   if(!p.alive){playerPath=[];pathIndex=0;planAt=0;controlledTarget=null;}
   if(p.alive&&g.time>=decisionAt){decisionAt=g.time+.18;p.keys.clear();let target=null,dist=42;
    for(const b of g.bots){if(!b.alive||b.team===p.team||b.protection>0)continue;const d=V.Distance(p.position,b.position);if(d<dist&&g.combat.visible(p,b)){dist=d;target=b;}}
    if(target){if(controlledTarget!==target.id){controlledTarget=target.id;acquired=g.time;}p.yaw=Math.atan2(target.position.x-p.position.x,target.position.z-p.position.z);p.pitch=-Math.atan2(target.position.y+(target.crouching?.8:1.15)-p.camera.position.y,Math.hypot(target.position.x-p.position.x,target.position.z-p.position.z));p.ads=dist>7;g.weapon.select(dist<1.8?2:1);p.ads=dist>7;p.update(0);if(g.time-acquired>.45){if(g.weapon.ammo===0)g.weapon.reload();else g.weapon.attack();}}
    else{controlledTarget=null;p.ads=false;
     if(g.time>=planAt){planAt=g.time+8;const goal=g.capture.points.filter(o=>o.owner!=='cn').sort((a,b)=>Math.hypot(a.x-p.position.x,a.z-p.position.z)-Math.hypot(b.x-p.position.x,b.z-p.position.z))[0]??g.capture.points[1];g.world.routePlanner.enqueue('soak-player',2,function*(){playerPath=yield* g.world.tactical.findSteps(p.position.clone(),new V(goal.x,goal.y??0,goal.z),'main');pathIndex=0;});}
     const next=playerPath[pathIndex];if(next){p.yaw=Math.atan2(next.x-p.position.x,next.z-p.position.z);p.pitch=0;p.keys.add('KeyW');if(V.DistanceSquared(next,p.position)<1)pathIndex++;}if(g.weapon.ammo<5)g.weapon.reload();
    }
   }
   originalStep(dt);
   if(g.time>=checkAt){checkAt=g.time+1;state.pressureMax=Math.max(state.pressureMax,g.pressure.active.size);
    for(const b of g.bots){state.states.add(b.state);state.tactics.add(b.combat.tactic);if(b.position.z>20)state.lanes.add('north');else if(b.position.z<-22)state.lanes.add('south');else state.lanes.add('main');if(g.world.undergroundAt(b.position.x,b.position.y,b.position.z))state.tunnelBots.add(b.id);if(b.alive&&!g.world.canStand(b.position.x,b.position.y,b.position.z,.30,b.crouching?1.2:1.7)&&state.collisions.length<30)state.collisions.push({id:b.id,time:g.time,position:b.position.asArray()});}
   }
   if(g.match.winner){state.matches.push({winner:g.match.winner,time:g.time,tickets:{...g.match.tickets},deaths:{...g.match.deaths}});state.lastShot.clear();g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;p.locked=true;decisionAt=checkAt=planAt=0;playerPath=[];pathIndex=0;state.restartCount++;}
  };
  g.engine.onBeginFrameObservable.add(()=>{begin=performance.now();if(last)state.intervals.push(begin-last);last=begin;});g.engine.onEndFrameObservable.add(()=>state.frames.push(performance.now()-begin));
  const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b),n=sorted.length;return {mean:a.reduce((s,v)=>s+v,0)/(n||1),p95:sorted[Math.floor((n-1)*.95)],p99:sorted[Math.floor((n-1)*.99)],max:sorted[n-1],count:n};};
  let since=performance.now();window.__feedbackSoak={take(){const now=performance.now(),elapsed=(now-since)/1000;const sample={elapsed,fps:state.frames.length/elapsed,cpu:stats(state.frames),frame:stats(state.intervals),stats:g.diagnostics.snapshot(),gameSeconds:state.gameSeconds,steps:state.steps,shots:state.shots,playerShots:state.playerShots,melee:state.melee,matches:state.matches.slice(),states:[...state.states],tactics:[...state.tactics],lanes:[...state.lanes],tunnelBots:[...state.tunnelBots],pressureMax:state.pressureMax,boltViolations:state.boltViolations,collisions:state.collisions,sounds:{...state.sounds},audioContext:g.audio.context.state,routeQueue:g.world.routePlanner.pending};state.frames=[];state.intervals=[];since=now;return sample;}};
 });
 const start=Date.now();while(Date.now()-start<seconds*1000){await new Promise(r=>setTimeout(r,Math.min(30000,seconds*1000-(Date.now()-start))));const sample=await page.evaluate(()=>window.__feedbackSoak.take());samples.push(sample);fs.writeFileSync(file,JSON.stringify({running:true,seconds:(Date.now()-start)/1000,initial,samples,errors},null,2));console.log(JSON.stringify({elapsed:Math.round((Date.now()-start)/1000),fps:sample.fps,cpu:sample.cpu,shots:sample.shots,playerShots:sample.playerShots,heap:sample.stats.heapMB,collisions:sample.collisions.length,lanes:sample.lanes,states:sample.states}));if(errors.length)break;}
 await page.evaluate(()=>window.__game.paused=true);await page.waitForTimeout(1800);await cdp.send('HeapProfiler.collectGarbage');const final=await page.evaluate(()=>({heap:performance.memory.usedJSHeapSize,stats:window.__game.diagnostics.snapshot()}));
 const keys=['meshes','materials','textures','ai','transformNodes','effectPool','shellPool','lights','smokePool'];const stable=keys.every(k=>samples.every(s=>s.stats[k]===initial.stats[k])&&final.stats[k]===initial.stats[k]);const last=samples.at(-1);
 const report={running:false,seconds:(Date.now()-start)/1000,browser:browser.version(),hardware:os.cpus()[0]?.model,resolution:[1920,1080],initial,final,postGCHeapDeltaMB:(final.heap-initial.heap)/1048576,stable,samples,errors};fs.writeFileSync(file,JSON.stringify(report,null,2));await page.screenshot({path:'test-results/feedback-soak.png'});
 assert.ok(stable);assert.ok(last.gameSeconds>=seconds*.9);assert.equal(errors.length,0);assert.equal(last.collisions.length,0);assert.equal(last.boltViolations.length,0);assert.ok(last.pressureMax<=3);assert.ok(last.playerShots>10);assert.ok(last.shots>100);assert.ok(final.stats.audioVoices===0);console.log(JSON.stringify({done:true,seconds:report.seconds,stable,heapDeltaMB:report.postGCHeapDeltaMB,matches:last.matches}));
}finally{await browser.close();}

