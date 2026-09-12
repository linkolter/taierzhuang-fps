export type FootstepMode='walk'|'sprint'|'crouch';
export type FootstepSurface='earth'|'stone'|'wood'|'tunnel';
/** Temporary region tags for the whitebox; authored surface tags take precedence. */
export function whiteboxFootstep(x:number,y:number,z:number):FootstepSurface {
  if(Math.abs(y-5)<.3&&Math.hypot(x-48,z-28)<9)return 'wood';
  if(Math.abs(y-3)<.3&&Math.hypot(x+48,z-28)<9||Math.abs(y)<.3&&Math.hypot(x,z+7)<9)return 'stone';
  return 'earth';
}
export class FootstepTracker {
  distance=0;
  reset(){this.distance=0;}
  advance(moved:number,grounded:boolean,mode:FootstepMode){
    if(!grounded||moved<=0)return false;
    this.distance+=moved;const stride=mode==='crouch'?1.25:mode==='sprint'?1.9:1.65;
    if(this.distance<stride)return false;this.distance%=stride;return true;
  }
}
