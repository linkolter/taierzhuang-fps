import type {Obstacle} from './World';
/** Static X/Z broad phase. Exact collision boxes and height tests remain unchanged. */
export class ObstacleIndex {
 private buckets=new Map<number,number[]>();
 private seen=new Uint32Array(8192);
 private generation=0;
 private result:Obstacle[]=[];
 constructor(private obstacles:Obstacle[],private size=4){for(let i=0;i<obstacles.length;i++)this.add(i);}
 private key(x:number,z:number){return (x+256)*512+z+256;}
 add(id:number){const o=this.obstacles[id];if(id>=this.seen.length){const next=new Uint32Array(Math.max(id+1,this.seen.length*2));next.set(this.seen);this.seen=next;}
  for(let x=Math.floor((o.x-o.w/2)/this.size);x<=Math.floor((o.x+o.w/2)/this.size);x++)for(let z=Math.floor((o.z-o.d/2)/this.size);z<=Math.floor((o.z+o.d/2)/this.size);z++){const key=this.key(x,z);let ids=this.buckets.get(key);if(!ids){ids=[];this.buckets.set(key,ids);}ids.push(id);}
 }
 /** Borrowed scratch array; consume before another query on this index. */
 query(x0:number,z0:number,x1:number,z1:number){this.result.length=0;this.generation=(this.generation+1)>>>0;if(!this.generation){this.seen.fill(0);this.generation=1;}
  for(let x=Math.floor(x0/this.size);x<=Math.floor(x1/this.size);x++)for(let z=Math.floor(z0/this.size);z<=Math.floor(z1/this.size);z++){const ids=this.buckets.get(this.key(x,z));if(!ids)continue;for(const id of ids)if(this.seen[id]!==this.generation){this.seen[id]=this.generation;this.result.push(this.obstacles[id]);}}
  return this.result;
 }
}
