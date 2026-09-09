import { Mesh, MeshBuilder, Scene, TransformNode } from '@babylonjs/core';
import type { Team } from '../config/gameConfig';
import { World } from '../map/World';
export class SoldierModel {
  root: TransformNode; torso: TransformNode; leftLeg!: TransformNode; rightLeg!: TransformNode; leftArm!: TransformNode; rightArm!: TransformNode; gun: TransformNode; blade: TransformNode; meshes: Mesh[] = [];
  constructor(scene: Scene, world: World, team: Team, variant: number) {
    this.root = new TransformNode('soldier-' + team, scene); this.torso = new TransformNode('upper-body', scene); this.torso.parent = this.root;
    const uniform = world.material(team + '-uniform', team === 'cn' ? '#838f90' : '#a29353');
    const puttee = world.material(team + '-puttee', team === 'cn' ? '#727f80' : '#8d804b');
    const skin = world.material('skin-' + variant % 3, ['#b68a64', '#c2956f', '#a87f5c'][variant % 3]);
    const leather = world.material('leather', '#55402c'), shoes = world.material(team + '-shoes', team === 'cn' ? '#292c29' : '#4f3724'), metal = world.material('gunmetal', '#353b39');
    const part = (name: string, size: number[], xyz: number[], mat = uniform, parent = this.torso) => { const m = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene); m.position.set(...xyz as [number, number, number]); m.parent = parent; m.material = mat; m.isPickable = false; this.meshes.push(m); return m; };
    part('tunic', [.44, .55, .25], [0, 1.08, 0]); part('skirt', [.47, .2, .28], [0, .79, 0]); part('belt', [.455, .065, .27], [0, .92, 0], leather); part('buckle', [.06, .055, .017], [0, .92, .15], metal);
    part('neck', [.14, .12, .14], [0, 1.4, 0], skin); part('face', [.22, .25, .21], [0, 1.54, 0], skin); part('nose', [.06, .065, .06], [0, 1.535, .12], skin);
    part('soft-cap', [.26, .13, .25], [0, 1.7, 0]); part('cap-brim', [.25, .025, .14], [0, 1.65, .14]);
    if (team === 'jp') { part('neck-flap', [.25, .24, .03], [0, 1.51, -.125]); part('ammo-left', [.13, .12, .08], [-.17, .91, .16], leather); part('ammo-right', [.13, .12, .08], [.17, .91, .16], leather); }
    for (const side of [-1, 1]) {
      const leg = new TransformNode('leg', scene); leg.parent = this.root; leg.position.set(side * .12, .78, 0);
      part('trouser', [.18, .4, .21], [0, -.2, 0], uniform, leg); part('puttee', [.135, .26, .15], [0, -.53, 0], puttee, leg); part('shoe', [.15, .105, .27], [0, -.72, .045], shoes, leg);
      const arm = new TransformNode('arm', scene); arm.parent = this.torso; arm.position.set(side * .27, 1.3, 0);
      part('sleeve', [.16, .37, .18], [0, -.16, 0], uniform, arm); part('hand', [.12, .13, .13], [0, -.39, 0], skin, arm);
      if (side === -1) { this.leftLeg = leg; this.leftArm = arm; } else { this.rightLeg = leg; this.rightArm = arm; }
    }
    this.gun = new TransformNode('held-rifle', scene); this.gun.parent = this.torso; this.gun.position.set(.16, 1.07, .15);
    part('rifle-stock', [.06, .075, .7], [0, 0, .22], leather, this.gun); part('rifle-barrel', [.025, .025, .78], [0, .045, .5], metal, this.gun);
    this.blade = new TransformNode('melee-weapon', scene); this.blade.parent = this.torso;
    const bladeMat = world.material('blade-steel', '#aab2ab');
    part(team === 'cn' ? 'dadao' : 'sabre', [team === 'cn' ? .105 : .045, .72, .024], [.31, 1.38, .3], bladeMat, this.blade); part('sword-hilt', [.05, .2, .05], [.31, .94, .3], leather, this.blade);
    this.blade.setEnabled(false);
    for (const parent of [this.torso, this.leftLeg, this.rightLeg, this.leftArm, this.rightArm, this.gun, this.blade]) {
      const pieces = this.meshes.filter(m => m.parent === parent); for (const m of pieces) { m.parent = null; m.computeWorldMatrix(true); }
      const merged = Mesh.MergeMeshes(pieces, true, true, undefined, false, true); if (merged) { merged.parent = parent; merged.isPickable = false; }
    }
    this.meshes = this.root.getChildMeshes() as Mesh[];
  }
  update(time: number, moving: boolean, engaging: boolean, melee: boolean, shot: number, deadAge: number) {
    const stride = moving ? Math.sin(time * 10) * .65 : 0;
    this.leftLeg.rotation.x = stride; this.rightLeg.rotation.x = -stride;
    this.leftArm.rotation.x = engaging ? -1.3 : -.7 - stride * .3; this.rightArm.rotation.x = melee ? -1.3 + Math.sin(shot * Math.PI) * 1.8 : -1.25;
    this.gun.setEnabled(!melee); this.blade.setEnabled(melee); this.gun.position.z = .15 - shot * .08;
    this.torso.rotation.x = shot * -.06; this.blade.rotation.x = melee ? Math.sin(shot * Math.PI) * 1.3 : 0;
    this.root.rotation.z = deadAge >= 0 ? Math.min(1, deadAge * 2) * -1.48 : 0;
    this.root.setEnabled(deadAge < 2.7);
  }
}
