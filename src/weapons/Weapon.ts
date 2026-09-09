import { MeshBuilder, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { lerp } from '../core/math';
import { Player } from '../player/Player';
import { World } from '../map/World';

export class Weapon {
  slot = 1; ammo: number = CONFIG.rifle.capacity; cooldown = 0; reloadTime = 0; recoil = 0; swing = 0;
  root: TransformNode; rifle: TransformNode; blade: TransformNode; bolt: TransformNode;
  onFire = (_origin: Vector3, _direction: Vector3, _melee: boolean) => {};
  onSound = (_name: string) => {};
  constructor(scene: Scene, public player: Player, world: World) {
    this.root = new TransformNode('view-weapon', scene); this.root.parent = player.camera;
    this.rifle = new TransformNode('type38', scene); this.rifle.parent = this.root;
    this.blade = new TransformNode('dadao', scene); this.blade.parent = this.root;
    const wood = world.material('rifle-stock', '#613f28'), steel = world.material('gunmetal', '#353b39'), edge = world.material('blade-steel', '#aab2ab');
    const part = (name: string, size: number[], pos: number[], mat: typeof wood, parent = this.rifle) => { const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene); m.position.set(...pos as [number, number, number]); m.material = mat; m.parent = parent; m.isPickable = false; m.renderingGroupId = 2; return m; };
    part('wood-stock', [.1, .12, .62], [0, -.025, .15], wood); part('wood-foreend', [.065, .075, .6], [0, .01, .65], wood); part('barrel', [.036, .036, .95], [0, .06, .56], steel); part('receiver', [.075, .055, .24], [0, .069, .2], steel);
    part('front-sight', [.008, .04, .016], [0, .103, 1.025], steel); part('rear-sight-left', [.012, .033, .035], [-.026, .106, .12], steel); part('rear-sight-right', [.012, .033, .035], [.026, .106, .12], steel);
    this.bolt = new TransformNode('bolt', scene); this.bolt.parent = this.rifle; part('bolt-handle', [.095, .024, .025], [.07, .08, .23], steel, this.bolt);
    part('dadao-blade', [.13, .68, .025], [0, .32, .25], edge, this.blade).rotation.z = -.12;
    part('dadao-tip', [.16, .18, .025], [.02, .71, .25], edge, this.blade).rotation.z = -.35;
    part('dadao-grip', [.046, .23, .05], [0, -.16, .25], wood, this.blade); part('dadao-guard', [.22, .025, .075], [0, -.025, .25], steel, this.blade);
    this.blade.setEnabled(false); this.root.position.set(.24, -.23, .36);
  }
  attack() {
    if (!this.player.alive || this.cooldown > 0 || this.reloadTime > 0 || this.player.sprinting) return;
    if (this.slot === 1 && this.ammo <= 0) { this.reload(); return; }
    if (this.slot === 1) { this.ammo--; this.cooldown = CONFIG.rifle.cycle; this.recoil = 1; this.player.pitch -= this.player.ads ? .018 : .032; this.onSound('rifle'); }
    else { this.cooldown = CONFIG.melee.cn.cycle; this.swing = 1; this.onSound('dadao'); }
    const direction = this.player.camera.getForwardRay().direction.clone();
    if (this.slot === 1) { const spread = this.player.ads ? CONFIG.rifle.adsSpread : CONFIG.rifle.hipSpread; direction.x += (Math.random() - .5) * spread; direction.y += (Math.random() - .5) * spread; direction.z += (Math.random() - .5) * spread; direction.normalize(); }
    this.onFire(this.player.camera.position.clone(), direction, this.slot === 2);
  }
  reload() { if (this.slot !== 1 || this.reloadTime > 0 || this.ammo === CONFIG.rifle.capacity || this.cooldown > 0 || !this.player.alive) return; this.reloadTime = CONFIG.rifle.reload; this.player.ads = false; this.onSound('reload'); }
  select(slot: number) { if (this.reloadTime > 0 || this.cooldown > 0) return; this.slot = slot; this.player.ads = false; this.rifle.setEnabled(slot === 1); this.blade.setEnabled(slot === 2); }
  reset() { this.ammo = CONFIG.rifle.capacity; this.cooldown = 0; this.reloadTime = 0; this.recoil = 0; this.select(1); }
  update(dt: number, time: number) {
    if(this.slot!==1)this.player.ads=false;
    const old = this.cooldown; this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.slot === 1 && old > 1.05 && this.cooldown <= 1.05) this.onSound('bolt');
    if (this.reloadTime > 0) { this.player.ads = false; this.reloadTime -= dt; if (this.reloadTime <= 0) this.ammo = CONFIG.rifle.capacity; }
    this.recoil = Math.max(0, this.recoil - dt * 7); this.swing = Math.max(0, this.swing - dt * 2.6);
    const ads = this.player.ads && this.slot === 1, bob = this.player.moving ? Math.sin(time * (this.player.sprinting ? 15 : 10)) * (this.player.sprinting ? .025 : .008) : Math.sin(time * 2) * .002;
    this.root.position.x = lerp(this.root.position.x, ads ? 0 : .24, Math.min(1, dt * 15));
    this.root.position.y = lerp(this.root.position.y, (ads ? -.12 : -.23) + bob - (this.reloadTime > 0 ? .18 : 0), Math.min(1, dt * 15));
    this.root.position.z = .36 - this.recoil * .1;
    const boltPhase = this.slot === 1 && this.cooldown > .15 && this.cooldown < 1.15 ? Math.sin((1.15 - this.cooldown) * Math.PI) : 0;
    this.rifle.rotation.set(-this.recoil * .08 + (this.player.sprinting ? .3 : 0), 0, boltPhase * .15 + (this.reloadTime > 0 ? -.4 : 0)); this.bolt.position.z = -boltPhase * .11; this.bolt.rotation.z = -boltPhase * .5;
    this.blade.rotation.set(-Math.sin(this.swing * Math.PI) * 1.4, -.3, Math.sin(this.swing * Math.PI) * 1.8);
    this.root.setEnabled(this.player.alive);
  }
}
