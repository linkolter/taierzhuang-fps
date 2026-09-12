import {createRequire} from 'node:module';
import fs from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('test-results',{recursive:true});
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.__game?.scene.isReady());await page.locator('#start').click();
 await page.evaluate(()=>{const g=window.__game;g.reset();g.started=true;g.paused=false;g.hud.menu.hidden=true;g.player.position.set(-48,3,28);g.player.protection=0;g.capture.points[0].owner='cn';g.capture.points[0].progress=1;g.bots[7].position.set(0,0,-7);g.combat.damage(g.player,g.bots[7],100);});
 await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__game.paused),false);assert.equal(await page.evaluate(()=>!!document.pointerLockElement),false);
 await page.waitForTimeout(5100);assert.equal(await page.evaluate(()=>window.__game.player.alive),false);await page.locator('[data-spawn="A"]').click();await page.waitForTimeout(150);await page.screenshot({path:'test-results/battlefield-death.png'});
 await page.locator('#deploy').click();await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>{const g=window.__game;return g.player.alive&&g.player.position.x>-65&&g.player.protection>0&&g.player.locked&&!g.paused;}));
 await page.keyboard.down('Tab');await page.waitForTimeout(150);assert.ok(await page.locator('#scoreboard').isVisible());assert.equal(await page.locator('#scoreboard tbody tr').count(),16);await page.screenshot({path:'test-results/battlefield-scoreboard.png'});await page.keyboard.up('Tab');
 const checks=await page.evaluate(()=>{
  const g=window.__game;g.paused=true;const sounds=[],original=g.weapon.onSound;g.weapon.onSound=n=>{sounds.push(n);original(n);};g.weapon.reset();g.weapon.ammo=0;g.weapon.reload();for(let i=0;i<200;i++)g.weapon.update(1/60,g.time+i/60);
  g.player.alive=false;g.player.respawnAt=0;g.selectedSpawn='A';const p=g.capture.points[0];p.owner='cn';p.progress=1;p.contested=false;const before=g.spawns.evaluate('A').available;p.contested=true;const rejected=!g.deploy();p.contested=false;
  g.match.tickets.jp=1;g.match.death('jp');g.hud.win();g.hud.update();return {sounds,before,rejected,roundEnd:g.hud.menu.textContent.includes('再来一局'),rows:g.scores.rows.length};
 });assert.ok(checks.before&&checks.rejected&&checks.roundEnd);for(const sound of ['reload-open','reload-clip','reload-press','reload-close'])assert.ok(checks.sounds.includes(sound));
 await page.screenshot({path:'test-results/battlefield-round-end.png'});await page.evaluate(()=>document.exitPointerLock());await page.locator('#start').click();await page.waitForTimeout(150);
 assert.ok(await page.evaluate(()=>{const g=window.__game;return g.player.alive&&!g.match.winner&&g.match.tickets.cn===100&&g.match.tickets.jp===100&&g.scores.rows.every(r=>r.score===0);}));
 assert.deepEqual(errors,[]);fs.writeFileSync('test-results/battlefield-browser.json',JSON.stringify({checks,errors,passed:true},null,2));console.log(JSON.stringify({checks,errors,passed:true}));
}finally{await browser.close();}
