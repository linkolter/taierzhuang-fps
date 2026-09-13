import {Matrix,Quaternion,Scene,TransformNode,Vector3,type Node} from '@babylonjs/core';

/** Metres in rifle space AFTER the glTF loader's Z reflection (+Z forward).
 * Measured on hanyang-body: V notch opening midpoint and front blade top edge.
 * The notch floor is y=.097004, shoulders y=.099444; aim through the opening.
 */
export const HANYANG_SIGHTS={
 rear:new Vector3(.000044,.09825,.406841),
 front:new Vector3(.000031552,.092061251,1.018499374),
};
export const VIEWMODEL={
 landing:{distance:.015,seconds:.12},
 switching:{seconds:.3,drop:.28},
 adsSeconds:.21,hipFov:1.18,adsFov:.90,sprintFov:1.25,
 hipPosition:new Vector3(.24,-.25,.46),adsForward:.46,
 sprint:{position:new Vector3(0,-.08,0),rotation:new Vector3(.28,0,-.16)},
 reload:{position:new Vector3(0,-.18,0),rotation:new Vector3(0,0,-.4)},
 bolt:{position:new Vector3(.012,-.012,.015),rotation:new Vector3(0,0,.17)},
 recoil:{position:new Vector3(0,0,-.1),rotation:new Vector3(-.11,0,0),adsTranslation:.65,adsRotation:.55},
};

/** Pose references are never animated. Each frame is rebuilt from these anchors. */
export class ViewmodelAnchors {
 readonly hip:TransformNode;readonly ads:TransformNode;
 readonly rear:TransformNode;readonly front:TransformNode;
 constructor(scene:Scene,camera:Node,rifle:TransformNode){
  this.hip=new TransformNode('HipAnchor',scene);this.hip.parent=camera;this.hip.position.copyFrom(VIEWMODEL.hipPosition);this.hip.rotationQuaternion=Quaternion.Identity();
  this.ads=new TransformNode('ADSAnchor',scene);this.ads.parent=camera;this.ads.rotationQuaternion=Quaternion.Identity();
  this.rear=new TransformNode('RearSightAnchor',scene);this.rear.parent=rifle;
  this.front=new TransformNode('FrontSightAnchor',scene);this.front.parent=rifle;
  this.calibrate(false);
 }
 calibrate(hanyang:boolean){
  this.rear.position.copyFrom(hanyang?HANYANG_SIGHTS.rear:new Vector3(0,.123,.12));
  this.front.position.copyFrom(hanyang?HANYANG_SIGHTS.front:new Vector3(0,.123,1.025));
  const line=this.front.position.subtract(this.rear.position).normalize();
  Quaternion.FromUnitVectorsToRef(line,Vector3.Forward(),this.ads.rotationQuaternion!);
  const rotation=Matrix.FromQuaternionToRef(this.ads.rotationQuaternion!,Matrix.Identity());
  const rear=Vector3.TransformCoordinates(this.rear.position,rotation);
  this.ads.position.set(-rear.x,-rear.y,VIEWMODEL.adsForward);
 }
}
