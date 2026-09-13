import {Matrix,Vector3} from '@babylonjs/core';
import type {Game} from '../game/Game';

/** Development-only overlay. Observes the exact post-spread ray passed to onFire. */
export class SightCalibrationDebug {
 enabled=new URLSearchParams(location.search).has('adsdebug');
 readonly canvas=document.createElement('canvas');
 lastShot?:{origin:Vector3;direction:Vector3;errorPx:number};
 private events=new AbortController();
 constructor(private game:Game){
  this.canvas.id='sight-calibration-debug';this.canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
  document.body.append(this.canvas);
  document.addEventListener('keydown',e=>{if(e.code==='F4'&&!e.repeat){e.preventDefault();this.enabled=!this.enabled;}},{signal:this.events.signal});
  const observer=game.scene.onAfterRenderObservable.add(()=>this.draw());
  game.weapon.onShotDebug=(origin,direction)=>{
   const point=this.project(origin.add(direction.scale(100)));
   this.lastShot={origin:origin.clone(),direction:direction.clone(),errorPx:Math.hypot(point.x-innerWidth/2,point.y-innerHeight/2)};
  };
  game.scene.onDisposeObservable.addOnce(()=>{game.scene.onAfterRenderObservable.remove(observer);this.events.abort();this.canvas.remove();game.weapon.onShotDebug=undefined;});
 }
 private project(point:Vector3){
  const {scene,player}=this.game;
  return Vector3.Project(point,Matrix.Identity(),scene.getTransformMatrix(),player.camera.viewport.toGlobal(innerWidth,innerHeight));
 }
 snapshot(){
  const {weapon,player}=this.game;
  const rear=this.project(weapon.anchors.rear.getAbsolutePosition()),front=this.project(weapon.anchors.front.getAbsolutePosition());
  const ray=player.camera.getForwardRay(100),shot=this.project(ray.origin.add(ray.direction.scale(100)));
  const error=(p:Vector3)=>Math.hypot(p.x-innerWidth/2,p.y-innerHeight/2);
  return {center:[innerWidth/2,innerHeight/2],rear:rear.asArray(),front:front.asArray(),shot:shot.asArray(),
   rearErrorPx:error(rear),frontErrorPx:error(front),shotErrorPx:error(shot),lastShotErrorPx:this.lastShot?.errorPx??null};
 }
 private draw(){
  this.canvas.hidden=!this.enabled;if(!this.enabled)return;
  const c=this.canvas.getContext('2d')!;this.canvas.width=innerWidth;this.canvas.height=innerHeight;
  const s=this.snapshot();
  const mark=(p:number[],radius:number,color:string)=>{c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(p[0],p[1],radius,0,Math.PI*2);c.stroke();};
  mark(s.center,17,'#ffffff');mark(s.rear,11,'#42e4ff');mark(s.front,6,'#ffc857');mark(s.shot,2,'#ff65ad');
  if(this.lastShot){const p=this.project(this.lastShot.origin.add(this.lastShot.direction.scale(100)));c.setLineDash([2,2]);mark(p.asArray(),8,'#ff65ad');c.setLineDash([]);}
  c.fillStyle='#10191de8';c.fillRect(22,130,490,130);c.font='14px monospace';
  for(const [i,text,color] of [
   [0,'F4 · ADS calibration · white: screen center','#fff'],
   [1,`RearSightAnchor (cyan): ${s.rearErrorPx.toFixed(3)} px`,'#42e4ff'],
   [2,`FrontSightAnchor (amber): ${s.frontErrorPx.toFixed(3)} px`,'#ffc857'],
   [3,`Shot axis (pink): ${s.shotErrorPx.toFixed(3)} px`,'#ff65ad'],
   [4,`Last actual shot + spread: ${s.lastShotErrorPx?.toFixed(3)??'not fired'} px`,'#ff65ad'],
  ] as const){c.fillStyle=color;c.fillText(text,34,153+i*22);}
 }
}
