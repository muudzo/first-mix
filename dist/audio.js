import {clamp,crossfaderGains,phase,waveform} from './core.js';

export class Deck {
  constructor(engine,id){this.engine=engine;this.id=id;this.track=null;this.buffer=null;this.source=null;this.playing=false;this.offset=0;this.startedAt=0;this.rate=1;this.cue=0;this.loop=0;this.loopStart=0;this.low=0;this.mid=0;this.high=0;this.peaks=[];this.loadGeneration=0;}
  connect(ctx){
    this.lowNode=ctx.createBiquadFilter();this.lowNode.type='lowshelf';this.lowNode.frequency.value=220;
    this.midNode=ctx.createBiquadFilter();this.midNode.type='peaking';this.midNode.frequency.value=1200;this.midNode.Q.value=.7;
    this.highNode=ctx.createBiquadFilter();this.highNode.type='highshelf';this.highNode.frequency.value=5000;
    this.gain=ctx.createGain();this.lowNode.connect(this.midNode).connect(this.highNode).connect(this.gain).connect(this.engine.master);
  }
  get bpm(){return (this.track?.bpm||120)*this.rate;}
  get position(){
    let p=this.offset+(this.playing?Math.max(0,this.engine.ctx.currentTime-this.startedAt)*this.rate:0);
    if(this.loop&&this.buffer){const end=Math.min(this.buffer.duration,this.loopStart+this.loop*60/this.track.bpm);if(end>this.loopStart&&p>=end)p=this.loopStart+(p-this.loopStart)%(end-this.loopStart);}
    return clamp(p,0,this.buffer?.duration||0);
  }
  get beatPhase(){return phase(Math.max(0,this.position-(this.track?.beatOffset||0)),this.track?.bpm||120);}
  stopSource(){if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}}
  async load(track){
    const generation=++this.loadGeneration;
    let data;
    if(track.blob)data=await track.blob.arrayBuffer();
    else{const response=await fetch(track.url);if(!response.ok)throw new Error('Track could not be downloaded. Try again when online.');data=await response.arrayBuffer();}
    const buffer=await this.engine.ctx.decodeAudioData(data);
    if(generation!==this.loadGeneration)return false;
    if(buffer.duration>12*60)throw new Error('Choose a track shorter than 12 minutes for this version.');
    this.pause();this.track=track;this.buffer=buffer;this.offset=0;this.rate=1;this.cue=0;this.loop=0;this.low=0;this.mid=0;this.high=0;
    this.setEQ('low',0);this.setEQ('mid',0);this.setEQ('high',0);this.peaks=track.peaks||waveform(buffer);
    return true;
  }
  play(when=this.engine.ctx.currentTime){
    if(!this.buffer||this.playing)return;
    if(this.offset>=this.buffer.duration-.015)this.offset=0;
    this.stopSource();const source=this.engine.ctx.createBufferSource();source.buffer=this.buffer;source.playbackRate.value=this.rate;
    if(this.loop){source.loop=true;source.loopStart=this.loopStart;source.loopEnd=Math.min(this.buffer.duration,this.loopStart+this.loop*60/this.track.bpm);}
    source.connect(this.lowNode);this.source=source;this.startedAt=when;this.playing=true;
    source.onended=()=>{if(this.source===source){this.offset=this.buffer.duration;this.playing=false;this.source=null;source.disconnect();}};
    source.start(when,this.offset);
  }
  pause(){this.offset=this.position;this.playing=false;this.stopSource();}
  seek(seconds,when){const wasPlaying=this.playing;this.pause();this.offset=clamp(seconds,0,this.buffer?.duration||0);if(wasPlaying)this.play(when);}
  setRate(rate){const p=this.position;this.offset=p;this.startedAt=this.engine.ctx.currentTime;this.rate=clamp(rate,.8,1.2);if(this.source)this.source.playbackRate.setValueAtTime(this.rate,this.engine.ctx.currentTime);}
  setEQ(band,value){this[band]=clamp(value,-24,6);this[band+'Node'].gain.setTargetAtTime(this[band],this.engine.ctx.currentTime,.015);}
  setLoop(beats){
    if(!this.buffer)return;
    const position=this.position, wasPlaying=this.playing;this.pause();
    this.loop=beats===this.loop?0:beats;
    if(this.loop){const beat=60/this.track.bpm,zero=this.track.beatOffset||0;this.loopStart=Math.max(0,zero+Math.floor(Math.max(0,position-zero)/beat)*beat);this.offset=this.loopStart;}
    else this.offset=position;
    if(wasPlaying)this.play();
  }
  returnCue(){this.pause();this.loop=0;this.offset=this.cue;}
  nudge(direction){this.seek(this.position+direction*.025);}
  snapshot(){return {playing:this.playing,bpm:this.bpm,phase:this.beatPhase,loop:this.loop,low:this.low};}
}

export class Mixer {
  constructor(){this.ctx=null;this.decks=[new Deck(this,'A'),new Deck(this,'B')];this.fader=0;this.volume=.7;}
  async enable(){
    if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;this.ctx=new Context({latencyHint:'interactive',sampleRate:44100});this.master=this.ctx.createGain();this.master.gain.value=this.volume*.6;this.limiter=this.ctx.createDynamicsCompressor();this.limiter.threshold.value=-3;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.003;this.limiter.release.value=.1;this.master.connect(this.limiter).connect(this.ctx.destination);this.decks.forEach(d=>d.connect(this.ctx));this.setFader(this.fader);}
    if(this.ctx.state!=='running')await this.ctx.resume();
    if(this.ctx.state!=='running')throw new Error('Tap Enable audio again to allow sound in this browser.');
  }
  setFader(position){this.fader=clamp(position,0,1);if(!this.ctx)return;crossfaderGains(this.fader).forEach((gain,i)=>this.decks[i].gain.gain.setTargetAtTime(gain,this.ctx.currentTime,.012));}
  setVolume(value){this.volume=clamp(value,0,1);if(this.master)this.master.gain.setTargetAtTime(this.volume*.6,this.ctx.currentTime,.015);}
  sync(index){
    const target=this.decks[index],master=this.decks[1-index];if(!target.buffer||!master.buffer)return false;
    const rate=master.bpm/target.track.bpm;if(rate<.8||rate>1.2)throw new Error('These tempos are more than 20% apart. Adjust the other deck first.');
    target.setRate(rate);
    const beat=60/target.track.bpm,zero=target.track.beatOffset||0;
    const base=zero+Math.floor(Math.max(0,target.position-zero)/beat)*beat;
    target.seek(base+master.beatPhase*beat);
    return true;
  }
  pauseAll(){this.decks.forEach(d=>d.pause());}
  snapshot(){return {a:this.decks[0].snapshot(),b:this.decks[1].snapshot(),fader:this.fader};}
}
