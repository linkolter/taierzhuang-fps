import {createRequire} from 'node:module';import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();
 const ramps=await page.evaluate(async()=>{
  const {RAMPS}=await import('/src/map/MapLayout.ts'),{rampFloor}=await import('/src/map/Topology.ts'),g=window.__game;
  g.engine.stopRenderLoop();g.reset();g.player.locked=false;g.hud.menu.hidden=true;for(const b of g.bots){b.alive=false;b.respawnAt=Infinity;}const results=[];
  for(const r of RAMPS){const states=[],transitions=[];g.tunnelBlend=0;
    for(let i=0;i<=60;i++){const t=i/60,x=r.lip[0]+(r.bottom[0]-r.lip[0])*t,z=r.lip[1]+(r.bottom[1]-r.lip[1])*t;
      g.player.position.set(x,g.world.terrain.height(x,z),z);g.step(1/60);states.push({state:g.environmentState,blend:g.tunnelBlend,ambient:g.ambient.intensity});}
    for(let i=0;i<=90;i++){const t=i/90,x=r.lip[0]+(r.bottom[0]-r.lip[0])*t,z=r.lip[1]+(r.bottom[1]-r.lip[1])*t;
      g.player.position.set(x,rampFloor(r,x,z,g.world.terrain.height),z);g.step(1/60);transitions.push({state:g.environmentState,blend:g.tunnelBlend,ambient:g.ambient.intensity,fog:g.scene.fogEnd,exposure:g.scene.imageProcessingConfiguration.exposure});}
    for(let i=0;i<60;i++)g.step(1/60);results.push({id:r.id,surfaceCorrect:states.every(s=>s.state==='SURFACE'&&s.blend===0&&s.ambient===.8),portalSeen:transitions.some(s=>s.state==='PORTAL'),finalState:g.environmentState,finalBlend:g.tunnelBlend,maxFrameBlendChange:Math.max(...transitions.slice(1).map((s,i)=>Math.abs(s.blend-transitions[i].blend))),exposure:g.scene.imageProcessingConfiguration.exposure,fog:g.scene.fogEnd});
  }
  g.scene.render();return results;
 });for(const r of ramps){assert.ok(r.surfaceCorrect&&r.portalSeen,r.id);assert.equal(r.finalState,'TUNNEL',r.id);assert.ok(r.finalBlend>.99);assert.ok(r.maxFrameBlendChange<.1);assert.ok(r.exposure<.83&&r.fog<46);}
 assert.deepEqual(errors,[]);fs.writeFileSync('test-results/tunnel-environment-browser.json',JSON.stringify({ramps,errors,passed:true},null,2));console.log(JSON.stringify({ramps,errors,passed:true}));
}finally{await browser.close();}
