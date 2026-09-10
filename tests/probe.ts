import {NullEngine,Scene,Vector3} from '@babylonjs/core';
import {World} from '../src/map/World';
import {RAMPS,laneZ} from '../src/map/MapLayout';
const scene=new Scene(new NullEngine());const w=new World(scene);console.time('build');w.buildVillage();console.timeEnd('build');
console.log({obstacles:w.obstacles.length,meshes:scene.meshes.length,nodes:w.tactical!.nodes.length});
const g=w.tactical!;const failures:any[]=[];let checked=0;
for(const n of g.nodes)for(const e of g.edges[n.id])if(e.to>n.id&&(n.level==='tunnel'||g.nodes[e.to].level==='tunnel')){checked++;if(!g.walkableLink(n.position,g.nodes[e.to].position))failures.push([n.position.asArray(),g.nodes[e.to].position.asArray()]);}
console.log('edges',checked,'failed',failures.length,JSON.stringify(failures.slice(0,20)));
for(const r of RAMPS){const p=new Vector3(r.lip[0],w.terrain.height(...r.lip),r.lip[1]);console.log(r.id,'lip',w.canStand(p.x,p.y,p.z),'surface route',g.find(new Vector3(-82,0,0),p,'main').length,'bottom route',g.find(new Vector3(...[r.bottom[0],-4,r.bottom[1]]),new Vector3(0,-4,0),'tunnel').length);}
for(const lane of ['main','north','south'] as const){const a=new Vector3(-82,w.terrain.height(-82,laneZ(lane,-82)),laneZ(lane,-82)),b=new Vector3(82,w.terrain.height(82,laneZ(lane,82)),laneZ(lane,82));const path=g.find(a,b,lane==='main'?'main':lane);console.log(lane,'route',path.length);}
scene.dispose();
