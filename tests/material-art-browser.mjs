import {createRequire} from 'node:module';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[],failed=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,2000));});
page.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
const label=process.env.ART_LABEL||'after',out=`test-results/material-art/${label}`;fs.mkdirSync(out,{recursive:true});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5190');await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady(),{},{timeout:120000});
 await page.evaluate(()=>{const g=window.__game;g.engine.stopRenderLoop();g.time=5;g.started=true;g.paused=true;g.player.respawn();g.weapon.reset();g.hud.menu.hidden=true;});
 const views=[['village',[-67,0,0],Math.PI/2,-.07],['courtyard',[-49,3,26],0,-.09],['roofs',[-30,14,-18],.28,.39],['trench',[34,-1.6,-36],Math.PI/2,0],['tunnel',[-43,-4,-18],Math.PI/2,0]];
 for(const [name,position,yaw,pitch]of views){
  await page.evaluate(({position,yaw,pitch})=>{const g=window.__game;g.player.position.set(...position);g.player.yaw=yaw;g.player.pitch=pitch;g.player.update(0);g.weapon.update(0,5);const b=g.world.environmentAt(...position).blend;g.ambient.intensity=.8-.55*b;g.sun.intensity=.9-.86*b;g.lamp.intensity=b*1.5;if(b){let nearest=g.world.lamps[0];for(const p of g.world.lamps)if(p.subtract(g.player.position).lengthSquared()<nearest.subtract(g.player.position).lengthSquared())nearest=p;g.lamp.position.copyFrom(nearest);}g.scene.fogStart=34*(1-b)+8*b;g.scene.fogEnd=100*(1-b)+45*b;g.hud.update();g.scene.render();},{position,yaw,pitch});
  await page.waitForFunction(()=>window.__game.scene.isReady());await page.evaluate(()=>{const g=window.__game;for(let i=0;i<4;i++)g.scene.render();});await page.screenshot({path:`${out}/${name}.png`});
 }
 await page.evaluate(()=>{const g=window.__game;g.player.position.set(-80,0,-3);g.player.yaw=0;g.player.pitch=.05;g.player.update(0);g.weapon.root.setEnabled(false);g.ambient.intensity=.8;g.sun.intensity=.9;g.lamp.intensity=0;g.bots.forEach(b=>b.model.root.setEnabled(false));for(const [i,x]of [[0,-81],[7,-79]]){const b=g.bots[i];b.model.root.position.set(x,0,0);b.model.root.rotation.y=Math.PI*.65;b.model.update(0,false,true,false,0,-1);b.model.root.setEnabled(true);}g.hud.update();g.scene.render();});
 await page.waitForFunction(()=>window.__game.scene.isReady());await page.evaluate(()=>window.__game.scene.render());await page.screenshot({path:`${out}/soldiers.png`});
 const result=await page.evaluate(async()=>{
  const g=window.__game;g.reset();g.hud.menu.hidden=true;g.started=true;g.paused=true;g.player.position.set(-57,0,-1);g.player.yaw=Math.PI/2;g.player.update(0);g.weapon.update(0,5);g.scene.render();
  const counts=()=>({meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,geometry:g.scene.geometries.length,nodes:g.scene.transformNodes.length,obstacles:g.world.obstacles.length,solids:g.world.solids.length});
  const initial=counts(),times=[];for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const start=performance.now();g.scene.render();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
  for(let i=0;i<10;i++){g.reset();g.weapon.update(0,5);g.scene.render();}
  const imported=g.scene.textures.filter(t=>t.name.includes('/textures/village/'));
  const textureGroups=new Map();for(const t of imported){const s=textureGroups.get(t.name)??new Set();s.add(t.getInternalTexture());textureGroups.set(t.name,s);}
  return {initial,afterResets:counts(),obstacles:JSON.stringify(g.world.obstacles),terrain:g.scene.meshes.filter(m=>m.metadata?.terrain).map(m=>({name:m.name,vertices:m.getTotalVertices(),indices:m.getTotalIndices()})),pbr:g.scene.materials.filter(m=>m.name.startsWith('village-')).map(m=>({name:m.name,ready:m.isReady(),textures:m.getActiveTextures().map(t=>t.name)})),imported:{urls:textureGroups.size,sets:new Set(imported.map(t=>t.name.split('/').at(-2))).size,allShared:[...textureGroups.values()].every(s=>s.size===1),allReady:imported.every(t=>t.isReady()),errors:g.villageMaterials?.errors??[]},renderCpuMs:{median:times[90],p95:times[171]},shaderErrors:g.scene.materials.filter(m=>m.getEffect?.()?.getCompilationError()).map(m=>m.name),weapon:{position:g.weapon.anchors.ads.position.asArray(),rear:g.weapon.anchors.rear.position.asArray(),front:g.weapon.anchors.front.position.asArray()}};
 });
 result.obstacleHash=createHash('sha256').update(result.obstacles).digest('hex');delete result.obstacles;
 if(label==='after'){
  const before=JSON.parse(fs.readFileSync('test-results/material-art/before/report.json','utf8')).result;
  assert.equal(result.obstacleHash,before.obstacleHash);assert.deepEqual(result.terrain,before.terrain);assert.deepEqual(result.weapon,before.weapon);
  assert.equal(result.imported.urls,45);assert.equal(result.imported.sets,15);assert.ok(result.imported.allShared&&result.imported.allReady);assert.deepEqual(result.imported.errors,[]);
 }
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({result,errors,failed},null,2));console.log(JSON.stringify({counts:result.initial,obstacleHash:result.obstacleHash,pbr:result.pbr.length,cpu:result.renderCpuMs,errors,failed}));
 if(errors.length||failed.length||JSON.stringify(result.initial)!==JSON.stringify(result.afterResets))process.exitCode=1;
}finally{await browser.close();}
