import {DynamicTexture,MaterialPluginBase,PBRMaterial,Texture,type BaseTexture,type UniformBuffer} from '@babylonjs/core';
import {laneZ,laneWidth} from './MapLayout';
import type {VillageMaterialLibrary} from './VillageMaterialLibrary';

/** Blend all three PBR maps with one scene-owned low-resolution world-space mask.
 * Mesh positions, indices, collision and tunnel holes stay byte-for-byte unchanged.
 * Terrain uses 13 samplers including its three base maps, below WebGL2's 16 minimum.
 */
export class TerrainMaterialBlend extends MaterialPluginBase {
 private bindings:Record<string,Texture>={};
 constructor(material:PBRMaterial,library:VillageMaterialLibrary,bank=false){
  super(material,'VillageTerrainBlend',180,{},true,true);
  const sets=bank?[library.surface('farm_soil')]:[library.surface('gravelly_sand'),library.surface('farm_soil'),library.surface('brown_mud_03')];
  sets.forEach((set,i)=>{for(const channel of ['albedo','normal','arm'] as const)this.bindings[`art${i}${channel}`]=set[channel];});
  if(!bank){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
   const c=canvas.getContext('2d')!,data=c.createImageData(512,256);
   const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
   for(let j=0;j<256;j++)for(let i=0;i<512;i++){
    const x=i/511*180-90,z=j/255*90-45,noise=Math.sin(x*.71+Math.sin(z*.38))*Math.sin(z*.55+x*.13);
    const main=Math.abs(z-laneZ('main',x)),north=Math.abs(z-laneZ('north',x));
    const mud=(1-smooth(2,5,Math.abs(z-laneZ('south',x))+noise*.4))*smooth(12,23,-z);
    const farm=smooth(8,15,main+noise)*(1-smooth(0,8,z+14))*(1-mud);
    const gravel=smooth(1.7,4.5,Math.min(main,north)+noise*.5)*.68*(1-mud-farm);
    const n=(j*512+i)*4;data.data[n]=gravel*255;data.data[n+1]=farm*255;data.data[n+2]=mud*255;data.data[n+3]=255;
   }
   c.putImageData(data,0,0);const mask=new DynamicTexture('village-terrain-mask',canvas,library.scene,false,Texture.BILINEAR_SAMPLINGMODE);
   mask.gammaSpace=false;mask.wrapU=mask.wrapV=Texture.CLAMP_ADDRESSMODE;mask.update(false);this.bindings.artMask=mask;
  }
  this.bank=bank;
 }
 private bank:boolean;
 override getSamplers(samplers:string[]){samplers.push(...Object.keys(this.bindings));}
 override getActiveTextures(textures:BaseTexture[]){textures.push(...Object.values(this.bindings));}
 override hasTexture(texture:BaseTexture){return Object.values(this.bindings).includes(texture as Texture);}
 override isReadyForSubMesh(){return Object.values(this.bindings).every(t=>t.isReady());}
 override bindForSubMesh(buffer:UniformBuffer){for(const [name,texture]of Object.entries(this.bindings))buffer.setTexture(name,texture);}
 override getCustomCode(type:string){
  if(type!=='fragment')return null;
  // Babylon queries hook names from the base constructor before field initialization.
  const declarations=Object.keys(this.bindings??{}).map(name=>`uniform sampler2D ${name};`).join('\n');
  const weights=this.bank?'vec3 weights=vec3(smoothstep(0.5,0.85,abs(normalize(vNormalW).y)),0.,0.);':'vec3 weights=texture2D(artMask,(vPositionW.xz+vec2(90.,45.))/vec2(180.,90.)).rgb;';
  const functions=(['albedo','normal','arm'] as const).map(channel=>{
   const base={albedo:'albedoSampler',normal:'bumpSampler',arm:'reflectivitySampler'}[channel];
   const extra=this.bank?`texture2D(art0${channel},uv)*weights.x`:[0,1,2].map((i)=>`texture2D(art${i}${channel},uv)*weights.${'xyz'[i]}`).join('+');
   return `vec4 artSample${channel}(vec2 originalUV){${weights} vec2 uv=${this.bank?'originalUV':'vPositionW.xz/2.5'};return texture2D(${base},${this.bank?'originalUV':'uv'})*max(0.,1.-weights.x-weights.y-weights.z)+${extra};}`;
  }).join('\n');
  return {
   CUSTOM_FRAGMENT_DEFINITIONS:declarations+'\n'+functions,
   '!vec4 albedoTexture=texture2D\\(albedoSampler,vAlbedoUV\\+uvOffset\\);':'vec4 albedoTexture=artSamplealbedo(vAlbedoUV+uvOffset);',
   '!vec4 surfaceMetallicOrReflectivityColorMap=texture2D\\(reflectivitySampler,vReflectivityUV\\+uvOffset\\);':'vec4 surfaceMetallicOrReflectivityColorMap=artSamplearm(vReflectivityUV+uvOffset);',
   '!texture2D\\(bumpSampler,vBumpUV\\+uvOffset\\)':'artSamplenormal(vBumpUV+uvOffset)',
  };
 }
}
