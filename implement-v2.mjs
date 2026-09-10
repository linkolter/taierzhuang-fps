import fs from 'node:fs';
const file='src/map/World.ts';let s=fs.readFileSync(file,'utf8');
s=s.replace("import { NORTH_SHAFTS,SOUTH_SHAFTS,openShaft,northRampFloor,southRampFloor } from './Topology';","import { openShaft,rampAt,rampFloor } from './Topology';\nimport { tunnelContains } from './TunnelGeometry';");
const a=s.indexOf('  inRamp('),b=s.indexOf('  blocked(',a);
s=s.slice(0,a)+`  inRamp(x:number,z:number){return this.village&&openShaft(x,z,this.terrain.height);}
  undergroundAt(x:number,y:number,z:number){return this.inRamp(x,z)||y<this.terrain.height(x,z)-.5;}
  tunnelVolume(x:number,y:number,z:number,radius=0){return tunnelContains(x,z,radius);}
  floorAt(x:number,z:number,y=0){
    if(!this.village)return 0;const surface=this.terrain.height(x,z),r=rampAt(x,z);
    if(r&&(this.inRamp(x,z)||y<surface-.5))return rampFloor(r,x,z,this.terrain.height);
    if(y<surface-.5&&tunnelContains(x,z))return -4;return surface;
  }
`+s.slice(b);
const ra=s.indexOf('    if(this.tactical)return'),rb=s.indexOf('  nearestCover(',ra);
s=s.slice(0,ra)+`    if(this.tactical)return this.tactical.find(start,end,route as TacticalRoute);
    return this.navigation?.find(start,end)??[end];
  }
`+s.slice(rb);
fs.writeFileSync(file,s);
s=fs.readFileSync('src/map/TacticalRouteGraph.ts','utf8').replace(/import \{ allowedSurfaceEdge[^\n]+/,"import { allowedSurfaceEdge,groundLane,rampFloor } from './Topology';\nimport { RAMPS,TUNNEL_PATHS,TUNNEL_ROOMS } from './MapLayout';");
const na=s.indexOf('    const trunk='),nb=s.indexOf('    this.costs=',na);
s=s.slice(0,na)+`    const points=new Map<string,number>();
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
`+s.slice(nb);
s=s.replace('if(Vector3.DistanceSquared(this.nodes[e].position,end)<9)path.push(end.clone());','if(this.walkableLink(this.nodes[e].position,end))path.push(end.clone());');
fs.writeFileSync('src/map/TacticalRouteGraph.ts',s);
s=fs.readFileSync('src/map/Navigation.ts','utf8').replace('width=89; depth=43; step=2','width=177; depth=85; step=1').replace('let iterations=0','let iterations=0').replace('iterations++<4000','iterations++<16000');fs.writeFileSync('src/map/Navigation.ts',s);
s=fs.readFileSync('src/config/gameConfig.ts','utf8').replace('spawnX: -80','spawnX: -82').replace('centre: 1.2','centre: 1').replace('northAnchorZ: 22','northAnchorZ: 28').replace('southAnchorZ: -38','southAnchorZ: -28').replace('northAnchorX: 40','northAnchorX: 20').replace('southAnchorX: 30','southAnchorX: 12');fs.writeFileSync('src/config/gameConfig.ts',s);
s=fs.readFileSync('src/ai/Bot.ts','utf8').replace("this.team === 'cn' ? -80 : 80","this.team === 'cn' ? -82 : 82").replace("((this.id % 4) - 1.5) * 3","((this.id % 4) - 1.5) * 1.1");fs.writeFileSync('src/ai/Bot.ts',s);
s=fs.readFileSync('src/capture/CaptureSystem.ts','utf8').replace("import { clamp }", "import { OBJECTIVES } from '../map/MapLayout';\nimport { clamp }");const ca=s.indexOf('  points: CapturePoint[] = ['),cb=s.indexOf('  onCapture',ca);s=s.slice(0,ca)+"  points: CapturePoint[] = OBJECTIVES.map(p=>({...p,owner:null,progress:0,contested:false,present:{cn:0,jp:0}}));\n"+s.slice(cb);fs.writeFileSync('src/capture/CaptureSystem.ts',s);
s=fs.readFileSync('src/map/MapLayout.ts','utf8').replace("{x:0,z:9,w:11,d:6,h:4.5","{x:5,z:10,w:9,d:6,h:4.5");fs.writeFileSync('src/map/MapLayout.ts',s);
s=fs.readFileSync('src/map/Village.ts','utf8').replace("x,1.6,0,.6,3.2,5.6","x,1.6,x<0?.8:-.8,.6,3.2,4");fs.writeFileSync('src/map/Village.ts',s);
