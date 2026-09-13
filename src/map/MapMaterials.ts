import type {World} from './World';
import {VillageMaterialLibrary} from './VillageMaterialLibrary';
import {TerrainMaterialBlend} from './TerrainMaterialBlend';
import {dressVillageArt} from './VillageArt';
import {Mesh} from '@babylonjs/core';
import {projectSurfaceUV} from './SurfaceUV';
export function applyMapMaterials(w:World){
  for(const mesh of w.scene.meshes)if(mesh instanceof Mesh&&!mesh.metadata?.terrain)projectSurfaceUV(mesh,2.5,true);
  dressVillageArt(w);
  const library=VillageMaterialLibrary.forScene(w.scene);library.apply();
  new TerrainMaterialBlend(library.material('blockout-ground')!,library);
  new TerrainMaterialBlend(library.material('blockout-field-bank')!,library,true);
  return library;
}
