import {Vector3} from '@babylonjs/core';
import type {Game} from '../game/Game';
import {RAMPS,laneZ} from '../map/MapLayout';
export function mapValidation(g:Game){
 const panel=document.createElement('div');panel.id='map-validation';panel.style.cssText='position:fixed;right:8px;top:65px;z-index:9999;max-width:480px;background:#17251ee8;color:#eee;padding:10px;font:12px monospace;max-height:80vh;overflow:auto';
 const output=document.createElement('pre');output.id='map-report';output.style.whiteSpace='pre-wrap';panel.append(output);document.body.append(panel);
 const show=(x:unknown)=>output.textContent=JSON.stringify(x,null,2);
 const button=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='font:12px sans-serif;padding:6px;margin:2px;min-width:0;width:auto';b.onclick=fn;panel.prepend(b);};
 const stop=()=>{g.paused=true;g.started=false;g.hud.menu.hidden=true;g.player.locked=false;g.player.keys.clear();};
 const view=(x:number,y:number,z:number,yaw:number,pitch=0)=>{stop();g.player.position.set(x,y,z);g.player.yaw=yaw;g.player.pitch=pitch;g.player.update(0);show({view:[x,y,z],resources:g.diagnostics?.snapshot()});};
 button('总览',()=>view(0,94,-63,0,1.02));button('A院落',()=>view(-48,0,0,0));button('B晒谷场',()=>view(0,1,0,Math.PI/2));button('北高地',()=>view(-20,g.world.terrain.height(-20,28),28,Math.PI/2));button('南低沟',()=>view(20,g.world.terrain.height(20,-28),-28,Math.PI/2));button('地下室',()=>view(0,-4,0,Math.PI/2));
 const surface=(x:number,z:number)=>new Vector3(x,g.world.terrain.height(x,z),z);
 button('玩家通行测试',async()=>{
  stop();const result:any[]=[];const graph=g.world.tactical!,start=surface(-82,0);
  const cases:{name:string;points:Vector3[];route:'main'|'north'|'south'|'tunnel'}[]=[
   {name:'主街 A B C',points:[start,surface(-48,0),surface(0,0),surface(48,0),surface(82,0)],route:'main'},
   {name:'北线全程',points:[surface(-82,laneZ('north',-82)),surface(82,laneZ('north',82))],route:'north'},
   {name:'南线全程',points:[surface(-82,laneZ('south',-82)),surface(82,laneZ('south',82))],route:'south'},
   {name:'地表高地返回',points:[start,surface(-14,28),surface(0,0)],route:'north'},
   ...RAMPS.map(r=>({name:'地下室↔'+r.id,points:[new Vector3(0,-4,0),surface(...r.lip),new Vector3(0,-4,0)],route:'tunnel' as const})),
  ];
  for(const c of cases){let ok=true,reason='',steps=0;g.player.position.copyFrom(c.points[0]);g.player.velocityY=0;g.player.alive=true;g.player.locked=true;g.player.keys.add('KeyW');
   for(let k=1;k<c.points.length&&ok;k++){const path=graph.find(g.player.position,c.points[k],c.route);if(!path.length){ok=false;reason='no path';break;}
    for(const goal of path){let attempts=0;while(Vector3.Distance(g.player.position,goal)>.09&&attempts++<500){g.player.yaw=Math.atan2(goal.x-g.player.position.x,goal.z-g.player.position.z);g.player.update(1/120);steps++;}if(attempts>=500){ok=false;reason='stuck '+g.player.position.asArray()+' → '+goal.asArray();break;}}
   }
   result.push({name:c.name,ok,steps,reason});show(result);await new Promise(r=>setTimeout(r,0));
  }
  stop();show({test:'player',passed:result.filter(x=>x.ok).length,total:result.length,result});
 });
 button('AI路线测试',async()=>{
  stop();const b=g.bots[0],routes=[{name:'出生→北线→B',points:[surface(-82,0),surface(-20,28),surface(0,0)],route:'north' as const},{name:'出生→南线→C',points:[surface(-82,0),surface(12,-28),surface(48,0)],route:'south' as const},{name:'地表→地道→地表',points:[surface(-70,-8),new Vector3(0,-4,0),surface(55,-8)],route:'tunnel' as const},{name:'地表→高地→返回',points:[surface(-14,0),surface(-14,28),surface(-14,0)],route:'north' as const}];const results:any[]=[];
  for(const c of routes){b.position.copyFrom(c.points[0]);b.target=null;let ok=true;for(let i=1;i<c.points.length;i++){b.path=g.world.route(b.position,c.points[i],c.route,0);b.pathIndex=0;if(!b.path.length){ok=false;break;}let steps=0;while(b.pathIndex<b.path.length&&steps++<40000){b.followObjective(1/60);b.syncModel(steps/60);}if(b.pathIndex<b.path.length)ok=false;}results.push({name:c.name,ok,position:b.position.asArray()});show(results);await new Promise(r=>setTimeout(r,0));}show({test:'AI routes',results});
 });
 button('实时性能采样',()=>{stop();g.reset();g.hud.menu.hidden=true;g.started=true;g.paused=false;const samples:number[]=[];let ticks=0;const timer=setInterval(()=>{if(ticks++>4)samples.push(g.engine.getFps());if(ticks>=30){clearInterval(timer);stop();samples.sort((a,b)=>a-b);show({test:'realtime 15s',medianFPS:samples[Math.floor(samples.length/2)],minFPS:samples[0],maxFPS:samples[samples.length-1],resources:g.diagnostics?.snapshot()});}},500);});
 button('8v8完整对局',async()=>{
  stop();g.reset();g.hud.menu.hidden=true;g.started=true;g.paused=true;const lanes=new Set<string>(),underground=new Set<number>();let shots=0;const old=g.combat.onShot;g.combat.onShot=(...args)=>{shots++;old(...args);};
  const begin=performance.now();while(!g.match.winner&&g.time<960){for(let i=0;i<120&&!g.match.winner;i++){g.step(1/30);for(const b of g.bots){if(b.position.y<g.world.terrain.height(b.position.x,b.position.z)-.5)underground.add(b.id);if(b.position.z>20)lanes.add('north');if(b.position.z<-22)lanes.add('south');}}show({test:'match running',time:g.time,tickets:g.match.tickets,shots,lanes:[...lanes],underground:[...underground]});await new Promise(r=>setTimeout(r,0));}
  g.combat.onShot=old;const report={test:'match complete',time:g.time,winner:g.match.winner,tickets:g.match.tickets,shots,deaths:g.match.deaths,lanes:[...lanes],underground:[...underground],respawns:g.bots.map(b=>b.births),recoveries:g.bots.map(b=>({id:b.id,count:b.recoveries,pos:b.position.asArray(),path:b.path.length,index:b.pathIndex})),wallSeconds:(performance.now()-begin)/1000,resources:g.diagnostics?.snapshot()};stop();show(report);
 });
 show({ready:true,nodes:g.world.tactical!.nodes.length,meshes:g.scene.meshes.length});
}
