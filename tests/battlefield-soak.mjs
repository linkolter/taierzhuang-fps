import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';import os from 'node:os';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-precise-memory-info','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],samples=[];
const accelerated=process.env.ACCELERATED==='1',file=accelerated?'test-results/battlefield-pilot.json':'test-results/battlefield-soak.json';
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('test-results',{recursive:true});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();await page.waitForTimeout(1000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const initial=await page.evaluate(()=>({heap:performance.memory.usedJSHeapSize,stats:window.__game.diagnostics.snapshot()}));
 await page.evaluate(({accelerated})=>{
  const g=window.__game,V=g.player.position.constructor;
  g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;g.player.locked=true;
  // Input driver replaces only OS pointer capture; deploy(), damage, AI, capture and tickets stay real.
  g.player.lock=async()=>{g.player.locked=true;g.player.onLock(true);};
  g.player.onLock=locked=>{g.player.locked=true;if(!g.match.winner){g.paused=false;g.hud.menu.hidden=true;}};
  let decisionAt=0,planAt=0,checkAt=0,playerPath=[],pathIndex=0,targetId=null,acquired=0,lastPlayerShot=-10,roundChanges=[],roundDeploys=[],roundAssignments=[],roundDeaths=0;
  const state={matches:[],steps:0,pressureMax:0,suppressed:0,frontline:0,shots:0,playerShots:0,sounds:{},cpu:[],frames:[],done:false};let begin=0,last=0;
  const sound=g.audio.play.bind(g.audio);g.audio.play=(name,...args)=>{state.sounds[name]=(state.sounds[name]??0)+1;sound(name,...args);};
  const capture=g.capture.onCapture;g.capture.onCapture=(p,owner)=>{roundChanges.push({id:p.id,owner,time:g.time});capture(p,owner);};
  const death=g.combat.onDeath;g.combat.onDeath=(...args)=>{if(args[0].id===0)roundDeaths++;death(...args);};
  const fire=g.weapon.onFire;g.weapon.onFire=(...args)=>{state.playerShots++;fire(...args);};for(const b of g.bots){const shoot=b.onFire;b.onFire=(...args)=>{state.shots++;shoot(...args);};}
  const original=g.step.bind(g);g.step=dt=>{
    const p=g.player;state.steps++;
    if(!p.alive){p.keys.clear();playerPath=[];pathIndex=0;planAt=0;targetId=null;
      if(g.time>=p.respawnAt){const options=g.spawns.candidates(),front=options.find(o=>o.id!=='BASE'&&o.available),choice=front??options[0];g.selectedSpawn=choice.id;
        state.suppressed+=options.filter(o=>o.reason==='出生点受压制').length;if(g.deploy()){if(choice.id!=='BASE')state.frontline++;roundDeploys.push({time:g.time,point:choice.id});}}
    }
    if(p.alive&&g.time>=decisionAt){decisionAt=g.time+.18;p.keys.clear();let target=null,dist=40;
      for(const b of g.bots){if(!b.alive||b.team===p.team||b.protection>0)continue;const d=V.Distance(p.position,b.position);if(d<dist&&g.combat.visible(p,b)){dist=d;target=b;}}
      if(target){if(targetId!==target.id){targetId=target.id;acquired=g.time;}p.yaw=Math.atan2(target.position.x-p.position.x,target.position.z-p.position.z);p.pitch=-Math.atan2(target.position.y+(target.crouching?.8:1.15)-p.camera.position.y,Math.hypot(target.position.x-p.position.x,target.position.z-p.position.z));g.weapon.select(dist<1.8?2:1);p.ads=dist>7;p.update(0);if(g.time-acquired>.8&&g.time-lastPlayerShot>2.8){if(g.weapon.ammo===0)g.weapon.reload();else {g.weapon.attack();lastPlayerShot=g.time;}}}
      else{targetId=null;p.ads=false;
        if(g.time>=planAt){planAt=g.time+8;const goal=g.capture.points.filter(o=>o.owner!=='cn').sort((a,b)=>Math.hypot(a.x-p.position.x,a.z-p.position.z)-Math.hypot(b.x-p.position.x,b.z-p.position.z))[0]??g.capture.points[1];g.world.routePlanner.enqueue('soak-player',2,function*(){playerPath=yield* g.world.tactical.findSteps(p.position.clone(),new V(goal.x,goal.y??0,goal.z),'main');pathIndex=0;});}
        const next=playerPath[pathIndex];if(next){p.yaw=Math.atan2(next.x-p.position.x,next.z-p.position.z);p.pitch=0;p.keys.add('KeyW');if(V.DistanceSquared(next,p.position)<.7)pathIndex++;}if(g.weapon.ammo<5)g.weapon.reload();
      }
    }
    original(dt);
    if(g.time>=checkAt){checkAt=g.time+10;state.pressureMax=Math.max(state.pressureMax,g.pressure.active.size);roundAssignments.push({time:g.time,teams:['cn','jp'].map(team=>({team,points:g.capture.points.map(p=>({id:p.id,count:g.bots.filter(b=>b.alive&&b.team===team&&b.strategicObjective===p.id).length,near:g.bots.filter(b=>b.alive&&b.team===team&&Math.hypot(b.position.x-p.x,b.position.z-p.z)<14).length}))}))});}
    if(g.match.winner){state.matches.push({winner:g.match.winner,seconds:g.time,tickets:{...g.match.tickets},deaths:{...g.match.deaths},player:{...g.scores.row(0)},playerDeaths:roundDeaths,changes:roundChanges,deploys:roundDeploys,assignments:roundAssignments,stuckRecoveries:p.stuckRecovery.recoveries});
      if(state.matches.length>=2){state.done=true;g.paused=true;return;}
      g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;p.locked=true;lastPlayerShot=-10;decisionAt=planAt=checkAt=0;playerPath=[];pathIndex=0;roundChanges=[];roundDeploys=[];roundAssignments=[];roundDeaths=0;
    }
  };
  g.engine.onBeginFrameObservable.add(()=>{begin=performance.now();if(last)state.frames.push(begin-last);last=begin;});g.engine.onEndFrameObservable.add(()=>state.cpu.push(performance.now()-begin));
  const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b);return {mean:a.reduce((s,v)=>s+v,0)/(a.length||1),p95:sorted[Math.floor(a.length*.95)]??0,p99:sorted[Math.floor(a.length*.99)]??0};};
  window.__battlefieldSoak={state,take(){const result={done:state.done,time:g.time,matches:state.matches,shots:state.shots,playerShots:state.playerShots,frontline:state.frontline,suppressed:state.suppressed,pressureMax:state.pressureMax,cpu:stats(state.cpu),frame:stats(state.frames),stats:g.diagnostics.snapshot(),sounds:{...state.sounds},currentChanges:roundChanges,currentAssignments:roundAssignments.slice(-1),currentPositions:g.bots.map(b=>({id:b.id,p:b.position.asArray(),state:b.state,obj:b.strategicObjective,path:b.path.length,index:b.pathIndex}))};state.cpu=[];state.frames=[];return result;}};
  if(accelerated){g.engine.stopRenderLoop();window.__pilotTimer=setInterval(()=>{for(let i=0;i<300&&!state.done;i++)g.step(1/60);g.hud.update();g.scene.render();},0);}
 },{accelerated});
 const start=Date.now();let result;
 while(Date.now()-start<35*60*1000){await new Promise(r=>setTimeout(r,accelerated?2000:30000));result=await page.evaluate(()=>window.__battlefieldSoak.take());samples.push(result);fs.writeFileSync(file,JSON.stringify({running:true,accelerated,initial,samples,errors},null,2));console.log(JSON.stringify({wallSeconds:Math.round((Date.now()-start)/1000),gameSeconds:result.time,matches:result.matches.length,shots:result.shots,frontline:result.frontline,changes:result.currentChanges,cpu:result.cpu,assignments:result.currentAssignments}));if(result.done||errors.length)break;}
 await page.evaluate(()=>{window.__game.paused=true;clearInterval(window.__pilotTimer);});await page.waitForTimeout(2000);await cdp.send('HeapProfiler.collectGarbage');
 const final=await page.evaluate(()=>({heap:performance.memory.usedJSHeapSize,stats:window.__game.diagnostics.snapshot()}));
 const poolKeys=['meshes','materials','textures','ai','effectPool','shellPool','lights','smokePool','transformNodes'];
 const stablePools=poolKeys.every(k=>samples.every(s=>s.stats[k]===initial.stats[k])&&final.stats[k]===initial.stats[k]);
 const report={running:false,accelerated,wallSeconds:(Date.now()-start)/1000,browser:browser.version(),cpu:os.cpus()[0]?.model,initial,final,stablePools,postGCHeapDeltaMB:(final.heap-initial.heap)/1048576,samples,errors};fs.writeFileSync(file,JSON.stringify(report,null,2));
 assert.deepEqual(errors,[]);assert.equal(result.matches.length,2);assert.ok(result.pressureMax<=3);assert.ok(result.matches.every(m=>m.seconds>=480&&m.seconds<=900));
 assert.ok(stablePools);assert.equal(final.stats.audioVoices,0);assert.ok(report.postGCHeapDeltaMB<35);
 console.log(JSON.stringify({passed:true,matches:result.matches.map(m=>({seconds:m.seconds,winner:m.winner,tickets:m.tickets,changes:m.changes,deploys:m.deploys})),heapDelta:report.postGCHeapDeltaMB}));
}finally{await browser.close();}
