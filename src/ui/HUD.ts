import { CONFIG } from '../config/gameConfig';
import type { Game } from '../game/Game';
import { Vector3, Matrix } from '@babylonjs/core';
import { inBase } from '../game/SpawnSystem';
import { captureState } from '../capture/CaptureSystem';
export class HUD {
  root = document.querySelector<HTMLDivElement>('#ui')!;
  menu: HTMLElement; startButton: HTMLButtonElement; message = ''; messageUntil = 0; hitUntil = 0; hurtUntil = 0;
  private elements=new Map<string,HTMLElement>();private clickStart=()=>this.game.start();
  private events=new AbortController();private scoreboard=false;
  constructor(public game: Game) {
    this.root.innerHTML = `<div id="top"><div class="team cn"><span>中国方</span><strong id="cn-tickets">100</strong><i><b id="cn-bar"></b></i></div><div id="objectives"></div><div class="team jp"><span>日军方</span><strong id="jp-tickets">100</strong><i><b id="jp-bar"></b></i></div></div>
      <div id="clock"></div><div id="crosshair"><i></i><i></i><i></i><i></i></div><div id="hitmarker">×</div><div id="hurt"></div><div id="capture"></div><div id="notice"></div><div id="killfeed"></div><div id="location"></div>
      <div id="vitals"><span>中国方 · 步兵</span><div><strong id="health">100</strong><small>生命</small></div><i><b id="health-bar"></b></i></div>
      <div id="weapon"><span id="weapon-name">三八式步枪</span><div><strong id="ammo">5</strong><small id="ammo-max"> / 5</small></div><span id="weapon-state">栓动 · 单发</span></div>
      <div id="controls">WASD 移动　Shift 奔跑　C 蹲下　Space 跳跃　右键 瞄准　R 装填　1 / 2 武器　Esc 暂停</div>
      <div id="world-objectives"></div><div id="scoreboard" hidden></div>
      <div id="death" hidden><small>你已阵亡</small><h2>选择增援位置</h2><p id="death-cause"></p><p id="death-score"></p><div id="spawn-map" aria-label="战术部署地图"><span class="map-north">北 ↑</span><div class="map-lanes"></div><div id="spawn-options"></div></div><p id="spawn-status"></p><button id="deploy">部署</button></div>
      <div id="menu"><div class="menu-inner"><div class="eyebrow">1938 鲁南村镇 · COMBAT MAP V3 · BLOCKOUT</div><h1>烽火<span>乡关</span></h1><p class="subtitle">守住村庄，争夺每一寸土地。</p><div class="brief"><span>中国方 <b>你 + 7 AI</b></span><span>日军方 <b>8 AI</b></span><span>作战范围 <b>180 × 90 m</b></span></div><p id="menu-copy">争夺 A / B / C，控制多数据点消耗敌方兵力。<br>A 西北祠堂 / B 村心水井 / C 东北粮仓。<br>当前为白盒验收版本，按 F8 查看全图。</p><button id="start">开始作战 <span>→</span></button><p class="menu-help">点击后全屏并锁定鼠标 · Esc 暂停并释放鼠标<br>C 下蹲；全屏按键捕获成功后也可用 Ctrl<br>左键射击 / 挥砍　右键瞄准　R 换弹　1 步枪　2 大刀</p><div class="footnote">原创程序化场景与角色 · 单人离线 8 v 8</div></div></div>`;
    this.menu = this.root.querySelector('#menu')!; this.startButton = this.root.querySelector('#start')!;
    this.startButton.addEventListener('click',this.clickStart);
    this.el('deploy').addEventListener('click',()=>this.game.deploy(),{signal:this.events.signal});
    this.el('spawn-options').addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button[data-spawn]');if(button&&!button.disabled)this.game.selectedSpawn=button.dataset.spawn!;},{signal:this.events.signal});
    document.addEventListener('keydown',e=>{if(e.code==='Tab'&&this.game.started){e.preventDefault();this.scoreboard=true;}},{signal:this.events.signal});
    document.addEventListener('keyup',e=>{if(e.code==='Tab'){e.preventDefault();this.scoreboard=false;}},{signal:this.events.signal});
    window.addEventListener('blur',()=>this.scoreboard=false,{signal:this.events.signal});
  }
  el(id: string) {let element=this.elements.get(id);if(!element){element=this.root.querySelector<HTMLElement>('#'+id)!;this.elements.set(id,element);}return element;}
  html(id:string,html:string){const el=this.el(id);if(el.dataset.lastHtml!==html){el.innerHTML=html;el.dataset.lastHtml=html;}}
  dispose(){this.events.abort();this.startButton.removeEventListener('click',this.clickStart);this.elements.clear();}
  notify(text: string, time = 3) { this.message = text; this.messageUntil = this.game.time + time; }
  hit(head: boolean) { this.hitUntil = this.game.time + .18; this.el('hitmarker').style.color = head ? '#d9ba72' : '#fff'; }
  hurt() { this.hurtUntil = this.game.time + .4; }
  showMenu() { if (!this.game.match.winner) { this.menu.hidden = false; if (this.game.started) { this.el('menu-copy').textContent = '作战已暂停。点击继续返回战场。'; this.startButton.innerHTML = '继续作战 <span>→</span>'; } } }
  win() { const g = this.game,r=g.scores.row(0); this.menu.hidden = false; this.root.querySelector('h1')!.textContent = g.match.winner === 'cn' ? '胜利 · 坚守乡关' : '失败 · 来日再战'; this.el('menu-copy').innerHTML = `${g.match.reason}<br>中国 ${g.match.tickets.cn} : ${g.match.tickets.jp} 日军 · 用时 ${this.formatTime(g.match.elapsed)}<br>K/D ${r.kills}/${r.deaths} · 积分 ${r.score}<br>占领 ${r.captures} · 防守 ${r.defenses} · 助攻 ${r.assists}`; this.startButton.innerHTML = '再来一局 <span>↻</span>'; }
  formatTime(t: number) { return `${Math.floor(t / 60).toString().padStart(2,'0')}:${Math.floor(t % 60).toString().padStart(2,'0')}`; }
  update() {
    const g = this.game, p = g.player, w = g.weapon;
    for (const team of ['cn','jp'] as const) { this.el(team + '-tickets').textContent = String(g.match.tickets[team]); this.el(team + '-bar').style.width = g.match.tickets[team] + '%'; }
    this.el('clock').textContent = g.match.elapsed >= CONFIG.match.duration ? '加时 · 下一次兵力优势决胜' : this.formatTime(CONFIG.match.duration - g.match.elapsed);
    this.html('objectives',g.capture.points.map(o => `<div class="objective ${o.owner ?? 'neutral'} ${o.contested ? 'contested' : ''}">${o.id}<i style="width:${Math.round(Math.abs(o.progress)*100)}%"></i></div>`).join(''));
    this.html('controls',`WASD 移动　Shift 奔跑　${p.ctrlCrouchAvailable ? 'Ctrl / C' : 'C'} 蹲下　Space 跳跃　右键 瞄准　R 装填　1 / 2 武器　Tab 比分板　Esc 暂停`);
    this.el('health').textContent = String(p.health); this.el('health-bar').style.width = p.health + '%';
    this.el('ammo').textContent = w.slot === 1 ? String(w.ammo) : '刀'; this.el('ammo-max').textContent = w.slot === 1 ? ' / 5' : '';
    this.el('weapon-name').textContent = w.slot === 1 ? '三八式步枪' : '中国大刀';
    this.el('weapon-state').textContent = w.reloadTime > 0 ? `装填中 ${w.reloadTime.toFixed(1)}s` : w.cooldown > 0 ? w.slot === 1 ? '拉栓中' : '收刀' : w.slot === 1 ? w.ammo === 0 ? '按 R 装填' : '栓动 · 单发' : '近战 · 2 米';
    this.el('crosshair').hidden = p.ads || !p.alive || !g.started; this.el('hitmarker').hidden = g.time > this.hitUntil;
    this.el('hurt').style.opacity = g.time < this.hurtUntil ? '.8' : p.health < 35 && p.alive ? '.25' : '0';
    this.el('notice').textContent = g.time < this.messageUntil ? this.message : '';
    const cap = g.capture.points.find(o => Math.hypot(p.position.x-o.x,p.position.z-o.z) <= CONFIG.match.captureRadius && Math.abs(p.position.y-(o.y??0)) < 1.1);
    this.el('capture').innerHTML = cap && p.alive ? `<b>${cap.id} · ${cap.name}</b><span>${cap.contested ? '交战中 · 占领暂停' : cap.owner === p.team && cap.progress === 1 ? '我方控制' : '占领中'}　${Math.round(Math.abs(cap.progress)*100)}%</span><i><b style="width:${Math.abs(cap.progress)*100}%;background:${cap.progress >=0 ? CONFIG.colors.cn : CONFIG.colors.jp}"></b></i>` : '';
    this.el('death').hidden = p.alive || !!g.match.winner;
    if(!p.alive&&!g.match.winner){
      this.el('death-cause').textContent=`击杀者 / 原因：${g.deathCause}`;
      const r=g.scores.row(0);this.el('death-score').textContent=`中国 ${g.match.tickets.cn} : ${g.match.tickets.jp} 日军　K/D ${r.kills}/${r.deaths}　积分 ${r.score}`;
      this.html('spawn-options',g.spawnOptions.map(c=>{const o=g.capture.points.find(o=>o.id===c.id),x=o?.x??-82,z=o?.z??0;return `<button data-spawn="${c.id}" ${c.available?'':'disabled'} class="spawn-point ${o?.contested?'contested':o?.owner??(c.id==='BASE'?'cn':'neutral')} ${g.selectedSpawn===c.id?'selected':''}" style="left:${(x+90)/180*100}%;top:${(45-z)/90*100}%">${c.id}<small>${c.reason}</small></button>`;}).join(''));
      const selected=g.spawnOptions.find(c=>c.id===g.selectedSpawn),remaining=Math.max(0,Math.ceil(p.respawnAt-g.time));
      this.el('spawn-status').textContent=remaining?`增援准备 ${remaining} 秒 · 可先选择部署位置`:`${g.selectedSpawn} · ${selected?.reason??'评估中'}`;
      (this.el('deploy') as HTMLButtonElement).disabled=remaining>0||!selected?.available;
    }
    this.html('killfeed',g.scores.feed.filter(e=>g.time-e.time<7).map(e=>`<div class="${e.player?'player-kill':''}" style="opacity:${Math.min(1,(7-(g.time-e.time))/2)}">${e.attacker} [${e.weapon}] ${e.victim}</div>`).join(''));
    this.el('scoreboard').hidden=!this.scoreboard;
    if(this.scoreboard)this.html('scoreboard',(['cn','jp'] as const).map(team=>`<section><h3 class="${team}">${team==='cn'?'中国方':'日军方'} · ${g.match.tickets[team]}</h3><table><thead><tr><th>士兵</th><th>Kills</th><th>Deaths</th><th>Score</th></tr></thead><tbody>${g.scores.sorted(team).map(r=>`<tr class="${r.id===0?'player-row':''}"><td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.score}</td></tr>`).join('')}</tbody></table></section>`).join(''));
    const viewport=p.camera.viewport.toGlobal(g.engine.getRenderWidth(),g.engine.getRenderHeight());
    this.html('world-objectives',!p.alive||!g.started||g.mapOverview.active?'':g.capture.points.map(o=>{
      const position=new Vector3(o.x,(o.y??0)+3,o.z),toward=position.subtract(p.camera.position);
      if(Vector3.Dot(toward,p.camera.getForwardRay().direction)<=0)return '';
      const screen=Vector3.Project(position,Matrix.Identity(),g.scene.getTransformMatrix(),viewport);if(screen.z<0||screen.z>1)return '';
      const status=captureState(o);return `<div class="world-point ${o.contested?'contested':o.owner??'neutral'}" style="left:${screen.x/viewport.width*100}%;top:${screen.y/viewport.height*100}%">${o.id} · ${Math.round(toward.length())}m<small>${status==='CONTESTED'?'争夺':status==='CHINESE'?'中国控制':status==='JAPANESE'?'日军控制':'中立'}</small></div>`;
    }).join(''));
    this.el('location').textContent = this.game.world.undergroundAt(p.position.x,p.position.y,p.position.z) ? '地下交通线 · 木支撑与油灯引导各处出口' : inBase(p.position,p.team) ? '基地整备区 · 出界后交战' : p.protection > 0 ? '出生保护中'  : p.position.z>14?'北线高地 · A 祠堂 / C 粮仓':p.position.z<-14?'南线低沟 · 隐蔽推进':'村心窄巷 · B 水井 / 地下室';
  }
}
