import test from 'node:test';
import assert from 'node:assert/strict';
import {crossfaderGains,phase,phaseDistance,LessonSession,waveform,escapeHTML} from '../dist/core.js';
import {Mixer} from '../dist/audio.js';
const state=()=>({a:{playing:false,bpm:120,phase:0,loop:0,low:0},b:{playing:false,bpm:124,phase:0,loop:0,low:0},fader:0});

test('equal-power crossfade isolates endpoints and maintains power throughout the blend',()=>{
  for(let step=0;step<=100;step++){const [a,b]=crossfaderGains(step/100);assert.ok(Math.abs(a*a+b*b-1)<1e-10);}
  assert.deepEqual(crossfaderGains(0),[1,0]);assert.ok(crossfaderGains(1)[0]<1e-10);assert.equal(crossfaderGains(1)[1],1);
  assert.deepEqual(crossfaderGains(-5),[1,0]);assert.deepEqual(crossfaderGains(NaN),[1,0]);
});
test('beat phase handles wraparound',()=>{assert.equal(phase(1.25,120),.5);assert.ok(Math.abs(phaseDistance(.99,.01)-.02)<1e-10);});
test('transport lesson requires real ordered events',()=>{
  const l=new LessonSession('decks'),s=state();assert.equal(l.receive('setCueA',s),false);s.a.playing=true;assert.equal(l.receive('playA',s),true);assert.equal(l.step,1);assert.equal(l.receive('tick',s),false);assert.equal(l.receive('setCueA',s),true);assert.equal(l.receive('cueA',s),false);s.a.playing=false;assert.equal(l.receive('cueA',s),true);assert.equal(l.complete,true);assert.equal(l.receive('cueA',s),false);
});
test('beatmatch lesson rejects mismatched tempo and beat phase',()=>{
  const l=new LessonSession('beatmatch'),s=state();s.a.playing=s.b.playing=true;assert.ok(l.receive('tick',s));assert.equal(l.receive('tick',s),false);s.b.bpm=120.1;assert.ok(l.receive('tick',s));s.b.phase=.4;assert.equal(l.receive('syncB',s),false);s.b.phase=.01;assert.ok(l.receive('syncB',s));assert.ok(l.complete);
});
test('transition cannot complete by moving a fader with paused decks or skipping the blend',()=>{
  const l=new LessonSession('transition'),s=state();s.fader=1;assert.equal(l.receive('crossfade',s),false);s.a.playing=true;s.fader=0;assert.ok(l.receive('playA',s));s.b.playing=true;s.b.bpm=120;assert.ok(l.receive('syncB',s));s.fader=1;assert.equal(l.receive('crossfade',s),false);s.fader=.5;assert.ok(l.receive('crossfade',s));s.fader=1;assert.ok(l.receive('crossfade',s));assert.ok(l.complete);
});
test('loop and EQ lesson requires audible loop and bass reduction together',()=>{
  const l=new LessonSession('eq'),s=state();s.a.loop=8;assert.equal(l.receive('loopA',s),false);s.a.playing=true;assert.ok(l.receive('loopA',s));s.b.low=-12;assert.ok(l.receive('eqB',s));s.fader=.5;assert.equal(l.receive('crossfade',s),false);s.b.playing=true;assert.ok(l.receive('playB',s));assert.ok(l.complete);
});
test('waveforms use actual peak samples and untrusted titles are escaped',()=>{
  assert.deepEqual(waveform({getChannelData:()=>new Float32Array([0,.5,-1,0])},2),[.5,1]);assert.equal(escapeHTML('<img onerror="bad">'), '&lt;img onerror=&quot;bad&quot;&gt;');
});

class Param{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}}
class Node{constructor(){for(const name of ['gain','frequency','Q','playbackRate','threshold','knee','ratio','attack','release'])this[name]=new Param();}connect(node){return node;}disconnect(){}start(when,offset){this.when=when;this.offset=offset;}stop(){this.stopped=true;}}
class Context{constructor(){this.currentTime=0;this.state='running';this.destination=new Node();}createGain(){return new Node();}createDynamicsCompressor(){return new Node();}createBiquadFilter(){return new Node();}createBufferSource(){return new Node();}async resume(){this.state='running';}}
globalThis.window={AudioContext:Context};
async function makeMixer(){const m=new Mixer();await m.enable();for(const d of m.decks){d.track={bpm:120,beatOffset:0};d.buffer={duration:60};}return m;}
test('audio transport preserves position over pause, resume and tempo changes',async()=>{
  const m=await makeMixer(),d=m.decks[0];d.play();m.ctx.currentTime=2;assert.equal(d.position,2);d.setRate(1.1);m.ctx.currentTime=3;assert.equal(d.position,3.1);d.pause();m.ctx.currentTime=8;assert.equal(d.position,3.1);d.play();m.ctx.currentTime=9;assert.equal(d.position,4.2);d.cue=1.25;d.returnCue();assert.equal(d.position,1.25);assert.equal(d.playing,false);
});
test('loop position wraps and releasing it continues from the audible position',async()=>{
  const m=await makeMixer(),d=m.decks[0];d.offset=1.7;d.play();d.setLoop(4);assert.equal(d.loopStart,1.5);m.ctx.currentTime=3;assert.equal(d.position,2.5);d.setLoop(4);assert.equal(d.loop,0);assert.equal(d.position,2.5);
});
test('sync matches tempo and phase, and rejects rates outside its supported range',async()=>{
  const m=await makeMixer(),a=m.decks[0],b=m.decks[1];a.offset=1.25;b.track.bpm=124;b.offset=8;a.play();b.play();m.sync(1);assert.ok(Math.abs(b.bpm-a.bpm)<1e-10);assert.ok(phaseDistance(a.beatPhase,b.beatPhase)<1e-10);b.track.bpm=200;assert.throws(()=>m.sync(1),/20% apart/);
});
