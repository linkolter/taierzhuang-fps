import type {World} from './World';
import {ProceduralMaterialFactory,type VillageMaterial} from './ProceduralMaterialFactory';
export function applyMapMaterials(w:World){
  const factory=ProceduralMaterialFactory.forScene(w.scene);
  const kinds:Record<string,VillageMaterial>={earth:'PackedEarth',plaster:'MudWall',stone:'StoneWall',wood:'OldWood',roof:'RoofTile','tunnel-earth':'TunnelEarth',field:'Farmland',straw:'Farmland',sack:'Sack'};
  for(const [name,kind] of Object.entries(kinds)){const m=w.materials.get(name);if(m)factory.apply(m,kind);}
}
