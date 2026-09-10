import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, PointLight, Scene, Vector3 } from '@babylonjs/core';
import { applyMapMaterials } from '../map/MapMaterials';
import { World } from '../map/World';
import { Player } from '../player/Player';
import { Weapon } from '../weapons/Weapon';
import { Bot } from '../ai/Bot';
import { Combat } from './Combat';
import type { Actor, Objective } from './types';
import { CONFIG } from '../config/gameConfig';
import { CaptureSystem } from '../capture/CaptureSystem';
import { Match } from './Match';
import { HUD } from '../ui/HUD';
import { CaptureVisuals } from '../capture/CaptureVisuals';
import { AudioSystem } from '../audio/AudioSystem';
import { Effects } from '../effects/Effects';
import { Diagnostics } from '../core/Diagnostics';
export class Game {
  engine: Engine; scene: Scene; world: World; player: Player; weapon: Weapon; time = 0; started = false;
  bots: Bot[] = []; actors: Actor[] = []; combat: Combat; hud: HUD;
  capture = new CaptureSystem(); match = new Match(); paused = true; hudClock = 0;
  captureVisuals:CaptureVisuals; audio=new AudioSystem(); effects:Effects; ambient:HemisphericLight; sun:DirectionalLight; lamp:PointLight; stepClock=0;
  diagnostics?:Diagnostics; private events=new AbortController(); private visible=(a:Actor,b:Actor)=>this.combat.visible(a,b);
  get objectives(): Objective[] { return this.capture.points; }
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true); this.engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/CONFIG.graphics.maxPixelRatio)); this.scene = new Scene(this.engine); this.scene.clearColor = Color4.FromHexString('#c5c7bbff');this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogStart=CONFIG.graphics.fogStart;this.scene.fogEnd=CONFIG.graphics.fogEnd;this.scene.fogColor=Color3.FromHexString('#c5c7bb');
    this.ambient = new HemisphericLight('sky', new Vector3(.3, 1, .2), this.scene); this.ambient.intensity = .8; this.ambient.groundColor = Color3.FromHexString('#71604b'); this.sun=new DirectionalLight('sun', new Vector3(-.5, -1, -.3), this.scene);this.sun.intensity=.9;
    this.lamp=new PointLight('nearest-oil-lamp',new Vector3(0,-2,-29),this.scene);this.lamp.diffuse=Color3.FromHexString('#f3b866');this.lamp.range=15;this.lamp.intensity=0;
    this.world = new World(this.scene); this.world.buildVillage(); applyMapMaterials(this.world); this.player = new Player(this.scene, canvas, this.world); this.weapon = new Weapon(this.scene, this.player, this.world);
    for (let i = 1; i <= CONFIG.ai.cnCount + CONFIG.ai.jpCount; i++) this.bots.push(new Bot(i, i <= CONFIG.ai.cnCount ? 'cn' : 'jp', this.world));
    this.actors = [this.player, ...this.bots]; this.combat = new Combat(this.world, this.actors); this.hud = new HUD(this);
    this.captureVisuals=new CaptureVisuals(this.world,this.capture);this.effects=new Effects(this.world);
    this.engine.maxFPS=CONFIG.graphics.maxFPS;if(import.meta.env.DEV)this.diagnostics=new Diagnostics(this);
    this.combat.onDeath = (victim, attacker, head) => { victim.respawnAt = this.time + CONFIG.match.respawn; if (victim instanceof Bot) victim.deadAt = this.time; else { this.player.deaths++; this.player.ads = false; } this.match.death(victim.team); if (attacker.id === 0) { this.player.kills++; this.hud.notify(head ? '爆头击杀 · 敌方兵力 −1' : '击杀确认 · 敌方兵力 −1'); } };
    this.combat.onHit = (victim, attacker, head) => { if (attacker.id === 0) {this.hud.hit(head);this.audio.play('hit');} if (victim.id === 0) {this.hud.hurt();this.audio.play(victim.health===0?'death':'hit');} };
    this.combat.onShot=(o,e,team,melee)=>{this.effects.shot(o,e,melee);if(Vector3.DistanceSquared(o,this.player.camera.position)>1)this.audio.play(melee?(team==='cn'?'dadao':'sabre'):'rifle',o,this.player.camera.position,this.player.yaw);};
    this.weapon.onSound=name=>this.audio.play(name);
    this.weapon.onFire = (o, d, melee) => { this.combat.shoot(this.player, o, d, melee); };
    this.bots.forEach(bot => { bot.onFire = (b,t,m) => this.combat.botShoot(b,t,m); });
    this.player.onAttack = () => this.weapon.attack(); this.player.onReload = () => this.weapon.reload(); this.player.onWeapon = n => this.weapon.select(n);
    this.capture.onCapture = (point, owner) => {this.hud.notify(`${point.id} ${point.name} · ${owner === 'cn' ? '中国方占领' : owner === 'jp' ? '日军占领' : '已中立'}`);this.bots.forEach(b=>b.requestReplan(this.time));};
    this.player.onLock = locked => { this.paused = !locked; this.audio.pause(!locked); if (locked) this.hud.menu.hidden = true; else this.hud.showMenu(); };
    this.player.update(0); this.bots.forEach(b => b.model.root.position.copyFrom(b.position));
    this.engine.runRenderLoop(() => { const dt = Math.min(.05, this.engine.getDeltaTime() / 1000); if (this.started && !this.paused && !this.match.winner) this.step(dt); this.hudClock += dt; if (this.hudClock > .08) { this.hud.update(); this.hudClock = 0; } this.scene.render();this.diagnostics?.update(); });
    window.addEventListener('resize', () => this.engine.resize(),{signal:this.events.signal});
  }
  start() { if (!this.started || this.match.winner) this.reset(); this.started = true; void this.audio.start().catch(()=>{}); void this.player.lock(); }
  reset() { this.audio.reset();if(this.diagnostics)this.diagnostics.restarts++;this.time = 0; this.match.reset(); this.capture.reset(); this.player.kills = 0; this.player.deaths = 0; this.player.respawn(); this.weapon.reset(); this.bots.forEach(b => b.respawn(0)); this.effects.reset();this.hud.messageUntil = 0; this.hud.hitUntil = 0; this.hud.hurtUntil = 0; this.hud.root.querySelector('h1')!.innerHTML = '烽火<span>乡关</span>'; }
  dispose(){this.events.abort();this.engine.stopRenderLoop();this.diagnostics?.dispose();this.player.dispose();this.hud.dispose();this.audio.dispose();this.scene.dispose();this.engine.dispose();}
  step(dt: number) {
    this.time += dt;
    for (const actor of this.actors) if (!actor.alive && this.time >= actor.respawnAt) { if (actor instanceof Bot) actor.respawn(this.time); else { this.player.respawn(); this.weapon.reset(); } }
    this.player.protection = Math.max(0, this.player.protection - dt); this.player.update(dt); this.weapon.update(dt, this.time);
    for (const b of this.bots) b.update(dt, this.time, this.actors, this.objectives, this.visible);
    this.separateActors();
    this.capture.update(dt, this.actors); this.match.update(dt, this.capture);
    this.captureVisuals.update(this.time);this.effects.update(dt);const underground=this.world.undergroundAt(this.player.position.x,this.player.position.y,this.player.position.z);this.ambient.intensity=underground?.25:.8;this.sun.intensity=underground?.04:.9;this.lamp.intensity=underground?1.5:0;if(underground){let nearest=this.world.lamps[0];for(const p of this.world.lamps)if(Vector3.DistanceSquared(p,this.player.position)<Vector3.DistanceSquared(nearest,this.player.position))nearest=p;this.lamp.position.copyFrom(nearest);}
    this.stepClock+=dt;if(this.player.moving&&this.stepClock>(this.player.sprinting?.29:.44)){this.audio.play('step');this.stepClock=0;}
    if (this.match.winner) { this.paused = true; document.exitPointerLock(); this.hud.win(); }
  }
  separateActors(){
    const diameter=CONFIG.player.radius*2;
    for(let i=0;i<this.actors.length;i++)for(let j=i+1;j<this.actors.length;j++){
      const a=this.actors[i],b=this.actors[j];if(!a.alive||!b.alive||Math.abs(a.position.y-b.position.y)>.8)continue;
      let dx=b.position.x-a.position.x,dz=b.position.z-a.position.z;const distance=Math.hypot(dx,dz);if(distance>=diameter)continue;
      if(distance<.001){dx=.001;dz=0;}const strength=Math.min(.08,(diameter-distance)*.5),length=Math.hypot(dx,dz);dx=dx/length*strength;dz=dz/length*strength;
      if(a.id!==0)this.world.move(a.position,-dx,-dz);if(b.id!==0)this.world.move(b.position,dx,dz);
    }
  }
}
