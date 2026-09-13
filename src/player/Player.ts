import { FreeCamera, Scene, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { clamp, lerp } from '../core/math';
import { World } from '../map/World';
import { PlayerStuckRecovery } from './PlayerStuckRecovery';
import {VIEWMODEL} from '../weapons/ViewmodelAnchors';
type KeyboardCapture = {lock(keys:string[]):Promise<void>;unlock():void};

export class Player {
  readonly team = 'cn' as const;
  readonly id = 0;
  position = new Vector3(CONFIG.player.spawnX, 0, 0);
  camera: FreeCamera;
  health: number = CONFIG.player.health;
  private living = true;
  get alive(){return this.living;}
  set alive(value:boolean){this.living=value;if(!value)this.clearInput();}
  respawnAt = 0; protection = 0; kills = 0; deaths = 0;
  private events=new AbortController();
  private keyboard=(navigator as Navigator&{keyboard?:KeyboardCapture}).keyboard;
  ctrlCrouchAvailable=false;
  private inputBlocked=false;
  keys = new Set<string>(); locked = false; sprinting = false; moving = false; crouching = false;
  adsIntent=false;
  canAim=()=>true;
  get effectiveADS(){return this.adsIntent&&this.alive&&!this.inputBlocked&&this.canAim();}
  // Keep the existing public ADS interface; every consumer reads current permission.
  get ads(){return this.effectiveADS;}
  set ads(value:boolean){this.adsIntent=value;}
  moveSpeed=0; adsBlend=0; mouseX=0; mouseY=0; cameraKick=0;
  // Reused vectors: desired motion is never the collision/animation truth.
  readonly targetVelocity = Vector3.Zero();
  readonly currentVelocity = Vector3.Zero();
  private horizontalDisplacement = Vector3.Zero();
  grounded=false;
  private wasAirborne=false;
  eyeHeight:number=CONFIG.player.eye;
  private eyeFrom:number=CONFIG.player.eye;
  private eyeTarget:number=CONFIG.player.eye;
  private eyeElapsed=0;
  onLand=()=>{};
  onFeelReset=()=>{};
  stuckRecovery=new PlayerStuckRecovery();
  yaw = Math.PI / 2; pitch = 0; velocityY = 0; jumpQueued = false;
  onAttack = () => {}; onReload = () => {}; onWeapon = (_n: number) => {}; onLock = (_locked: boolean) => {};
  constructor(public scene: Scene, public canvas: HTMLCanvasElement, public world: World) {
    this.camera = new FreeCamera('player-camera', this.position.clone(), scene); this.camera.minZ = 0.05; this.camera.maxZ = 240; this.camera.fov = 1.18; this.camera.inputs.clear();
    document.addEventListener('pointerlockchange', () => { this.locked = !this.inputBlocked && document.pointerLockElement === canvas; if (this.inputBlocked && document.pointerLockElement === canvas) document.exitPointerLock(); if (!this.locked) { this.clearInput();this.keyboard?.unlock();this.ctrlCrouchAvailable=false; } this.onLock(this.locked); },{signal:this.events.signal});
    document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){this.ctrlCrouchAvailable=false;this.keyboard?.unlock();this.clearInput();if(this.locked)document.exitPointerLock();}},{signal:this.events.signal});
    document.addEventListener('mousemove', e => { if (!this.locked || !this.alive) return; const s = CONFIG.player.sensitivity * (this.ads ? 0.6 : 1); this.mouseX+=e.movementX;this.mouseY+=e.movementY;this.yaw += e.movementX * s; this.pitch = clamp(this.pitch + e.movementY * s, -1.45, 1.45); },{signal:this.events.signal});
    document.addEventListener('keydown', e => { if (!this.locked) return; if(e.code==='Escape'){document.exitPointerLock();return;} e.preventDefault(); this.keys.add(e.code); if (e.repeat) return; if(e.code==='Space')this.jumpQueued=true; if (e.code === 'KeyR') this.onReload(); if (e.code === 'Digit1') this.onWeapon(1); if (e.code === 'Digit2') this.onWeapon(2); },{signal:this.events.signal});
    document.addEventListener('keyup', e => {if(this.locked)e.preventDefault();this.keys.delete(e.code);},{signal:this.events.signal});
    canvas.addEventListener('mousedown', e => { if (!this.locked || !this.alive) return; if (e.button === 0) this.onAttack(); if (e.button === 2) this.ads = true; },{signal:this.events.signal});
    document.addEventListener('mouseup', e => { if (e.button === 2) this.ads = false; },{signal:this.events.signal});
    canvas.addEventListener('contextmenu', e => e.preventDefault(),{signal:this.events.signal});
    window.addEventListener('blur', () => this.clearInput(),{signal:this.events.signal});
  }
  private clearInput(){this.keys.clear();this.ads=false;this.jumpQueued=false;this.crouching=false;this.moving=false;this.sprinting=false;this.moveSpeed=0;this.mouseX=this.mouseY=0;this.clearVelocity();this.wasAirborne=false;this.grounded=false;this.eyeHeight=this.eyeFrom=this.eyeTarget=CONFIG.player.eye;this.eyeElapsed=0;this.onFeelReset();}
  private updateEyeHeight(dt:number){
    const target=this.crouching?CONFIG.player.crouchEye:CONFIG.player.eye;
    if(target!==this.eyeTarget){this.eyeFrom=this.eyeHeight;this.eyeTarget=target;this.eyeElapsed=0;}
    const seconds=this.crouching?CONFIG.playerFeel.crouchSeconds:CONFIG.playerFeel.standSeconds;
    this.eyeElapsed=Math.min(seconds,this.eyeElapsed+dt);
    const t=this.eyeElapsed/seconds;
    this.eyeHeight=lerp(this.eyeFrom,target,t*t*(3-2*t));
    // A low ceiling takes precedence over a cosmetic transition; collision rules stay in World.
    if(this.crouching&&this.eyeHeight>target&&!this.world.canStand(this.position.x,this.position.y,this.position.z,CONFIG.player.radius,this.eyeHeight+.08)){
      this.eyeHeight=this.eyeFrom=target;
    }
  }
  private clearVelocity(){this.targetVelocity.setAll(0);this.currentVelocity.setAll(0);}
  private integrateVelocity(dt:number,rate:number){
    const v=this.currentVelocity,target=this.targetVelocity;
    const oldX=v.x,oldZ=v.z,dx=target.x-v.x,dz=target.z-v.z,distance=Math.hypot(dx,dz);
    const rampTime=Math.min(dt,distance/rate),amount=distance>0?Math.min(1,rate*dt/distance):0;
    v.x+=dx*amount;v.z+=dz*amount;
    this.horizontalDisplacement.x+=(oldX+v.x)*.5*rampTime+v.x*(dt-rampTime);
    this.horizontalDisplacement.z+=(oldZ+v.z)*.5*rampTime+v.z*(dt-rampTime);
  }
  private moveHorizontal(dt:number,speed:number,height:number,grounded:boolean){
    if(dt<=0)return;
    const v=this.currentVelocity,target=this.targetVelocity;
    // Keep the existing instantaneous air control and all existing speed caps.
    if(!grounded)v.copyFrom(target);
    const length=v.length();if(length>speed)v.scaleInPlace(speed/length);
    const feel=CONFIG.playerFeel;
    this.horizontalDisplacement.setAll(0);
    const dot=Vector3.Dot(v,target);
    if(dot<0){
      const dx=target.x-v.x,dz=target.z-v.z;
      // Switch braking -> acceleration at the exact zero projection, even mid-frame.
      const crossing=-dot*Math.hypot(dx,dz)/(feel.reverseBraking*(dx*target.x+dz*target.z));
      const brakingTime=Math.min(dt,crossing);
      this.integrateVelocity(brakingTime,feel.reverseBraking);
      this.integrateVelocity(dt-brakingTime,feel.acceleration);
    }else this.integrateVelocity(dt,target.lengthSquared()===0?feel.braking:feel.acceleration);
    const moveX=this.horizontalDisplacement.x,moveZ=this.horizontalDisplacement.z;
    const oldX=this.position.x,oldZ=this.position.z;
    this.world.move(this.position,moveX,moveZ,height,grounded);
    const actualX=this.position.x-oldX,actualZ=this.position.z-oldZ;
    // Only constrained axes use actual displacement; free axes retain end velocity.
    if(Math.abs(actualX-moveX)>1e-8)v.x=actualX/dt;
    if(Math.abs(actualZ-moveZ)>1e-8)v.z=actualZ/dt;
  }
  setInputBlocked(blocked: boolean) {
    this.inputBlocked = blocked;
    this.clearInput();
    if (blocked) {
      this.locked = false;
      this.keyboard?.unlock();
      this.ctrlCrouchAvailable = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }
  }
  dispose(){this.events.abort();this.clearInput();this.keyboard?.unlock();}
  async lock() {
    if (this.inputBlocked) return;
    // Browser-reserved Ctrl+W cannot reliably be cancelled by keydown.preventDefault.
    // Selective keyboard capture requires script fullscreen; leave Escape available.
    this.ctrlCrouchAvailable=false;
    if(this.keyboard){try {
      if(!document.fullscreenElement)await document.documentElement.requestFullscreen();
      await this.keyboard.lock(['KeyW','KeyA','KeyS','KeyD','KeyR','KeyC','Digit1','Digit2','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight']);
      this.ctrlCrouchAvailable=true;
    } catch { this.keyboard.unlock(); }}
    if (this.inputBlocked) { this.keyboard?.unlock();this.ctrlCrouchAvailable=false;return; }
    try { await this.canvas.requestPointerLock(); } catch { this.keyboard?.unlock();this.ctrlCrouchAvailable=false;this.onLock(false); }
  }
  update(dt: number) {
    const oldX=this.position.x,oldZ=this.position.z;let moveInput=false;
    if (this.alive && this.locked) {
      const p = CONFIG.player; const wantsCrouch = this.keys.has('KeyC') || this.ctrlCrouchAvailable&&(this.keys.has('ControlLeft') || this.keys.has('ControlRight'));
      this.crouching = wantsCrouch || !this.world.canStand(this.position.x, this.position.y, this.position.z);
      this.sprinting = (this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')) && !this.ads && !this.crouching;
      let f = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')), r = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      this.moving = f !== 0 || r !== 0; const length = Math.hypot(f, r) || 1; f /= length; r /= length;
      moveInput=this.moving;
      const speed = (this.crouching ? p.crouch : this.sprinting ? p.sprint : p.walk) * (this.ads ? 0.65 : 1);
      this.targetVelocity.set((Math.sin(this.yaw)*f+Math.cos(this.yaw)*r)*speed,0,(Math.cos(this.yaw)*f-Math.sin(this.yaw)*r)*speed);
      this.moveHorizontal(dt,speed,this.crouching?1.2:p.height,this.velocityY<=0&&this.position.y<=this.world.floorAt(this.position.x,this.position.z,this.position.y)+.02);
      const floor = this.world.floorAt(this.position.x, this.position.z, this.position.y);
      if (this.jumpQueued && this.position.y <= floor + 0.02 && !this.crouching) this.velocityY = p.jump;
      this.jumpQueued=false;this.velocityY -= p.gravity * dt;const nextY=this.position.y+this.velocityY*dt;
      if(this.velocityY>0&&!this.world.canStand(this.position.x,nextY,this.position.z,p.radius,this.crouching?1.2:p.height))this.velocityY=0;else this.position.y=nextY;
      if (this.position.y < floor) { this.position.y = floor; this.velocityY = 0; }
    } else { this.moving = false; this.sprinting = false;this.clearVelocity(); }
    const moved=Math.hypot(this.position.x-oldX,this.position.z-oldZ);
    const recovered=this.alive&&this.stuckRecovery.update(dt,this.position,moveInput,moved,this.velocityY===0&&!this.jumpQueued,this.crouching,this.world);
    if(recovered){this.velocityY=0;this.clearVelocity();this.wasAirborne=false;this.onFeelReset();}
    this.grounded=this.alive&&this.velocityY<=0&&Math.abs(this.position.y-this.world.floorAt(this.position.x,this.position.z,this.position.y))<.02;
    if(this.alive&&this.locked&&dt>0&&!recovered){
      if(this.grounded&&this.wasAirborne)this.onLand();
      this.wasAirborne=!this.grounded;
    }
    this.moveSpeed=dt>0&&!recovered?moved/dt:0;this.moving=this.moveSpeed>.05;this.sprinting=this.sprinting&&this.moving;
    const adsTarget=this.ads&&this.alive?1:0;this.adsBlend+=Math.sign(adsTarget-this.adsBlend)*Math.min(Math.abs(adsTarget-this.adsBlend),dt/VIEWMODEL.adsSeconds);
    this.cameraKick*=Math.exp(-dt*8);
    this.updateEyeHeight(dt);
    this.camera.position.copyFrom(this.position); this.camera.position.y += this.alive ? this.eyeHeight : 0.48;
    this.camera.rotation.set(this.pitch-this.cameraKick, this.yaw, 0);
    const adsEase=this.adsBlend*this.adsBlend*(3-2*this.adsBlend);
    this.camera.fov = lerp(this.sprinting?VIEWMODEL.sprintFov:VIEWMODEL.hipFov,VIEWMODEL.adsFov,adsEase);
  }
  respawn(position?:Vector3) { this.clearInput();this.stuckRecovery.reset();if(position)this.position.copyFrom(position);else this.position.set(CONFIG.player.spawnX, 0, 0); this.health = CONFIG.player.health; this.alive = true; this.protection = CONFIG.match.spawnProtection; this.velocityY = 0; this.pitch = 0; this.cameraKick=0;this.adsBlend=0;this.mouseX=this.mouseY=0;this.yaw = Math.PI / 2; this.ads = false;this.update(0); }
}
