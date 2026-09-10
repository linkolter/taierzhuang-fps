import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
await page.goto('http://localhost:5173'); await page.waitForFunction(() => window.__game?.scene.isReady()); await page.waitForTimeout(500);
const stage = process.argv[2] || 'stage3';
const checks = await page.evaluate(() => {
  const g = window.__game, checks = {}; g.engine.stopRenderLoop(); g.reset();
  checks.roster = g.actors.filter(a=>a.team==='cn').length === 8 && g.actors.filter(a=>a.team==='jp').length === 8;
  const cn=g.bots[0], jp=g.bots.find(b=>b.team==='jp'), a=g.capture.points[0];
  cn.position.set(a.x,0,a.z); jp.position.set(a.x,0,a.z);
  g.capture.update(5,[cn,jp]); checks.contested = a.contested && a.progress === 0;
  g.capture.update(14,[cn]); checks.capture = a.owner === 'cn';
  g.capture.points[1].owner = 'cn'; g.match.update(7,g.capture); checks.bleed = g.match.tickets.jp===99;
  jp.protection=0; const tickets=g.match.tickets.jp; g.combat.damage(jp,cn,75); checks.body = jp.health===25; g.combat.damage(jp,cn,75); checks.death = !jp.alive && g.match.tickets.jp===tickets-1;
  g.time=jp.respawnAt; g.step(.01); checks.respawn=jp.alive && jp.health===100;
  jp.protection=0; g.combat.damage(jp,cn,150,true); checks.head = !jp.alive;
  g.match.tickets.jp=1; jp.respawn(0); jp.protection=0; g.combat.damage(jp,cn,100); g.step(.01); checks.victory=g.match.winner==='cn' && !g.hud.menu.hidden;
  g.reset(); checks.restart=g.match.winner===null && g.match.tickets.jp===100 && g.bots.every(b=>b.alive) && g.capture.points.every(p=>p.owner===null);
  g.player.protection=0; g.combat.damage(g.player,jp,150,true); checks.playerDeath=!g.player.alive; g.time=g.player.respawnAt; g.step(.01); checks.playerRespawn=g.player.alive && g.weapon.ammo===5;
  g.reset(); const V=g.player.position.constructor; const fullRoster=g.combat.actors;g.combat.actors=[g.player,jp];// V2 spawn court: keep this damage fixture before the new spawn-screen wall.
jp.position.set(-78.3,0,0);jp.protection=0;
  g.combat.shoot(g.player,new V(-80,1,0),new V(1,0,0),false);checks.bodyRay=jp.health===25;
  jp.health=100;g.combat.shoot(g.player,new V(-80,1.58,0),new V(1,0,0),false);checks.headRay=!jp.alive;
  jp.respawn(0);jp.position.set(-78.3,0,0);jp.protection=0;g.combat.shoot(g.player,new V(-80,1.2,0),new V(1,0,0),true);checks.meleeHit=!jp.alive;
  jp.respawn(0);jp.position.set(-76,0,0);jp.protection=0;g.combat.shoot(g.player,new V(-80,1.2,0),new V(1,0,0),true);checks.meleeRange=jp.health===100;
  const building=g.world.obstacles.find(o=>o.top>3&&o.w>7&&o.bottom>=0);if(building){jp.position.set(building.x+building.w/2+2,0,building.z);jp.health=100;g.combat.shoot(g.player,new V(building.x-building.w/2-2,1.2,building.z),new V(1,0,0),false);checks.wallOcclusion=jp.health===100;}
  g.combat.actors=fullRoster;g.reset();return checks;
});
const simulation = await page.evaluate(() => {
  const g=window.__game; let tunnelVisits=0, shots=0, tunnelExits=0; const entered=new Map();const visited={north:new Set(),south:new Set(),tunnel:new Set()},seenStates=new Set();const original=g.combat.onShot; g.combat.onShot=(...args)=>{shots++; original(...args);};
  for(let i=0;i<7300&&!g.match.winner;i++){g.step(.1);if(g.bots.some(b=>b.position.y < -2))tunnelVisits++;for(const b of g.bots){seenStates.add(b.state);if(b.alive){if(b.position.z>16&&b.position.y>1.5)visited.north.add(b.id);if(b.position.z< -32&&b.position.y> -1.6)visited.south.add(b.id);if(b.position.y< -2)visited.tunnel.add(b.id);}if(!b.alive){entered.delete(b.id);continue;}if(b.position.y < -3&&!entered.has(b.id))entered.set(b.id,b.position.x);if(b.position.y>=0&&entered.has(b.id)){if(Math.abs(b.position.x-entered.get(b.id))>30)tunnelExits++;entered.delete(b.id);}}}
  g.hud.update(); g.scene.render();
  return { visited:Object.fromEntries(Object.entries(visited).map(([k,v])=>[k,[...v]])),seenStates:[...seenStates],recoveries:g.bots.map(b=>[b.id,b.recoveries]), elapsed:g.time, winner:g.match.winner, tickets:g.match.tickets, deaths:g.match.deaths, points:g.capture.points.map(p=>[p.id,p.owner]), tunnelVisits, tunnelExits, shots, states:g.bots.map(b=>({id:b.id,state:b.state,position:b.position.asArray(),route:b.route,objective:b.objective})) };
});
await mkdir('test-results',{recursive:true}); await page.screenshot({path:`test-results/${stage}-match.png`});
const report={checks,simulation,errors}; await writeFile(`test-results/${stage}-gameplay.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
await browser.close(); if(errors.length || Object.values(checks).some(v=>!v) || !simulation.winner || simulation.shots===0) process.exit(1);

