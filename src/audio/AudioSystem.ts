import {Vector3} from '@babylonjs/core';
import {CONFIG} from '../config/gameConfig';
type Layer={duration:number;hz:number;gain:number;end?:number;tone?:boolean;delay?:number;type?:BiquadFilterType};
const sounds:Record<string,Layer[]>={
 rifle:[{duration:.035,hz:5700,gain:.95,type:'highpass'},{duration:.18,hz:1550,end:450,gain:.7},{duration:.085,hz:125,end:65,gain:.22,tone:true}],
 'bolt-unlock':[{duration:.055,hz:2600,gain:.19},{duration:.035,hz:1450,gain:.12,tone:true}],
 'bolt-back':[{duration:.16,hz:1600,end:3300,gain:.14}],
 'bolt-eject':[{duration:.045,hz:4100,gain:.12,tone:true}],
 'bolt-forward':[{duration:.15,hz:2100,end:1000,gain:.13}],
 'bolt-lock':[{duration:.06,hz:2500,gain:.25},{duration:.035,hz:780,gain:.11,tone:true}],
 reload:[{duration:.17,hz:700,gain:.12}],
 'reload-open':[{duration:.12,hz:2400,end:900,gain:.2}],
 'reload-clip':[{duration:.06,hz:3500,gain:.19,tone:true},{duration:.08,hz:1600,gain:.12,delay:.08}],
 'reload-press':[{duration:.16,hz:850,end:1700,gain:.15},{duration:.04,hz:2300,gain:.09,delay:.12}],
 'reload-feed':[{duration:.07,hz:3000,gain:.17},{duration:.06,hz:1800,gain:.12,delay:.09}],
 'reload-close':[{duration:.09,hz:2100,gain:.22}],
 shell:[{duration:.065,hz:4200,gain:.10,tone:true},{duration:.035,hz:2600,gain:.08,delay:.065}],
 dadao:[{duration:.24,hz:600,end:2000,gain:.28}],sabre:[{duration:.18,hz:900,end:2400,gain:.22}],
 'melee-hit':[{duration:.12,hz:400,gain:.38},{duration:.08,hz:110,end:65,gain:.14,tone:true}],
 'impact-earth':[{duration:.13,hz:480,gain:.25}], 'impact-stone':[{duration:.08,hz:3100,gain:.3}],
 'impact-wood':[{duration:.1,hz:1100,gain:.25},{duration:.06,hz:230,end:130,gain:.1,tone:true}],
 'impact-body':[{duration:.09,hz:470,gain:.28}],
 'step-earth':[{duration:.11,hz:340,gain:.16}], 'step-stone':[{duration:.065,hz:1400,gain:.17},{duration:.04,hz:220,gain:.07,tone:true}],
 'step-wood':[{duration:.08,hz:600,gain:.15},{duration:.09,hz:150,end:90,gain:.09,tone:true}],
 'step-tunnel':[{duration:.12,hz:260,gain:.17}],
 death:[{duration:.25,hz:150,gain:.2}],creak:[{duration:.65,hz:185,end:120,gain:.025,tone:true}],
 artillery:[{duration:1.5,hz:180,end:45,gain:.36},{duration:.65,hz:65,end:28,gain:.15,tone:true}],
};
/** All layers of a voice share positioning and bus; finite sources disconnect on completion. */
export class ProceduralAudioSystem {
 context?:AudioContext;master?:GainNode;noise?:AudioBuffer;wind?:AudioBufferSourceNode;
 voices=new Set<()=>void>();surfaceBus?:GainNode;tunnelBus?:BiquadFilterNode;
 private permanent:AudioNode[]=[];private ambientAt=12;private underground=0;private busTunnel=-1;private paused=false;
 reset(){for(const stop of [...this.voices])stop();this.ambientAt=12;this.underground=0;this.busTunnel=-1;}
 dispose(){this.reset();try{this.wind?.stop();}catch{}for(const n of this.permanent)n.disconnect();this.permanent=[];void this.context?.close();}
 async start(){
  if(!this.context){const c=this.context=new AudioContext();const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=5;compressor.attack.value=.003;compressor.release.value=.18;
   this.master=c.createGain();this.master.gain.value=.26;this.master.connect(compressor).connect(c.destination);
   this.surfaceBus=c.createGain();this.surfaceBus.connect(this.master);this.tunnelBus=c.createBiquadFilter();this.tunnelBus.type='lowpass';this.tunnelBus.frequency.value=2300;this.tunnelBus.Q.value=.5;this.tunnelBus.connect(this.master);
   const verb=c.createConvolver(),wet=c.createGain();wet.gain.value=.19;const ir=c.createBuffer(2,Math.floor(c.sampleRate*.28),c.sampleRate);
   for(let ch=0;ch<2;ch++){const data=ir.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(c.sampleRate*.055))*.28;}verb.buffer=ir;this.tunnelBus.connect(verb).connect(wet).connect(this.master);
   this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   this.wind=c.createBufferSource();this.wind.buffer=this.noise;this.wind.loop=true;const filter=c.createBiquadFilter(),gain=c.createGain();filter.type='lowpass';filter.frequency.value=190;gain.gain.value=.055;this.wind.connect(filter).connect(gain).connect(this.surfaceBus);this.wind.start();
   this.permanent=[compressor,this.master,this.surfaceBus,this.tunnelBus,verb,wet,this.wind,filter,gain];
  }this.paused=false;this.pause(false);await this.context.resume();
 }
 pause(paused:boolean){this.paused=paused;if(this.master&&this.context)this.master.gain.setTargetAtTime(paused?0:.26,this.context.currentTime,.04);}
 update(dt:number,position:Vector3,yaw:number,tunnel:boolean|number){
  const blend=Number(tunnel);this.underground=blend;const c=this.context;if(!c||this.paused)return;
  const l=c.listener;l.positionX.value=position.x;l.positionY.value=position.y;l.positionZ.value=-position.z;l.forwardX.value=Math.sin(yaw);l.forwardY.value=0;l.forwardZ.value=-Math.cos(yaw);l.upX.value=0;l.upY.value=1;l.upZ.value=0;
  if(this.surfaceBus&&Math.abs(this.busTunnel-blend)>.005){this.busTunnel=blend;this.surfaceBus.gain.setTargetAtTime(1-.62*blend,c.currentTime,.12);this.tunnelBus!.frequency.setTargetAtTime(4500-2200*blend,c.currentTime,.12);}
  this.ambientAt-=dt;if(this.ambientAt<=0){this.ambientAt=12+Math.random()*20;const angle=Math.random()*Math.PI*2,kind=Math.random();const distant=position.add(new Vector3(Math.sin(angle)*100,5,Math.cos(angle)*100));this.play(kind<.48?'rifle':kind<.7?'artillery':'creak',kind<.7?distant:position.add(new Vector3(4,2,1)),position,yaw,tunnel);}
 }
 play(name:string,position?:Vector3,listener?:Vector3,_yaw=0,sourceTunnel:boolean|number=this.underground){
  const c=this.context;if(!c||c.state!=='running'||!this.master||!this.noise||this.paused)return;
  if(position&&listener&&Vector3.DistanceSquared(position,listener)>220**2)return;
  const layers=sounds[name]??sounds[name==='hit'?'impact-body':name==='step'?'step-earth':name==='bolt'?'bolt-lock':'impact-earth'];
  while(this.voices.size>=CONFIG.stability.audioVoices)this.voices.values().next().value?.();
  const nodes:AudioNode[]=[],sources:(AudioBufferSourceNode|OscillatorNode)[]=[];
  const mix=Math.max(Number(sourceTunnel),this.underground),bus=c.createGain(),dry=c.createGain(),wet=c.createGain();dry.gain.value=1-mix;wet.gain.value=mix;
  bus.connect(dry).connect(this.surfaceBus!);bus.connect(wet).connect(this.tunnelBus!);nodes.push(bus,dry,wet);
  let output:AudioNode=bus;
  if(position){const p=c.createPanner();p.panningModel='equalpower';p.distanceModel='inverse';p.refDistance=5;p.rolloffFactor=1.25;p.maxDistance=220;p.positionX.value=position.x;p.positionY.value=position.y;p.positionZ.value=-position.z;p.connect(bus);nodes.push(p);output=p;}
  let pending=layers.length,ended=false;
  const cleanup=()=>{if(ended)return;ended=true;for(const s of sources){s.onended=null;try{s.stop();}catch{}}for(const n of nodes)n.disconnect();this.voices.delete(cleanup);};this.voices.add(cleanup);
  const pitch=.985+Math.random()*.03,volume=.97+Math.random()*.06;
  for(const layer of layers){const start=c.currentTime+(layer.delay??0),end=start+layer.duration;let source:AudioBufferSourceNode|OscillatorNode;
   if(layer.tone){const osc=c.createOscillator();osc.frequency.setValueAtTime(layer.hz*pitch,start);osc.frequency.exponentialRampToValueAtTime((layer.end??layer.hz)*pitch,end);source=osc;}
   else{const noise=c.createBufferSource();noise.buffer=this.noise;noise.loop=true;noise.playbackRate.value=pitch;source=noise;}
   const filter=c.createBiquadFilter();filter.type=layer.type??'bandpass';filter.frequency.setValueAtTime(layer.hz*pitch,start);filter.frequency.exponentialRampToValueAtTime((layer.end??layer.hz)*pitch,end);filter.Q.value=.65;
   const gain=c.createGain();gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(layer.gain*volume,start+.002);gain.gain.exponentialRampToValueAtTime(.0001,end);
   source.connect(filter).connect(gain).connect(output);nodes.push(source,filter,gain);sources.push(source);source.onended=()=>{if(--pending===0)cleanup();};source.start(start);source.stop(end+.01);
  }
 }
}
export {ProceduralAudioSystem as AudioSystem};
