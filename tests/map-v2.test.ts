import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {NullEngine,Scene,Vector3,Ray} from '@babylonjs/core';
import {Bot} from '../src/ai/Bot';
import {World} from '../src/map/World';
import {MAP,OBJECTIVES,RAMPS,SURFACE_CONNECTIONS,laneZ} from '../src/map/MapLayout';
import {groundLane,rampFloor} from '../src/map/Topology';
const engine=new NullEngine(),scene=new Scene(engine),world=new World(scene);world.buildVillage();const graph=world.tactical!;
const surface=(x:number,z:number)=>new Vector3(x,world.terrain.height(x,z),z);
function reachable(a:Vector3,b:Vector3,allowCross:boolean){const start=graph.nearest(a),end=graph.nearest(b),seen=new Set([start]),queue=[start];assert.ok(start>=0&&end>=0);for(let i=0;i<queue.length;i++){const id=queue[i];if(id===end)return true;for(const edge of graph.edges[id]){const n=graph.nodes[edge.to];if(n.level==='tunnel'||seen.has(n.id)||!allowCross&&groundLane(n.position.z)!==groundLane(graph.nodes[id].position.z))continue;seen.add(n.id);queue.push(n.id);}}return false;}
after(()=>{scene.dispose();engine.dispose();});
test('incremental and cached routes preserve endpoints, route preference and independent path arrays',()=>{
  for(const route of ['main','north','south','tunnel'] as const){
    const start=surface(-82,0),end=surface(48,0),search=graph.findSteps(start,end,route);
    let step=search.next(),yields=0;while(!step.done){yields++;step=search.next();}
    const first=step.value;assert.ok(first.length);const hits=graph.cacheHits,expanded=graph.expanded;
    const second=graph.find(start,end,route);assert.equal(graph.cacheHits,hits+1);assert.equal(graph.expanded,expanded);
    assert.notEqual(first,second);assert.deepEqual(first,second);first.pop();assert.ok(second.length>first.length);
    assert.ok(yields>0||graph.cacheHits>0);
  }
});
test('spatial mesh picking agrees with full scene picking for finite, vertical and boundary rays',()=>{
  let seed=1938;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<250;i++){
    const start=new Vector3(rnd()*180-90,rnd()*12-4,rnd()*90-45);
    const direction=i%5===0?new Vector3(0,-1,0):new Vector3(rnd()*2-1,rnd()-.5,rnd()*2-1).normalize();
    if(i%7===0){start.x=15;start.z=0;}
    const ray=new Ray(start,direction,i%3===0?2:160),expected=scene.pickWithRay(ray,m=>!!m.metadata?.solid),actual=world.pickStaticRay(ray);
    assert.equal(!!actual?.hit,!!expected?.hit,`ray ${i}`);if(expected?.hit)assert.ok(Math.abs(actual!.distance-expected.distance)<1e-5,`distance ${i}`);
  }
  assert.ok(world.staticMeshIndex!.candidateCount/world.staticMeshIndex!.queries<world.solids.length/2);
});
test('actual bots queue births, capture changes, invalid paths, deaths and respawns without synchronous graph search',()=>{
  const bots=Array.from({length:15},(_,i)=>new Bot(i+1,i<7?'cn':'jp',world));
  const objectives=OBJECTIVES.map(p=>({...p,owner:null,progress:0,contested:false}));let time=0;
  const update=()=>{time+=1/60;for(const b of bots)b.update(1/60,time,bots,objectives,()=>false);};
  const searches=graph.searches;update();assert.equal(graph.searches,searches);assert.equal(world.routePlanner.pending,15);
  for(let i=0;i<600&&world.routePlanner.pending;i++){const before=world.routePlanner.completed;world.routePlanner.tick();assert.ok(world.routePlanner.completed-before<=1);update();}
  assert.equal(world.routePlanner.pending,0);assert.ok(bots.every(b=>b.path.length));
  const topology=world.tactical;bots.forEach(b=>b.requestReplan(time));update();assert.equal(world.routePlanner.pending,15);
  bots[0].requestReplan(time,0);bots[1].alive=false;update();assert.equal(world.routePlanner.has('objective:2'),false);
  bots[1].respawn(time);update();assert.equal(world.routePlanner.has('objective:2'),true);assert.equal(world.tactical,topology);
  world.routePlanner.clear();for(const b of bots){b.model.root.dispose();}assert.equal(world.routePlanner.pending,0);
});
test('authored elevations, objective positions and protected spawn court remain within 180 × 90',()=>{assert.equal(MAP.width,180);assert.equal(MAP.depth,90);assert.deepEqual(OBJECTIVES.map(p=>[p.x,p.y,p.z]),[[-48,0,0],[0,1,0],[48,0,0]]);assert.equal(world.terrain.height(46,32),4);assert.ok(world.terrain.height(20,-28)<-1.3);for(const x of [-82,82])assert.ok(world.canStand(x,0,0));assert.ok(world.blocked(new Vector3(-82,1.56,0),new Vector3(82,1.56,0)));});
test('each of the three surface lanes traverses end to end without any tunnel or lane change',()=>{for(const lane of ['main','north','south'] as const)assert.ok(reachable(surface(-82,laneZ(lane,-82)),surface(82,laneZ(lane,82)),false),lane);});
test('exactly two surface transfers connect lanes; removing them separates all three',()=>{assert.equal(SURFACE_CONNECTIONS.length,2);const points=[surface(0,0),surface(0,31),surface(20,-28)];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){assert.ok(reachable(points[i],points[j],true));assert.equal(reachable(points[i],points[j],false),false);}for(const p of SURFACE_CONNECTIONS)assert.ok(graph.walkableLink(surface(p.x,p.z-2),surface(p.x,p.z+2)));});
test('physical dividers stop standing, crouching and jumping away from the two gates',()=>{for(const p of SURFACE_CONNECTIONS)for(let x=-88;x<=88;x+=.5){if(Math.abs(x-p.x)<p.width/2+.6)continue;const y=world.terrain.height(x,p.z);for(const jump of [0,.85])assert.equal(world.canStand(x,y+jump,p.z,.33,1.2),false,`${x},${p.z},${jump}`);}});
test('every underground graph edge agrees with standing collision and floor height',()=>{let edges=0;for(const n of graph.nodes)for(const edge of graph.edges[n.id])if(edge.to>n.id&&(n.level==='tunnel'||graph.nodes[edge.to].level==='tunnel')){assert.ok(graph.walkableLink(n.position,graph.nodes[edge.to].position),`${n.position} -> ${graph.nodes[edge.to].position}`);edges++;}assert.ok(edges>500);});
test('all seven mouths join the central underground room with traversable ramps below 30 degrees',()=>{assert.equal(RAMPS.length,7);for(const r of RAMPS){const lip=surface(...r.lip),bottom=new Vector3(r.bottom[0],-4,r.bottom[1]);assert.ok(graph.find(new Vector3(0,-4,0),lip,'tunnel').length,r.id);assert.ok(graph.find(lip,new Vector3(0,-4,0),'tunnel').length,r.id);assert.ok(Math.atan2(lip.y+4,Math.hypot(lip.x-bottom.x,lip.z-bottom.z))*180/Math.PI<30);assert.equal(rampFloor(r,bottom.x,bottom.z,world.terrain.height),-4);}});
test('main-street sampled sight lines stay within 55 metres, and high ground cannot cover A B C at once',()=>{const positions:Vector3[]=[];for(let x=-74;x<=74;x+=2)for(const offset of [-2,0,2]){const p=surface(x,laneZ('main',x)+offset);if(world.canStand(p.x,p.y,p.z))positions.push(p.add(new Vector3(0,1.56,0)));}for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)if(Vector3.Distance(positions[i],positions[j])>55)assert.ok(world.blocked(positions[i],positions[j]));for(let x=-80;x<=80;x+=2)for(const offset of [-3,0,3]){const p=surface(x,laneZ('north',x)+offset);if(!world.canStand(p.x,p.y,p.z))continue;assert.ok(OBJECTIVES.some(o=>world.blocked(p.add(new Vector3(0,1.56,0)),new Vector3(o.x,o.y+1.4,o.z))));}});
test('all explicit cover and peek positions remain reachable',()=>{assert.ok(world.coverPoints.length>=8);for(const p of world.coverPoints){assert.ok(world.canStand(p.position.x,p.position.y,p.position.z));assert.ok(graph.walkableLink(p.position,p.peek));}});
