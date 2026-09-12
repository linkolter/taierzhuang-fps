import type { World } from './World';
import { rampAt, rampFloor } from './Topology';
import { MAP } from './MapLayout';
import { tunnelContains } from './TunnelGeometry';
export type EnvironmentState='SURFACE'|'PORTAL'|'TUNNEL';
export function tunnelEnvironment(world:Pick<World,'terrain'>,x:number,y:number,z:number):{state:EnvironmentState;blend:number;depth:number}{
  const depth=world.terrain.height(x,z)-y;
  if(depth<=.15)return {state:'SURFACE',blend:0,depth};
  const ramp=rampAt(x,z),floor=ramp?rampFloor(ramp,x,z,world.terrain.height):MAP.tunnelFloor;
  const volume=(!!ramp||tunnelContains(x,z))&&y>=floor-.4&&y<=floor+MAP.tunnelHeight+.4;
  if(!volume)return {state:'SURFACE',blend:0,depth};
  const t=Math.max(0,Math.min(1,(depth-.15)/2.2)),blend=t*t*(3-2*t);
  return {state:blend>=.999?'TUNNEL':'PORTAL',blend,depth};
}
