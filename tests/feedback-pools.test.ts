// Audits use the public object graph; no additional rendering or gameplay objects.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3} from '@babylonjs/core';
import {MuzzleLightPool} from '../src/effects/MuzzleLightPool';
import {ShellCasingPool} from '../src/effects/ShellCasingPool';
import {World} from '../src/map/World';
test('shared muzzle illumination expires without changing enabled light defines',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);try{const pool=MuzzleLightPool.forScene(scene);assert.equal(pool,MuzzleLightPool.forScene(scene));assert.equal(scene.lights.length,1);pool.pulse(new Vector3(1,2,3));assert.ok(pool.light.intensity>0);pool.update(.03);assert.ok(pool.light.intensity>0);pool.update(.02);assert.equal(pool.light.intensity,0);assert.ok(pool.light.isEnabled());pool.pulse(Vector3.Zero());pool.reset();assert.equal(pool.light.intensity,0);assert.equal(scene.lights.length,1);}finally{scene.dispose();engine.dispose();}
});
test('shell pool wraps at 24, bounces on terrain, and fully recycles after expiry',()=>{
 const engine=new NullEngine(),scene=new Scene(engine);try{const world=new World(scene),pool=new ShellCasingPool(world);const meshes=scene.meshes.length;let lands=0;pool.onLand=()=>lands++;for(let i=0;i<100;i++)pool.eject(new Vector3(0,1.4,0),0);for(let i=0;i<300;i++)pool.update(1/60);assert.equal(lands,24);assert.equal(scene.meshes.length,meshes);assert.ok(pool.pool.every(s=>s.life<=0&&!s.mesh.isEnabled()));pool.reset();assert.equal(pool.pool.length,24);}finally{scene.dispose();engine.dispose();}
});
