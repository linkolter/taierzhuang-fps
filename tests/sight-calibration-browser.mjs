import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];let requests=0;
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/hanyang.glb'))requests++;});
const output='test-results/sight-calibration';fs.mkdirSync(output,{recursive:true});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5190');
 await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady()&&window.__sightDebug,{},{timeout:60000});
 const report=await page.evaluate(async()=>{
  const g=window.__game,w=g.weapon,p=g.player,d=window.__sightDebug;
  const V=p.position.constructor,Ray=p.camera.getForwardRay().constructor;
  g.engine.stopRenderLoop();g.paused=true;g.started=true;g.time=5;g.hud.menu.hidden=true;p.respawn();w.reset();
  // A clear lane at the player eye height; no map or AI simulation changes.
  p.position.set(-63,g.world.terrain.height(-63,12),12);p.yaw=Math.PI/2;p.pitch=0;
  const frame=dt=>{p.update(dt);w.update(dt,5);g.effects.update(dt);g.hud.update();g.scene.render();};
  frame(0);const hip={position:w.root.position.asArray(),rotation:w.root.rotationQuaternion.toEulerAngles().asArray()};
  const rigs=[w.visual,...g.bots.map(b=>b.model.visual)],meshes=rigs.flatMap(r=>r.meshes);
  const sharing={requests:1,geometries:new Set(meshes.map(m=>m.geometry)).size,materials:new Set(meshes.map(m=>m.material)).size,
   textures:new Set(meshes.flatMap(m=>m.material.getActiveTextures()).map(t=>t.getInternalTexture())).size,
   viewSlingHidden:!w.visual.meshes.find(m=>m.name.endsWith('hanyang-sling')).isEnabled(),
   worldSlingsVisible:rigs.slice(1).every(r=>r.meshes.find(m=>m.name.endsWith('hanyang-sling')).isEnabled())};
  p.ads=true;for(let i=0;i<21;i++)frame(.01);assertReady();
  function assertReady(){if(p.adsBlend!==1)throw Error('ADS did not settle in 210ms');}
  const ads={position:w.root.position.asArray(),rotation:w.root.rotationQuaternion.toEulerAngles().asArray(),fov:p.camera.fov,alignment:d.snapshot()};
  const home=w.root.getWorldMatrix().multiply(p.camera.getViewMatrix()).asArray();
  // Validate actual geometry clearance along the sight line (not only helper points).
  const sightRay=new Ray(p.camera.position.clone(),p.camera.getForwardRay().direction.clone(),1.6);
  const sightHits=w.visual.meshes.filter(m=>m.isEnabled()).map(m=>({mesh:m.name,hit:sightRay.intersectsMesh(m,false)})).filter(r=>r.hit.hit).map(r=>({mesh:r.mesh,distance:r.hit.distance,point:V.TransformCoordinates(r.hit.pickedPoint,w.rifle.getWorldMatrix().clone().invert()).asArray()}));
  const frontDistance=V.Distance(p.camera.position,w.anchors.front.getAbsolutePosition());
  const occluders=sightHits.filter(h=>h.distance<frontDistance-.003);
  const samples=[],phases=[];let minimumDepth=Infinity;
  const vertices=w.visual.meshes.filter(m=>m.isEnabled()).map(m=>[m,m.getVerticesData('position')]);
  const checkDepth=()=>{for(const [mesh,positions] of vertices){const matrix=mesh.getWorldMatrix().multiply(p.camera.getViewMatrix());for(let j=0;j<positions.length;j+=3){const v=V.TransformCoordinates(V.FromArray(positions,j),matrix);minimumDepth=Math.min(minimumDepth,v.z);}}};
  for(let shot=0;shot<10;shot++){
   if(w.ammo===0){w.reload();for(let f=0;f<205;f++)frame(1/60);p.ads=true;for(let f=0;f<15;f++)frame(1/60);}
   // Keep the real attack/ray/spread/recoil code. The frozen scene does not step AI.
   w.attack();for(let f=0;f<96;f++){frame(1/60);checkDepth();if(shot===0&&[9,25,38,65,84].includes(f))phases.push({frame:f,back:w.visual.bolt.position.asArray(),rotation:w.visual.bolt.rotation.asArray(),quaternion:w.visual.bolt.rotationQuaternion?.asArray()??null,handleUp:V.TransformNormal(new V(1,0,0),w.visual.bolt.getWorldMatrix().multiply(w.rifle.getWorldMatrix().clone().invert())).asArray()});}
   const matrix=w.root.getWorldMatrix().multiply(p.camera.getViewMatrix()).asArray();
   samples.push({cycle:shot+1,...d.snapshot(),matrixDrift:Math.max(...matrix.map((v,i)=>Math.abs(v-home[i]))),rootPosition:w.root.position.asArray(),boltPosition:w.visual.bolt.position.asArray(),boltRotation:w.visual.bolt.rotation.asArray()});
  }
  // Inspect every frame of sprint, reload and reverse transitions for near clipping too.
  p.ads=false;for(let i=0;i<15;i++)frame(1/60);
  for(let i=0;i<60;i++){p.sprinting=i<30;w.update(1/60,5);g.scene.render();checkDepth();}p.sprinting=false;
  w.ammo=0;w.reload();for(let i=0;i<215;i++){frame(1/60);checkDepth();}
  return {hip,ads,sharing,samples,phases,sightHits,frontDistance,occluders,minimumDepth,near:p.camera.minZ,cameraPitchAfterTen:p.pitch};
 });
 console.log(JSON.stringify({hip:report.hip,ads:report.ads,sharing:report.sharing,maxRearError:Math.max(...report.samples.map(s=>s.rearErrorPx)),sightHits:report.sightHits,frontDistance:report.frontDistance,minimumDepth:report.minimumDepth},null,2));
 fs.writeFileSync(`${output}/measurements.json`,JSON.stringify({report,errors,requests},null,2));
 assert.equal(report.sharing.geometries,3);assert.equal(report.sharing.materials,3);assert.equal(report.sharing.textures,6);
 assert.ok(report.sharing.viewSlingHidden&&report.sharing.worldSlingsVisible);assert.equal(requests,1);
 assert.ok(report.ads.alignment.rearErrorPx<.1&&report.ads.alignment.frontErrorPx<.1);
 assert.ok(report.samples.every(s=>s.rearErrorPx<.1&&s.frontErrorPx<.1&&s.matrixDrift<.00003&&s.boltRotation.every(v=>v===0)));
 assert.ok(report.samples.every(s=>s.lastShotErrorPx!==null&&s.lastShotErrorPx<1.1));
 assert.ok(report.minimumDepth>report.near+.02);assert.deepEqual(report.occluders,[]);
 assert.equal(report.cameraPitchAfterTen,0);assert.ok(report.phases[2].handleUp[1]>.8);
 await page.evaluate(()=>{const g=window.__game;g.player.respawn();g.weapon.reset();g.player.position.set(-72,g.world.terrain.height(-72,0),0);g.player.yaw=Math.PI/2;g.player.pitch=-.16;g.player.update(0);g.weapon.update(0,5);g.hud.update();g.scene.render();});
 await page.screenshot({path:`${output}/01-hip.png`});
 await page.evaluate(()=>{const g=window.__game;g.player.ads=true;for(let i=0;i<20;i++){g.player.update(1/60);g.weapon.update(1/60,5);}g.hud.update();g.scene.render();});
 await page.screenshot({path:`${output}/02-ads.png`});
 await page.screenshot({path:`${output}/ads-detail.png`,clip:{x:620,y:405,width:220,height:170}});
 await page.evaluate(()=>{const g=window.__game;g.weapon.attack();for(let i=0;i<100;i++){g.player.update(1/60);g.weapon.update(1/60,5);g.effects.update(1/60);}window.__sightDebug.enabled=true;g.hud.update();g.scene.render();});
 await page.screenshot({path:`${output}/ads-debug.png`});
 await page.evaluate(()=>{const g=window.__game;window.__sightDebug.enabled=false;g.weapon.attack();for(let i=0;i<45;i++){g.player.update(1/60);g.weapon.update(1/60,5);g.effects.update(1/60);}g.hud.update();g.scene.render();});
 await page.screenshot({path:`${output}/03-bolt-back.png`});
 await page.evaluate(()=>{const g=window.__game;g.weapon.root.setEnabled(false);g.player.ads=false;g.player.adsBlend=0;g.player.position.set(-80,0,-3);g.player.yaw=0;g.player.pitch=.05;g.player.update(0);g.bots.forEach(b=>b.model.root.setEnabled(false));for(const [i,x]of [[0,-81],[7,-79]]){const b=g.bots[i];b.model.root.position.set(x,0,0);b.model.root.rotation.y=Math.PI*.65;b.model.update(0,false,true,false,0,-1);b.model.root.setEnabled(true);}g.hud.update();g.scene.render();});
 await page.screenshot({path:`${output}/04-ai-third-person.png`});
 assert.deepEqual(errors,[]);console.log('Sight calibration passed');
}finally{await browser.close();}
