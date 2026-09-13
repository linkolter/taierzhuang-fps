import {AssetContainer,LoadAssetContainerAsync,Scene,TransformNode,type AbstractMesh} from '@babylonjs/core';
import '@babylonjs/loaders/glTF/2.0';
import '@babylonjs/loaders/glTF/glTFFileLoader';

export const RIFLE_ASSET_URL=`${import.meta.env?.BASE_URL??'/'}models/hanyang/hanyang.glb`;

/** A scene owns one source container. Clones share geometry, materials and textures. */
export class HanyangRifleAssets {
 private static pending=new WeakMap<Scene,Promise<HanyangRifleAssets>>();
 static load(scene:Scene):Promise<HanyangRifleAssets>{
  let promise=this.pending.get(scene);
  if(!promise){promise=LoadAssetContainerAsync(RIFLE_ASSET_URL,scene).then(container=>{
   if(scene.isDisposed){container.dispose();throw new Error('Weapon scene disposed during loading');}
   const assets=new HanyangRifleAssets(container);scene.onDisposeObservable.addOnce(()=>container.dispose());return assets;
  });this.pending.set(scene,promise);}
  return promise;
 }
 private constructor(private container:AssetContainer){}
 attach(parent:TransformNode,firstPerson=false):HanyangRifleInstance{
  const prefix=parent.uniqueId+'-',entries=this.container.instantiateModelsToScene(name=>prefix+name,false,{doNotInstantiate:true});
  for(const root of entries.rootNodes){
   // The prepared glTF uses -Z forward. Keep the loader's Z reflection but
   // cancel its additional 180-degree yaw so the muzzle points along game +Z.
   if(root instanceof TransformNode)root.rotationQuaternion?.set(0,0,0,1);root.parent=parent;
  }
  const meshes=entries.rootNodes.flatMap(root=>root.getChildMeshes());
  for(const mesh of meshes){
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.renderingGroupId=firstPerson?2:0;mesh.receiveShadows=false;
   // Visibility belongs to this clone; geometry/material/texture resources stay shared.
   if(firstPerson&&mesh.name===prefix+'hanyang-sling')mesh.setEnabled(false);
  }
  const bolt=entries.rootNodes.flatMap(root=>root.getDescendants()).find(node=>node.name===prefix+'hanyang-bolt');
  if(!(bolt instanceof TransformNode)){entries.dispose();throw new Error('Hanyang bolt pivot missing');}
  return new HanyangRifleInstance(bolt,meshes,()=>entries.dispose());
 }
}

export class HanyangRifleInstance {
 private home;private homeRotation;private disposed=false;
 constructor(public bolt:TransformNode,public meshes:AbstractMesh[],private release:()=>void){
  this.home=bolt.position.clone();
  // glTF supplies a quaternion, which overrides Euler animation unless removed.
  this.homeRotation=bolt.rotationQuaternion?.toEulerAngles()??bolt.rotation.clone();
  bolt.rotationQuaternion=null;bolt.rotation.copyFrom(this.homeRotation);
 }
 setBolt(lift:number,back:number){
  // glTF's local -Z is forward; Babylon's loader root mirrors it for the LH scene.
  this.bolt.position.copyFrom(this.home);this.bolt.position.z+=back*.14;
  this.bolt.rotation.copyFrom(this.homeRotation);this.bolt.rotation.z+=lift*1.05;
 }
 dispose(){if(!this.disposed){this.disposed=true;this.release();}}
}
