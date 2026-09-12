import type { Actor } from './types';
import type { CapturePoint } from '../capture/CaptureSystem';
import type { Team } from '../config/gameConfig';
export interface SoldierScore { id:number;team:Team;name:string;kills:number;deaths:number;score:number;captures:number;defenses:number;assists:number }
export interface KillEntry { attacker:string;victim:string;weapon:string;time:number;player:boolean }
export class ScoreSystem {
  rows:SoldierScore[]=[]; feed:KillEntry[]=[];
  private damage=new Map<number,Map<number,number>>();
  private contributors=new Map<string,Map<number,number>>();
  constructor(actors:Actor[]){this.rows=actors.map(a=>({id:a.id,team:a.team,name:a.id===0?'你':`${a.team==='cn'?'中国':'日军'}士兵 ${a.id}`,kills:0,deaths:0,score:0,captures:0,defenses:0,assists:0}));}
  row(id:number){return this.rows.find(r=>r.id===id)!;}
  reset(){for(const r of this.rows)Object.assign(r,{kills:0,deaths:0,score:0,captures:0,defenses:0,assists:0});this.feed=[];this.damage.clear();this.contributors.clear();}
  hit(victim:Actor,attacker:Actor,time:number){let hits=this.damage.get(victim.id);if(!hits)this.damage.set(victim.id,hits=new Map());hits.set(attacker.id,time);}
  death(victim:Actor,attacker:Actor,time:number,weapon:string,points:CapturePoint[]){
    const a=this.row(attacker.id),v=this.row(victim.id);a.kills++;a.score+=100;v.deaths++;
    if(points.some(p=>p.owner===attacker.team&&Math.abs(victim.position.y-(p.y??0))<1.1&&Math.hypot(victim.position.x-p.x,victim.position.z-p.z)<=7)){a.defenses++;a.score+=50;}
    for(const [id,at] of this.damage.get(victim.id)??[])if(id!==attacker.id&&time-at<=10){const r=this.row(id);r.assists++;r.score+=50;}
    this.damage.delete(victim.id);
    this.feed.push({attacker:a.name,victim:v.name,weapon,time,player:attacker.id===0});if(this.feed.length>5)this.feed.shift();
  }
  presence(dt:number,points:CapturePoint[],actors:Actor[]){
    for(const p of points){const present=actors.filter(a=>a.alive&&Math.abs(a.position.y-(p.y??0))<1.1&&Math.hypot(a.position.x-p.x,a.position.z-p.z)<=7);
      if(!present.length||new Set(present.map(a=>a.team)).size>1)continue;const sign=present[0].team==='cn'?1:-1;if(p.progress===sign)continue;
      let contributions=this.contributors.get(p.id);if(!contributions)this.contributors.set(p.id,contributions=new Map());
      for(const a of present)contributions.set(a.id,(contributions.get(a.id)??0)+dt);
    }
  }
  capture(point:CapturePoint,owner:Team|null){
    if(!owner)return;
    const participants=[...(this.contributors.get(point.id)??[])].filter(([id])=>this.row(id).team===owner).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
    participants.forEach(([id],i)=>{const r=this.row(id);r.score+=i===0?200:100;r.captures++;});this.contributors.delete(point.id);
  }
  sorted(team:Team){return this.rows.filter(r=>r.team===team).sort((a,b)=>b.score-a.score||a.id-b.id);}
}
