import {AIWorkScheduler} from '../ai/AIWorkScheduler';
import {parseQuality,qualityScaling,type Quality} from '../config/quality';
import { Color3, Color4, DirectionalLight, Engine, HemisphericLight, PointLight, Scene, Vector3 } from '@babylonjs/core';
import { applyMapMaterials } from '../map/MapMaterials';
import { World } from '../map/World';
import { Player } from '../player/Player';
import { Weapon } from '../weapons/Weapon';
import {PlayerPressureDirector} from '../ai/PlayerPressureDirector';
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
import { MapOverview } from '../dev/MapOverview';
import { SpawnSystem } from './SpawnSystem';
import { ScoreSystem } from './ScoreSystem';
import { StrategicDirector } from '../ai/StrategicDirector';
import { FootstepTracker } from '../audio/Footsteps';
export class Game {
  engine: Engine; scene: Scene; world: World; player: Player; weapon: Weapon; time = 0; started = false;
  bots: Bot[] = []; actors: Actor[] = []; combat: Combat; hud: HUD;
  pressure=new PlayerPressureDirector();capture = new CaptureSystem(); match = new Match(); paused = true; hudClock = 0;
  captureVisuals:CaptureVisuals; audio=new AudioSystem(); effects:Effects; ambient:HemisphericLight; sun:DirectionalLight; lamp:PointLight; stepClock=0;
  diagnostics?:Diagnostics; private events=new AbortController(); private visible=(a:Actor,b:Actor)=>this.combat.visible(a,b);
  mapOverview: MapOverview;
  spawns:SpawnSystem; scores:ScoreSystem; strategy=new StrategicDirector();
  selectedSpawn='BASE';deathCause='';tunnelBlend=0; environmentState='SURFACE';
  playerShots=0;playerHits=0;private spawnClock=0;
  spawnOptions:ReturnType<SpawnSystem['candidates']>=[];
  footsteps=new FootstepTracker();
  aiWork=new AIWorkScheduler();quality:Quality=parseQuality(new URLSearchParams(location.search).get('quality'));
  setQuality(value:string){this.quality=parseQuality(value);this.engine.setHardwareScalingLevel(qualityScaling(this.quality,window.devicePixelRatio,CONFIG.graphics.maxPixelRatio));this.engine.resize();}
  get objectives(): Objective[] { return this.capture.points; }
  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true); this.engine.setHardwareScalingLevel(qualityScaling(this.quality,window.devicePixelRatio,CONFIG.graphics.maxPixelRatio)); this.scene = new Scene(this.engine); this.scene.clearColor = Color4.FromHexString('#c5c7bbff');this.scene.fogMode=Scene.FOGMODE_LINEAR;this.scene.fogStart=CONFIG.graphics.fogStart;this.scene.fogEnd=CONFIG.graphics.fogEnd;this.scene.fogColor=Color3.FromHexString('#c5c7bb');
    this.ambient = new HemisphericLight('sky', new Vector3(.3, 1, .2), this.scene); this.ambient.intensity = .8; this.ambient.groundColor = Color3.FromHexString('#71604b'); this.sun=new DirectionalLight('sun', new Vector3(-.5, -1, -.3), this.scene);this.sun.intensity=.9;
    this.lamp=new PointLight('nearest-oil-lamp',new Vector3(0,-2,-29),this.scene);this.lamp.diffuse=Color3.FromHexString('#f3b866');this.lamp.range=15;this.lamp.intensity=0;
    this.world = new World(this.scene); this.world.buildVillage(); applyMapMaterials(this.world);
    const staticMapMeshes = [...this.scene.meshes];
    this.player = new Player(this.scene, canvas, this.world); this.weapon = new Weapon(this.scene, this.player, this.world);
    for (let i = 1; i <= CONFIG.ai.cnCount + CONFIG.ai.jpCount; i++) this.bots.push(new Bot(i, i <= CONFIG.ai.cnCount ? 'cn' : 'jp', this.world));
    this.actors = [this.player, ...this.bots]; this.combat = new Combat(this.world, this.actors);
    this.spawns=new SpawnSystem(this.world,this.capture,this.actors);this.scores=new ScoreSystem(this.actors);this.hud = new HUD(this);
    this.captureVisuals=new CaptureVisuals(this.world,this.capture);this.effects=new Effects(this.world);
    this.mapOverview = new MapOverview(this, staticMapMeshes);
    this.engine.maxFPS=CONFIG.graphics.maxFPS;if(import.meta.env.DEV)this.diagnostics=new Diagnostics(this);
    this.combat.onDeath = (victim, attacker, head) => {
      this.scores.death(victim,attacker,this.time,this.combat.lastWeapon,this.capture.points);
      victim.respawnAt = this.time + CONFIG.match.respawn;
      if (victim instanceof Bot) victim.deadAt = this.time;
      else { this.player.deaths++;this.player.ads=false;this.deathCause=`${this.scores.row(attacker.id).name} · ${this.combat.lastWeapon}${head?' · 头部命中':''}`;this.spawnClock=0;this.hud.menu.hidden=true;document.exitPointerLock(); }
      this.match.death(victim.team);
      if (attacker.id === 0) { this.player.kills++; this.hud.notify(head ? '爆头击杀 +100' : '击杀确认 +100'); }
    };
    this.combat.onHit = (victim, attacker, head) => {this.scores.hit(victim,attacker,this.time); if(victim instanceof Bot)victim.damaged(this.time);if (attacker.id === 0) {this.playerHits++;this.hud.hit(head);} if (victim.id === 0) {this.hud.hurt();this.audio.play(victim.health===0?'death':'hit');} };
    this.combat.onImpact=(position,material,melee)=>this.audio.play(melee?'melee-hit':`impact-${material}`,position,this.player.camera.position,this.player.yaw,this.world.environmentAt(position.x,position.y,position.z).blend);
    this.combat.onShot=(o,e,team,melee)=>{
      if(Vector3.DistanceSquared(o,this.player.camera.position)>1){this.effects.shot(o,e,melee);this.audio.play(melee?(team==='cn'?'dadao':'sabre'):'rifle',o,this.player.camera.position,this.player.yaw,this.world.environmentAt(o.x,o.y,o.z).blend);}
      else if(!melee)this.effects.flash(e,.09,.1);
    };
    this.weapon.onSound=name=>this.audio.play(name,undefined,undefined,0,this.tunnelBlend);
    this.weapon.shells.onLand=position=>this.audio.play('shell',position,this.player.camera.position,this.player.yaw,this.world.environmentAt(position.x,position.y,position.z).blend);
    this.weapon.onFire = (o, d, melee) => { if(!melee)this.playerShots++;this.combat.shoot(this.player, o, d, melee); };
    this.bots.forEach(bot => { bot.canFire=(b,t)=>this.combat.muzzleClear(b,t);bot.onSound=(name,position)=>{this.audio.play(name,position,this.player.camera.position,this.player.yaw,this.world.environmentAt(position.x,position.y,position.z).blend);if(name==='bolt-eject')this.weapon.shells.eject(this.combat.muzzle(bot),bot.model.root.rotation.y);};bot.onFire = (b,t,m) => this.combat.botShoot(b,t,m); });
    this.player.onAttack = () => this.weapon.attack(); this.player.onReload = () => this.weapon.reload(); this.player.onWeapon = n => this.weapon.select(n);
    this.capture.onCapture = (point, owner) => {this.scores.capture(point,owner);this.hud.notify(`${point.id} ${point.name} · ${owner === 'cn' ? '中国方占领' : owner === 'jp' ? '日军占领' : '已中立'}`);this.bots.forEach(b=>b.requestReplan(this.time));};
    this.player.onLock = locked => { if (this.mapOverview.active) return;if(this.started&&!this.player.alive&&!this.match.winner){this.paused=false;this.audio.pause(false);this.hud.menu.hidden=true;return;} this.paused = !locked; this.audio.pause(!locked); if (locked) this.hud.menu.hidden = true; else this.hud.showMenu(); };
    this.player.update(0); this.bots.forEach(b => b.model.root.position.copyFrom(b.position));
    this.engine.runRenderLoop(() => { const dt = Math.min(.05, this.engine.getDeltaTime() / 1000); if (this.started && !this.paused && !this.match.winner) this.step(dt); this.hudClock += dt; if (this.hudClock > .08) { this.hud.update(); this.hudClock = 0; } this.scene.render();this.diagnostics?.update(); });
    window.addEventListener('resize', () => this.engine.resize(),{signal:this.events.signal});
  }
  start() { if (this.mapOverview.active) return; if (!this.started || this.match.winner) this.reset(); this.started = true; void this.audio.start().catch(()=>{}); void this.player.lock(); }
  deploy(){
    if(this.player.alive||this.match.winner||this.time<this.player.respawnAt)return false;
    const candidate=this.spawns.evaluate(this.selectedSpawn);
    if(!candidate.available){this.hud.notify(candidate.reason);return false;}
    this.player.respawn(candidate.anchor!.position);this.weapon.reset();this.stepClock=0;this.footsteps.reset();
    this.paused=true;this.hud.el('death').hidden=true;void this.player.lock();return true;
  }
  reset() { this.aiWork.reset();this.footsteps.reset();this.strategy.reset();this.scores.reset();this.selectedSpawn='BASE';this.spawnOptions=[];this.spawnClock=0;this.deathCause='';this.tunnelBlend=0;this.playerShots=this.playerHits=0;this.pressure.reset();this.stepClock=0;this.world.routePlanner.clear();this.audio.reset();if(this.diagnostics)this.diagnostics.restarts++;this.time = 0; this.match.reset(); this.capture.reset(); this.player.kills = 0; this.player.deaths = 0; this.player.respawn(); this.weapon.reset(); this.bots.forEach(b => {b.strategicObjective='';b.respawn(0);}); this.effects.reset();this.hud.messageUntil = 0; this.hud.hitUntil = 0; this.hud.hurtUntil = 0;this.hud.el('death').hidden=true; this.hud.root.querySelector('h1')!.innerHTML = '烽火<span>乡关</span>'; }
  dispose(){this.events.abort();this.engine.stopRenderLoop();this.mapOverview.dispose();this.diagnostics?.dispose();this.player.dispose();this.hud.dispose();this.audio.dispose();this.scene.dispose();this.engine.dispose();}
  step(dt: number) {
    if(this.match.winner)return;
    this.time += dt;
    for (const actor of this.bots) if (!actor.alive && this.time >= actor.respawnAt) actor.respawn(this.time);
    this.player.protection = Math.max(0, this.player.protection - dt); this.player.update(dt); this.weapon.update(dt, this.time);
    this.pressure.update(dt,this.bots,this.player);
    this.strategy.update(dt,this.time,this.bots,this.capture.points);
    this.aiWork.beginFrame();
    for (const b of this.bots) b.update(dt, this.time, this.actors, this.objectives, this.visible,this.aiWork);
    this.world.routePlanner.tick();
    this.separateActors();
    this.scores.presence(dt,this.capture.points,this.actors);this.capture.update(dt, this.actors); this.match.update(dt, this.capture);
    this.spawnClock-=dt;if(!this.player.alive&&this.spawnClock<=0){this.spawnOptions=this.spawns.candidates();this.spawnClock=.4;}
    this.captureVisuals.update(this.time);this.effects.update(dt);
    const environment=this.world.environmentAt(this.player.position.x,this.player.position.y,this.player.position.z);this.environmentState=environment.state;
    this.tunnelBlend+=(environment.blend-this.tunnelBlend)*(1-Math.exp(-dt*6));const blend=this.tunnelBlend;
    this.ambient.intensity=.8-.55*blend;this.sun.intensity=.9-.86*blend;this.lamp.intensity=1.5*blend;
    this.scene.fogStart=CONFIG.graphics.fogStart*(1-blend)+8*blend;this.scene.fogEnd=CONFIG.graphics.fogEnd*(1-blend)+45*blend;
    this.scene.imageProcessingConfiguration.exposure=1-.18*blend;
    this.scene.fogColor.set(.773-.58*blend,.78-.59*blend,.733-.57*blend);
    if(blend>.01&&this.world.lamps.length){let nearest=this.world.lamps[0];for(const p of this.world.lamps)if(Vector3.DistanceSquared(p,this.player.position)<Vector3.DistanceSquared(nearest,this.player.position))nearest=p;this.lamp.position.copyFrom(nearest);}
    this.audio.update(dt,this.player.camera.position,this.player.yaw,blend);
    if(this.footsteps.advance(this.player.moveSpeed*dt,this.player.alive&&this.player.velocityY===0,this.player.crouching?'crouch':this.player.sprinting?'sprint':'walk')){
      this.audio.play('step-'+this.world.footstepAt(this.player.position),undefined,undefined,0,blend);
    }
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
