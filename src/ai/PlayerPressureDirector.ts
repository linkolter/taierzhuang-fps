import {Vector3} from '@babylonjs/core';
import type {Bot} from './Bot';
import type {Actor} from '../game/types';
/** Soft allocation affects only fire directed at the human, never AI vs AI. */
export class PlayerPressureDirector {
 private clock=0;readonly active=new Set<number>();
 reset(){this.clock=0;this.active.clear();}
 update(dt:number,bots:Bot[],player:Actor){
  this.clock-=dt;if(this.clock>0)return;this.clock=.25;this.active.clear();
  const candidates=bots.filter(b=>b.alive&&b.team!==player.team&&b.target?.id===player.id);
  candidates.sort((a,b)=>Vector3.DistanceSquared(a.position,player.position)-Vector3.DistanceSquared(b.position,player.position));
  for(const b of candidates.slice(0,3))this.active.add(b.id);
  for(const b of bots)b.preciseAgainstPlayer=this.active.has(b.id);
 }
}
