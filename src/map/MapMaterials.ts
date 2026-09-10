import {Color3,Texture} from '@babylonjs/core';
import type {World} from './World';
/** Seven shared matte textures; box UVs are measured in metres before static batching. */
export function applyMapMaterials(w:World){
 const kinds:Record<string,string>={earth:'earth',plaster:'mud_wall',stone:'stone',wood:'wood',roof:'roof_tile','tunnel-earth':'tunnel_earth',field:'farmland',straw:'farmland'};
 const textures=new Map<string,Texture>();
 for(const [name,kind] of Object.entries(kinds)){const material=w.materials.get(name);if(!material)continue;let texture=textures.get(kind);if(!texture){texture=new Texture(`${import.meta.env.BASE_URL}textures/map/${kind}/tile.svg`,w.scene);texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.uScale=texture.vScale=1;texture.anisotropicFilteringLevel=4;textures.set(kind,texture);}material.diffuseTexture=texture;material.diffuseColor=Color3.White();material.specularColor=Color3.Black();material.specularPower=1;}
}
