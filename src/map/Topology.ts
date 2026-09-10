import { MAP,RAMPS,SURFACE_CONNECTIONS } from './MapLayout';
export const GROUND_PORTALS=SURFACE_CONNECTIONS;
export const groundLane=(z:number)=>z>14?'north':z<-14?'south':'main';
export function allowedSurfaceEdge(a:{x:number;z:number},b:{x:number;z:number}){for(const p of GROUND_PORTALS)if((a.z<p.z&&b.z>=p.z)||(a.z>=p.z&&b.z<p.z)){const x=a.x+(b.x-a.x)*(p.z-a.z)/(b.z-a.z);if(Math.abs(x-p.x)>p.width/2-.35)return false;}return true;}
export function rampAt(x:number,z:number,radius=0){return RAMPS.find(r=>{const alongX=r.lip[1]===r.bottom[1];return alongX?Math.abs(z-r.lip[1])<=r.width/2-radius&&x>=Math.min(r.lip[0],r.bottom[0])&&x<=Math.max(r.lip[0],r.bottom[0]):Math.abs(x-r.lip[0])<=r.width/2-radius&&z>=Math.min(r.lip[1],r.bottom[1])&&z<=Math.max(r.lip[1],r.bottom[1]);});}
export function rampFloor(r:typeof RAMPS[number],x:number,z:number,height:(x:number,z:number)=>number){const dx=r.bottom[0]-r.lip[0],dz=r.bottom[1]-r.lip[1],t=Math.max(0,Math.min(1,((x-r.lip[0])*dx+(z-r.lip[1])*dz)/(dx*dx+dz*dz)));return height(...r.lip)*(1-t)+MAP.tunnelFloor*t;}
export function openShaft(x:number,z:number,height:(x:number,z:number)=>number){const r=rampAt(x,z);return !!r&&height(x,z)-rampFloor(r,x,z,height)<MAP.tunnelHeight+.35;}
