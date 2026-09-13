import {DirectionalLight,RenderTargetTexture,ShadowGenerator,type AbstractMesh} from '@babylonjs/core';

/** Static daylight shadows are rendered once; actors and simulation add no shadow work. */
export function addVillageShadows(sun:DirectionalLight,meshes:AbstractMesh[]){
 sun.autoCalcShadowZBounds=true;sun.shadowOrthoScale=.03;
 const shadows=new ShadowGenerator(2048,sun);shadows.usePercentageCloserFiltering=true;
 shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;shadows.bias=.0005;shadows.normalBias=.04;shadows.setDarkness(.22);
 const map=shadows.getShadowMap()!;
 map.renderList=meshes.filter(m=>m.getTotalVertices()>0&&!m.metadata?.terrain&&m.getBoundingInfo().boundingBox.maximumWorld.y>0);
 map.refreshRate=RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
 sun.getScene().onDisposeObservable.addOnce(()=>shadows.dispose());return shadows;
}
