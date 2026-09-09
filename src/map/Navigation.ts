import { Vector3 } from '@babylonjs/core';
import type { World } from './World';
import { allowedSurfaceEdge } from './Topology';
// Small, cached 2 m ground grid. Tunnels use explicit ramp/trunk waypoints.
export class Navigation {
  width=89; depth=43; step=2; walkable: boolean[]=[];
  private points:Vector3[]=[];
  constructor(public world: World){for(let z=0;z<this.depth;z++)for(let x=0;x<this.width;x++){const p=this.point(z*this.width+x);this.walkable.push(world.canStand(p.x,p.y,p.z,.55)&&!world.inRamp(p.x,p.z));}}
  point(i:number){if(!this.points[i]){const x=(i%this.width)*this.step-88,z=Math.floor(i/this.width)*this.step-42;this.points[i]=new Vector3(x,this.world.terrain.height(x,z),z);}return this.points[i];}
  nearest(p:Vector3){let best=-1,d=Infinity;for(let i=0;i<this.walkable.length;i++)if(this.walkable[i]){const q=this.point(i),dist=(q.x-p.x)**2+(q.z-p.z)**2;if(dist<d){best=i;d=dist;}}return best;}
  find(start:Vector3,end:Vector3){
    const s=this.nearest(start),e=this.nearest(end); if(s<0||e<0)return [end];
    const open=new Set([s]),came=new Map<number,number>(),cost=new Map([[s,0]]);const heuristic=(i:number)=>Math.abs(i%this.width-e%this.width)+Math.abs(Math.floor(i/this.width)-Math.floor(e/this.width));
    let iterations=0;
    while(open.size&&iterations++<4000){let current=-1,best=Infinity;for(const i of open){const f=cost.get(i)!+heuristic(i);if(f<best){best=f;current=i;}}if(current===e){const path:Vector3[]=[];let n=e;while(n!==s){path.unshift(this.point(n));n=came.get(n)!;}path.push(end.clone());return this.simplify(start,path);}
      open.delete(current);const cx=current%this.width,cz=Math.floor(current/this.width);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=cx+dx,z=cz+dz;if(x<0||x>=this.width||z<0||z>=this.depth)continue;const n=z*this.width+x;if(!this.walkable[n]||!this.lineClear(this.point(current),this.point(n)))continue;const c=cost.get(current)!+1;if(c<(cost.get(n)??Infinity)){cost.set(n,c);came.set(n,current);open.add(n);}}
    }return [this.point(s)];
  }
  simplify(start:Vector3,path:Vector3[]){const out:Vector3[]=[];let from=start;for(let i=0;i<path.length;i++){const next=path[i+1];if(!next||!this.lineClear(from,next)){out.push(path[i]);from=path[i];}}return out;}
  lineClear(a:Vector3,b:Vector3){if(!allowedSurfaceEdge(a,b))return false;const len=Vector3.Distance(a,b);for(let i=0;i<=Math.ceil(len/.4);i++){const t=len===0?0:Math.min(1,i*.4/len),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=this.world.terrain.height(x,z);if(!this.world.canStand(x,y,z,.55)||this.world.inRamp(x,z))return false;}return true;}
}
