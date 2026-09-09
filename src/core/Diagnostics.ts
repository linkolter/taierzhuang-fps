import type { Game } from '../game/Game';
import { NavigationDebug } from '../map/NavigationDebug';
export class Diagnostics {
  samples:Record<string,unknown>[]=[]; errors:string[]=[]; restarts=0; frames=0; frameMs=0; nextSample=0;
  private controls=new AbortController(); private panel=document.createElement('pre'); visible=false;
  navigation?:NavigationDebug;
  constructor(public game:Game){
    this.panel.id='diagnostics';this.panel.hidden=true;document.body.append(this.panel);
    const options={signal:this.controls.signal};
    window.addEventListener('error',e=>this.error('error: '+e.message),options);
    window.addEventListener('unhandledrejection',e=>this.error('promise: '+String(e.reason)),options);
    game.engine.getRenderingCanvas()!.addEventListener('webglcontextlost',()=>this.error('WebGL context lost'),options);
    game.engine.getRenderingCanvas()!.addEventListener('webglcontextrestored',()=>this.error('WebGL context restored'),options);
    document.addEventListener('keydown',e=>{if(e.code==='F3'&&!e.repeat){e.preventDefault();this.visible=!this.visible;this.panel.hidden=!this.visible;if(this.visible&&!this.navigation)this.navigation=new NavigationDebug(game.world);this.navigation?.setEnabled(this.visible);this.render();}},options);
    this.nextSample=performance.now()+30000;
  }
  error(message:string){this.errors.push(message);if(this.errors.length>16)this.errors.shift();try{sessionStorage.setItem('fps-last-error',JSON.stringify(this.errors));}catch{}console.warn('[FPS diagnostic] '+message);}
  snapshot(){const g=this.game;const memory=(performance as Performance&{memory?:{usedJSHeapSize:number;jsHeapSizeLimit:number}}).memory;return {wallSeconds:Math.round(performance.now()/1000),matchSeconds:Math.round(g.time),meshes:g.scene.meshes.length,materials:g.scene.materials.length,textures:g.scene.textures.length,particles:g.scene.particleSystems.length,ai:g.bots.length,deadAI:g.bots.filter(b=>!b.alive).length,activeEffects:g.effects.pool.filter(p=>p.life>0).length,effectPool:g.effects.pool.length,projectiles:0,decals:0,audioVoices:g.audio.voices.size,transformNodes:g.scene.transformNodes.length,pathNodes:g.bots.reduce((sum,b)=>sum+b.path.length,0),heapMB:memory?Math.round(memory.usedJSHeapSize/1048576*10)/10:null,fps:Math.round(g.engine.getFps()*10)/10,restarts:this.restarts,errors:this.errors.length};}
  update(){const now=performance.now();if(now>=this.nextSample){this.nextSample=now+30000;const sample=this.snapshot();this.samples.push(sample);if(this.samples.length>120)this.samples.shift();console.info('[FPS stats] '+JSON.stringify(sample));try{sessionStorage.setItem('fps-last-stats',JSON.stringify(sample));}catch{} }if(this.visible&&this.frames++%15===0)this.render();}
  render(){if(!this.visible)return;this.panel.textContent='F3 诊断 / 路线\n'+JSON.stringify(this.snapshot(),null,1)+'\n'+this.game.bots.map(b=>`${b.id} ${b.team} ${b.route} ${b.state} wp ${b.pathIndex}/${b.path.length} → ${b.objective}`).join('\n');}
  dispose(){this.controls.abort();this.panel.remove();this.navigation?.dispose();}
}
