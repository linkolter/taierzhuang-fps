import { FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { clamp, lerp } from '../core/math';
import { World } from '../map/World';

export class Player {
  readonly team = 'cn' as const;
  readonly id = 0;
  position = new Vector3(CONFIG.player.spawnX, 0, 0);
  camera: FreeCamera;
  health: number = CONFIG.player.health;
  alive = true; respawnAt = 0; protection = 0; kills = 0; deaths = 0;
  private events=new AbortController();
  keys = new Set<string>(); locked = false; ads = false; sprinting = false; moving = false; crouching = false;
  yaw = Math.PI / 2; pitch = 0; velocityY = 0; jumpQueued = false;
  onAttack = () => {}; onReload = () => {}; onWeapon = (_n: number) => {}; onLock = (_locked: boolean) => {};
  constructor(public scene: Scene, public canvas: HTMLCanvasElement, public world: World) {
    this.camera = new FreeCamera('player-camera', this.position.clone(), scene); this.camera.minZ = 0.05; this.camera.maxZ = 240; this.camera.fov = 1.18; this.camera.inputs.clear();
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; if (!this.locked) { this.keys.clear(); this.ads = false; } this.onLock(this.locked); },{signal:this.events.signal});
    document.addEventListener('mousemove', e => { if (!this.locked || !this.alive) return; const s = CONFIG.player.sensitivity * (this.ads ? 0.6 : 1); this.yaw += e.movementX * s; this.pitch = clamp(this.pitch + e.movementY * s, -1.45, 1.45); },{signal:this.events.signal});
    document.addEventListener('keydown', e => { if (!this.locked) return; if(e.code==='Escape'){document.exitPointerLock();return;} e.preventDefault(); this.keys.add(e.code); if (e.repeat) return; if(e.code==='Space')this.jumpQueued=true; if (e.code === 'KeyR') this.onReload(); if (e.code === 'Digit1') this.onWeapon(1); if (e.code === 'Digit2') this.onWeapon(2); },{signal:this.events.signal});
    document.addEventListener('keyup', e => this.keys.delete(e.code),{signal:this.events.signal});
    canvas.addEventListener('mousedown', e => { if (!this.locked || !this.alive) return; if (e.button === 0) this.onAttack(); if (e.button === 2) this.ads = true; },{signal:this.events.signal});
    document.addEventListener('mouseup', e => { if (e.button === 2) this.ads = false; },{signal:this.events.signal});
    canvas.addEventListener('contextmenu', e => e.preventDefault(),{signal:this.events.signal});
    window.addEventListener('blur', () => { this.keys.clear(); this.ads = false; },{signal:this.events.signal});
  }
  dispose(){this.events.abort();this.keys.clear();}
  async lock() { try { await this.canvas.requestPointerLock(); } catch { this.onLock(false); } }
  update(dt: number) {
    if (this.alive && this.locked) {
      const p = CONFIG.player; const wantsCrouch = this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC');
      this.crouching = wantsCrouch || !this.world.canStand(this.position.x, this.position.y, this.position.z);
      this.sprinting = (this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')) && !this.ads && !this.crouching;
      let f = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')), r = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      this.moving = f !== 0 || r !== 0; const length = Math.hypot(f, r) || 1; f /= length; r /= length;
      const speed = (this.crouching ? p.crouch : this.sprinting ? p.sprint : p.walk) * (this.ads ? 0.65 : 1);
      this.world.move(this.position, (Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * speed * dt, (Math.cos(this.yaw) * f - Math.sin(this.yaw) * r) * speed * dt, this.crouching ? 1.2 : p.height, this.velocityY<=0&&this.position.y<=this.world.floorAt(this.position.x,this.position.z,this.position.y)+.02);
      const floor = this.world.floorAt(this.position.x, this.position.z, this.position.y);
      if (this.jumpQueued && this.position.y <= floor + 0.02 && !this.crouching) this.velocityY = p.jump;
      this.jumpQueued=false;this.velocityY -= p.gravity * dt;const nextY=this.position.y+this.velocityY*dt;
      if(this.velocityY>0&&!this.world.canStand(this.position.x,nextY,this.position.z,p.radius,this.crouching?1.2:p.height))this.velocityY=0;else this.position.y=nextY;
      if (this.position.y < floor) { this.position.y = floor; this.velocityY = 0; }
    } else { this.moving = false; this.sprinting = false; }
    this.camera.position.copyFrom(this.position); this.camera.position.y += this.alive ? (this.crouching ? CONFIG.player.crouchEye : CONFIG.player.eye) : 0.48;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.fov = lerp(this.camera.fov, this.ads && this.alive ? 0.64 : this.sprinting ? 1.25 : 1.18, Math.min(1, dt * 13));
  }
  respawn() { this.position.set(CONFIG.player.spawnX, 0, 0); this.health = CONFIG.player.health; this.alive = true; this.protection = CONFIG.match.spawnProtection; this.velocityY = 0; this.pitch = 0; this.yaw = Math.PI / 2; this.ads = false; }
}
