/** Combat Map V3 blockout; metres, +Z north. Shared by geometry, collision and navigation. */
export const MAP={width:180,depth:90,spawnX:82,tunnelFloor:-4,tunnelHeight:2.2} as const;
export const OBJECTIVES=[{id:'A',name:'西北祠堂院落',x:-48,y:3,z:28},{id:'B',name:'村心水井',x:0,y:0,z:-7},{id:'C',name:'东北粮仓院落',x:48,y:5,z:28}] as const;
export const SURFACE_CONNECTIONS=[{id:'high-main',x:-8,z:14,width:4,from:4,to:30},{id:'main-low',x:24,z:-14,width:4,from:-4,to:-28}] as const;
export type Lane='main'|'north'|'south';
export const LANE_POINTS:Record<Lane,readonly (readonly[number,number])[]>={
main:[[-90,0],[-78,0],[-67,-1],[-48,0],[-34,-5],[-20,-4],[-10,-4],[0,-7],[10,-3],[26,-4],[38,2],[56,2],[70,-4],[82,0],[90,0]],
north:[[-90,27],[-70,27],[-48,28],[-32,24],[-20,28],[-8,30],[20,31],[32,26],[48,28],[68,27],[90,27]],
south:[[-90,-28],[-74,-28],[-63,-35],[-47,-35],[-35,-26],[-15,-26],[-3,-32],[12,-28],[24,-28],[36,-36],[54,-36],[69,-26],[90,-26]]};
export function interpolate(p:readonly(readonly[number,number])[],x:number){for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(x<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));}return p[p.length-1][1];}
export const laneZ=(lane:Lane,x:number)=>interpolate(LANE_POINTS[lane],x);
export const laneWidth=(lane:Lane,x:number)=>lane==='north'?9:lane==='south'?(x>=-3&&x<=18?7:5.5):Math.abs(x)<10?12:6;
export const HIGH_PROFILE=[[-90,2],[-70,2.4],[-58,3],[-38,3],[-20,3.5],[0,4],[24,4.5],[38,5],[58,5],[68,3],[90,2]] as const;
export interface Ramp{id:string;role:string;lip:readonly[number,number];bottom:readonly[number,number];width:number}
export const RAMPS:readonly Ramp[]=[{id:'T0',role:'A侧',lip:[-62,26],bottom:[-62,8],width:2.2},{id:'T3',role:'高地',lip:[-20,28],bottom:[-44,28],width:2.2},{id:'central',role:'B地下室',lip:[-2,-6],bottom:[-18,-6],width:2.2},{id:'T6',role:'南沟',lip:[12,-28],bottom:[0,-28],width:2.2},{id:'T7',role:'B/C侧翼',lip:[28,7],bottom:[28,23],width:2.2},{id:'T9',role:'C后院',lip:[72,28],bottom:[48,28],width:2.2},{id:'T10',role:'东村口',lip:[76,4],bottom:[76,20],width:2.2}];
export interface TunnelPath{id:string;width:number;points:readonly(readonly[number,number])[]}
export const TUNNEL_PATHS:readonly TunnelPath[]=[
{id:'A-court-link',width:2,points:[[-62,8],[-54,8]]},
{id:'C-court-link',width:2,points:[[48,28],[48,26]]},
{id:'B-cellar-link',width:2,points:[[-18,-6],[-20,-6]]},
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
export const HOUSES=[
 {name:'ancestral-hall',x:-48,z:39,w:24,d:7,h:4.5},
 {name:'A-west-wing',x:-59,z:34,w:4,d:9,h:3.2},
 {name:'A-east-wing',x:-37,z:33,w:5,d:11,h:3.8},
 {name:'west-high-longhouse',x:-78,z:38,w:16,d:9,h:3},
 {name:'high-storehouse',x:-20,z:39,w:16,d:8,h:3.3},
 {name:'high-front-longhouse',x:8,z:22,w:20,d:7,h:3.5},
 {name:'high-east-house',x:23,z:40,w:12,d:7,h:3},
 {name:'granary-longhouse',x:48,z:39,w:26,d:7,h:4.2},
 {name:'C-west-wing',x:34,z:33,w:5,d:10,h:3.4},
 {name:'C-rear-wing',x:64,z:37,w:5,d:9,h:3.2},
 {name:'C-front-store',x:45,z:20,w:16,d:5,h:3.3},
 {name:'east-high-house',x:80,z:37,w:13,d:10,h:3.4},
 {name:'west-entry-house',x:-71,z:8,w:12,d:7,h:3.5},
 {name:'west-court-longhouse',x:-52,z:8,w:18,d:7,h:4},
 {name:'west-alley-house',x:-31,z:3,w:11,d:11,h:3.8},
 {name:'B-north-house',x:-15,z:9,w:13,d:6,h:3.4},
 {name:'B-east-longhouse',x:10,z:5,w:14,d:9,h:4},
 {name:'east-alley-house',x:38,z:8,w:12,d:8,h:3.3},
 {name:'east-entry-longhouse',x:62,z:8,w:12,d:6,h:3.8},
 {name:'east-entry-wing',x:84,z:9,w:7,d:6,h:3},
 {name:'west-south-longhouse',x:-66,z:-9,w:16,d:8,h:3.6},
 {name:'west-south-wing',x:-44,z:-8,w:13,d:9,h:3},
 {name:'B-west-longhouse',x:-21,z:-9,w:15,d:6,h:3.5},
 {name:'B-south-east-wing',x:15,z:-9,w:8,d:6,h:3},
 {name:'east-court-longhouse',x:45,z:-6,w:15,d:12,h:4},
 {name:'east-south-wing',x:63,z:-10,w:10,d:5,h:3},
 {name:'east-spawn-screenhouse',x:77,z:-9,w:9,d:7,h:3.5},
];
export const COVERS=[{x:-53,z:25,w:3,d:1,h:1.15},{x:-42,z:31,w:2,d:1,h:1.2},{x:-7,z:-10,w:2.4,d:1,h:1.1},{x:7,z:-4,w:2.6,d:4,h:2.3},{x:43,z:27,w:2,d:1,h:1.2},{x:53,z:31,w:2,d:1,h:1.15},{x:-30,z:27,w:3,d:.7,h:1.3},{x:24,z:29,w:3,d:.7,h:1.3},{x:-39,z:-26,w:2,d:.7,h:1.1},{x:40,z:-34,w:3,d:.7,h:1.1}];

export const STREET_BLOCKS=[{x:-73,z:0,d:5},{x:-20,z:-2.5,d:4.6},{x:-8,z:2,d:8},{x:25,z:0,d:6},{x:66,z:-1,d:6}];
