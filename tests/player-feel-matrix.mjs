import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const phase=process.env.FEEL_PHASE||'P4',out=`test-results/player-feel/${phase}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__game?.weaponAssetState==='ready'&&window.__game.scene.isReady());
 const report=await page.evaluate(({phase})=>{
  const g=window.__game,p=g.player,w=g.weapon;g.engine.stopRenderLoop();g.started=true;g.paused=true;g.hud.menu.hidden=true;
  const checks=[],data={};const check=(name,ok,detail)=>checks.push({name,ok:!!ok,detail});
  let sounds=[],ejects=0,shots=0;const sound=w.onSound,eject=w.shells.eject.bind(w.shells),fire=w.onFire;
  w.onSound=n=>{sounds.push(n);sound(n);};w.shells.eject=(...a)=>{ejects++;eject(...a);};w.onFire=(...a)=>{shots++;fire(...a);};
  const frame=dt=>{g.time+=dt;p.update(dt);w.update(dt,g.time);g.effects.update(dt);};
  const advance=seconds=>{for(let t=0;t<seconds-1e-9;t+=.01)frame(Math.min(.01,seconds-t));};
  const reset=()=>{p.respawn();p.position.set(-82,0,0);p.locked=true;w.reset();sounds=[];ejects=shots=0;g.time=10;};
  reset();g.canvas?.dispatchEvent?.(new MouseEvent('mousedown',{button:0}));
  // Use the actual canvas input once, then hold without issuing another mousedown.
  if(!shots){document.querySelector('canvas').dispatchEvent(new MouseEvent('mousedown',{button:0}));}
  advance(3.2);check('held primary input fires only once',shots===1&&w.ammo===4,{shots,ammo:w.ammo});
  reset();w.attack();const ammo=w.ammo;w.reload();w.select(2);w.select(1);advance(1.49);w.attack();
  check('bolt rejects R/1/2/repeated fire until 1.5s',w.reloadTime===0&&w.slot===1&&w.ammo===ammo&&shots===1);
  advance(.02);w.attack();check('next shot accepted after full cycle',shots===2&&w.ammo===3);
  reset();w.ammo=1;w.attack();w.attack();w.reload();advance(1.49);
  check('last round decremented/ejected once and not reloadable early',w.ammo===0&&shots===1&&ejects===1&&w.reloadTime===0,{shots,ejects});
  advance(.02);w.reload();check('last round reload starts after cycle',w.reloadTime===3.2);
  p.ads=true;w.attack();w.select(2);frame(.01);
  check('reload raw aim intent cannot enter ADS or fire/switch',p.adsIntent&&!p.effectiveADS&&p.adsBlend===0&&p.camera.fov===1.18&&shots===1&&w.slot===1);
  const yaw=p.yaw;document.dispatchEvent(new MouseEvent('mousemove',{movementX:100}));
  check('reload mouse sensitivity uses effective ADS',Math.abs(p.yaw-yaw-.2)<1e-9);
  advance(3.18);check('reload not committed early',w.ammo===0);advance(.02);check('reload commits five rounds once',w.ammo===5&&w.reloadTime===0);
  reset();w.select(2);advance(.35);p.ads=true;frame(.01);check('blade cannot ADS',!p.ads&&p.adsBlend===0&&p.camera.fov===1.18);
  reset();p.ads=true;advance(.21);w.attack();w.update(0,g.time);
  data.adsRecoil={translation:w.root.position.z-w.anchors.ads.position.z,rotation:w.rifle.rotation.x,camera:p.cameraKick};
  check('ADS recoil uses .65/.55, camera kick unchanged',Math.abs(data.adsRecoil.translation+.065)<1e-8&&Math.abs(data.adsRecoil.rotation+.0605)<1e-8&&p.cameraKick===.034,data.adsRecoil);
  reset();w.attack();for(const dt of [.7,.6,.2,.5])frame(dt);
  check('large dt bolt events exactly once in order',JSON.stringify(sounds)===JSON.stringify(['rifle','bolt-unlock','bolt-back','bolt-eject','bolt-forward','bolt-lock'])&&ejects===1,sounds.slice());
  sounds=[];w.reload();for(const dt of [1.5,1.6,.2,.7])frame(dt);
  check('large dt reload events exactly once in order',JSON.stringify(sounds)===JSON.stringify(['reload','reload-open','reload-clip','reload-press','reload-press','reload-feed','reload-close']),sounds.slice());
  reset();let landCount=0;const land=p.onLand;p.onLand=()=>{landCount++;land();};p.jumpQueued=true;
  while(!landCount&&g.time<12)frame(.005);
  const landing=[];for(let i=0;i<24;i++){landing.push(w.root.position.y-w.anchors.hip.position.y);frame(.005);}
  data.landing={landCount,min:Math.min(...landing),end:w.root.position.y-w.anchors.hip.position.y};
  check('one actual landing gives .015m gun dip, recovers by 120ms',landCount===1&&Math.abs(data.landing.min+.015)<1e-7&&Math.abs(data.landing.end)<1e-8,data.landing);
  p.onLand=land;
  reset();p.keys.add('KeyW');advance(.3);const groundedBob=w.bobWeight;p.jumpQueued=true;advance(.2);
  check('airborne weapon bob decays',!p.grounded&&w.bobWeight<groundedBob*.1,{groundedBob,airBob:w.bobWeight});
  if(phase==='P4'){
   reset();w.ammo=3;w.select(1);check('same-slot ignored',w.pendingSlot===null&&!w.switching);
   w.select(2);p.ads=true;w.attack();w.reload();w.select(1);frame(.1);
   check('holster rejects fire/reload/ADS/repeated switch',w.slot===1&&w.pendingSlot===2&&shots===0&&w.reloadTime===0&&!p.ads);
   frame(.05);check('switch at midpoint',w.slot===2&&w.switching&&w.blade.isEnabled()&&!w.rifle.isEnabled());
   frame(.14);w.attack();check('unholster still locks combat',shots===0&&w.switching);
   frame(.02);w.attack();check('ready after 300ms, melee cycle preserved',!w.switching&&w.pendingSlot===null&&shots===1&&w.cooldown===1.1);
   w.select(1);check('switch cannot shorten melee cooldown',w.slot===2&&!w.switching&&w.cooldown===1.1);
   advance(1.2);w.select(1);advance(.31);check('switch grants no ammunition',w.ammo===3);
   for(const reason of ['death','blur','unlock','reset','recovery']){
    reset();w.ammo=3;w.select(2);frame(.06);p.keys.add('KeyW');frame(.01);
    if(reason==='death')p.alive=false;
    if(reason==='blur')window.dispatchEvent(new Event('blur'));
    if(reason==='unlock')document.dispatchEvent(new Event('pointerlockchange'));
    if(reason==='reset'){p.respawn();w.reset();}
    if(reason==='recovery'){const recover=p.stuckRecovery.update;p.stuckRecovery.update=()=>true;frame(.01);p.stuckRecovery.update=recover;}
    check(`${reason} clears new transient states`,w.pendingSlot===null&&!w.switching&&w.landingTime===0&&p.currentVelocity.length()===0);
   }
   reset();p.health=100;g.hud.hurt();const fade=[];
   for(let i=0;i<=4;i++){g.hud.updateHurt();fade.push(Number(g.hud.el('hurt').style.opacity));g.time+=.1;}
   check('hurt fades continuously over .4s',fade[0]===.8&&fade[1]>fade[2]&&fade[2]>fade[3]&&fade[4]<1e-8,fade);
   p.health=25;g.hud.hurt();g.time+=.2;g.hud.updateHurt();const middle=Number(g.hud.el('hurt').style.opacity);g.hud.hurt();g.hud.updateHurt();const refreshed=Number(g.hud.el('hurt').style.opacity);g.time+=.41;g.hud.updateHurt();
   check('hurt refresh is bounded and returns to low-health floor',middle>.25&&middle<.8&&refreshed===.8&&Number(g.hud.el('hurt').style.opacity)===.25);
  }
  reset();g.scene.render();return {checks,data};
 },{phase});
 fs.writeFileSync(`${out}/matrix.json`,JSON.stringify({report,errors},null,2));
 console.log(JSON.stringify({phase,...report,errors},null,2));assert.deepEqual(errors,[]);assert.ok(report.checks.every(c=>c.ok),'Player Feel matrix failed');
}finally{await browser.close();}
