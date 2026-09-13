import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];let requests=0;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/hanyang.glb'))requests++;});
fs.mkdirSync('test-results',{recursive:true});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5190');
 await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady(),{},{timeout:60000});
 const checks=await page.evaluate(()=>{
  const g=window.__game;g.paused=true;g.hud.menu.hidden=true;g.time=5;
  const rigs=[g.weapon.visual,...g.bots.map(b=>b.model.visual)];
  const meshes=rigs.flatMap(r=>r.meshes),materials=new Set(meshes.map(m=>m.material)),textures=new Set([...materials].flatMap(m=>m.getActiveTextures()));
  const counts=()=>({meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,nodes:g.scene.transformNodes.length});
  g.player.respawn();g.weapon.reset();g.player.update(0);g.weapon.update(0,0);g.scene.render();
  const V=g.player.position.constructor,bolt=g.weapon.visual.bolt;
  const closed=bolt.getAbsolutePosition().clone();g.weapon.visual.setBolt(1,1);bolt.computeWorldMatrix(true);const opened=bolt.getAbsolutePosition().clone();
  const travel=V.Dot(opened.subtract(closed),g.player.camera.getForwardRay().direction);g.weapon.visual.setBolt(0,0);
  g.weapon.attack();const firedAmmo=g.weapon.ammo,cycle=g.weapon.cooldown;for(let i=0;i<100;i++)g.weapon.update(.016,g.time);
  g.weapon.ammo=0;g.weapon.reload();const reloadTime=g.weapon.reloadTime;g.weapon.update(3.19,g.time);const beforeFull=g.weapon.ammo;g.weapon.update(.02,g.time);const afterFull=g.weapon.ammo;
  g.weapon.select(2);g.weapon.update(.31,g.time);const bladeOnly=g.weapon.blade.isEnabled()&&rigs[0].meshes.every(m=>!m.isEnabled());g.weapon.select(1);g.weapon.update(.31,g.time);
  g.player.alive=false;g.weapon.update(.016,g.time);const deathHidden=rigs[0].meshes.every(m=>!m.isEnabled());g.reset();g.weapon.update(0,0);g.scene.render();
  const before=counts();for(let i=0;i<20;i++){g.reset();g.weapon.update(0,0);g.scene.render();}const after=counts();
  return {rigs:rigs.length,cn:g.bots.filter(b=>b.team==='cn'&&b.model.visual).length,jp:g.bots.filter(b=>b.team==='jp'&&b.model.visual).length,
   geometries:new Set(meshes.map(m=>m.geometry)).size,materials:materials.size,textures:textures.size,internalTextures:new Set([...textures].map(t=>t.getInternalTexture())).size,unpickable:meshes.every(m=>!m.isPickable&&!m.checkCollisions),
   viewGroup:rigs[0].meshes.every(m=>m.renderingGroupId===2),worldGroup:rigs.slice(1).every(r=>r.meshes.every(m=>m.renderingGroupId===0)),
   travel,firedAmmo,cycle,reloadTime,beforeFull,afterFull,bladeOnly,deathHidden,before,after};
 });
 console.log(JSON.stringify(checks));
 assert.equal(checks.rigs,16);assert.equal(checks.cn,7);assert.equal(checks.jp,8);assert.equal(checks.geometries,3);assert.equal(checks.materials,3);assert.equal(checks.internalTextures,6);
 assert.ok(checks.unpickable&&checks.viewGroup&&checks.worldGroup&&checks.bladeOnly&&checks.deathHidden);
 assert.ok(Math.abs(checks.travel+.14)<.001);assert.equal(checks.firedAmmo,4);assert.equal(checks.cycle,1.5);assert.equal(checks.reloadTime,3.2);assert.equal(checks.beforeFull,0);assert.equal(checks.afterFull,5);assert.deepEqual(checks.before,checks.after);assert.equal(requests,1);
 await page.evaluate(()=>{const g=window.__game;g.time=5;g.paused=true;g.player.respawn();g.hud.menu.hidden=true;g.weapon.reset();g.player.update(0);g.weapon.update(.016,5);g.hud.update();g.scene.render();});
 await page.screenshot({path:'test-results/hanyang-hip.png'});
 await page.evaluate(()=>{const g=window.__game;g.player.ads=true;for(let i=0;i<60;i++){g.player.update(.016);g.weapon.update(.016,5);}g.hud.update();g.scene.render();});
 await page.screenshot({path:'test-results/hanyang-ads.png'});
 await page.evaluate(()=>{const g=window.__game;g.weapon.attack();for(let i=0;i<42;i++)g.weapon.update(.016,5);g.scene.render();});
 await page.screenshot({path:'test-results/hanyang-bolt.png'});
 await page.evaluate(()=>{const g=window.__game;g.weapon.root.setEnabled(false);g.player.ads=false;g.player.adsBlend=0;g.player.camera.fov=1.18;g.player.position.set(-80,0,-3);g.player.yaw=0;g.player.pitch=.05;g.player.update(0);for(let i=0;i<g.bots.length;i++)g.bots[i].model.root.setEnabled(false);for(const [i,x]of [[0,-81],[7,-79]]){const b=g.bots[i];b.model.root.position.set(x,0,0);b.model.root.rotation.y=Math.PI*.65;b.model.update(0,false,true,false,0,-1);b.model.root.setEnabled(true);}g.hud.update();g.scene.render();});
 await page.screenshot({path:'test-results/hanyang-teams.png'});
 // A delayed asset must respect selection and reset state when it arrives.
 const delayed=await browser.newPage();let release;const gate=new Promise(resolve=>release=resolve);
 await delayed.route('**/hanyang.glb',async route=>{await gate;await route.continue();});
 await delayed.goto(process.env.GAME_URL||'http://127.0.0.1:5190',{waitUntil:'domcontentloaded'});
 await delayed.waitForFunction(()=>!!window.__game);
 await delayed.evaluate(()=>{window.__game.reset();window.__game.weapon.select(2);window.__game.weapon.update(.31,0);});release();
 await delayed.waitForFunction(()=>window.__game.weaponAssetState==='ready');
 assert.ok(await delayed.evaluate(()=>window.__game.weapon.blade.isEnabled()&&window.__game.weapon.visual.meshes.every(m=>!m.isEnabled())));
 await delayed.close();assert.deepEqual(errors,[]);
 fs.writeFileSync('test-results/hanyang-browser.json',JSON.stringify({passed:true,requests,checks,errors},null,2));console.log(JSON.stringify({passed:true,requests,checks,errors},null,2));
}finally{await browser.close();}
