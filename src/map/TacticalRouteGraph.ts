import { Vector3 } from '@babylonjs/core';
import type { World } from './World';
import { allowedSurfaceEdge,groundLane,NORTH_SHAFTS,SOUTH_SHAFTS,northRampFloor,southRampFloor,trunkZ,northNodeX } from './Topology';
export type Level='surface'|'high'|'low'|'tunnel';
export type TacticalRoute='main'|'north'|'south'|'tunnel';
export interface RouteNode { id:number; position:Vector3; level:Level; routeType:TacticalRoute; objectiveId?:string; coverValue:number }
export interface RouteEdge { to:number; cost:number; type:'normal'|'stairs'|'slope'|'tunnelEntrance' }
/** Extends the existing ground waypoint grid with explicit underground links. Scratch storage is reused. */
export class TacticalRouteGraph {
  nodes:RouteNode[]=[];edges:RouteEdge[][]=[];searches=0;failed=0;
  private costs!:Float64Array;private parents!:Int32Array;private closed!:Uint8Array;private heap:{id:number;f:number}[]=[];
  constructor(public world:World){
    const nav=world.navigation!;const grid=new Map<number,number>();
    for(let i=0;i<nav.walkable.length;i++)if(nav.walkable[i]){const p=nav.point(i);grid.set(i,this.add(p.clone(),this.levelAt(p),groundLane(p.z)));}
    for(const [i,id] of grid){for(const offset of [1,nav.width]){const j=i+offset;if(offset===1&&Math.floor(i/nav.width)!==Math.floor(j/nav.width))continue;const other=grid.get(j);if(other!==undefined&&nav.lineClear(this.nodes[id].position,this.nodes[other].position))this.link(id,other,Math.abs(this.nodes[id].position.y-this.nodes[other].position.y)>.05?(Math.abs(this.nodes[id].position.x+22)<2&&this.nodes[id].position.z>=12&&this.nodes[id].position.z<=18?'stairs':'slope'):'normal');}}
    const trunk=new Map<number,number>();for(let x=-68;x<=68;x+=4)trunk.set(x,this.add(new Vector3(x,-4,trunkZ(x)),'tunnel','tunnel'));
    for(let x=-68;x<68;x+=4)this.link(trunk.get(x)!,trunk.get(x+4)!,'normal');
    for(const x of [-68,0,68]){const lip=this.add(new Vector3(x,world.floorAt(x,-12,0),-12),'surface','tunnel');const surface=this.nearest(this.nodes[lip].position,false,lip);this.link(lip,surface,'normal');let previous=lip;for(const z of [-15,-19,-23,-27,-29]){const n=z===-29?trunk.get(x)!:this.add(new Vector3(x,world.floorAt(x,z,-4),z),'tunnel','tunnel');this.link(previous,n,'tunnelEntrance');previous=n;}}
    for(const x of NORTH_SHAFTS){let previous=trunk.get(x)!;for(const z of [-25,-21,-17,-13,-9,-5,-1,3,6,10,14,18,22,26]){const n=this.add(new Vector3(northNodeX(x,z),z<=6?-4:northRampFloor(z),z),'tunnel','tunnel');this.link(previous,n,z>=10?'tunnelEntrance':'normal');previous=n;}const lip=this.add(new Vector3(x,world.terrain.height(x,27),27),'high','north');this.link(previous,lip,'tunnelEntrance');this.link(lip,this.nearest(this.nodes[lip].position,false,lip),'normal');}
    for(const x of SOUTH_SHAFTS){let previous=trunk.get(x)!;for(const z of [-34,-36,-38,-40]){const n=this.add(new Vector3(x,southRampFloor(z),z),'tunnel','tunnel');this.link(previous,n,'tunnelEntrance');previous=n;}
    const southLip=this.add(new Vector3(x,world.terrain.height(x,-41),-41),'low','south');this.link(previous,southLip,'tunnelEntrance');this.link(southLip,this.nearest(this.nodes[southLip].position,false,southLip),'normal');}
    const room=this.add(new Vector3(17,-4,-34),'tunnel','tunnel');this.link(trunk.get(20)!,room,'normal');
    this.costs=new Float64Array(this.nodes.length);this.parents=new Int32Array(this.nodes.length);this.closed=new Uint8Array(this.nodes.length);
  }
  levelAt(p:Vector3):Level{return p.y>0.6?'high':p.y<-.4?'low':'surface';}
  add(position:Vector3,level:Level,routeType:TacticalRoute){const id=this.nodes.length;this.nodes.push({id,position,level,routeType,coverValue:0});this.edges.push([]);return id;}
  link(a:number,b:number,type:RouteEdge['type']){if(a<0||b<0||a===b)return;const cost=Vector3.Distance(this.nodes[a].position,this.nodes[b].position);this.edges[a].push({to:b,cost,type});this.edges[b].push({to:a,cost,type});}
  nearest(p:Vector3,tunnel=this.world.undergroundAt(p.x,p.y,p.z),exclude=-1){let best=-1,d=64;for(const n of this.nodes){if(n.id===exclude||(n.level==='tunnel')!==tunnel)continue;const dist=Vector3.DistanceSquared(n.position,p);if(dist<d&&this.walkableLink(p,n.position)){best=n.id;d=dist;}}return best;}
  walkableLink(a:Vector3,b:Vector3){if(!this.world.undergroundAt(a.x,a.y,a.z)&&!this.world.undergroundAt(b.x,b.y,b.z)&&!allowedSurfaceEdge(a,b))return false;const steps=Math.max(1,Math.ceil(Vector3.Distance(a,b)/.3));let lastY=a.y;for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=this.world.floorAt(x,z,lastY);if(Math.abs(y-lastY)>.36||!this.world.canStand(x,y,z))return false;lastY=y;}return Math.abs(lastY-b.y)<.25;}
  private push(id:number,f:number){let i=this.heap.length;this.heap.push({id,f});while(i>0){const p=(i-1)>>1;if(this.heap[p].f<=f)break;this.heap[i]=this.heap[p];i=p;}this.heap[i]={id,f};}
  private pop(){const first=this.heap[0],last=this.heap.pop()!;if(this.heap.length){let i=0;while(i*2+1<this.heap.length){let child=i*2+1;if(child+1<this.heap.length&&this.heap[child+1].f<this.heap[child].f)child++;if(last.f<=this.heap[child].f)break;this.heap[i]=this.heap[child];i=child;}this.heap[i]=last;}return first.id;}
  find(start:Vector3,end:Vector3,preference:TacticalRoute='main'){
    this.searches++;const s=this.nearest(start),e=this.nearest(end);if(s<0||e<0)return [];
    this.costs.fill(Infinity);this.parents.fill(-1);this.closed.fill(0);this.heap.length=0;this.costs[s]=0;this.push(s,0);
    while(this.heap.length){const id=this.pop();if(this.closed[id])continue;if(id===e){const path:Vector3[]=[];let n=e;while(n!==s&&n>=0){path.push(this.nodes[n].position);n=this.parents[n];}path.push(this.nodes[s].position);path.reverse();if(Vector3.DistanceSquared(this.nodes[e].position,end)<9)path.push(end.clone());return path;}this.closed[id]=1;
      for(const edge of this.edges[id]){if(this.closed[edge.to])continue;const node=this.nodes[edge.to],factor=node.routeType===preference?.48:1.2;const cost=this.costs[id]+edge.cost*factor;if(cost<this.costs[edge.to]){this.costs[edge.to]=cost;this.parents[edge.to]=id;this.push(edge.to,cost+Vector3.Distance(node.position,this.nodes[e].position)*.45);}}
    }this.failed++;return [];
  }
}

