import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady());await page.locator('#start').click();
 const checks=await page.evaluate(async()=>{
  const g=window.__game;g.engine.stopRenderLoop();g.reset();g.player.locked=false;g.hud.menu.hidden=true;await g.audio.start();
  const sizes=()=>[g.scene.meshes.length,g.scene.materials.length,g.scene.textures.length,g.scene.lights.length,g.scene.transformNodes.length];const initial=sizes(),sounds=[];const play=g.weapon.onSound;g.weapon.onSound=name=>{sounds.push(name);play(name);};
  g.player.position.set(-46,g.world.terrain.height(-46,0),0);g.player.yaw=.6;g.player.update(0);
  for(let i=0;i<6;i++){g.weapon.attack();if(i===0){window.__firstFlash=g.weapon.flash.light.isEnabled()&&g.weapon.flash.light.intensity>0&&g.weapon.flash.life>0;const ammo=g.weapon.ammo;g.weapon.attack();window.__boltLock=g.weapon.ammo===ammo;}
   for(let f=0;f<92;f++){g.player.update(1/60);g.weapon.update(1/60,f/60);g.effects.update(1/60);}
  }
  const rifleCount=sounds.filter(s=>s==='rifle').length,boltSounds=sounds.filter(s=>s.startsWith('bolt-'));
  for(let f=0;f<200;f++){g.player.update(1/60);g.weapon.update(1/60,f/60);}
  const reload=g.weapon.ammo===5&&g.weapon.reloadTime===0;
  g.weapon.reset();g.player.ads=true;for(let i=0;i<15;i++){g.player.update(1/60);g.weapon.update(1/60,i/60);}g.scene.render();
  const front=g.weapon.anchors.front,V=g.player.position.constructor;
  const projected=V.Project(V.Zero(),front.getWorldMatrix(),g.scene.getTransformMatrix(),g.player.camera.viewport.toGlobal(1440,900));
  const ads={blend:g.player.adsBlend,x:g.weapon.root.position.x,frontPixel:[projected.x,projected.y],state:g.weapon.state};
  const materialKinds=g.scene.textures.filter(t=>t.name.startsWith('procedural-')).map(t=>({name:t.name,size:t.getSize().width}));
  const rigs=[g.weapon.visual,...g.bots.map(b=>b.model.visual)];
  const weaponMaterialsShared=rigs.length===16&&new Set(rigs.flatMap(r=>r.meshes.map(m=>m.material))).size===3;
  g.weapon.shells.eject(g.player.camera.position,g.player.yaw);for(let i=0;i<100;i++)g.weapon.shells.eject(g.player.camera.position,g.player.yaw);
  const shellCapacity=g.weapon.shells.pool.length;
  for(let f=0;f<360;f++)g.weapon.shells.update(1/60);const shellsRecycled=g.weapon.shells.pool.every(p=>p.life<=0&&!p.mesh.isEnabled());
  g.audio.reset();for(const name of ['rifle','bolt-unlock','bolt-back','bolt-eject','bolt-forward','bolt-lock','reload','reload-feed','reload-close','dadao','sabre','melee-hit','impact-earth','impact-stone','impact-wood','impact-body','step-earth','step-stone','step-wood','step-tunnel','artillery','creak'])g.audio.play(name,g.player.position,g.player.position,0,name.includes('tunnel'));
  const maxVoices=g.audio.voices.size;await new Promise(r=>setTimeout(r,1800));const audioCleaned=g.audio.voices.size===0;
  g.weapon.reset();g.effects.reset();g.player.ads=true;for(let f=0;f<30;f++){g.player.update(1/60);g.weapon.update(1/60,f/60);}g.time=1;g.hud.update();g.scene.render();
  return {initial,final:sizes(),firstFlash:window.__firstFlash,boltLock:window.__boltLock,rifleCount,boltSounds,reload,ads,materialKinds,weaponMaterialsShared,shellCapacity,shellsRecycled,maxVoices,audioCleaned,covers:g.world.coverPoints.length};
 });
 await page.screenshot({path:'test-results/feedback-ads.png'});
 await page.evaluate(()=>{const g=window.__game;g.player.ads=false;for(let f=0;f<30;f++){g.player.update(1/60);g.weapon.update(1/60,f/60);}g.scene.render();});await page.screenshot({path:'test-results/feedback-village.png'});
 fs.writeFileSync('test-results/feedback-regression.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
 assert.deepEqual(checks.initial,checks.final);assert.ok(checks.firstFlash&&checks.boltLock&&checks.reload&&checks.weaponMaterialsShared&&checks.shellsRecycled&&checks.audioCleaned);
 assert.equal(checks.rifleCount,5);assert.equal(checks.boltSounds.length,25);assert.deepEqual(checks.materialKinds.map(t=>t.name),['procedural-OldWood']);assert.ok(checks.materialKinds.every(t=>t.size===256));assert.equal(checks.shellCapacity,24);assert.ok(checks.maxVoices<=24);assert.ok(Math.abs(checks.ads.frontPixel[0]-720)<2&&Math.abs(checks.ads.frontPixel[1]-450)<2);assert.equal(errors.length,0);
}finally{await browser.close();}
