import {SceneInstrumentation} from '@babylonjs/core';
import type {Game} from '../game/Game';
type Switch='DISABLE_AI'|'DISABLE_PATHFINDING'|'DISABLE_PERCEPTION'|'DISABLE_COVER'|'DISABLE_COLLISIONS_TEST'|'DISABLE_SHADOWS';
type Sample={ms:number;inclusiveMs:number;calls:number};
/** Opt-in developer profiling. All wrappers, observables and timers are removed on dispose. */
export class PerformanceMonitor{
 flags:Record<Switch,boolean>={DISABLE_AI:false,DISABLE_PATHFINDING:false,DISABLE_PERCEPTION:false,DISABLE_COVER:false,DISABLE_COLLISIONS_TEST:false,DISABLE_SHADOWS:false};
 samples:Record<string,any>[]=[];results:Record<string,any>[]=[];private restores:(()=>void)[]=[];private buckets:Record<string,Sample>={};private children:number[]=[];private frames=0;private cpuSum=0;private cpuMax=0;private frameStart=0;private windowStart=performance.now();private intervalSum=0;private intervalMax=0;private lastStart=0;private disposed=false;private running=false;
 private panel=document.createElement('section');private out=document.createElement('pre');private result=document.createElement('pre');private checks:HTMLInputElement[]=[];
 constructor(private g:Game){
  const instrumentation=new SceneInstrumentation(g.scene);this.restores.push(()=>instrumentation.dispose());
  this.panel.id='performance-monitor';this.panel.style.cssText='position:fixed;top:64px;right:8px;width:520px;max-height:84vh;overflow:auto;background:#102018ed;color:#eee;padding:12px;z-index:10000;font:12px monospace';this.out.id='performance-live';this.result.id='performance-results';this.out.style.whiteSpace=this.result.style.whiteSpace='pre-wrap';
  const title=document.createElement('strong');title.textContent='CPU 性能诊断（每秒更新，保持原画质）';this.panel.append(title);
  for(const key of Object.keys(this.flags) as Switch[]){const label=document.createElement('label');label.style.display='block';const input=document.createElement('input');input.type='checkbox';input.onchange=()=>{this.flags[key]=input.checked;g.scene.shadowsEnabled=!this.flags.DISABLE_SHADOWS;};label.append(input,document.createTextNode(key));this.panel.append(label);this.checks.push(input);}
  const button=(text:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='font:12px sans-serif;margin:4px;padding:6px;width:auto;min-width:0';b.onclick=action;this.panel.append(b);};
  button('运行隔离测试',()=>void this.isolate());button('采样全系统',()=>void this.isolate(['ALL']));button('实时运行',()=>{g.reset();g.hud.menu.hidden=true;g.started=true;g.paused=false;});button('暂停',()=>{g.paused=true;});
  this.panel.append(this.out,this.result);document.body.append(this.panel);
  const wrap=(obj:any,key:string,bucket:string,disabled?:Switch,fallback?:()=>any)=>{
   const original=obj[key];const monitor=this;obj[key]=function(...args:any[]){if(disabled&&monitor.flags[disabled])return fallback?.();const start=performance.now();monitor.children.push(0);try{return original.apply(this,args);}finally{const elapsed=performance.now()-start,child=monitor.children.pop()!;if(monitor.children.length)monitor.children[monitor.children.length-1]+=elapsed;const value=monitor.buckets[bucket]??={ms:0,inclusiveMs:0,calls:0};value.ms+=elapsed-child;value.inclusiveMs+=elapsed;value.calls++;}};this.restores.push(()=>obj[key]=original);
  };
  for(const b of g.bots)wrap(b,'update','AI','DISABLE_AI');
  wrap(g.world.tactical,'find','Pathfinding','DISABLE_PATHFINDING',()=>[]);
  wrap(g.world.tactical,'nearest','Waypoint selection');
  wrap(g.combat,'visible','Perception / LOS','DISABLE_PERCEPTION',()=>false);
  wrap(g.world,'blocked','Perception / LOS');wrap(g.world,'chooseCover','Cover search','DISABLE_COVER',()=>null);
  wrap(g.world,'canStand','Collision / Terrain','DISABLE_COLLISIONS_TEST',()=>true);
  for(const method of ['move','floorAt'])wrap(g.world,method,'Collision / Terrain');
  wrap(g.scene,'pickWithRay','Mesh raycast');wrap(g.scene,'render','Render');
  const begin=g.engine.onBeginFrameObservable.add(()=>{const now=performance.now();this.frameStart=now;if(this.lastStart){const interval=now-this.lastStart;this.intervalSum+=interval;this.intervalMax=Math.max(this.intervalMax,interval);}this.lastStart=now;});
  const end=g.engine.onEndFrameObservable.add(()=>{const now=performance.now(),cpu=now-this.frameStart;this.frames++;this.cpuSum+=cpu;this.cpuMax=Math.max(this.cpuMax,cpu);if(now-this.windowStart>=1000)this.publish(now);});
  this.restores.push(()=>{g.engine.onBeginFrameObservable.remove(begin);g.engine.onEndFrameObservable.remove(end);});
 }
 private resetWindow(){this.buckets={};this.frames=0;this.cpuSum=0;this.cpuMax=0;this.intervalSum=0;this.intervalMax=0;this.windowStart=performance.now();}
 private publish(now:number){const g=this.g,seconds=(now-this.windowStart)/1000,frames=this.frames||1;const metrics:Record<string,any>={};for(const [key,value]of Object.entries(this.buckets))metrics[key]={selfMsPerFrame:value.ms/frames,inclusiveMsPerFrame:value.inclusiveMs/frames,callsPerSecond:value.calls/seconds};
  const sample={fps:frames/seconds,frameMeanMs:this.intervalSum/frames,frameMaxMs:this.intervalMax,cpuFrameMeanMs:this.cpuSum/frames,cpuFrameMaxMs:this.cpuMax,metrics,meshes:g.scene.meshes.length,activeMeshes:g.scene.getActiveMeshes().length,materials:g.scene.materials.length,textures:g.scene.textures.length,drawCalls:g.engine._drawCalls.current,activeIndices:g.scene.getActiveIndices(),ai:g.bots.length,waypoints:g.world.tactical!.nodes.length,coverPoints:g.world.coverPoints.length,renderWidth:g.engine.getRenderWidth(),renderHeight:g.engine.getRenderHeight(),meshRaycastsPerSecond:(this.buckets['Mesh raycast']?.calls??0)/seconds,pathfindsPerSecond:(this.buckets.Pathfinding?.calls??0)/seconds,renderer:g.engine.getGlInfo(),shadowsEnabled:g.scene.shadowsEnabled,flags:{...this.flags}};
  this.samples.push(sample);if(this.samples.length>180)this.samples.shift();this.out.textContent=JSON.stringify(sample,null,1);this.resetWindow();
 }
 async isolate(modes:string[]=['ALL',...Object.keys(this.flags)]){if(this.running)return;this.running=true;this.results=[];const g=this.g,random=Math.random;this.checks.forEach(c=>c.disabled=true);
  try{for(const mode of modes){
   if(this.disposed)break;g.paused=true;for(const key of Object.keys(this.flags) as Switch[])this.flags[key]=false;g.scene.shadowsEnabled=true;g.bots.forEach(b=>b.births=0);g.reset();g.hud.menu.hidden=true;g.player.locked=false;
   let seed=1938;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   // Identical deterministic battle state before each switch; warm-up is excluded from FPS samples.
   for(let i=0;i<2700;i++){g.step(1/30);if(i%300===299)await new Promise(r=>setTimeout(r,0));}
   g.player.position.set(-5,g.world.terrain.height(-5,0),0);g.player.yaw=Math.PI/2;g.player.update(0);
   if(mode!=='ALL')this.flags[mode as Switch]=true;g.scene.shadowsEnabled=!this.flags.DISABLE_SHADOWS;this.samples=[];this.resetWindow();g.started=true;g.paused=false;
   this.result.textContent='正在采样 '+mode;await new Promise(resolve=>setTimeout(resolve,6500));g.paused=true;
   const samples=this.samples.slice(1),avg=(key:string)=>samples.reduce((sum,s)=>sum+s[key],0)/(samples.length||1),metrics:Record<string,number>={};for(const sample of samples)for(const [name,value]of Object.entries(sample.metrics) as [string,any][])metrics[name]=(metrics[name]??0)+value.selfMsPerFrame/(samples.length||1);
   this.results.push({mode,frames:samples.length,fps:avg('fps'),cpuMs:avg('cpuFrameMeanMs'),maxCpuMs:Math.max(...samples.map(s=>s.cpuFrameMaxMs)),metrics,pathfindsPerSecond:avg('pathfindsPerSecond'),meshRaycastsPerSecond:avg('meshRaycastsPerSecond'),renderSize:[g.engine.getRenderWidth(),g.engine.getRenderHeight()]});this.result.textContent=JSON.stringify(this.results,null,2);
  }}finally{Math.random=random;g.paused=true;for(const key of Object.keys(this.flags) as Switch[])this.flags[key]=false;g.scene.shadowsEnabled=true;this.checks.forEach(c=>c.disabled=false);this.running=false;this.result.textContent=JSON.stringify({complete:true,results:this.results},null,2);}
 }
 dispose(){this.disposed=true;for(const restore of this.restores.reverse())restore();this.panel.remove();}
}
