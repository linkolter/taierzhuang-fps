import { Color3, Mesh, MeshBuilder, Ray, Scene, StandardMaterial, Vector3, VertexBuffer } from '@babylonjs/core';
import { RoutePlanningScheduler } from '../ai/RoutePlanningScheduler';
import { CONFIG } from '../config/gameConfig';
import { buildVillage } from './Village';
import { ObstacleIndex } from './ObstacleIndex';
import { StaticMeshIndex } from './StaticMeshIndex';
import { Navigation } from './Navigation';
import { TacticalRouteGraph,type TacticalRoute } from './TacticalRouteGraph';
import { Terrain } from './Terrain';
import { buildCoverPoints,type CoverPoint } from './CoverPoints';
import { openShaft,rampAt,rampFloor } from './Topology';
import { tunnelContains } from './TunnelGeometry';
import { tunnelEnvironment } from './TunnelEnvironment';
import { whiteboxFootstep } from '../audio/Footsteps';

export interface Obstacle { x: number; z: number; w: number; d: number; bottom: number; top: number }
export class World {
  routePlanner=new RoutePlanningScheduler();
  obstacles: Obstacle[] = [];
  collisionQueries=0;collisionCandidates=0;losQueries=0;losCandidates=0;
  private collisionIndex?:ObstacleIndex;
  staticMeshIndex?:StaticMeshIndex;
  pickStaticRay(ray:Ray){this.staticMeshIndex??=new StaticMeshIndex(this.solids);return this.staticMeshIndex.pick(ray);}
  footSurfaces:{x:number;z:number;y:number;w:number;d:number;kind:'stone'|'wood'}[]=[];
  footstepAt(p:Vector3){if(this.undergroundAt(p.x,p.y,p.z))return 'tunnel';for(const s of this.footSurfaces)if(Math.abs(p.y-s.y)<.2&&Math.abs(p.x-s.x)<=s.w/2&&Math.abs(p.z-s.z)<=s.d/2+.25)return s.kind;return this.village?whiteboxFootstep(p.x,p.y,p.z):'earth';}
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
    if(name==='stoneStep'||name.includes('floor')&&mat.name==='wood')this.footSurfaces.push({x,z,y:y+h/2,w,d,kind:mat.name==='wood'?'wood':'stone'});
    if(mat.name==='plaster'){const positions=m.getVerticesData(VertexBuffer.PositionKind)!;const colors:number[]=[];for(let i=1;i<positions.length;i+=3){const shade=positions[i]<0?.78:1;colors.push(shade,shade,shade,1);}m.setVerticesData(VertexBuffer.ColorKind,colors);}
    const uv=m.getVerticesData(VertexBuffer.UVKind);if(uv){const sizes=[[w,h],[w,h],[d,h],[d,h],[w,d],[w,d]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){uv[f*8+v*2]*=sizes[f][0]/2.5;uv[f*8+v*2+1]*=sizes[f][1]/2.5;}m.setVerticesData(VertexBuffer.UVKind,uv);}
    if (solid) { this.obstacles.push({ x, z, w, d, bottom: y - h / 2, top: y + h / 2 }); this.solids.push(m); this.collisionIndex?.add(this.obstacles.length-1);this.staticMeshIndex?.add(m); } return m;
  }
  buildTraining() {
    this.box('ground', 0, -0.3, 0, 180, 0.6, 90, this.material('earth', '#9e8b66'), false);
    this.box('wall', -66, 1.5, 8, 10, 3, 1, this.material('wall', '#b4a183'));
    this.box('crate', -69, 0.6, -4, 2, 1.2, 2, this.material('wood', '#675039'));
  }
  buildVillage() { this.village = true; buildVillage(this); this.collisionIndex=new ObstacleIndex(this.obstacles); this.navigation = new Navigation(this);this.tactical=new TacticalRouteGraph(this);this.coverPoints=buildCoverPoints(this); this.optimizeStatic();this.staticMeshIndex=new StaticMeshIndex(this.solids); }
  chooseCover(pos:Vector3,enemy:Vector3,id:number){let best:CoverPoint|null=null,score=Infinity;for(const p of this.coverPoints){if(p.reservedBy!==null&&p.reservedBy!==id||Math.abs(p.position.y-pos.y)>1.3)continue;const d=Vector3.DistanceSquared(pos,p.position);if(d>CONFIG.ai.coverRadius**2)continue;const dx=enemy.x-p.position.x,dz=enemy.z-p.position.z;if(dx*p.facing.x+dz*p.facing.z<0)continue;const eye=p.position.add(new Vector3(0,p.height==='crouch'?.85:1.35,0));const cover=this.blocked(eye,enemy.add(new Vector3(0,1.2,0)));const value=d+(cover?0:100);if(value<score){score=value;best=p;}}return best;}
  optimizeStatic() { const groups=new Map<string,Mesh[]>();for(const m of [...this.scene.meshes] as Mesh[]){if(m.parent||!m.material||m.name.startsWith('sign-'))continue;if(m.metadata?.staticChunk){m.freezeWorldMatrix();continue;}const key=m.material.uniqueId+':'+!!m.metadata?.solid+':'+Math.floor(m.position.x/30);if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(m);}this.solids=(this.scene.meshes as Mesh[]).filter(m=>m.metadata?.staticChunk&&m.metadata?.solid);for(const pieces of groups.values()){const solid=!!pieces[0].metadata?.solid;const mesh=pieces.length>1?Mesh.MergeMeshes(pieces,true,true):pieces[0];if(mesh){mesh.metadata={solid};mesh.isPickable=solid;mesh.receiveShadows=true;mesh.freezeWorldMatrix();if(solid)this.solids.push(mesh);}} }
  inRamp(x:number,z:number){return this.village&&openShaft(x,z,this.terrain.height);}
  environmentAt(x:number,y:number,z:number){return tunnelEnvironment(this,x,y,z);}
  undergroundAt(x:number,y:number,z:number){return this.environmentAt(x,y,z).blend>.05;}
  tunnelVolume(x:number,y:number,z:number,radius=0){return tunnelContains(x,z,radius);}
  floorAt(x:number,z:number,y=0){
    if(!this.village)return 0;const surface=this.terrain.height(x,z),r=rampAt(x,z);
    if(r&&(this.inRamp(x,z)||y<surface-.5))return rampFloor(r,x,z,this.terrain.height);
    if(y<surface-.5&&tunnelContains(x,z))return -4;return surface;
  }
  blocked(a: Vector3, b: Vector3) {
    // Slab intersection against collision boxes avoids per-triangle vision tests for all 15 bots.
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    const candidates=this.collisionIndex?.query(Math.min(a.x,b.x),Math.min(a.z,b.z),Math.max(a.x,b.x),Math.max(a.z,b.z))??this.obstacles;
    this.losQueries++;this.losCandidates+=candidates.length;
    for(const o of candidates){let lo=0,hi=1,hit=true;for(let k=0;k<3;k++){
      const origin=k===0?a.x:k===1?a.y:a.z,direction=k===0?dx:k===1?dy:dz;
      const min=k===0?o.x-o.w/2:k===1?o.bottom:o.z-o.d/2,max=k===0?o.x+o.w/2:k===1?o.top:o.z+o.d/2;
      if(Math.abs(direction)<.000001){if(origin<min||origin>max){hit=false;break;}}
      else{let t1=(min-origin)/direction,t2=(max-origin)/direction;if(t1>t2){const t=t1;t1=t2;t2=t;}lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi){hit=false;break;}}
    }if(hit&&hi>.001&&lo<.999)return true;}
    const steps=Math.ceil(Math.hypot(dx,dy,dz));for(let i=1;i<steps;i++){const t=i/steps,x=a.x+dx*t,y=a.y+dy*t,z=a.z+dz*t;const underground=this.undergroundAt(x,y,z)&&this.tunnelVolume(x,y,z);if(!underground&&y<this.floorAt(x,z,y)-.05)return true;}return false;
  }
  route(start: Vector3, end: Vector3, route: string, lane: number): Vector3[] {
    if(this.tactical)return this.tactical.find(start,end,route as TacticalRoute);
    return this.navigation?.find(start,end)??[end];
  }
  nearestCover(pos: Vector3, enemy: Vector3) { let best: Vector3 | null = null, distance = 12; for (const o of this.obstacles) { if (o.top < .8 || o.bottom > 1) continue; const d = new Vector3(o.x - enemy.x, 0, o.z - enemy.z).normalize(); const p = new Vector3(o.x + d.x * (o.w / 2 + 1), pos.y, o.z + d.z * (o.d / 2 + 1)); const len = Vector3.Distance(p, pos); if (len < distance && this.canStand(p.x, p.y, p.z) && this.blocked(enemy.add(new Vector3(0, 1.3, 0)), p.add(new Vector3(0, 1.3, 0)))) { best = p; distance = len; } } return best; }
  canStand(x: number, y: number, z: number, radius: number = CONFIG.player.radius, height: number = CONFIG.player.height) {
    if (Math.abs(x) > 89 || Math.abs(z) > 44) return false;
    if(this.village&&y<this.terrain.height(x,z)-.5&&!this.tunnelVolume(x,y,z,radius))return false;
    const nearby=this.collisionIndex?.query(x-radius,z-radius,x+radius,z+radius)??this.obstacles;
    this.collisionQueries++;this.collisionCandidates+=nearby.length;
    for(const o of nearby)if(!(o.top<=.05&&y>=o.top-.36)&&y+height>o.bottom+.06&&y<o.top-.05&&Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius)return false;
    return true;
  }
  move(pos: Vector3, dx: number, dz: number, height: number = CONFIG.player.height, followFloor=true) {
    const oldFloor=this.floorAt(pos.x,pos.z,pos.y), grounded=followFloor&&Math.abs(pos.y-oldFloor)<.16;
    const tryAxis=(x:number,z:number)=>{const floor=this.floorAt(x,z,pos.y);if(grounded&&floor>oldFloor+.36)return;const y=grounded?floor:pos.y;if(this.canStand(x,y,z,CONFIG.player.radius,height)){pos.x=x;pos.z=z;if(grounded)pos.y=y;}};
    tryAxis(pos.x+dx,pos.z);tryAxis(pos.x,pos.z+dz);
  }
}
