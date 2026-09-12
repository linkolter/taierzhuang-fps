import type { Bot } from './Bot';
import type { CapturePoint } from '../capture/CaptureSystem';
export type StrategicRole='ATTACK'|'DEFEND'|'FLANK';
/** Bounded team-wide assignment; local combat and route scheduler retain ownership of movement. */
export class StrategicDirector {
  private clock=0; assignments=0;
  reset(){this.clock=0;this.assignments=0;}
  update(dt:number,time:number,bots:Bot[],points:CapturePoint[]){
    this.clock-=dt;if(this.clock>0)return;this.clock=1.5;this.assignments++;
    for(const team of ['cn','jp'] as const){
      const roster=bots.filter(b=>b.alive&&b.team===team),counts=new Map(points.map(p=>[p.id,0]));
      const cap=Math.ceil(roster.length/points.length)+1;
      for(const b of roster){
        const score=(p:CapturePoint)=>{
          const count=counts.get(p.id)!;const threatened=p.owner===team&&(p.contested||p.present[team==='cn'?'jp':'cn']>0||Math.abs(p.progress)<.99);
          return (count>=cap?10000:0)+count*55+(threatened?-50:p.owner===team?25:0)+Math.hypot(b.position.x-p.x,b.position.z-p.z)*.3+(b.strategicObjective===p.id?-18:0);
        };
        const p=[...points].sort((a,c)=>score(a)-score(c))[0];if(!p)continue;
        counts.set(p.id,counts.get(p.id)!+1);
        b.strategicRole=p.owner===team?'DEFEND':b.id%4===0?'FLANK':'ATTACK';
        if(b.strategicObjective!==p.id){b.strategicObjective=p.id;b.releaseCover();b.requestReplan(time);}
      }
    }
  }
}
