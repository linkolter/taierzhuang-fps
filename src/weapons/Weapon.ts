import { MeshBuilder, Quaternion, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import {ViewmodelAnchors,VIEWMODEL} from './ViewmodelAnchors';
import {BOLT_EVENTS,RELOAD_EVENTS,boltPose,type WeaponPose} from './BoltTimeline';
import {ShellCasingPool} from '../effects/ShellCasingPool';
import {MuzzleEffect} from '../effects/MuzzleEffect';
import {ProceduralMaterialFactory} from '../map/ProceduralMaterialFactory';
import { CONFIG } from '../config/gameConfig';
import { lerp } from '../core/math';
import { Player } from '../player/Player';
import { World } from '../map/World';
import type {HanyangRifleAssets,HanyangRifleInstance} from './HanyangRifle';

export class Weapon {
  visual?:HanyangRifleInstance;
  installRifle(assets:HanyangRifleAssets){
    if(this.visual)return;
    const fallback=this.rifle.getChildren().filter(node=>node!==this.flash.flash&&node!==this.anchors.rear&&node!==this.anchors.front);
    this.visual=assets.attach(this.rifle,true);this.bolt=this.visual.bolt;
    for(const node of fallback)node.dispose();
    this.rifle.name='hanyang-view-rifle';
    this.anchors.calibrate(true);
  }
  state:WeaponPose='Idle';shells:ShellCasingPool;flash:MuzzleEffect;private swayX=0;private swayY=0;private bobPhase=0;private bobWeight=0;private sprintBlend=0;private reloadBlend=0;private boltEvent=0;private reloadEvent=0;
  readonly anchors:ViewmodelAnchors;
  private landingTime=0;
  pendingSlot:number|null=null;
  private switchElapsed=0;
  get switching(){return this.pendingSlot!==null;}
  get switchPhase(){return !this.switching?null:this.switchElapsed<VIEWMODEL.switching.seconds/2?'holster':'unholster';}
  onShotDebug?: (origin:Vector3,direction:Vector3)=>void;
  slot = 1; ammo: number = CONFIG.rifle.capacity; cooldown = 0; reloadTime = 0; recoil = 0; swing = 0;
  root: TransformNode; rifle: TransformNode; blade: TransformNode; bolt: TransformNode;
  onFire = (_origin: Vector3, _direction: Vector3, _melee: boolean) => {};
  onSound = (_name: string) => {};
  constructor(scene: Scene, public player: Player, world: World) {
    player.onLand=()=>{this.landingTime=VIEWMODEL.landing.seconds;};
    player.onFeelReset=()=>{this.clearFeel();};
    player.canAim=()=>this.slot===1&&this.reloadTime===0&&!this.switching;
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
    this.blade.setEnabled(false);
    this.anchors=new ViewmodelAnchors(scene,player.camera,this.rifle);
    this.root.position.copyFrom(this.anchors.hip.position);this.root.rotationQuaternion=Quaternion.Identity();
    this.shells=new ShellCasingPool(world);this.flash=new MuzzleEffect(world,this.rifle);
  }
  attack() {
    if (!this.player.alive || this.cooldown > 0 || this.reloadTime > 0 || this.player.sprinting || this.switching) return;
    if (this.slot === 1 && this.ammo <= 0) { this.reload(); return; }
    if (this.slot === 1) { this.ammo--; this.cooldown = CONFIG.rifle.cycle; this.recoil=1;this.boltEvent=0;this.player.cameraKick+=this.player.ads?.034:.05;if(!this.player.ads)this.player.pitch-=.014;this.flash.fire();this.onSound('rifle'); }
    else { this.cooldown = CONFIG.melee.cn.cycle; this.swing = 1; this.onSound('dadao'); }
    const direction = this.player.camera.getForwardRay().direction.clone();
    if (this.slot === 1) { const spread = this.player.ads ? CONFIG.rifle.adsSpread : CONFIG.rifle.hipSpread; direction.x += (Math.random() - .5) * spread; direction.y += (Math.random() - .5) * spread; direction.z += (Math.random() - .5) * spread; direction.normalize(); }
    if(import.meta.env.DEV&&this.slot===1)this.onShotDebug?.(this.player.camera.position,direction);
    this.onFire(this.player.camera.position.clone(), direction, this.slot === 2);
  }
  reload() { if (this.slot !== 1 || this.reloadTime > 0 || this.ammo === CONFIG.rifle.capacity || this.cooldown > 0 || !this.player.alive || this.switching) return; this.reloadEvent=0;this.reloadTime = CONFIG.rifle.reload; this.onSound('reload'); }
  select(slot:number){
    if(!this.player.alive||this.switching||this.reloadTime>0||this.cooldown>0||slot===this.slot||(slot!==1&&slot!==2))return;
    this.pendingSlot=slot;this.switchElapsed=0;
  }
  private equip(slot:number){this.slot=slot;this.rifle.setEnabled(slot===1);this.blade.setEnabled(slot===2);}
  private clearFeel(){this.landingTime=0;this.pendingSlot=null;this.switchElapsed=0;}
  private updateSwitch(dt:number){
    if(this.pendingSlot===null)return 0;
    const seconds=VIEWMODEL.switching.seconds;
    this.switchElapsed=Math.min(seconds,this.switchElapsed+dt);
    if(this.switchElapsed>=seconds/2&&this.slot!==this.pendingSlot)this.equip(this.pendingSlot);
    if(this.switchElapsed>=seconds){this.pendingSlot=null;this.switchElapsed=0;return 0;}
    const t=1-Math.abs(this.switchElapsed/(seconds/2)-1);
    return t*t*(3-2*t);
  }
  reset() { this.clearFeel();this.player.ads=false;this.ammo = CONFIG.rifle.capacity; this.cooldown = 0; this.reloadTime = 0; this.recoil=0;this.swing=0;this.boltEvent=0;this.reloadEvent=0;this.swayX=this.swayY=this.bobWeight=this.sprintBlend=this.reloadBlend=this.bobPhase=0;this.state='Idle';this.shells.reset();this.flash.reset();this.equip(1); }
  update(dt:number,time:number) {
    this.shells.update(dt);this.flash.update(dt);
    if(!this.player.alive){this.cooldown=0;this.reloadTime=0;this.clearFeel();this.root.setEnabled(false);return;}
    this.root.setEnabled(true);
    const switchWeight=this.updateSwitch(dt);
    const cycling=this.slot===1&&this.cooldown>0;this.cooldown=Math.max(0,this.cooldown-dt);
    const phase=cycling?1-this.cooldown/CONFIG.rifle.cycle:0;
    if(cycling)while(this.boltEvent<BOLT_EVENTS.length&&phase>=BOLT_EVENTS[this.boltEvent].at){const event=BOLT_EVENTS[this.boltEvent++];this.onSound(event.sound);if(event.sound==='bolt-eject'){this.bolt.computeWorldMatrix(true);this.shells.eject(this.bolt.getAbsolutePosition(),this.player.yaw);}}
    if(this.reloadTime>0){this.reloadTime=Math.max(0,this.reloadTime-dt);const t=1-this.reloadTime/CONFIG.rifle.reload;while(this.reloadEvent<RELOAD_EVENTS.length&&t>=RELOAD_EVENTS[this.reloadEvent].at)this.onSound(RELOAD_EVENTS[this.reloadEvent++].sound);if(this.reloadTime===0)this.ammo=CONFIG.rifle.capacity;}
    this.recoil=this.cooldown>0?this.recoil*Math.exp(-dt*10):0;this.swing=Math.max(0,this.swing-dt*2.6);
    const blend=this.player.adsBlend,ads=blend*blend*(3-2*blend),speed=this.player.moveSpeed;
    if(this.player.grounded)this.bobPhase+=speed*dt*2.4;
    this.bobWeight=lerp(this.bobWeight,this.player.grounded?Math.min(1,speed/4.2):0,1-Math.exp(-dt*16));
    const bob=this.bobWeight*(this.player.sprinting?.014:.007)*(1-.83*ads);
    const mx=this.player.mouseX,my=this.player.mouseY;this.player.mouseX=this.player.mouseY=0;
    this.swayX=lerp(this.swayX,Math.max(-.012,Math.min(.012,-mx*.0003)),1-Math.exp(-dt*14));
    this.swayY=lerp(this.swayY,Math.max(-.01,Math.min(.01,my*.0003)),1-Math.exp(-dt*14));
    const pose=boltPose(phase),reload=this.reloadTime>0,sprint=this.player.sprinting;
    this.state=reload?'Reload':cycling?(phase<.09?'Fire':'BoltCycle'):ads>.5?'ADS':sprint?'Sprint':speed>.05?'Walk':'Idle';
    const approach=(v:number,target:number)=>v+Math.sign(target-v)*Math.min(Math.abs(target-v),dt/.18);
    this.sprintBlend=approach(this.sprintBlend,Number(sprint));this.reloadBlend=approach(this.reloadBlend,Number(reload));
    Vector3.LerpToRef(this.anchors.hip.position,this.anchors.ads.position,ads,this.root.position);
    Quaternion.SlerpToRef(this.anchors.hip.rotationQuaternion!,this.anchors.ads.rotationQuaternion!,ads,this.root.rotationQuaternion!);
    this.root.position.x+=this.swayX*(1-ads)+Math.sin(this.bobPhase)*bob;
    this.root.position.y+=this.swayY*(1-ads)+Math.cos(this.bobPhase*2)*bob;
    this.landingTime=Math.max(0,this.landingTime-dt);
    this.root.position.y-=Math.sin(Math.PI*this.landingTime/VIEWMODEL.landing.seconds)*VIEWMODEL.landing.distance;
    this.root.position.y-=switchWeight*VIEWMODEL.switching.drop;
    this.rifle.rotation.setAll(0);
    for(const [offset,weight] of [[VIEWMODEL.sprint,this.sprintBlend],[VIEWMODEL.reload,this.reloadBlend],[VIEWMODEL.bolt,pose.tilt]] as const){
      this.root.position.addInPlaceFromFloats(offset.position.x*weight,offset.position.y*weight,offset.position.z*weight);
      this.rifle.rotation.addInPlaceFromFloats(offset.rotation.x*weight,offset.rotation.y*weight,offset.rotation.z*weight);
    }
    const kick=VIEWMODEL.recoil,translation=this.recoil*lerp(1,kick.adsTranslation,ads),rotation=this.recoil*lerp(1,kick.adsRotation,ads);
    this.root.position.addInPlaceFromFloats(kick.position.x*translation,kick.position.y*translation,kick.position.z*translation);
    this.rifle.rotation.addInPlaceFromFloats(kick.rotation.x*rotation,kick.rotation.y*rotation,kick.rotation.z*rotation);
    const reloadPhase=reload?1-this.reloadTime/CONFIG.rifle.reload:0;
    const reloadOpen=reloadPhase>=.08&&reloadPhase<.92?1:0;
    if(this.visual)this.visual.setBolt(Math.max(pose.lift,reloadOpen),Math.max(pose.back,reloadOpen));
    else {this.bolt.position.z=.23-Math.max(pose.back,reloadOpen)*.14;this.bolt.rotation.z=Math.max(pose.lift,reloadOpen)*1.05;}
    this.blade.rotation.set(-Math.sin(this.swing*Math.PI)*1.4,-.3,Math.sin(this.swing*Math.PI)*1.8);
  }
}
