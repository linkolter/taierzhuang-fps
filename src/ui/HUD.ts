import { CONFIG } from '../config/gameConfig';
import type { Game } from '../game/Game';
export class HUD {
  root = document.querySelector<HTMLDivElement>('#ui')!;
  menu: HTMLElement; startButton: HTMLButtonElement; message = ''; messageUntil = 0; hitUntil = 0; hurtUntil = 0;
  private elements=new Map<string,HTMLElement>();private clickStart=()=>this.game.start();
  constructor(public game: Game) {
    this.root.innerHTML = `<div id="top"><div class="team cn"><span>中国方</span><strong id="cn-tickets">100</strong><i><b id="cn-bar"></b></i></div><div id="objectives"></div><div class="team jp"><span>日军方</span><strong id="jp-tickets">100</strong><i><b id="jp-bar"></b></i></div></div>
      <div id="clock"></div><div id="crosshair"><i></i><i></i><i></i><i></i></div><div id="hitmarker">×</div><div id="hurt"></div><div id="capture"></div><div id="notice"></div><div id="killfeed"></div><div id="location"></div>
      <div id="vitals"><span>中国方 · 步兵</span><div><strong id="health">100</strong><small>生命</small></div><i><b id="health-bar"></b></i></div>
      <div id="weapon"><span id="weapon-name">三八式步枪</span><div><strong id="ammo">5</strong><small id="ammo-max"> / 5</small></div><span id="weapon-state">栓动 · 单发</span></div>
      <div id="controls">WASD 移动　Shift 奔跑　C 蹲下　Space 跳跃　右键 瞄准　R 装填　1 / 2 武器　Esc 暂停</div>
      <div id="death" hidden><small>你已阵亡</small><h2>坚守，等待增援</h2><p>将在 <strong id="respawn">5</strong> 秒后从西侧重生</p></div>
      <div id="menu"><div class="menu-inner"><div class="eyebrow">华北乡村 · 据点争夺 · ALPHA 01</div><h1>烽火<span>乡关</span></h1><p class="subtitle">守住村庄，争夺每一寸土地。</p><div class="brief"><span>中国方 <b>你 + 7 AI</b></span><span>日军方 <b>8 AI</b></span><span>作战范围 <b>180 × 90 m</b></span></div><p id="menu-copy">争夺 A / B / C，控制多数据点消耗敌方兵力。<br>沿主街推进，或进入南侧地道迂回敌军侧翼。</p><button id="start">开始作战 <span>→</span></button><p class="menu-help">点击后锁定鼠标 · Esc 暂停并释放鼠标<br>左键射击 / 挥砍　右键瞄准　R 换弹　1 步枪　2 大刀</p><div class="footnote">原创程序化场景与角色 · 单人离线 8 v 8</div></div></div>`;
    this.menu = this.root.querySelector('#menu')!; this.startButton = this.root.querySelector('#start')!;
    this.startButton.addEventListener('click',this.clickStart);
  }
  el(id: string) {let element=this.elements.get(id);if(!element){element=this.root.querySelector<HTMLElement>('#'+id)!;this.elements.set(id,element);}return element;}
  html(id:string,html:string){const el=this.el(id);if(el.dataset.lastHtml!==html){el.innerHTML=html;el.dataset.lastHtml=html;}}
  dispose(){this.startButton.removeEventListener('click',this.clickStart);this.elements.clear();}
  notify(text: string, time = 3) { this.message = text; this.messageUntil = this.game.time + time; }
  hit(head: boolean) { this.hitUntil = this.game.time + .18; this.el('hitmarker').style.color = head ? '#d9ba72' : '#fff'; }
  hurt() { this.hurtUntil = this.game.time + .4; }
  showMenu() { if (!this.game.match.winner) { this.menu.hidden = false; if (this.game.started) { this.el('menu-copy').textContent = '作战已暂停。点击继续返回战场。'; this.startButton.innerHTML = '继续作战 <span>→</span>'; } } }
  win() { const g = this.game; this.menu.hidden = false; this.root.querySelector('h1')!.textContent = g.match.winner === 'cn' ? '中国方胜利' : '日军胜利'; this.el('menu-copy').innerHTML = `${g.match.reason}<br>击杀 ${g.player.kills} · 阵亡 ${g.player.deaths} · 用时 ${this.formatTime(g.match.elapsed)}`; this.startButton.innerHTML = '重新开始一局 <span>↻</span>'; }
  formatTime(t: number) { return `${Math.floor(t / 60).toString().padStart(2,'0')}:${Math.floor(t % 60).toString().padStart(2,'0')}`; }
  update() {
    const g = this.game, p = g.player, w = g.weapon;
    for (const team of ['cn','jp'] as const) { this.el(team + '-tickets').textContent = String(g.match.tickets[team]); this.el(team + '-bar').style.width = g.match.tickets[team] + '%'; }
    this.el('clock').textContent = g.match.elapsed >= CONFIG.match.duration ? '加时 · 下一次兵力优势决胜' : this.formatTime(CONFIG.match.duration - g.match.elapsed);
    this.html('objectives',g.capture.points.map(o => `<div class="objective ${o.owner ?? 'neutral'} ${o.contested ? 'contested' : ''}">${o.id}<i style="width:${Math.round(Math.abs(o.progress)*100)}%"></i></div>`).join(''));
    this.el('health').textContent = String(p.health); this.el('health-bar').style.width = p.health + '%';
    this.el('ammo').textContent = w.slot === 1 ? String(w.ammo) : '刀'; this.el('ammo-max').textContent = w.slot === 1 ? ' / 5' : '';
    this.el('weapon-name').textContent = w.slot === 1 ? '三八式步枪' : '中国大刀';
    this.el('weapon-state').textContent = w.reloadTime > 0 ? `装填中 ${w.reloadTime.toFixed(1)}s` : w.cooldown > 0 ? w.slot === 1 ? '拉栓中' : '收刀' : w.slot === 1 ? w.ammo === 0 ? '按 R 装填' : '栓动 · 单发' : '近战 · 2 米';
    this.el('crosshair').hidden = p.ads || !p.alive || !g.started; this.el('hitmarker').hidden = g.time > this.hitUntil;
    this.el('hurt').style.opacity = g.time < this.hurtUntil ? '.8' : p.health < 35 && p.alive ? '.25' : '0';
    this.el('notice').textContent = g.time < this.messageUntil ? this.message : '';
    const cap = g.capture.points.find(o => Math.hypot(p.position.x-o.x,p.position.z-o.z) <= CONFIG.match.captureRadius && Math.abs(p.position.y-(o.y??0)) < 1.1);
    this.el('capture').innerHTML = cap && p.alive ? `<b>${cap.id} · ${cap.name}</b><span>${cap.contested ? '交战中 · 占领暂停' : cap.owner === p.team && cap.progress === 1 ? '我方控制' : '占领中'}　${Math.round(Math.abs(cap.progress)*100)}%</span><i><b style="width:${Math.abs(cap.progress)*100}%;background:${cap.progress >=0 ? CONFIG.colors.cn : CONFIG.colors.jp}"></b></i>` : '';
    this.el('death').hidden = p.alive || !!g.match.winner; this.el('respawn').textContent = String(Math.max(0, Math.ceil(p.respawnAt - g.time)));
    this.el('location').textContent = p.position.y < -1.5 ? '地下交通线 · 沿木支撑前进，出口通往南侧' : p.protection > 0 ? '出生保护中' : '主街 / 北侧院落 / 南侧低地　·　地道入口在南侧木牌处';
  }
}
