import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:process.env.TEST_BROWSER||'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();await page.waitForTimeout(300);
const checks={pointerLock:await page.evaluate(()=>!!document.pointerLockElement)};
await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');checks.move=await page.evaluate(()=>window.__game.player.position.x>-78);
await page.keyboard.down('ControlLeft');await page.waitForTimeout(150);checks.crouch=await page.evaluate(()=>window.__game.player.crouching);await page.keyboard.up('ControlLeft');
await page.keyboard.press('Space');await page.waitForTimeout(180);checks.jump=await page.evaluate(()=>window.__game.player.position.y>.1);await page.waitForTimeout(700);
await page.mouse.down({button:'right'});await page.waitForTimeout(250);checks.ads=await page.evaluate(()=>window.__game.player.ads&&window.__game.player.camera.fov>.85&&window.__game.player.camera.fov<1);await page.screenshot({path:'test-results/ads.png'});await page.mouse.up({button:'right'});
await page.mouse.click(960,540);await page.waitForTimeout(100);checks.fire=await page.evaluate(()=>window.__game.weapon.ammo===4);await page.waitForTimeout(1500);await page.keyboard.press('KeyR');await page.waitForTimeout(3400);checks.reload=await page.evaluate(()=>window.__game.weapon.ammo===5);
await page.keyboard.press('Digit2');await page.waitForTimeout(350);checks.meleeSwitch=await page.evaluate(()=>window.__game.weapon.slot===2);await page.mouse.click(960,540);await page.waitForTimeout(100);checks.meleeSwing=await page.evaluate(()=>window.__game.weapon.swing>0);await page.waitForTimeout(1200);await page.keyboard.press('Digit1');await page.waitForTimeout(350);
await page.screenshot({path:'test-results/first-person.png'});
const fps=await page.evaluate(()=>({fps:window.__game.engine.getFps(),meshes:window.__game.scene.meshes.length,activeMeshes:window.__game.scene.getActiveMeshes().length,drawCalls:window.__game.engine._drawCalls.current}));
await page.keyboard.press('Escape');await page.waitForTimeout(150);checks.escapePause=await page.evaluate(()=>window.__game.paused&&!document.pointerLockElement);
const tunnel=await page.evaluate(async()=>{
 const {RAMPS}=await import('/src/map/MapLayout.ts');
 const g=window.__game;g.engine.stopRenderLoop();g.reset();g.hud.menu.hidden=true;g.started=true;
 const V=g.player.position.constructor,p=g.player.position,hub=new V(0,-4,0);let minY=0,failed=[];
 const walk=goal=>{const path=g.world.tactical.find(p,goal,'tunnel');if(!path.length){failed.push({noPath:goal.asArray()});return false;}
  g.player.keys.add('KeyW');for(const node of path){let reached=false;for(let i=0;i<3000;i++){const d=node.subtract(p);d.y=0;if(d.length()<.09){reached=true;break;}g.player.yaw=Math.atan2(d.x,d.z);g.player.update(1/60);minY=Math.min(minY,p.y);}if(!reached){failed.push({goal:node.asArray(),at:p.asArray()});g.player.keys.clear();return false;}}g.player.keys.clear();return V.Distance(p,goal)<.2;};
 const exits=[];for(const ramp of RAMPS){const lip=new V(ramp.lip[0],g.world.terrain.height(...ramp.lip),ramp.lip[1]);g.player.respawn(lip);g.player.locked=true;const entered=walk(hub),exited=entered&&walk(lip);exits.push({id:ramp.id,entered,passed:exited});}
 g.player.respawn(hub);g.player.locked=true;g.player.update(0);g.step(.01);g.hud.update();g.scene.render();
 return {minY,room:exits.every(e=>e.entered),eastExit:exits.find(e=>e.id==='T10').passed,centralExit:exits.find(e=>e.id==='central').passed,exits,failed};
});
await page.screenshot({path:'test-results/tunnel.png'});
const uniforms=await page.evaluate(()=>{const g=window.__game;g.reset();g.hud.menu.hidden=true;g.player.position.set(-76,0,20);g.player.yaw=0;g.player.pitch=0;g.player.update(0);g.bots.forEach((b,i)=>{b.position.set(-77+(i%2)*2,0,26+Math.floor(i/2)*4);b.model.root.position.copyFrom(b.position);b.model.root.rotation.y=Math.PI;b.model.update(0,false,true,false,0,-1);});g.ambient.intensity=.8;g.sun.intensity=.9;g.scene.render();return g.bots.map(b=>({id:b.id,team:b.team,meshes:b.model.meshes.length}));});
await page.screenshot({path:'test-results/uniforms.png'});
await mkdir('test-results',{recursive:true});const report={checks,tunnel,fps,errors};await writeFile(`test-results/input-tunnel-${process.env.TEST_BROWSER||'msedge'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(errors.length||Object.values(checks).some(x=>!x)||tunnel.failed.length||!tunnel.eastExit||!tunnel.centralExit||!tunnel.room||tunnel.exits.some(e=>!e.passed))process.exit(1);
