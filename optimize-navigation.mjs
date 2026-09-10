import fs from 'node:fs';let s=fs.readFileSync('src/map/TacticalRouteGraph.ts','utf8');
s=s.replace("private heap:{id:number;f:number}[]=[];", "private heapIds:number[]=[];private heapScores:number[]=[];private heapSize=0;\n  private spatialNodes=new Map<number,RouteNode[]>();\n  private pathCache=new Map<string,Vector3[]>();");
s=s.replace('    this.costs=new Float64Array', "    for(const n of this.nodes){const key=this.spatialKey(Math.floor(n.position.x/4),Math.floor(n.position.z/4));let bucket=this.spatialNodes.get(key);if(!bucket){bucket=[];this.spatialNodes.set(key,bucket);}bucket.push(n);}\n    this.costs=new Float64Array");
const start=s.indexOf('  nearest(p:'),end=s.indexOf('  walkableLink(',start);
s=s.slice(0,start)+`  private spatialKey(x:number,z:number){return (x+128)*256+z+128;}
  nearest(p:Vector3,tunnel=this.world.undergroundAt(p.x,p.y,p.z),exclude=-1){
    let best=-1,d=64;const cx=Math.floor(p.x/4),cz=Math.floor(p.z/4);
    for(let ring=0;ring<=2;ring++)for(let dx=-ring;dx<=ring;dx++)for(let dz=-ring;dz<=ring;dz++){
      if(ring&&Math.abs(dx)<ring&&Math.abs(dz)<ring)continue;
      const x=cx+dx,z=cz+dz,nearX=Math.max(x*4,Math.min(p.x,x*4+4)),nearZ=Math.max(z*4,Math.min(p.z,z*4+4));
      if((nearX-p.x)**2+(nearZ-p.z)**2>d)continue;
      const bucket=this.spatialNodes.get(this.spatialKey(x,z));if(!bucket)continue;
      for(const n of bucket){if(n.id===exclude||(n.level==='tunnel')!==tunnel)continue;const dist=Vector3.DistanceSquared(n.position,p);if((dist<d||best>=0&&dist===d&&n.id<best)&&this.walkableLink(p,n.position)){best=n.id;d=dist;}}
    }return best;
  }
`+s.slice(end);
const hs=s.indexOf('  private push('),he=s.indexOf('  find(',hs);
s=s.slice(0,hs)+`  private push(id:number,f:number){let i=this.heapSize++;while(i>0){const p=(i-1)>>1;if(this.heapScores[p]<=f)break;this.heapIds[i]=this.heapIds[p];this.heapScores[i]=this.heapScores[p];i=p;}this.heapIds[i]=id;this.heapScores[i]=f;}
  private pop(){const first=this.heapIds[0],lastId=this.heapIds[--this.heapSize],lastScore=this.heapScores[this.heapSize];if(this.heapSize){let i=0;while(i*2+1<this.heapSize){let child=i*2+1;if(child+1<this.heapSize&&this.heapScores[child+1]<this.heapScores[child])child++;if(lastScore<=this.heapScores[child])break;this.heapIds[i]=this.heapIds[child];this.heapScores[i]=this.heapScores[child];i=child;}this.heapIds[i]=lastId;this.heapScores[i]=lastScore;}return first;}
`+s.slice(he);
s=s.replace('    this.costs.fill(Infinity);', "    const cacheKey=s+':'+e+':'+preference,cached=this.pathCache.get(cacheKey);if(cached){const path=cached.slice();if(this.walkableLink(this.nodes[e].position,end))path.push(end.clone());return path;}\n    this.costs.fill(Infinity);");s=s.replace('this.heap.length=0','this.heapSize=0').replace('while(this.heap.length)','while(this.heapSize)');
s=s.replace('path.reverse();if(this.walkableLink', "path.reverse();if(this.pathCache.size>=128)this.pathCache.delete(this.pathCache.keys().next().value!);this.pathCache.set(cacheKey,path.slice());if(this.walkableLink");fs.writeFileSync('src/map/TacticalRouteGraph.ts',s);
