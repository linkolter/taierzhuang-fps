import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:process.env.TEST_BROWSER||'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();await page.waitForTimeout(300);
const checks={pointerLock:await page.evaluate(()=>!!document.pointerLockElement)};
await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');checks.move=await page.evaluate(()=>window.__game.player.position.x>-78);
await page.keyboard.down('ControlLeft');await page.waitForTimeout(150);checks.crouch=await page.evaluate(()=>window.__game.player.crouching);await page.keyboard.up('ControlLeft');
await page.keyboard.press('Space');await page.waitForTimeout(180);checks.jump=await page.evaluate(()=>window.__game.player.position.y>.1);await page.waitForTimeout(700);
await page.mouse.down({button:'right'});await page.waitForTimeout(250);checks.ads=await page.evaluate(()=>window.__game.player.ads&&window.__game.player.camera.fov<.8);await page.screenshot({path:'test-results/ads.png'});await page.mouse.up({button:'right'});
await page.mouse.click(960,540);await page.waitForTimeout(100);checks.fire=await page.evaluate(()=>window.__game.weapon.ammo===4);await page.waitForTimeout(1500);await page.keyboard.press('KeyR');await page.waitForTimeout(3400);checks.reload=await page.evaluate(()=>window.__game.weapon.ammo===5);
await page.keyboard.press('Digit2');await page.waitForTimeout(100);checks.meleeSwitch=await page.evaluate(()=>window.__game.weapon.slot===2);await page.mouse.click(960,540);await page.waitForTimeout(100);checks.meleeSwing=await page.evaluate(()=>window.__game.weapon.swing>0);await page.waitForTimeout(1200);await page.keyboard.press('Digit1');
await page.screenshot({path:'test-results/first-person.png'});
const fps=await page.evaluate(()=>({fps:window.__game.engine.getFps(),meshes:window.__game.scene.meshes.length,activeMeshes:window.__game.scene.getActiveMeshes().length,drawCalls:window.__game.engine._drawCalls.current}));
await page.keyboard.press('Escape');await page.waitForTimeout(150);checks.escapePause=await page.evaluate(()=>window.__game.paused&&!document.pointerLockElement);
const tunnel=await page.evaluate(()=>{
 const g=window.__game;g.engine.stopRenderLoop();g.reset();g.player.locked=true;g.hud.menu.hidden=true;g.started=true;
 const V=g.player.position.constructor;const p=g.player.position;p.set(-68,0,-12);let minY=0,failed=[];
 const walk=(goal)=>{const path=g.world.tactical.find(p,goal,'tunnel');if(!path.length){failed.push({noPath:goal.asArray()});return;}g.player.keys.add('KeyW');for(const node of path){let reached=false;for(let i=0;i<3000;i++){const d=node.subtract(p);d.y=0;if(d.length()<.09){reached=true;break;}g.player.yaw=Math.atan2(d.x,d.z);g.player.update(1/60);minY=Math.min(minY,p.y);}if(!reached){failed.push({goal:node.asArray(),at:p.asArray()});break;}}g.player.keys.clear();};
 walk(new V(-68,-4,-29));walk(new V(20,-4,-29));walk(new V(17,-4,-34));const room=p.y===-4&&p.z<-33.8;walk(new V(20,-4,-29));walk(new V(68,-4,-29));walk(new V(68,0,-12));const eastExit=p.y===0&&p.x>67;
 walk(new V(68,-4,-29));walk(new V(0,-4,-29));walk(new V(0,0,-12));const centralExit=p.y===0&&Math.abs(p.x)<.1;
 const exits=[];for(const [x,z] of [[-64,27],[64,27],[-48,-41],[20,-41],[48,-41]]){walk(new V(x,g.world.terrain.height(x,z),z));exits.push({x,z,passed:V.Distance(p,new V(x,g.world.terrain.height(x,z),z))<.2});walk(new V(0,0,-12));}
 p.set(-48,-4,-29);g.player.yaw=Math.PI/2;g.player.update(0);g.step(.01);g.hud.update();g.scene.render();
 return {minY,room,eastExit,centralExit,exits,failed};
});
await page.screenshot({path:'test-results/tunnel.png'});
const uniforms=await page.evaluate(()=>{const g=window.__game;g.reset();g.hud.menu.hidden=true;g.player.position.set(-76,0,20);g.player.yaw=0;g.player.pitch=0;g.player.update(0);g.bots.forEach((b,i)=>{b.position.set(-77+(i%2)*2,0,26+Math.floor(i/2)*4);b.model.root.position.copyFrom(b.position);b.model.root.rotation.y=Math.PI;b.model.update(0,false,true,false,0,-1);});g.ambient.intensity=.8;g.sun.intensity=.9;g.scene.render();return g.bots.map(b=>({id:b.id,team:b.team,meshes:b.model.meshes.length}));});
await page.screenshot({path:'test-results/uniforms.png'});
await mkdir('test-results',{recursive:true});const report={checks,tunnel,fps,errors};await writeFile(`test-results/input-tunnel-${process.env.TEST_BROWSER||'msedge'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(errors.length||Object.values(checks).some(x=>!x)||tunnel.failed.length||!tunnel.eastExit||!tunnel.centralExit||!tunnel.room||tunnel.exits.some(e=>!e.passed))process.exit(1);
