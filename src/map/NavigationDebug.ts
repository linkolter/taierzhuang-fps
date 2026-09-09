import { Color3, LinesMesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import type { World } from './World';
/** Built only once on the first F3 press. Subsequent toggles only enable/disable these meshes. */
export class NavigationDebug {
  meshes:LinesMesh[]=[];
  constructor(w:World){const graph=w.tactical!;for(const level of ['surface','high','low','tunnel'] as const){const lines:Vector3[][]=[];for(const n of graph.nodes){if(n.level!==level)continue;const p=n.position.add(new Vector3(0,.07,0));lines.push([p.add(new Vector3(-.11,0,0)),p.add(new Vector3(.11,0,0))]);for(const e of graph.edges[n.id])if(n.id<e.to)lines.push([p,graph.nodes[e.to].position.add(new Vector3(0,.07,0))]);}const mesh=MeshBuilder.CreateLineSystem('nav-'+level,{lines},w.scene);mesh.color=Color3.FromHexString({surface:'#aac1cc',high:'#c9a969',low:'#72ac80',tunnel:'#c28d79'}[level]);mesh.isPickable=false;this.meshes.push(mesh);}
    const cover=w.coverPoints.flatMap(p=>[[p.position.add(new Vector3(0,.05,0)),p.position.add(new Vector3(0,p.height==='crouch'?1:1.6,0))],[p.position.add(new Vector3(0,.5,0)),p.peek.add(new Vector3(0,.5,0))]]);const mesh=MeshBuilder.CreateLineSystem('cover-markers',{lines:cover},w.scene);mesh.color=new Color3(.9,.8,.4);mesh.isPickable=false;this.meshes.push(mesh);
  }
  setEnabled(on:boolean){for(const m of this.meshes)m.setEnabled(on);}
  dispose(){for(const m of this.meshes)m.dispose();}
}
