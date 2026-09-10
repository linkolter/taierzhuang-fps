import {Color3,PointLight,Scene,Vector3} from '@babylonjs/core';
/** One scene-wide transient illumination slot. Intensity changes never change shader light defines. */
export class MuzzleLightPool {
 private static scenes=new WeakMap<Scene,MuzzleLightPool>();
 static forScene(scene:Scene){let pool=this.scenes.get(scene);if(!pool){pool=new this(scene);this.scenes.set(scene,pool);}return pool;}
 readonly light:PointLight;private life=0;
 private constructor(scene:Scene){this.light=new PointLight('pooled-muzzle-light',new Vector3(),scene);this.light.diffuse=new Color3(1,.7,.32);this.light.range=4;this.light.intensity=0;}
 pulse(position:Vector3,duration=.045,intensity=1.8){this.life=Math.max(this.life,duration);this.light.position.copyFrom(position);this.light.intensity=intensity;}
 update(dt:number){if(this.life<=0)return;this.life-=dt;if(this.life<=0)this.light.intensity=0;}
 reset(){this.life=0;this.light.intensity=0;}
}
