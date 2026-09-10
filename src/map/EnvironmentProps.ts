import {MeshBuilder} from '@babylonjs/core';
import type {World} from './World';
export type PropKind='mudWall'|'stoneWall'|'brokenWall'|'woodFence'|'woodGate'|'cart'|'hayStack'|'firewoodPile'|'well'|'grainSack'|'woodCrate'|'stoneStep'|'earthRamp'|'trench'|'fieldRidge'|'tunnelBeam'|'oilLampPlaceholder';
export function prop(w:World,kind:PropKind,x:number,z:number){
 const y=w.terrain.height(x,z),wood=w.material('wood','#65503b'),stone=w.material('stone','#79766a'),straw=w.material('straw','#b8a36c'),mud=w.material('plaster','#b6a482'),earth=w.material('earth','#a89671');
 const box=(name:string,dx:number,dy:number,dz:number,width:number,height:number,depth:number,mat=wood,solid=true)=>w.box(name,x+dx,y+dy,z+dz,width,height,depth,mat,solid);
 switch(kind){
 case 'cart':box(kind,0,.6,0,1.5,.3,2.3);for(const side of [-1,1]){box('cart-rail',side*.72,1,0,.1,.6,2.3);const wheel=MeshBuilder.CreateCylinder('cart-wheel',{diameter:.85,height:.12,tessellation:10},w.scene);wheel.rotation.z=Math.PI/2;wheel.position.set(x+side*.86,y+.43,z);wheel.material=wood;wheel.isPickable=false;}box('cart-shaft',0,.5,1.8,.13,.13,1.5,wood,false);break;
 case 'well':for(const side of [-1,1]){box(kind,side*.8,.55,0,.35,1.1,1.8,stone);box(kind,0,.55,side*.8,1.3,1.1,.35,stone);box('well-post',side*.9,1.65,0,.13,2.2,.13,wood,false);}box('well-beam',0,2.7,0,2.1,.18,.18,wood,false);break;
 case 'hayStack':box(kind,0,.65,0,2,1.3,1.5,straw);box('hay-cap',0,1.4,0,1.6,.25,1.1,straw,false);break;
 case 'firewoodPile':for(let row=0;row<3;row++)for(let j=0;j<4-row;j++)box(kind,(j-(3-row)/2)*.32,.15+row*.28,0,.3,.28,1.6,wood);break;
 case 'grainSack':for(const side of [-1,1])box(kind,side*.4,.3,0,.7,.6,1,straw);box(kind,0,.82,0,.7,.5,1,straw);break;
 case 'woodCrate':box(kind,0,.5,0,1,1,1);for(const side of [-1,1])box('crate-strap',side*.3,.5,-.51,.08,1.05,.06,stone,false);break;
 case 'brokenWall':box(kind,-.8,1,0,1.4,2,.55,mud);box(kind,.3,.4,0,.8,.8,.55,stone);box('rubble',1,.15,.3,.7,.3,.8,stone,false);break;
 case 'woodFence':for(let i=-2;i<=2;i++)box(kind,i*.5,.6,0,.12,1.2,.12);box('fence-rail',0,.8,0,2.3,.13,.12);break;
 case 'woodGate':for(const side of [-1,1])box(kind,side*1.3,1.3,0,.2,2.6,.25);box(kind,0,2.65,0,2.8,.2,.3);break;
 case 'mudWall':box(kind,0,1.25,0,3,2.5,.55,mud);break;
 case 'stoneWall':box(kind,0,.6,0,3,1.2,.6,stone);break;
 case 'stoneStep':box(kind,0,.025,0,2.6,.05,.25,stone,false);break;
 case 'fieldRidge':box(kind,0,.1,0,7,.2,.35,w.material('field','#77714d'),false);break;
 case 'earthRamp':case 'trench':box(kind,0,.03,0,2,.06,3,earth,false);break;
 case 'tunnelBeam':box(kind,0,1,0,.15,2,.15,wood,false);break;
 case 'oilLampPlaceholder':box(kind,0,.9,0,.12,.22,.12,w.material('lamp','#d4af6b'),false);break;
 }
}
export function dressVillage(w:World){
 for(const [kind,x,z] of [['well',-50,7],['firewoodPile',-44,-5],['woodCrate',-53,-5],['cart',3,5],['grainSack',-3,5],['firewoodPile',6,-5],['grainSack',48,8],['grainSack',49,-7],['cart',44,-6],['hayStack',-32,33],['woodFence',-46,-36],['brokenWall',30,-34],['woodCrate',-18,32],['hayStack',58,-37]] as [PropKind,number,number][])prop(w,kind,x,z);
 for(const x of [-70,-48,-24,0,24,48,72])for(let z=-43;z<=-38;z+=1.2)prop(w,'fieldRidge',x,z);
}
