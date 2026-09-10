import test from 'node:test';import assert from 'node:assert/strict';import {ObstacleIndex} from '../src/map/ObstacleIndex';
import type {Obstacle} from '../src/map/World';
test('broad phase never omits overlapping boxes, including cell boundaries and late additions',()=>{
 const boxes:Obstacle[]=[];let seed=1938;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<600;i++)boxes.push({x:rnd()*180-90,z:rnd()*90-45,w:.1+rnd()*8,d:.1+rnd()*8,bottom:-4,top:4});boxes.push({x:0,z:0,w:180,d:.1,bottom:0,top:4});const index=new ObstacleIndex(boxes);
 boxes.push({x:4,z:4,w:.6,d:.6,bottom:0,top:4});index.add(boxes.length-1);
 for(let i=0;i<3000;i++){const x=rnd()*180-90,z=rnd()*90-45,r=.33+rnd()*.22,actual=new Set(index.query(x-r,z-r,x+r,z+r));for(const b of boxes)if(Math.abs(x-b.x)<=b.w/2+r&&Math.abs(z-b.z)<=b.d/2+r)assert.ok(actual.has(b));}
 assert.ok(index.query(4,4,4,4).includes(boxes.at(-1)!));
});
