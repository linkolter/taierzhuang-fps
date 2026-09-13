import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Repack the supplied source without image resampling. Coordinates become metres,
// with a named bolt pivot; the detached display bayonet is not part of the rifle.
const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/prepare-hanyang.mjs <source.glb>');
const raw=await readFile(source),jsonLength=raw.readUInt32LE(12);
const original=JSON.parse(raw.subarray(20,20+jsonLength).toString());
const bin=raw.subarray(28+jsonLength);
if(original.asset.extras?.title!=='汉阳造步枪1'||original.meshes.length!==4)throw new Error('Unexpected source asset');
const scale=1.25/(51.56760025024414+33.60919952392578);
const forwardOffset=1.05-51.56760025024414*scale;
const point=([x,y,z])=>[-(y-.62755)*scale,(z-2.619)*scale+.06,-(x*scale+forwardOffset)];
const pivot=point([-5.9,.62755,3.6]);
const chunks=[],views=[],accessors=[];let offset=0;
function buffer(data){const bytes=Buffer.from(data);const index=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);const pad=(4-bytes.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));offset+=bytes.length+pad;return index;}
function readAccessor(id){const a=original.accessors[id],v=original.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];if(![5125,5126].includes(a.componentType))throw new Error('Unexpected component type');const data=Buffer.alloc(a.count*n*4),start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||n*4;for(let i=0;i<a.count;i++)bin.copy(data,i*n*4,start+i*stride,start+i*stride+n*4);return {a,n,data};}
function attribute(id,semantic,bolt){const {a,n,data}=readAccessor(id);const min=Array(n).fill(Infinity),max=Array(n).fill(-Infinity);
 for(let i=0;i<a.count;i++){
  let value=Array.from({length:n},(_,j)=>data.readFloatLE((i*n+j)*4));
  if(semantic==='POSITION'){value=point(value);if(bolt)value=value.map((v,j)=>v-pivot[j]);}
  if(semantic==='NORMAL'||semantic==='TANGENT')value=[-value[1],value[2],-value[0],...value.slice(3)];
  value.forEach((v,j)=>{data.writeFloatLE(v,(i*n+j)*4);min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);});
 }
 const result={bufferView:buffer(data),componentType:a.componentType,count:a.count,type:a.type};if(semantic==='POSITION'){result.min=min;result.max=max;}
 accessors.push(result);return accessors.length-1;
}
const meshes=[0,1,3].map((id,index)=>{const p=original.meshes[id].primitives[0],attributes={};for(const [key,a]of Object.entries(p.attributes))attributes[key]=attribute(a,key,id===3);const {a,data}=readAccessor(p.indices);accessors.push({bufferView:buffer(data),componentType:a.componentType,count:a.count,type:a.type});return {name:['hanyang-sling','hanyang-body','hanyang-bolt-mesh'][index],primitives:[{attributes,indices:accessors.length-1,material:index,mode:4}]};});
const images=original.images.slice(0,6).map(image=>{const v=original.bufferViews[image.bufferView];return {mimeType:image.mimeType,bufferView:buffer(bin.subarray(v.byteOffset,v.byteOffset+v.byteLength))};});
const doc={asset:{...original.asset,generator:'taierzhuang-fps / prepare-hanyang.mjs',extras:{...original.asset.extras,modifications:'Removed detached bayonet; normalized scale/orientation; named rigid bolt pivot; original textures retained.',sourceSha256:createHash('sha256').update(raw).digest('hex')}},extensionsUsed:original.extensionsUsed,
 scene:0,scenes:[{nodes:[0]}],nodes:[{name:'hanyang-rifle',children:[1,2,3]},{name:'hanyang-sling',mesh:0},{name:'hanyang-body',mesh:1},{name:'hanyang-bolt',translation:pivot,children:[4]},{name:'hanyang-bolt-mesh',mesh:2}],meshes,materials:[original.materials[0],original.materials[1],original.materials[3]],textures:original.textures.slice(0,6),images,samplers:original.samplers,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
const json=Buffer.from(JSON.stringify(doc)),jsonPad=Buffer.alloc((4-json.length%4)%4,32),binary=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jsonPad.length+binary.length,8);header.writeUInt32LE(json.length+jsonPad.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
await mkdir('public/models/hanyang',{recursive:true});await writeFile('public/models/hanyang/hanyang.glb',Buffer.concat([header,json,jsonPad,binHeader,binary]));
console.log(JSON.stringify({sourceSha256:doc.asset.extras.sourceSha256,bytes:header.readUInt32LE(8),scale,boltPivot:pivot,triangles:meshes.reduce((sum,m)=>sum+accessors[m.primitives[0].indices].count/3,0)},null,2));
