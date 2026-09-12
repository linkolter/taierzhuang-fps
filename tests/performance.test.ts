import test from 'node:test';
import assert from 'node:assert/strict';
import {AIWorkScheduler,AI_WORK_LIMITS,type AIWorkKind} from '../src/ai/AIWorkScheduler';
import {parseQuality,qualityScaling} from '../src/config/quality';

test('all 16 actors requesting all heavy jobs remain bounded and get service',()=>{
  const scheduler=new AIWorkScheduler(),kinds:AIWorkKind[]=['perception','decision','fire'];
  const last=Array.from({length:16},()=>({perception:0,decision:0,fire:0}));
  let longest=0;
  for(let frame=1;frame<=240;frame++){
    scheduler.beginFrame();
    for(let id=0;id<16;id++)for(const kind of kinds)if(scheduler.allow(kind,id)){longest=Math.max(longest,frame-last[id][kind]);last[id][kind]=frame;}
    const state=scheduler.snapshot();assert.ok(state.actors<=5);assert.ok(state.pending<=48);
    for(const kind of kinds)assert.ok(state.used[kind]<=AI_WORK_LIMITS[kind]);
  }
  for(const row of last)for(const kind of kinds)assert.ok(row[kind]>220,'no starvation');
  assert.ok(longest<=16,`worst saturated service gap ${longest} frames`);
});
test('abandoned requests expire and reset releases queued actor references',()=>{
  const scheduler=new AIWorkScheduler();scheduler.beginFrame();
  for(let id=0;id<16;id++)scheduler.allow('perception',id);
  scheduler.beginFrame();scheduler.allow('perception',20);
  scheduler.beginFrame();assert.ok(scheduler.allow('perception',20));
  scheduler.reset();assert.equal(scheduler.snapshot().pending,0);assert.equal(scheduler.snapshot().actors,0);
});
test('MEDIUM is default and preserves the previous resolution formula',()=>{
  assert.equal(parseQuality(null),'MEDIUM');assert.equal(parseQuality('invalid'),'MEDIUM');
  for(const dpr of [1,1.25,1.5,2,3])assert.equal(qualityScaling('MEDIUM',dpr,1.5),Math.max(1,dpr/1.5));
  assert.equal(1920/qualityScaling('LOW',1,1.5),1440);
  assert.equal(1920/qualityScaling('HIGH',1,1.5),2400);
});
