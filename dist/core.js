export const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
export const crossfaderGains = position => {
  const angle = clamp(position, 0, 1) * Math.PI / 2;
  return [Math.cos(angle), Math.sin(angle)];
};
export const phase = (seconds, bpm) => ((Math.max(0, seconds) * bpm / 60) % 1);
export const phaseDistance = (a, b) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
export const time = seconds => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
export const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export const lessons = [
  { id:'decks', title:'Meet your decks', minutes:3, topic:'The essentials', summary:'Press play, find the beat, and mark your starting point.', steps:[
    {title:'Start with a beat.', instruction:'Press Play on deck A. Listen for the kick drum landing on each beat.', why:'Each deck is a music player. Two decks let you prepare the next song while the first one plays.', test:(e,s)=>e==='playA'&&s.a.playing},
    {title:'Save a starting point.', instruction:'While A plays, press Set cue to save this position.', why:'A cue is a bookmark. A clear downbeat makes your next start predictable.', test:(e,s)=>e==='setCueA'&&s.a.playing},
    {title:'Find your way back.', instruction:'Press Cue on deck A to return to your bookmark and pause.', why:'Cue gets you back to a known point, ready to start the track again.', test:(e,s)=>e==='cueA'&&!s.a.playing}
  ]},
  { id:'beatmatch', title:'Get the beats together', minutes:5, topic:'Beatmatching', summary:'Match two tempos. Turn two kick drums into one rhythm.', steps:[
    {title:'Hear the difference.', instruction:'Press Play on both decks. Listen for their kicks drifting apart.', why:'The practice tracks start at 120 and 124 BPM. B’s beats arrive a little faster.', test:(e,s)=>s.a.playing&&s.b.playing},
    {title:'Match their speed.', instruction:'Move B’s tempo slider until its BPM matches A within 0.2 BPM.', why:'Matching tempo stops the drift. It does not yet align the starting points.', test:(e,s)=>s.a.playing&&s.b.playing&&Math.abs(s.a.bpm-s.b.bpm)<=.2},
    {title:'Bring the beats in line.', instruction:'Press Sync on deck B while both tracks play.', why:'Sync matches the tempo and beat phase using the track’s BPM and first-beat position.', test:(e,s)=>e==='syncB'&&s.a.playing&&s.b.playing&&phaseDistance(s.a.phase,s.b.phase)<.08}
  ]},
  { id:'transition', title:'Your first transition', minutes:5, topic:'The blend', summary:'Bring the next track in. Let it take over without losing the flow.', steps:[
    {title:'Let A lead.', instruction:'Play A and move the crossfader all the way left.', why:'Left is deck A; right is deck B. A track can play silently while the fader is on the other side.', test:(e,s)=>s.a.playing&&s.fader<=.03},
    {title:'Prepare the next track.', instruction:'Start B, then press B’s Sync button while A keeps playing.', why:'B is ready for the blend. This version sends both decks to the main output, with no separate headphone cue.', test:(e,s)=>e==='syncB'&&s.a.playing&&s.b.playing&&Math.abs(s.a.bpm-s.b.bpm)<=.2},
    {title:'Find the middle.', instruction:'Slowly move the crossfader to the middle while both decks play.', why:'At the center, both decks are about −3 dB. Listen for a continuous rhythm.', test:(e,s)=>e==='crossfade'&&s.a.playing&&s.b.playing&&s.fader>=.4&&s.fader<=.6},
    {title:'Hand it over.', instruction:'Keep B playing and move the crossfader all the way right.', why:'B now carries the mix. A is free for your next track.', test:(e,s)=>e==='crossfade'&&s.b.playing&&s.fader>=.97}
  ]},
  { id:'eq', title:'Leave room for the bass', minutes:4, topic:'Loops & EQ', summary:'Hold a phrase. Keep two bass lines from competing.', steps:[
    {title:'Hold the groove.', instruction:'Play A, then choose an 8-beat loop on deck A.', why:'Eight beats make two bars in 4/4. A loop buys you time before a transition.', test:(e,s)=>s.a.playing&&s.a.loop===8},
    {title:'Make some space.', instruction:'Move B’s Low EQ to −12 dB or below.', why:'Two strong bass lines can compete. Cut the incoming bass to leave room for the outgoing track.', test:(e,s)=>e==='eqB'&&s.b.low<=-12},
    {title:'Bring B into the mix.', instruction:'Play B and blend to the middle. Keep B’s bass reduced and A’s loop running.', why:'Listen for an uncluttered low end. In a full transition, swap the bass lines at the start of a phrase.', test:(e,s)=>s.a.playing&&s.b.playing&&s.a.loop===8&&s.b.low<=-12&&s.fader>=.4&&s.fader<=.6}
  ]}
];

export class LessonSession {
  constructor(id, step=0) { this.lesson=lessons.find(l=>l.id===id)||lessons[0]; this.step=clamp(step,0,this.lesson.steps.length); }
  get complete() { return this.step>=this.lesson.steps.length; }
  receive(event,state) { if(this.complete||!this.lesson.steps[this.step].test(event,state))return false; this.step++; return true; }
}

export function waveform(buffer, bins=420) {
  const samples=buffer.getChannelData(0), size=Math.ceil(samples.length/bins), peaks=[];
  for(let b=0;b<bins;b++){let peak=0;for(let i=b*size;i<Math.min(samples.length,(b+1)*size);i++)peak=Math.max(peak,Math.abs(samples[i]));peaks.push(peak);}
  return peaks;
}
