import { MeshBuilder, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import {BOLT_EVENTS,boltPose,type WeaponPose} from './BoltTimeline';
import {ShellCasingPool} from '../effects/ShellCasingPool';
import {MuzzleEffect} from '../effects/MuzzleEffect';
import {ProceduralMaterialFactory} from '../map/ProceduralMaterialFactory';
import { CONFIG } from '../config/gameConfig';
import { lerp } from '../core/math';
import { Player } from '../player/Player';
import { World } from '../map/World';

export class Weapon {
  state:WeaponPose='Idle';shells:ShellCasingPool;flash:MuzzleEffect;private swayX=0;private swayY=0;private bobPhase=0;private bobWeight=0;private lowering=0;private boltEvent=0;private reloadEvent=0;
  slot = 1; ammo: number = CONFIG.rifle.capacity; cooldown = 0; reloadTime = 0; recoil = 0; swing = 0;
  root: TransformNode; rifle: TransformNode; blade: TransformNode; bolt: TransformNode;
  onFire = (_origin: Vector3, _direction: Vector3, _melee: boolean) => {};
  onSound = (_name: string) => {};
  constructor(scene: Scene, public player: Player, world: World) {
    this.root = new TransformNode('view-weapon', scene); this.root.parent = player.camera;
    this.rifle = new TransformNode('type38', scene); this.rifle.parent = this.root;
    this.blade = new TransformNode('dadao', scene); this.blade.parent = this.root;
    const wood = world.material('rifle-stock', '#613f28'), steel = world.material('gunmetal', '#353b39'), edge = world.material('blade-steel', '#aab2ab');
    ProceduralMaterialFactory.forScene(scene).apply(wood,'OldWood');
    const part = (name: string, size: number[], pos: number[], mat: typeof wood, parent = this.rifle) => { const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene); m.position.set(...pos as [number, number, number]); m.material = mat; m.parent = parent; m.isPickable = false; m.renderingGroupId = 2; return m; };
    part('wood-stock', [.1, .12, .62], [0, -.025, .15], wood); part('wood-foreend', [.065, .075, .6], [0, .01, .65], wood); part('barrel', [.036, .036, .95], [0, .06, .56], steel); part('receiver', [.075, .055, .24], [0, .069, .2], steel);
    part('front-sight', [.008, .04, .016], [0, .103, 1.025], steel); part('rear-sight-left', [.012, .033, .035], [-.026, .106, .12], steel); part('rear-sight-right', [.012, .033, .035], [.026, .106, .12], steel);
    this.bolt = new TransformNode('bolt', scene); this.bolt.parent = this.rifle;this.bolt.position.set(0,.08,.23);part('bolt-handle', [.095,.024,.025],[.07,0,0],steel,this.bolt);part('bolt-knob',[.036,.036,.036],[.12,0,0],steel,this.bolt);
    part('dadao-blade', [.13, .68, .025], [0, .32, .25], edge, this.blade).rotation.z = -.12;
    part('dadao-tip', [.16, .18, .025], [.02, .71, .25], edge, this.blade).rotation.z = -.35;
    part('dadao-grip', [.046, .23, .05], [0, -.16, .25], wood, this.blade); part('dadao-guard', [.22, .025, .075], [0, -.025, .25], steel, this.blade);
    this.blade.setEnabled(false); this.root.position.set(.24, -.23, .36);
    this.shells=new ShellCasingPool(world);this.flash=new MuzzleEffect(world,this.rifle);
  }
  attack() {
    if (!this.player.alive || this.cooldown > 0 || this.reloadTime > 0 || this.player.sprinting) return;
    if (this.slot === 1 && this.ammo <= 0) { this.reload(); return; }
    if (this.slot === 1) { this.ammo--; this.cooldown = CONFIG.rifle.cycle; this.recoil=1;this.boltEvent=0;this.player.cameraKick+=this.player.ads?.034:.05;this.player.pitch-=this.player.ads?.009:.014;this.flash.fire();this.onSound('rifle'); }
    else { this.cooldown = CONFIG.melee.cn.cycle; this.swing = 1; this.onSound('dadao'); }
    const direction = this.player.camera.getForwardRay().direction.clone();
    if (this.slot === 1) { const spread = this.player.ads ? CONFIG.rifle.adsSpread : CONFIG.rifle.hipSpread; direction.x += (Math.random() - .5) * spread; direction.y += (Math.random() - .5) * spread; direction.z += (Math.random() - .5) * spread; direction.normalize(); }
    this.onFire(this.player.camera.position.clone(), direction, this.slot === 2);
  }
  reload() { if (this.slot !== 1 || this.reloadTime > 0 || this.ammo === CONFIG.rifle.capacity || this.cooldown > 0 || !this.player.alive) return; this.reloadEvent=0;this.reloadTime = CONFIG.rifle.reload; this.player.ads = false; this.onSound('reload'); }
  select(slot: number) { if (this.reloadTime > 0 || this.cooldown > 0) return; this.slot = slot; this.player.ads = false; this.rifle.setEnabled(slot === 1); this.blade.setEnabled(slot === 2); }
  reset() { this.ammo = CONFIG.rifle.capacity; this.cooldown = 0; this.reloadTime = 0; this.recoil=0;this.swing=0;this.boltEvent=0;this.reloadEvent=0;this.swayX=this.swayY=this.bobWeight=this.lowering=this.bobPhase=0;this.state='Idle';this.shells.reset();this.flash.reset();this.select(1); }
  update(dt:number,time:number) {
    this.shells.update(dt);this.flash.update(dt);
    if(!this.player.alive){this.cooldown=0;this.reloadTime=0;this.root.setEnabled(false);return;}
    this.root.setEnabled(true);if(this.slot!==1)this.player.ads=false;
    const cycling=this.slot===1&&this.cooldown>0;this.cooldown=Math.max(0,this.cooldown-dt);
    const phase=cycling?1-this.cooldown/CONFIG.rifle.cycle:0;
    if(cycling)while(this.boltEvent<BOLT_EVENTS.length&&phase>=BOLT_EVENTS[this.boltEvent].at){const event=BOLT_EVENTS[this.boltEvent++];this.onSound(event.sound);if(event.sound==='bolt-eject'){this.bolt.computeWorldMatrix(true);this.shells.eject(this.bolt.getAbsolutePosition(),this.player.yaw);}}
    if(this.reloadTime>0){this.player.ads=false;this.reloadTime=Math.max(0,this.reloadTime-dt);const t=1-this.reloadTime/CONFIG.rifle.reload;const marks=[.2,.38,.56,.74,.92];while(this.reloadEvent<marks.length&&t>=marks[this.reloadEvent])this.onSound(++this.reloadEvent===marks.length?'reload-close':'reload-feed');if(this.reloadTime===0)this.ammo=CONFIG.rifle.capacity;}
    this.recoil*=Math.exp(-dt*10);this.swing=Math.max(0,this.swing-dt*2.6);
    const blend=this.player.adsBlend,ads=blend*blend*(3-2*blend),speed=this.player.moveSpeed;
    this.bobPhase+=speed*dt*2.4;this.bobWeight=lerp(this.bobWeight,Math.min(1,speed/4.2),1-Math.exp(-dt*16));
    const bob=this.bobWeight*(this.player.sprinting?.014:.007)*(1-.83*ads);
    const mx=this.player.mouseX,my=this.player.mouseY;this.player.mouseX=this.player.mouseY=0;
    this.swayX=lerp(this.swayX,Math.max(-.012,Math.min(.012,-mx*.0003)),1-Math.exp(-dt*14));
    this.swayY=lerp(this.swayY,Math.max(-.01,Math.min(.01,my*.0003)),1-Math.exp(-dt*14));
    const smooth=1-Math.exp(-dt*18),pose=boltPose(phase),reload=this.reloadTime>0,sprint=this.player.sprinting;
    this.state=reload?'Reload':cycling?(phase<.09?'Fire':'BoltCycle'):ads>.5?'ADS':sprint?'Sprint':speed>.05?'Walk':'Idle';
    this.root.position.x=.24*(1-ads)+this.swayX*(1-.85*ads)+Math.sin(this.bobPhase)*bob;
    this.lowering=lerp(this.lowering,(reload?.18:0)+(sprint?.08:0),smooth);this.root.position.y=lerp(-.23,-.123,ads)+this.swayY*(1-.85*ads)+Math.cos(this.bobPhase*2)*bob-this.lowering;
    this.root.position.z=.36-this.recoil*.1;
    this.rifle.rotation.x=lerp(this.rifle.rotation.x,-this.recoil*.11+(sprint?.28:0),smooth);
    this.rifle.rotation.z=lerp(this.rifle.rotation.z,pose.tilt*.17+(reload?-.4:0)+(sprint?-.16:0),smooth);
    this.bolt.position.z=.23-pose.back*.14;this.bolt.rotation.z=pose.lift*1.05;
    this.blade.rotation.set(-Math.sin(this.swing*Math.PI)*1.4,-.3,Math.sin(this.swing*Math.PI)*1.8);
  }
}
