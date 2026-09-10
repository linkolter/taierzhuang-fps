import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from '@babylonjs/core';

export type VillageMaterial = 'PackedEarth'|'MudWall'|'StoneWall'|'RoofTile'|'OldWood'|'Farmland'|'TunnelEarth'|'Sack';
const bases: Record<VillageMaterial,string> = {PackedEarth:'#998363',MudWall:'#c6beaa',StoneWall:'#777369',RoofTile:'#555c5a',OldWood:'#756047',Farmland:'#71694b',TunnelEarth:'#655644',Sack:'#a09370'};
/** Scene-owned, deterministic, 256² canvases. Never generated in the render loop. */
export class ProceduralMaterialFactory {
  static forScene(scene:Scene) { let f=this.scenes.get(scene);if(!f){f=new this(scene);this.scenes.set(scene,f);}return f; }
  private static scenes=new WeakMap<Scene,ProceduralMaterialFactory>();
  readonly textures=new Map<VillageMaterial,DynamicTexture>();
  private constructor(private scene:Scene) {}
  apply(material:StandardMaterial,kind:VillageMaterial) {
    material.diffuseTexture=this.texture(kind);material.diffuseColor=Color3.White();material.specularColor=Color3.Black();material.specularPower=1;
  }
  texture(kind:VillageMaterial) {
    const cached=this.textures.get(kind);if(cached)return cached;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d')!;let seed=1938+Object.keys(bases).indexOf(kind)*701;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    c.fillStyle=bases[kind];c.fillRect(0,0,256,256);
    const wrap=(paint:()=>void)=>{for(const x of [-256,0,256])for(const y of [-256,0,256]){c.save();c.translate(x,y);paint();c.restore();}};
    for(let i=0;i<65;i++){const x=random()*256,y=random()*256,r=8+random()*33,shade=i%2?'45,35,24':'205,195,162';wrap(()=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${shade},.13)`);g.addColorStop(1,`rgba(${shade},0)`);c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);});}
    if(kind==='StoneWall')for(let row=0;row<8;row++){
      let x=0;while(x<256){const width=Math.min(256-x,32+Math.floor(random()*3)*16),y=row*32,v=Math.floor(random()*27);c.fillStyle=`rgb(${103+v},${100+v},${89+v})`;const xx=x;wrap(()=>{c.beginPath();c.moveTo(xx+3,y+4);c.lineTo(xx+width-5,y+2);c.lineTo(xx+width-2,y+26);c.lineTo(xx+6,y+30);c.closePath();c.fill();c.strokeStyle='rgba(30,28,24,.65)';c.lineWidth=3;c.stroke();});x+=width;}
    }
    // U runs along ridge, V down roof slope in the existing box face UVs.
    if(kind==='RoofTile')for(let row=0;row<8;row++)for(let col=0;col<8;col++){
      const x=col*32,y=row*32,g=c.createLinearGradient(x,0,x+32,0);g.addColorStop(0,'#383f3f');g.addColorStop(.4,`rgb(${91+Math.floor(random()*14)},103,102)`);g.addColorStop(1,'#444b4a');c.fillStyle=g;c.fillRect(x,y,32,32);c.fillStyle='#343b3a';c.fillRect(x,y+29,32,3);if(random()<.12){c.fillStyle='#42403b';c.fillRect(x+9,y+26,5,4);}
    }
    if(kind==='OldWood'){
      for(let i=0;i<110;i++){const x=random()*256,phase=random()*6;c.strokeStyle=i%3?'rgba(43,28,16,.18)':'rgba(196,166,116,.18)';c.lineWidth=.5+random();wrap(()=>{c.beginPath();for(let y=0;y<=256;y+=4)c.lineTo(x+Math.sin(y/256*Math.PI*2+phase)*2,y);c.stroke();});}
      c.fillStyle='rgba(36,28,19,.55)';for(let x=0;x<256;x+=64)c.fillRect(x,0,2,256);
    }
    if(kind==='Farmland')for(let y=0;y<256;y+=32){c.fillStyle='rgba(37,31,21,.32)';c.fillRect(0,y,256,5);for(let i=0;i<38;i++){c.fillStyle=i%2?'#666b44':'#7e8050';c.fillRect(random()*256,y+8+random()*14,2,3+random()*4);}}
    if(kind==='Sack')for(let i=0;i<256;i+=4){c.fillStyle='rgba(46,37,23,.28)';c.fillRect(i,0,1,256);c.fillRect(0,i,256,1);c.fillStyle='rgba(221,209,166,.24)';c.fillRect(i+1,0,1,256);}
    if(kind==='MudWall'||kind==='TunnelEarth'||kind==='OldWood')for(let i=0;i<19;i++){
      const x=random()*256,y=random()*256,points=[[x,y]];for(let j=0;j<4;j++)points.push([points[j][0]+(random()-.5)*14,points[j][1]+4+random()*7]);
      c.strokeStyle=kind==='TunnelEarth'?'rgba(31,27,23,.3)':'rgba(54,42,30,.3)';c.lineWidth=kind==='TunnelEarth'?3:.7;wrap(()=>{c.beginPath();points.forEach(p=>c.lineTo(p[0],p[1]));c.stroke();});
    }
    if(kind==='MudWall')for(let i=0;i<125;i++){
      const x=random()*256,y=random()*256,r=1+random()*8,points:number[][]=[];for(let j=0;j<9;j++){const a=j/9*Math.PI*2,rr=r*(.5+random()*.5);points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}
      c.fillStyle=i%3?'rgba(99,84,65,.26)':'rgba(224,217,197,.45)';wrap(()=>{c.beginPath();points.forEach(p=>c.lineTo(p[0],p[1]));c.closePath();c.fill();c.strokeStyle='rgba(79,66,51,.13)';c.lineWidth=.6;c.stroke();});
    }
    for(let i=0;i<8200;i++){const x=random()*256,y=random()*256;c.fillStyle=i%2?'rgba(20,17,12,.1)':'rgba(235,222,182,.1)';wrap(()=>c.fillRect(x,y,1,1));}
    if(kind==='PackedEarth'||kind==='TunnelEarth')for(let i=0;i<75;i++){const x=random()*256,y=random()*256;c.fillStyle=i%2?'#827b6a':'#afa18a';wrap(()=>c.fillRect(x,y,1+i%3,1+i%2));}
    const texture=new DynamicTexture(`procedural-${kind}`,canvas,this.scene,true,Texture.TRILINEAR_SAMPLINGMODE);
    texture.wrapU=texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.uScale=texture.vScale=1;texture.anisotropicFilteringLevel=4;texture.update(false);
    this.textures.set(kind,texture);return texture;
  }
}
