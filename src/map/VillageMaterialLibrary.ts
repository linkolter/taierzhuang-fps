import {Color3,Material,MultiMaterial,PBRMaterial,Scene,Texture,type BaseTexture} from '@babylonjs/core';
export type SurfaceId='dirt_floor'|'gravelly_sand'|'farm_soil'|'brown_mud_03'|'sandstone_blocks_04'|'grey_stone_path'|'grey_plaster'|'weathered_brown_planks'|'dark_wood'|'thatch_roof_angled'|'excavated_soil_wall'|'hessian_380'|'rusty_metal_04'|'brown_leather'|'cotton_jersey';
export type SurfaceTextures={albedo:Texture;normal:Texture;arm:Texture};
type Look={surface:SurfaceId;tint?:string;normal?:number;tile?:number;metal?:number};
const looks:Record<string,Look>={
 'blockout-ground':{surface:'dirt_floor',tint:'#fff3df',tile:2,normal:.48},
 'blockout-building':{surface:'grey_plaster',tint:'#e6d7bd',normal:.38},
 'blockout-wall':{surface:'grey_plaster',tint:'#cbbda5',normal:.45},
 'blockout-retaining-wall':{surface:'sandstone_blocks_04',tint:'#c2b49c',normal:.55},
 'blockout-field-bank':{surface:'excavated_soil_wall',tint:'#cbbda2',normal:.62},
 'blockout-cover':{surface:'hessian_380',tint:'#c4ad83',tile:3,normal:.4},
 'tunnel-earth':{surface:'excavated_soil_wall',tint:'#cbb9a0',normal:.6},
 wood:{surface:'dark_wood',tint:'#b0aaa0',normal:.35},
 'art-roof':{surface:'thatch_roof_angled',tint:'#d8b47b',normal:.85},
 'art-timber':{surface:'dark_wood',tint:'#999184',normal:.35},
 'art-planks':{surface:'weathered_brown_planks',tint:'#d5c2a3',normal:.55},
 'art-stone':{surface:'sandstone_blocks_04',tint:'#c7bba5',normal:.55},
 'art-court-stone':{surface:'sandstone_blocks_04',normal:.62},
 'art-court-path':{surface:'grey_stone_path',tint:'#d5cbb5',normal:.6},
 'art-farm':{surface:'farm_soil',normal:.6},
 'art-sack':{surface:'hessian_380',tint:'#d5c3a0',tile:3,normal:.32},
 'art-metal':{surface:'rusty_metal_04',tint:'#b0a495',normal:.5,metal:1},
 'rifle-stock':{surface:'dark_wood',normal:.3},
 'cn-uniform':{surface:'cotton_jersey',tint:'#789eab',tile:3,normal:.18},
 'jp-uniform':{surface:'cotton_jersey',tint:'#b5a76b',tile:3,normal:.18},
 'cn-puttee':{surface:'cotton_jersey',tint:'#778584',tile:3,normal:.15},
 'jp-puttee':{surface:'cotton_jersey',tint:'#a59766',tile:3,normal:.15},
 leather:{surface:'brown_leather',tint:'#8e7a61',normal:.22},
 'cn-shoes':{surface:'brown_leather',tint:'#494741',normal:.18},
 'jp-shoes':{surface:'brown_leather',tint:'#766449',normal:.18},
};

/** Scene-owned render materials. Original World materials remain untextured templates.
 * Actor MultiMaterials are remapped in place; glTF materials are never touched.
 */
export class VillageMaterialLibrary {
 private static scenes=new WeakMap<Scene,VillageMaterialLibrary>();
 static forScene(scene:Scene){let library=this.scenes.get(scene);if(!library){library=new this(scene);this.scenes.set(scene,library);}return library;}
 readonly textures=new Map<string,SurfaceTextures>();readonly materials=new Map<string,PBRMaterial>();readonly errors:string[]=[];
 private constructor(readonly scene:Scene){}
 surface(id:SurfaceId,tile=1,normal=.5):SurfaceTextures{
  const key=`${id}:${tile}:${normal}`;let set=this.textures.get(key);if(set)return set;
  const load=(channel:string)=>{
   const url=`${import.meta.env?.BASE_URL??'/'}textures/village/${id}/${channel}.webp`;
   const texture=new Texture(url,this.scene,false,true,Texture.TRILINEAR_SAMPLINGMODE,undefined,(message)=>{this.errors.push(url);console.error(`Village texture failed: ${url}`,message);});
   texture.gammaSpace=channel==='albedo';texture.uScale=texture.vScale=tile;
   texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=4;
   if(channel==='normal')texture.level=normal;
   return texture;
  };
  set={albedo:load('albedo'),normal:load('normal'),arm:load('arm')};this.textures.set(key,set);return set;
 }
 material(name:string,override?:Look){
  const cached=this.materials.get(name);if(cached)return cached;
  const look=override??looks[name];if(!look)return undefined;
  const set=this.surface(look.surface,look.tile??1,look.normal??.45),m=new PBRMaterial(`village-${name}`,this.scene);
  m.albedoTexture=set.albedo;m.bumpTexture=set.normal;m.metallicTexture=set.arm;
  m.albedoColor=Color3.FromHexString(look.tint??'#ffffff');m.metallic=look.metal??0;m.roughness=1;
  m.useRoughnessFromMetallicTextureAlpha=false;m.useRoughnessFromMetallicTextureGreen=true;
  m.useMetallnessFromMetallicTextureBlue=true;m.useAmbientOcclusionFromMetallicTextureRed=true;
  // OpenGL +Y normal maps, ordinary Babylon mesh UVs (not the glTF UV convention).
  m.invertNormalMapX=false;m.invertNormalMapY=false;m.forceIrradianceInFragment=true;
  m.environmentIntensity=.45;m.directIntensity=1;m.maxSimultaneousLights=3;
  this.materials.set(name,m);return m;
 }
 apply(){
  const replace=(m:Material|null):Material|null=>{if(m instanceof MultiMaterial){m.subMaterials=m.subMaterials.map(replace);return m;}return m?this.material(m.name)??m:null;};
  for(const mesh of this.scene.meshes)if(mesh.material)mesh.material=replace(mesh.material);
 }
 activeTextures():BaseTexture[]{return [...this.textures.values()].flatMap(set=>Object.values(set));}
}
