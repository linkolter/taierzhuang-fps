export type AIWorkKind = 'perception' | 'decision' | 'fire';
type Request = {id:number; since:number; seen:number};
export const AI_WORK_LIMITS = Object.freeze({perception:3, decision:2, fire:3, actors:5});

/** FIFO admission for expensive decisions only. Movement and weapon clocks still run every frame. */
export class AIWorkScheduler {
  private frame=0;
  private actors=new Set<number>();
  private queues:Record<AIWorkKind,Request[]>={perception:[],decision:[],fire:[]};
  private used={perception:0,decision:0,fire:0};
  private peak={perception:0,decision:0,fire:0,actors:0,waitFrames:0};
  beginFrame(){
    this.frame++;this.actors.clear();
    for(const kind of ['perception','decision','fire'] as const){
      this.used[kind]=0;
      // A dead bot or a no-longer-due job must never block the queue indefinitely.
      const queue=this.queues[kind];
      for(let i=queue.length-1;i>=0;i--)if(queue[i].seen<this.frame-1)queue.splice(i,1);
    }
  }
  allow(kind:AIWorkKind,id:number){
    const queue=this.queues[kind];let request=queue.find(r=>r.id===id);
    if(!request){request={id,since:this.frame,seen:this.frame};queue.push(request);}else request.seen=this.frame;
    if(queue[0]!==request||this.used[kind]>=AI_WORK_LIMITS[kind]||(!this.actors.has(id)&&this.actors.size>=AI_WORK_LIMITS.actors))return false;
    queue.shift();this.used[kind]++;this.actors.add(id);
    this.peak[kind]=Math.max(this.peak[kind],this.used[kind]);this.peak.actors=Math.max(this.peak.actors,this.actors.size);
    this.peak.waitFrames=Math.max(this.peak.waitFrames,this.frame-request.since);
    return true;
  }
  reset(){this.frame=0;this.actors.clear();for(const kind of ['perception','decision','fire'] as const){this.queues[kind].length=0;this.used[kind]=0;}}
  snapshot(){return {frame:this.frame,used:{...this.used},actors:this.actors.size,pending:Object.values(this.queues).reduce((n,q)=>n+q.length,0),peak:{...this.peak},limits:AI_WORK_LIMITS};}
}
