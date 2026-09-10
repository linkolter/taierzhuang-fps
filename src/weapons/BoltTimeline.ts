/** One authoritative normalized timeline for the 1.5 s bolt animation and sounds. */
export const BOLT_EVENTS = [
 {at:.09,sound:'bolt-unlock'}, {at:.24,sound:'bolt-back'}, {at:.43,sound:'bolt-eject'},
 {at:.62,sound:'bolt-forward'}, {at:.83,sound:'bolt-lock'},
] as const;
const ramp=(t:number,a:number,b:number)=>{const v=Math.max(0,Math.min(1,(t-a)/(b-a)));return v*v*(3-2*v);};
export function boltPose(t:number){return {lift:ramp(t,.09,.24)*(1-ramp(t,.83,.94)),back:ramp(t,.24,.43)*(1-ramp(t,.62,.83)),tilt:ramp(t,.07,.24)*(1-ramp(t,.85,1))};}
export type WeaponPose='Idle'|'Walk'|'Sprint'|'ADS'|'Fire'|'BoltCycle'|'Reload';
