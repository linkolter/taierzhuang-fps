// Browser integration harness. PLAYWRIGHT_MODULE may point at a preinstalled package.
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173');
await page.waitForFunction(() => window.__game?.scene?.isReady());
await page.waitForTimeout(1000);
const stage = process.argv[2] || 'stage1';
await mkdir('test-results', { recursive: true });
const result = await page.evaluate((stage) => {
  const g = window.__game;
  g.player.update(0);
  g.weapon.attack(); const first = g.weapon.ammo;
  g.weapon.attack(); const blocked = g.weapon.ammo === first;
  g.weapon.update(1.6, 0); g.weapon.attack();
  const target = g.scene.getMeshByName('target');
  g.weapon.update(1.6, 0); g.weapon.reload(); g.weapon.update(3.3, 0);
  const result = { ammoAfterFirst: first, boltBlocksSecond: blocked, targetDead: target ? !target.isEnabled() : null, reloadAmmo: g.weapon.ammo, meshes: g.scene.meshes.length };
  if (stage === 'stage2') {
    const a = g.bots[0], b = g.bots[1]; a.position.set(-8,0,0); b.position.set(8,0,0); a.protection = b.protection = 0;
    const initial = a.position.x;
    a.update(.5, 1, [a], g.objectives, () => false); a.update(.5, 1.5, [a], g.objectives, () => false); result.aiMoves = a.position.x !== initial || a.position.z !== 0;
    let shots = 0; const oldFire = a.onFire; a.onFire = (...args) => { shots++; oldFire(...args); };
    for(let i=0;i<1800;i++) { const t = 2+i/30; a.update(1/30,t,[a,b],g.objectives,(x,y)=>g.combat.visible(x,y)); b.update(1/30,t,[a,b],g.objectives,(x,y)=>g.combat.visible(x,y)); if (!a.alive || !b.alive) break; }
    result.aiFires = shots > 0; result.aiDies = !a.alive || !b.alive;
  }
  return result;
}, stage);
await page.screenshot({ path: `test-results/${stage}.png` });
await writeFile(`test-results/${stage}.json`, JSON.stringify({ result, errors }, null, 2));
console.log(JSON.stringify({ result, errors }, null, 2));
await browser.close();
if(errors.length || !result.boltBlocksSecond || result.reloadAmmo !== 5 || (stage === 'stage2' && (!result.aiMoves || !result.aiFires || !result.aiDies))) process.exit(1);
