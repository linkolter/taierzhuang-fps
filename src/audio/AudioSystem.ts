import { Vector3 } from '@babylonjs/core';
import { CONFIG } from '../config/gameConfig';
const SPEC:Record<string,[number,number,number]>={rifle:[.24,1800,1.25],bolt:[.17,2900,.27],reload:[.65,1600,.23],dadao:[.3,750,.65],sabre:[.23,1000,.6],step:[.09,220,.17],hit:[.1,550,.3],death:[.3,140,.3]};
export type SoundName='rifle'|'bolt'|'reload'|'dadao'|'sabre'|'step'|'hit'|'death';
/** Self-contained synthesized placeholders. Replace play() voices with decoded assets later. */
export class AudioSystem {
  context?: AudioContext; master?: GainNode; noise?: AudioBuffer; wind?: AudioBufferSourceNode;
  voices=new Set<()=>void>();
  reset(){for(const stop of [...this.voices])stop();}
  dispose(){this.reset();this.wind?.stop();this.wind?.disconnect();this.master?.disconnect();void this.context?.close();}
  async start(){if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.26;this.master.connect(this.context.destination);this.noise=this.context.createBuffer(1,this.context.sampleRate,this.context.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.wind=this.context.createBufferSource();this.wind.buffer=this.noise;this.wind.loop=true;const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=260;const gain=this.context.createGain();gain.gain.value=.035;this.wind.connect(filter).connect(gain).connect(this.master);this.wind.start();}await this.context.resume();}
  pause(paused:boolean){if(this.master&&this.context)this.master.gain.setTargetAtTime(paused?0:.26,this.context.currentTime,.1);}
  play(name:string,position?:Vector3,listener?:Vector3,yaw=0){const c=this.context;if(!c||c.state!=='running'||!this.master||!this.noise)return;let volume=1,pan=0;if(position&&listener){const d=position.subtract(listener),distance=d.length();volume=1/(1+distance*distance*.004);pan=Math.max(-.85,Math.min(.85,(d.x*Math.cos(yaw)-d.z*Math.sin(yaw))/Math.max(1,distance)));if(volume<.015)return;}
    if(this.voices.size>=CONFIG.stability.audioVoices)this.voices.values().next().value?.();
    const [duration,hz,loud]=SPEC[name]??SPEC.hit;
    const source=c.createBufferSource();source.buffer=this.noise;const filter=c.createBiquadFilter();filter.type=name==='rifle'?'lowpass':'bandpass';filter.frequency.setValueAtTime(hz,c.currentTime);filter.frequency.exponentialRampToValueAtTime(Math.max(70,hz*.25),c.currentTime+duration);const gain=c.createGain();gain.gain.setValueAtTime(volume*loud,c.currentTime);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+duration);const panner=c.createStereoPanner();panner.pan.value=pan;source.connect(filter).connect(gain).connect(panner).connect(this.master);source.start();source.stop(c.currentTime+duration);
    let osc:OscillatorNode|undefined,tail:GainNode|undefined,ended=false;
    const cleanup=()=>{if(ended)return;ended=true;source.onended=null;try{source.stop();osc?.stop();}catch{}source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();osc?.disconnect();tail?.disconnect();this.voices.delete(cleanup);};
    this.voices.add(cleanup);source.onended=cleanup;
    if(name==='rifle'){osc=c.createOscillator();tail=c.createGain();osc.frequency.setValueAtTime(110,c.currentTime);osc.frequency.exponentialRampToValueAtTime(35,c.currentTime+.15);tail.gain.setValueAtTime(volume*.65,c.currentTime);tail.gain.exponentialRampToValueAtTime(.001,c.currentTime+.2);osc.connect(tail).connect(this.master);osc.start();osc.stop(c.currentTime+.2);}
  }
}
