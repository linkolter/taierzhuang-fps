import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('crash',()=>errors.push('PAGE CRASH'));
fs.mkdirSync('test-results',{recursive:true});
try {
 await page.goto('http://127.0.0.1:5173/?mapcheck&perf');await page.waitForFunction(()=>window.__game&&document.querySelector('#performance-monitor')&&document.querySelector('#map-validation'));
 await page.locator('#start').click();await page.waitForTimeout(800);
 const capture=await page.evaluate(()=>({locked:!!document.pointerLockElement,fullscreen:!!document.fullscreenElement,ctrl:window.__game.player.ctrlCrouchAvailable}));
 assert.ok(capture.locked);assert.ok(capture.fullscreen);assert.ok(capture.ctrl);
 const checks=[];
 for(const modifier of ['ControlLeft','ControlRight'])for(const key of ['KeyW','KeyA','KeyS','KeyD']){
  await page.keyboard.down(modifier);await page.keyboard.down(key);await page.waitForTimeout(80);
  const state=await page.evaluate(()=>({crouching:window.__game.player.crouching,moving:window.__game.player.moving,finite:window.__game.player.position.asArray().every(Number.isFinite)}));
  checks.push({modifier,key,...state});assert.ok(state.crouching&&state.moving&&state.finite);
  await page.keyboard.up(key);await page.keyboard.up(modifier);
 }
 await page.keyboard.down('ControlLeft');await page.keyboard.down('KeyW');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 const cleared=await page.evaluate(()=>window.__game.player.keys.size===0&&!window.__game.player.jumpQueued);assert.ok(cleared);
 await page.keyboard.up('KeyW');await page.keyboard.up('ControlLeft');await page.keyboard.press('Escape');
 await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.__game.paused&&!document.pointerLockElement));
 console.log(JSON.stringify({capture,syntheticKeyChecks:checks,blurCleared:cleared}));
 await page.evaluate(()=>{document.querySelector('#performance-monitor').style.left='8px';document.querySelector('#performance-monitor').style.right='auto';window.__game.world.routePlanner.clear();});
 await page.getByRole('button',{name:'AI路线测试',exact:true}).click();
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#map-report').textContent).test==='AI routes';}catch{return false;}},{timeout:120000});
 const routes=await page.locator('#map-report').textContent();
 await page.getByRole('button',{name:'玩家通行测试',exact:true}).click();
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('#map-report').textContent).test==='player';}catch{return false;}},{timeout:120000});
 const player=await page.locator('#map-report').textContent();
 const hud=JSON.parse(await page.locator('#performance-live').textContent());
 const report={capture,syntheticKeyChecks:checks,blurCleared:cleared,routes:JSON.parse(routes),player:JSON.parse(player),hudFields:Object.keys(hud),errors,nativeShortcutTest:'not covered by Playwright keyboard injection'};
 fs.writeFileSync('test-results/browser-regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.ok(report.routes.results.every(r=>r.ok));assert.equal(report.player.passed,report.player.total);assert.equal(errors.length,0);
}finally{await browser.close();}
