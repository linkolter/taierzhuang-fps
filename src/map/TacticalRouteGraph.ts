import { Vector3 } from '@babylonjs/core';
import type { World } from './World';
import { allowedSurfaceEdge,groundLane,rampFloor } from './Topology';
import { RAMPS,TUNNEL_PATHS,TUNNEL_ROOMS } from './MapLayout';
export const ROUTE_TYPES={main:'MAIN_STREET',north:'HIGH_ROUTE',south:'LOW_ROUTE',tunnel:'TUNNEL_ROUTE'} as const;
export type Level='surface'|'high'|'low'|'tunnel';
export type TacticalRoute='main'|'north'|'south'|'tunnel';
export interface RouteNode { id:number; position:Vector3; level:Level; routeType:TacticalRoute; combatRouteType:typeof ROUTE_TYPES[TacticalRoute]; objectiveId?:string; coverValue:number }
export interface RouteEdge { to:number; cost:number; type:'normal'|'stairs'|'slope'|'tunnelEntrance' }
/** Extends the existing ground waypoint grid with explicit underground links. Scratch storage is reused. */
export class TacticalRouteGraph {
  nodes:RouteNode[]=[];edges:RouteEdge[][]=[];searches=0;failed=0;
  private costs!:Float64Array;private parents!:Int32Array;private closed!:Uint8Array;private heapIds:number[]=[];private heapScores:number[]=[];private heapSize=0;
  private spatialNodes=new Map<number,RouteNode[]>();
  private pathCache=new Map<string,Vector3[]>();
  constructor(public world:World){
    const nav=world.navigation!;const grid=new Map<number,number>();
    for(let i=0;i<nav.walkable.length;i++)if(nav.walkable[i]){const p=nav.point(i);grid.set(i,this.add(p.clone(),this.levelAt(p),groundLane(p.z)));}
    for(const [i,id] of grid){for(const offset of [1,nav.width,nav.width+1,nav.width-1]){const j=i+offset;if(Math.abs(i%nav.width-j%nav.width)>1)continue;const other=grid.get(j);if(other!==undefined&&nav.lineClear(this.nodes[id].position,this.nodes[other].position))this.link(id,other,Math.abs(this.nodes[id].position.y-this.nodes[other].position.y)>.05?(Math.abs(this.nodes[id].position.x+22)<2&&this.nodes[id].position.z>=12&&this.nodes[id].position.z<=18?'stairs':'slope'):'normal');}}
    const points=new Map<string,number>();
    const node=(x:number,z:number)=>{const key=x.toFixed(3)+','+z.toFixed(3);let id=points.get(key);if(id===undefined){id=this.add(new Vector3(x,-4,z),'tunnel','tunnel');points.set(key,id);}return id;};
    for(const path of TUNNEL_PATHS)for(let i=1;i<path.points.length;i++){
      const a=path.points[i-1],b=path.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));let prev=node(...a);
      for(let j=1;j<=steps;j++){const id=node(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps);this.link(prev,id,'normal');prev=id;}
    }
    for(const room of TUNNEL_ROOMS){const center=node(room.x,room.z);for(const n of [...this.nodes])if(n.level==='tunnel'&&n.id!==center&&Vector3.Distance(n.position,this.nodes[center].position)<4&&this.walkableLink(n.position,this.nodes[center].position))this.link(center,n.id,'normal');}
    for(const r of RAMPS){let prev=node(...r.bottom);const len=Math.hypot(r.lip[0]-r.bottom[0],r.lip[1]-r.bottom[1]),steps=Math.ceil(len/.5);
      for(let i=1;i<=steps;i++){const t=i/steps,x=r.bottom[0]+(r.lip[0]-r.bottom[0])*t,z=r.bottom[1]+(r.lip[1]-r.bottom[1])*t;const id=this.add(new Vector3(x,rampFloor(r,x,z,world.terrain.height),z),'tunnel','tunnel');this.link(prev,id,'tunnelEntrance');prev=id;}
      // The lip connects only to physically reachable surface nodes in its own lane.
      const lip=this.nodes[prev].position;for(const n of this.nodes)if(n.level!=='tunnel'&&groundLane(n.position.z)===groundLane(lip.z)&&Vector3.DistanceSquared(lip,n.position)<16&&this.walkableLink(lip,n.position))this.link(prev,n.id,'tunnelEntrance');
    }
    for(const n of this.nodes){const key=this.spatialKey(Math.floor(n.position.x/4),Math.floor(n.position.z/4));let bucket=this.spatialNodes.get(key);if(!bucket){bucket=[];this.spatialNodes.set(key,bucket);}bucket.push(n);}
    this.costs=new Float64Array(this.nodes.length);this.parents=new Int32Array(this.nodes.length);this.closed=new Uint8Array(this.nodes.length);
  }
  levelAt(p:Vector3):Level{return p.y>0.6?'high':p.y<-.4?'low':'surface';}
  add(position:Vector3,level:Level,routeType:TacticalRoute){const id=this.nodes.length;this.nodes.push({id,position,level,routeType,combatRouteType:ROUTE_TYPES[routeType],coverValue:0});this.edges.push([]);return id;}
  link(a:number,b:number,type:RouteEdge['type']){if(a<0||b<0||a===b)return;const cost=Vector3.Distance(this.nodes[a].position,this.nodes[b].position);this.edges[a].push({to:b,cost,type});this.edges[b].push({to:a,cost,type});}
  private spatialKey(x:number,z:number){return (x+128)*256+z+128;}
  nearest(p:Vector3,tunnel=this.world.undergroundAt(p.x,p.y,p.z),exclude=-1){
    let best=-1,d=64;const cx=Math.floor(p.x/4),cz=Math.floor(p.z/4);
    for(let ring=0;ring<=2;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){
      if(ring&&Math.abs(dx)<ring&&Math.abs(dz)<ring)continue;
      const x=cx+dx,z=cz+dz,nearX=Math.max(x*4,Math.min(p.x,x*4+4)),nearZ=Math.max(z*4,Math.min(p.z,z*4+4));
      if((nearX-p.x)**2+(nearZ-p.z)**2>d)continue;
      const bucket=this.spatialNodes.get(this.spatialKey(x,z));if(!bucket)continue;
      for(const n of bucket){if(n.id===exclude||(n.level==='tunnel')!==tunnel)continue;const dist=Vector3.DistanceSquared(n.position,p);if((dist<d||best>=0&&dist===d&&n.id<best)&&this.walkableLink(p,n.position)){best=n.id;d=dist;}}
    }return best;
  }
  walkableLink(a:Vector3,b:Vector3){if(!this.world.undergroundAt(a.x,a.y,a.z)&&!this.world.undergroundAt(b.x,b.y,b.z)&&!allowedSurfaceEdge(a,b))return false;const steps=Math.max(1,Math.ceil(Vector3.Distance(a,b)/.3));let lastY=a.y;for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=this.world.floorAt(x,z,lastY);if(Math.abs(y-lastY)>.36||!this.world.canStand(x,y,z))return false;lastY=y;}return Math.abs(lastY-b.y)<.25;}
  private push(id:number,f:number){let i=this.heapSize++;while(i>0){const p=(i-1)>>1;if(this.heapScores[p]<=f)break;this.heapIds[i]=this.heapIds[p];this.heapScores[i]=this.heapScores[p];i=p;}this.heapIds[i]=id;this.heapScores[i]=f;}
  private pop(){const first=this.heapIds[0],lastId=this.heapIds[--this.heapSize],lastScore=this.heapScores[this.heapSize];if(this.heapSize){let i=0;while(i*2+1<this.heapSize){let child=i*2+1;if(child+1<this.heapSize&&this.heapScores[child+1]<this.heapScores[child])child++;if(lastScore<=this.heapScores[child])break;this.heapIds[i]=this.heapIds[child];this.heapScores[i]=this.heapScores[child];i=child;}this.heapIds[i]=lastId;this.heapScores[i]=lastScore;}return first;}
  find(start:Vector3,end:Vector3,preference:TacticalRoute='main'){
    this.searches++;const s=this.nearest(start),e=this.nearest(end);if(s<0||e<0)return [];
    const cacheKey=s+':'+e+':'+preference,cached=this.pathCache.get(cacheKey);if(cached){const path=cached.slice();if(this.walkableLink(this.nodes[e].position,end))path.push(end.clone());return path;}
    this.costs.fill(Infinity);this.parents.fill(-1);this.closed.fill(0);this.heapSize=0;this.costs[s]=0;this.push(s,0);
    while(this.heapSize){const id=this.pop();if(this.closed[id])continue;if(id===e){const path:Vector3[]=[];let n=e;while(n!==s&&n>=0){path.push(this.nodes[n].position);n=this.parents[n];}path.push(this.nodes[s].position);path.reverse();if(this.pathCache.size>=128)this.pathCache.delete(this.pathCache.keys().next().value!);this.pathCache.set(cacheKey,path.slice());if(this.walkableLink(this.nodes[e].position,end))path.push(end.clone());return path;}this.closed[id]=1;
      for(const edge of this.edges[id]){if(this.closed[edge.to])continue;const node=this.nodes[edge.to],factor=node.routeType===preference?.48:1.2;const cost=this.costs[id]+edge.cost*factor;if(cost<this.costs[edge.to]){this.costs[edge.to]=cost;this.parents[edge.to]=id;this.push(edge.to,cost+Vector3.Distance(node.position,this.nodes[e].position)*.45);}}
    }this.failed++;return [];
  }
}

