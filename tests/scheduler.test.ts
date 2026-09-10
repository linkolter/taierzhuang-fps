import test from 'node:test';
import assert from 'node:assert/strict';
import {RoutePlanningScheduler} from '../src/ai/RoutePlanningScheduler';

test('15 births drain at most one request per frame; invalid paths precede births and tactics',()=>{
  const scheduler=new RoutePlanningScheduler(2,()=>0),done:string[]=[];
  const run=(name:string)=>function*(){done.push(name);};
  for(let i=0;i<15;i++)scheduler.enqueue('birth'+i,1,run('birth'+i));
  scheduler.enqueue('tactical',2,run('tactical'));scheduler.enqueue('invalid',0,run('invalid'));
  for(let frame=0;frame<17;frame++){scheduler.tick();assert.equal(done.length,frame+1);}
  assert.equal(done[0],'invalid');assert.equal(done.at(-1),'tactical');assert.equal(scheduler.pending,0);
});
test('incremental work yields at its budget; duplicate requests do not accumulate; cancel releases scratch',()=>{
  let clock=0,released=false,finished=false;
  const scheduler=new RoutePlanningScheduler(2,()=>clock);
  scheduler.enqueue('bot',2,function*(){try{for(let i=0;i<20;i++){clock++;yield;}finished=true;}finally{released=true;}});
  scheduler.enqueue('bot',0,function*(){throw Error('duplicate');});
  scheduler.tick();assert.equal(clock,2);assert.equal(finished,false);assert.equal(scheduler.pending,1);
  scheduler.clear();assert.equal(released,true);assert.equal(scheduler.pending,0);
  scheduler.enqueue('respawn',1,function*(){finished=true;});scheduler.tick();assert.equal(finished,true);
});
