import { CONFIG } from '../config/gameConfig';
export const GROUND_PORTALS=[{id:'AB-high-main',z:16,x:-22,width:4},{id:'BC-main-low',z:-32,x:22,width:4}] as const;
export const NORTH_SHAFTS=[-64,64];
export const SOUTH_SHAFTS=[-48,20,48];
export const TUNNEL_BAFFLES=[{x:-52,side:1},{x:-36,side:-1},{x:-28,side:1},{x:-12,side:-1},{x:12,side:1},{x:36,side:-1},{x:52,side:1}];
export function trunkZ(x:number){const b=TUNNEL_BAFFLES.find(b=>x===b.x||x===b.x-4);return -29-(b?.side??0)*.65;}
export function northNodeX(x:number,z:number){return x+(z===-21||z===-17?.65:z===-9||z===-5?-.65:0);}
export const NORTH_RAMP={start:6,end:26,floor:-4,top:2.4,open:19,width:2.4};
export const SOUTH_RAMP={x:20,start:-34,end:-40,floor:-4,top:-1.2,open:-35,width:2.4};
export const groundLane=(z:number)=>z>16?'north':z<-32?'south':'main';
export function allowedSurfaceEdge(a:{x:number;z:number},b:{x:number;z:number}){for(const p of GROUND_PORTALS)if((a.z<p.z&&b.z>=p.z)||(a.z>=p.z&&b.z<p.z)){const x=a.x+(b.x-a.x)*(p.z-a.z)/(b.z-a.z);if(Math.abs(x-p.x)>p.width/2-.35)return false;}return true;}
export function openShaft(x:number,z:number){return CONFIG.map.entrances.some(e=>Math.abs(x-e)<2)&&z<=-13&&z>=-31||NORTH_SHAFTS.some(e=>Math.abs(x-e)<1.2)&&z>=19&&z<=26||SOUTH_SHAFTS.some(e=>Math.abs(x-e)<1.2)&&z<=-35&&z>=-40;}
export function northRampFloor(z:number){return -4+Math.max(0,Math.min(1,(z-6)/20))*6.4;}
export function southRampFloor(z:number){return -4+Math.max(0,Math.min(1,(-z-34)/6))*2.8;}
