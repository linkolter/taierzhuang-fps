/** Combat Map V2; metres, +Z north. Geometry, collision and navigation share this data. */
export const MAP={width:180,depth:90,spawnX:82,tunnelFloor:-4,tunnelHeight:2.2} as const;
export const OBJECTIVES=[{id:'A',name:'西侧院落',x:-48,y:0,z:0},{id:'B',name:'晒谷场 / 祠堂',x:0,y:1,z:0},{id:'C',name:'东侧粮仓',x:48,y:0,z:0}] as const;
export const SURFACE_CONNECTIONS=[{id:'AB-high-main',x:-14,z:14,width:2.8,from:-3,to:29},{id:'BC-main-low',x:26,z:-14,width:2.8,from:-6,to:-28}] as const;
export type Lane='main'|'north'|'south';
export const LANE_POINTS:Record<Lane,readonly (readonly[number,number])[]>={
main:[[-90,0],[-78,0],[-68,-3],[-60,-3],[-48,0],[-40,3],[-34,3],[-24,-3],[-16,-3],[-6,0],[0,0],[8,3],[16,3],[24,-3],[34,-3],[44,0],[48,0],[56,3],[64,3],[74,-3],[82,0],[90,0]],
north:[[-90,28],[-76,28],[-62,32],[-48,32],[-36,27],[-20,28],[-6,31],[8,31],[22,26],[34,26],[46,32],[58,32],[72,28],[90,28]],
south:[[-90,-28],[-76,-28],[-62,-31],[-46,-31],[-32,-27],[-16,-27],[0,-30],[12,-28],[26,-28],[42,-32],[56,-32],[72,-27],[90,-28]]};
export function interpolate(p:readonly(readonly[number,number])[],x:number){for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(x<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));}return p[p.length-1][1];}
export const laneZ=(lane:Lane,x:number)=>interpolate(LANE_POINTS[lane],x);
export const laneWidth=(lane:Lane,x:number)=>lane==='north'?8:lane==='south'?(x>=-2&&x<=18?7:3.8):Math.min(...OBJECTIVES.map(o=>Math.abs(o.x-x)))<6?9:6.6;
export const HIGH_PROFILE=[[-90,1.5],[-64,1.8],[-32,2.7],[0,3],[26,2.6],[46,4],[64,3],[90,2]] as const;
export interface Ramp{id:string;lip:readonly[number,number];bottom:readonly[number,number];width:number}
export const RAMPS:readonly Ramp[]=[{id:'T0',lip:[-70,-8],bottom:[-70,-24],width:2.2},{id:'T3',lip:[-20,28],bottom:[-44,28],width:2.2},{id:'central',lip:[-2,6],bottom:[-2,22],width:2.2},{id:'T6',lip:[12,-28],bottom:[0,-28],width:2.2},{id:'T7',lip:[28,7],bottom:[28,23],width:2.2},{id:'T9',lip:[55,-8],bottom:[55,-24],width:2.2},{id:'T10',lip:[76,4],bottom:[76,20],width:2.2}];
export interface TunnelPath{id:string;width:number;points:readonly(readonly[number,number])[]}
export const TUNNEL_PATHS:readonly TunnelPath[]=[
{id:'west-T0-T1',width:2,points:[[-70,-24],[-58,-24],[-58,-18],[-46,-18]]},
{id:'north-T1-T2-T3',width:1.6,points:[[-46,-18],[-46,-6],[-54,-6],[-54,8],[-44,8],[-44,28]]},
{id:'main-T1-T4',width:2,points:[[-46,-18],[-34,-18],[-34,-10],[-20,-10],[-20,-2],[-8,-2],[-8,0],[0,0]]},
{id:'central-exit',width:1.6,points:[[-8,0],[-8,12],[-14,12],[-14,24],[6,24],[6,22],[-2,22]]},
{id:'south-T4-T5-T6',width:1.6,points:[[0,0],[8,0],[8,-10],[0,-10],[0,-16],[0,-28]]},
{id:'east-T4-T8',width:2,points:[[8,0],[12,0],[12,-6],[24,-6],[24,2],[36,2],[36,14],[48,14]]},
{id:'flank-T7',width:1.6,points:[[36,14],[40,14],[40,23],[28,23]]},
{id:'rear-T8-T9',width:2,points:[[48,14],[60,14],[60,0],[66,0],[66,-12],[66,-24],[55,-24]]},
{id:'reserve-T8-T10',width:1.6,points:[[48,14],[48,26],[64,26],[64,20],[76,20]]}];
export const TUNNEL_ROOMS=[{id:'T1',x:-46,z:-18,w:3.6,d:3.6},{id:'T4',x:0,z:0,w:5,d:5},{id:'T5',x:0,z:-16,w:3,d:3},{id:'T8',x:48,z:14,w:3.6,d:3.6}];
export const HOUSES=[{x:-48,z:8,w:8,d:6,h:3.6,enter:true},{x:-48,z:-8,w:7,d:6,h:3.3,enter:true},{x:5,z:10,w:9,d:6,h:4.5,enter:true},{x:48,z:9,w:10,d:7,h:4.1,enter:true},{x:48,z:-9,w:8,d:7,h:3.7,enter:true},...[-78,-64,-32,-22,16,36,66,80].flatMap((x,i)=>[{x,z:10,w:7,d:6,h:3.3+(i%3)*.35,enter:false},{x:x+2,z:-10,w:7,d:6,h:3.5,enter:false}]),...[-76,-54,-32,-4,20,46,70].map((x,i)=>({x,z:39,w:9,d:7,h:3.2+i%2*.5,enter:false}))];
export const COVERS=[{x:-53,z:2,w:3,d:1,h:1.15},{x:-42,z:-2,w:2,d:1,h:1.2},{x:-5,z:2,w:2.4,d:1,h:1.1},{x:5,z:-2,w:2.6,d:1,h:1.15},{x:44,z:2,w:2,d:1,h:1.2},{x:53,z:-2,w:2,d:1,h:1.15},{x:-34,z:30,w:4,d:.7,h:1.3},{x:46,z:29,w:4,d:.7,h:1.3},{x:-40,z:-27.7,w:2,d:.7,h:1.1},{x:38,z:-29,w:3,d:.7,h:1.1}];

export const STREET_BLOCKS=[{x:-62,z:-.5,d:3.4},{x:-34,z:.5,d:3.4},{x:-10,z:1.3,d:3.8},{x:18,z:-1.5,d:3.8},{x:40,z:1.5,d:3.8},{x:66,z:-1.2,d:3.8}];
