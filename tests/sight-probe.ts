import {NullEngine,Scene,Vector3} from '@babylonjs/core';import {World} from '../src/map/World';import {laneZ,OBJECTIVES} from '../src/map/MapLayout';
const w=new World(new Scene(new NullEngine()));w.buildVillage();let max=0,pair:any;const positions:Vector3[]=[];
for(let x=-74;x<=74;x+=2)for(const off of [-2,0,2]){const z=laneZ('main',x)+off,y=w.terrain.height(x,z);if(w.canStand(x,y,z))positions.push(new Vector3(x,y+1.56,z));}
for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const d=Vector3.Distance(positions[i],positions[j]);if(d>max&&!w.blocked(positions[i],positions[j])){max=d;pair=[positions[i].asArray(),positions[j].asArray()];}}
console.log('street max visibility',max,pair);
let high:any[]=[];for(let x=-80;x<=80;x+=2)for(const off of [-3,0,3]){const z=laneZ('north',x)+off,y=w.terrain.height(x,z);if(w.canStand(x,y,z)&&OBJECTIVES.every(o=>!w.blocked(new Vector3(x,y+1.56,z),new Vector3(o.x,o.y+1.4,o.z))))high.push([x,y,z]);}console.log('high overlooking all three',high);
