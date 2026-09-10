import fs from 'node:fs';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.argv[2]||'http://127.0.0.1:5173';
const seconds=Number(process.argv[3]||180),label=process.argv[4]||'v2';
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:process.env.HEADED!=='1'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('crash',()=>errors.push('PAGE CRASH'));
await page.goto(url);await page.waitForFunction(()=>window.__game?.world.tactical,{timeout:120000});
// Compile shaders and settle loading at the same camera before starting the cold-birth measurement.
await page.waitForTimeout(5000);
await page.evaluate(()=>{
  const g=window.__game;g.paused=true;g.bots.forEach(b=>b.births=0);
  let seed=1938;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  g.reset();g.player.position.set(-5,g.world.terrain.height(-5,0),0);g.player.yaw=Math.PI/2;g.player.update(0);
  const buckets={},stack=[],frames=[],intervals=[],birthFrames=[],matches=[],lanes=new Set(),tunnels=new Set(),states=new Set();
  let start=0,last=0,shots=0,framesInWindow=0,lastSearch=g.world.tactical.searches,frameSearch=lastSearch,maxSearchesPerFrame=0;
  let lastCollision=g.world.collisionQueries||0,lastCandidates=g.world.collisionCandidates||0;
  let since=performance.now();
  const wrap=(obj,key,name)=>{const old=obj[key];obj[key]=function(...args){const t=performance.now();stack.push(0);try{return old.apply(this,args);}finally{const dt=performance.now()-t,children=stack.pop();if(stack.length)stack[stack.length-1]+=dt;const b=buckets[name]??={self:0,inclusive:0,calls:0};b.self+=dt-children;b.inclusive+=dt;b.calls++;}};};
  for(const b of g.bots)wrap(b,'update','AI');
  if(g.world.routePlanner)wrap(g.world.routePlanner,'tick','pathfinding');else wrap(g.world.tactical,'find','pathfinding');
  wrap(g.world.tactical,'nearest','nearest');
  for(const key of ['move','canStand','floorAt'])wrap(g.world,key,'collision');
  wrap(g.combat,'visible','LOS');wrap(g.world,'chooseCover','cover');
  if(g.world.pickStaticRay)wrap(g.world,'pickStaticRay','raycast');else wrap(g.scene,'pickWithRay','raycast');
  wrap(g.scene,'render','render');wrap(g,'step','gameOther');
  const onShot=g.combat.onShot;g.combat.onShot=(...args)=>{shots++;onShot(...args);};
  g.engine.onBeginFrameObservable.add(()=>{start=performance.now();if(last)intervals.push(start-last);last=start;});
  g.engine.onEndFrameObservable.add(()=>{
    const cpu=performance.now()-start;frames.push(cpu);framesInWindow++;
    const searches=g.world.tactical.searches-frameSearch;frameSearch=g.world.tactical.searches;maxSearchesPerFrame=Math.max(maxSearchesPerFrame,searches);
    if(g.time<2)birthFrames.push({time:g.time,cpu,searches,queue:g.world.routePlanner?.pending});
    for(const b of g.bots){states.add(b.state);if(b.position.z>20)lanes.add('north');if(b.position.z<-22)lanes.add('south');if(Math.abs(b.position.z)<12)lanes.add('main');if(g.world.undergroundAt(b.position.x,b.position.y,b.position.z))tunnels.add(b.id);}
    if(g.match.winner){matches.push({winner:g.match.winner,time:g.time,tickets:{...g.match.tickets},deaths:{...g.match.deaths}});g.reset();g.player.position.set(-5,g.world.terrain.height(-5,0),0);g.player.yaw=Math.PI/2;g.player.update(0);g.hud.menu.hidden=true;g.started=true;g.paused=false;}
  });
  const stats=a=>{const sorted=a.slice().sort((a,b)=>a-b),n=sorted.length;return {mean:a.reduce((s,x)=>s+x,0)/Math.max(1,n),p95:sorted[Math.floor((n-1)*.95)],p99:sorted[Math.floor((n-1)*.99)],max:sorted[n-1],count:n};};
  window.__probe={take(){
    const now=performance.now(),duration=(now-since)/1000,metrics={};for(const [k,v] of Object.entries(buckets))metrics[k]={selfMsPerFrame:v.self/framesInWindow,inclusiveMsPerFrame:v.inclusive/framesInWindow,callsPerSecond:v.calls/duration};
    const cq=g.world.collisionQueries||0,cc=g.world.collisionCandidates||0;
    const report={wallSeconds:duration,fps:framesInWindow/duration,cpu:stats(frames),frame:stats(intervals),metrics,searchesPerSecond:(g.world.tactical.searches-lastSearch)/duration,maxSearchesPerFrame,collisionCandidateMean:(cc-lastCandidates)/Math.max(1,cq-lastCollision),meshes:g.scene.meshes.length,activeMeshes:g.scene.getActiveMeshes().length,materials:g.scene.materials.length,textures:g.scene.textures.length,queue:g.world.routePlanner?.pending,scheduler:g.world.routePlanner?{maxMs:g.world.routePlanner.maxMs,maxWaitMs:g.world.routePlanner.maxWaitMs}:null,cache:{hits:g.world.tactical.cacheHits,misses:g.world.tactical.cacheMisses},matches:matches.slice(),lanes:[...lanes],tunnels:[...tunnels],states:[...states],shots,time:g.time,tickets:g.match.tickets,respawns:g.bots.map(b=>b.births),bots:g.bots.map(b=>({id:b.id,position:b.position.asArray(),state:b.state,route:b.route,index:b.pathIndex,path:b.path.length,recoveries:b.recoveries})),renderer:g.engine.getGlInfo(),renderSize:[g.engine.getRenderWidth(),g.engine.getRenderHeight()],birthFrames:birthFrames.splice(0),diagnostics:g.diagnostics?.errors};
    for(const key of Object.keys(buckets))delete buckets[key];frames.length=0;intervals.length=0;framesInWindow=0;maxSearchesPerFrame=0;since=now;lastSearch=g.world.tactical.searches;lastCollision=cq;lastCandidates=cc;return report;
  }};
  g.hud.menu.hidden=true;g.started=true;g.paused=false;
});
const cpu=()=>os.cpus().reduce((a,c)=>{a.idle+=c.times.idle;a.total+=Object.values(c.times).reduce((s,v)=>s+v,0);return a;},{idle:0,total:0});
const samples=[];let previousCpu=cpu();
fs.mkdirSync('test-results/performance',{recursive:true});
try{
  for(let elapsed=0;elapsed<seconds;){const span=Math.min(60,seconds-elapsed);await page.waitForTimeout(span*1000);elapsed+=span;const sample=await page.evaluate(()=>window.__probe.take());const currentCpu=cpu();sample.systemCpuPercent=100*(1-(currentCpu.idle-previousCpu.idle)/(currentCpu.total-previousCpu.total));previousCpu=currentCpu;samples.push(sample);
    fs.writeFileSync(`test-results/performance/${label}.json`,JSON.stringify({url,label,browser:browser.version(),headless:process.env.HEADED!=='1',hardware:os.cpus()[0]?.model,seconds:elapsed,errors,samples},null,2));
    console.log(JSON.stringify({label,seconds:elapsed,fps:sample.fps,cpu:sample.cpu,systemCpu:sample.systemCpuPercent,matches:sample.matches.length,meshes:sample.meshes,queue:sample.queue}));
  }
  await page.screenshot({path:`test-results/performance/${label}.png`});
}finally{await browser.close();}
