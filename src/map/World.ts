import { Color3, Mesh, MeshBuilder, Ray, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
import { buildVillage } from './Village';
import { Navigation } from './Navigation';
import { TacticalRouteGraph,type TacticalRoute } from './TacticalRouteGraph';
import { Terrain } from './Terrain';
import { buildCoverPoints,type CoverPoint } from './CoverPoints';
import { NORTH_SHAFTS,SOUTH_SHAFTS,openShaft,northRampFloor,southRampFloor } from './Topology';

export interface Obstacle { x: number; z: number; w: number; d: number; bottom: number; top: number }
export class World {
  obstacles: Obstacle[] = [];
  materials = new Map<string, StandardMaterial>();
  solids: Mesh[] = [];
  lamps: Vector3[] = []; village = false; navigation?: Navigation;
  tactical?:TacticalRouteGraph;
  terrain=new Terrain();
  coverPoints:CoverPoint[]=[];
  constructor(public scene: Scene) {}
  material(name: string, hex: string) { let m = this.materials.get(name); if (!m) { m = new StandardMaterial(name, this.scene); m.diffuseColor = Color3.FromHexString(hex); m.specularColor = Color3.Black(); this.materials.set(name, m); } return m; }
  box(name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: StandardMaterial, solid = true) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene); m.position.set(x, y, z); m.material = mat; m.isPickable = solid; m.metadata = { solid }; m.receiveShadows = true;
    if (solid) { this.obstacles.push({ x, z, w, d, bottom: y - h / 2, top: y + h / 2 }); this.solids.push(m); } return m;
  }
  buildTraining() {
    this.box('ground', 0, -0.3, 0, 180, 0.6, 90, this.material('earth', '#9e8b66'), false);
    this.box('wall', -66, 1.5, 8, 10, 3, 1, this.material('wall', '#b4a183'));
    this.box('crate', -69, 0.6, -4, 2, 1.2, 2, this.material('wood', '#675039'));
  }
  buildVillage() { this.village = true; buildVillage(this); this.navigation = new Navigation(this);this.tactical=new TacticalRouteGraph(this);this.coverPoints=buildCoverPoints(this); this.optimizeStatic(); }
  chooseCover(pos:Vector3,enemy:Vector3,id:number){let best:CoverPoint|null=null,score=Infinity;for(const p of this.coverPoints){if(p.reservedBy!==null&&p.reservedBy!==id||Math.abs(p.position.y-pos.y)>1.3)continue;const d=Vector3.DistanceSquared(pos,p.position);if(d>CONFIG.ai.coverRadius**2)continue;const dx=enemy.x-p.position.x,dz=enemy.z-p.position.z;if(dx*p.facing.x+dz*p.facing.z<0)continue;const eye=p.position.add(new Vector3(0,p.height==='crouch'?.85:1.35,0));const cover=this.blocked(eye,enemy.add(new Vector3(0,1.2,0)));const value=d+(cover?0:100);if(value<score){score=value;best=p;}}return best;}
  optimizeStatic() { const groups=new Map<string,Mesh[]>();for(const m of [...this.scene.meshes] as Mesh[]){if(m.parent||!m.material||m.name.startsWith('sign-'))continue;const key=m.material.uniqueId+':'+!!m.metadata?.solid+':'+Math.floor(m.position.x/30);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(m);}this.solids=[];for(const pieces of groups.values()){const solid=!!pieces[0].metadata?.solid;const mesh=pieces.length>1?Mesh.MergeMeshes(pieces,true,true):pieces[0];if(mesh){mesh.metadata={solid};mesh.isPickable=solid;mesh.receiveShadows=true;mesh.freezeWorldMatrix();if(solid)this.solids.push(mesh);}} }
  inRamp(x: number,z: number){return this.village&&openShaft(x,z);}
  undergroundAt(x:number,y:number,z:number){return this.inRamp(x,z)||y<this.terrain.height(x,z)-.5;}
  tunnelVolume(x:number,y:number,z:number,radius=0){
    if(CONFIG.map.entrances.some(e=>Math.abs(x-e)<2-radius)&&z<=-13&&z>=-31)return true;
    if(NORTH_SHAFTS.some(e=>Math.abs(x-e)<1.2-radius)&&z>=-29.1&&z<=26.1)return true;
    if(SOUTH_SHAFTS.some(e=>Math.abs(x-e)<1.2-radius)&&z<=-29&&z>=-40.1)return true;
    return Math.abs(x)<70&&z>=-30.2+radius&&z<=-27.8-radius||x>=16+radius&&x<=24-radius&&z>=-37.2+radius&&z<=-29;
  }
  floorAt(x: number, z: number, y = 0) {
    if(!this.village)return 0;const surface=this.terrain.height(x,z);
    if(CONFIG.map.entrances.some(e=>Math.abs(x-e)<2)&&z<=-13&&z>=-31)return Math.max(-4,Math.min(0,(z+13)*4/14));
    if(NORTH_SHAFTS.some(e=>Math.abs(x-e)<1.2)&&z>=-29.1&&z<=26&&(y<surface-.5||z>=19))return z<=6?-4:northRampFloor(z);
    if(SOUTH_SHAFTS.some(e=>Math.abs(x-e)<1.2)&&z<=-29&&z>=-40&&(y<surface-.5||z<=-35))return southRampFloor(z);
    if(y<surface-.5&&this.tunnelVolume(x,y,z))return -4;return surface;
  }
  blocked(a: Vector3, b: Vector3) {
    // Slab intersection against collision boxes avoids per-triangle vision tests for all 15 bots.
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    for(const o of this.obstacles){let lo=0,hi=1,hit=true;for(let k=0;k<3;k++){
      const origin=k===0?a.x:k===1?a.y:a.z,direction=k===0?dx:k===1?dy:dz;
      const min=k===0?o.x-o.w/2:k===1?o.bottom:o.z-o.d/2,max=k===0?o.x+o.w/2:k===1?o.top:o.z+o.d/2;
      if(Math.abs(direction)<.000001){if(origin<min||origin>max){hit=false;break;}}
      else{let t1=(min-origin)/direction,t2=(max-origin)/direction;if(t1>t2){const t=t1;t1=t2;t2=t;}lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi){hit=false;break;}}
    }if(hit&&hi>.001&&lo<.999)return true;}
    const steps=Math.ceil(Math.hypot(dx,dy,dz));for(let i=1;i<steps;i++){const t=i/steps,x=a.x+dx*t,y=a.y+dy*t,z=a.z+dz*t;const underground=this.undergroundAt(x,y,z)&&this.tunnelVolume(x,y,z);if(!underground&&y<this.floorAt(x,z,y)-.05)return true;}return false;
  }
  route(start: Vector3, end: Vector3, route: string, lane: number): Vector3[] {
    if(this.tactical)return this.tactical.find(start,end,route as TacticalRoute);
    if(!this.navigation)return [new Vector3(start.x,0,lane),new Vector3(end.x,0,lane),end];
    const nav=this.navigation;const entrances=[...CONFIG.map.entrances];
    if(route==='tunnel'||start.y<-1.5){const enter=entrances.reduce((a,b)=>Math.abs(a-start.x)<Math.abs(b-start.x)?a:b),exit=entrances.reduce((a,b)=>Math.abs(a-end.x)<Math.abs(b-end.x)?a:b);let path:Vector3[]=[];
      if(start.y>=-1.5)path=[...nav.find(start,new Vector3(enter,0,-12)),new Vector3(enter,-4,-27.7),new Vector3(enter,-4,-29)];
      else if(this.inRamp(start.x,start.z))path=[new Vector3(enter,-4,-29)];
      path.push(new Vector3(exit,-4,-29),new Vector3(exit,-4,-27.7),new Vector3(exit,0,-12));path.push(...nav.find(new Vector3(exit,0,-12),end));return path;
    }
    if(Math.abs(start.z-lane)<4||Vector3.Distance(start,end)<18)return nav.find(start,end);
    const first=new Vector3(start.x,0,lane),last=new Vector3(end.x,0,lane);return [...nav.find(start,first),...nav.find(first,last),...nav.find(last,end)];
  }
  nearestCover(pos: Vector3, enemy: Vector3) { let best: Vector3 | null = null, distance = 12; for (const o of this.obstacles) { if (o.top < .8 || o.bottom > 1) continue; const d = new Vector3(o.x - enemy.x, 0, o.z - enemy.z).normalize(); const p = new Vector3(o.x + d.x * (o.w / 2 + 1), pos.y, o.z + d.z * (o.d / 2 + 1)); const len = Vector3.Distance(p, pos); if (len < distance && this.canStand(p.x, p.y, p.z) && this.blocked(enemy.add(new Vector3(0, 1.3, 0)), p.add(new Vector3(0, 1.3, 0)))) { best = p; distance = len; } } return best; }
  canStand(x: number, y: number, z: number, radius: number = CONFIG.player.radius, height: number = CONFIG.player.height) {
    if (Math.abs(x) > 89 || Math.abs(z) > 44) return false;
    if(this.village&&y<this.terrain.height(x,z)-.5&&!this.tunnelVolume(x,y,z,radius))return false;
    return !this.obstacles.some(o => !(o.top<=.05&&y>=o.top-.36) && y + height > o.bottom + 0.06 && y < o.top - 0.05 && Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
  }
  move(pos: Vector3, dx: number, dz: number, height: number = CONFIG.player.height, followFloor=true) {
    const oldFloor=this.floorAt(pos.x,pos.z,pos.y), grounded=followFloor&&Math.abs(pos.y-oldFloor)<.16;
    const tryAxis=(x:number,z:number)=>{const floor=this.floorAt(x,z,pos.y);if(grounded&&floor>oldFloor+.36)return;const y=grounded?floor:pos.y;if(this.canStand(x,y,z,CONFIG.player.radius,height)){pos.x=x;pos.z=z;if(grounded)pos.y=y;}};
    tryAxis(pos.x+dx,pos.z);tryAxis(pos.x,pos.z+dz);
  }
}
