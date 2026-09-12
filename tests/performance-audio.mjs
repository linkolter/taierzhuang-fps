import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
fs.mkdirSync('.tools',{recursive:true});
const before=execFileSync('git',['show','0633cb7:src/audio/AudioSystem.ts'],{encoding:'utf8'}).replace("'../config/gameConfig'","'../src/config/gameConfig'");
fs.writeFileSync('.tools/perf-before-audio.ts',before);
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5190');await page.waitForFunction(()=>window.__game?.scene.isReady());
 const result=await page.evaluate(async()=>{
  window.__game.engine.stopRenderLoop();
  const {AudioSystem:Before}=await import('/.tools/perf-before-audio.ts'),{AudioSystem:After}=await import('/src/audio/AudioSystem.ts');
  const make=(Type,context)=>{const a=new Type();a.context=context;a.master=context.createGain();a.master.connect(context.destination);a.surfaceBus=context.createGain();a.surfaceBus.connect(a.master);a.tunnelBus=context.createBiquadFilter();a.tunnelBus.frequency.value=2300;a.tunnelBus.connect(a.master);a.noise=context.createBuffer(1,48000,48000);const data=a.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.sin(i*13.37);return a;};
  const waveform=async(Type,mix)=>{const c=new OfflineAudioContext(1,48000,48000);Object.defineProperty(c,'state',{get:()=> 'running'});const a=make(Type,c),random=Math.random;Math.random=()=>.5;try{a.play('rifle',undefined,undefined,0,mix);}finally{Math.random=random;}return (await c.startRendering()).getChannelData(0);};
  const equivalence=[];for(const mix of [0,.5,1]){const a=await waveform(Before,mix),b=await waveform(After,mix);let maxError=0;for(let i=0;i<a.length;i++)maxError=Math.max(maxError,Math.abs(a[i]-b[i]));equivalence.push({mix,maxError});}
  const c=new AudioContext();await c.resume();const a=make(Before,c),b=make(After,c),timings=[];let nodes=0;
  for(const method of ['createGain','createBiquadFilter','createBufferSource','createOscillator']){const original=c[method].bind(c);c[method]=(...args)=>{nodes++;return original(...args);};}
  // Interleave rounds to avoid attributing JIT warmup / drift to one implementation.
  for(const mix of [0,.5,1]){const rows={before:[],after:[]},counts={before:0,after:0};for(let round=0;round<10;round++)for(const label of round%2?['after','before']:['before','after']){const audio=label==='before'?a:b;for(let i=0;i<50;i++){const n=nodes,start=performance.now();audio.play('rifle',undefined,undefined,0,mix);const elapsed=performance.now()-start;if(round>=2){rows[label].push(elapsed);counts[label]+=nodes-n;}audio.reset();}}
   timings.push({mix,...Object.fromEntries(Object.entries(rows).map(([label,values])=>{values.sort((a,b)=>a-b);return [label,{meanMs:values.reduce((s,x)=>s+x,0)/values.length,p95Ms:values[Math.floor(values.length*.95)],nodesPerVoice:counts[label]/values.length,samples:values.length}];}))});}
  await c.close();return {equivalence,timings};
 });
 for(const r of result.equivalence)assert.ok(r.maxError<1e-7);for(const r of result.timings)assert.equal(r.before.nodesPerVoice-r.after.nodesPerVoice,r.mix===.5?0:3);
 fs.mkdirSync('test-results/performance',{recursive:true});fs.writeFileSync('test-results/performance/audio.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
