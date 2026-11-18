import {Mixer} from './audio.js';
import {lessons,LessonSession,phaseDistance,time,escapeHTML as esc,clamp,waveform} from './core.js';
import {readTracks,saveTrack,deleteTrack,readProgress,saveProgress} from './storage.js';

const $=s=>document.querySelector(s), main=$('#main'), mixer=new Mixer();
let catalog=[], imported=[],completed=readProgress(),session=new LessonSession('decks'),page='studio',filter='all',search='',musicStyle='all',toastTimer,installPrompt,loading=new Set(),preparing=false,enablingPromise;
const modal=$('#modal');
const icons={play:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 3 12 7-12 7z"/></svg>',pause:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h4v14H5zm7 0h4v14h-4z"/></svg>',headphones:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v7h5v-7H4Zm16 0h2v7h-5v-7h3Z"/></svg>',external:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7m0-7-11 11M11 5H4v16h16v-7"/></svg>',plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',art:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 13v6M10 7v18M16 11v10M22 4v24M27 13v6"/></svg>'};
const allTracks=()=>[...catalog,...imported];
const practice=()=>catalog.filter(t=>t.kind==='practice');

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function showModal(html){$('#modal-content').innerHTML=html;modal.showModal();}
function closeModal(){modal.close();}
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();if(e.target.closest('[data-close]'))closeModal();});

function render(){
  page=['studio','learn','library','music'].includes(location.hash.slice(1))?location.hash.slice(1):'studio';
  const names={studio:'Mix studio',learn:'Learn to DJ',library:'Your crate',music:'Music sources'};
  $('#page-name').textContent=names[page];document.title=`${names[page]} — First Mix`;
  document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#progress-count').textContent=`${completed.length} of ${lessons.length} lessons`;
  $('#progress-fill').style.width=`${completed.length/lessons.length*100}%`;
  if(page==='studio')renderStudio();
  if(page==='learn')renderLearn();
  if(page==='library')renderLibrary();
  if(page==='music')renderMusic();
  updateLive();
}

function deckHTML(deck,index){
  const id=deck.id,track=deck.track||practice()[index];
  return `<section class="deck" aria-label="Deck ${id}"><div class="deck-heading"><div class="deck-label"><span class="deck-letter">${id}</span><span id="state-${id}">${deck.playing?'Playing':'Ready when you are'}</span></div><div><button class="deck-load" data-action="grid" data-deck="${index}">Edit grid</button><button class="deck-load" data-action="pick" data-deck="${index}">Load track</button></div></div>
  <div class="track-heading"><div class="track-copy"><h2 class="track-title" title="${esc(track?.title||'Choose a track')}">${esc(track?.title||'Choose a track')}</h2><p class="track-artist">${esc(track?.artist||'Load audio from your crate')}</p></div><div class="bpm"><output id="bpm-${id}">${deck.bpm.toFixed(1)}</output><span>BPM${track?.estimated?' · est.':''}</span></div></div>
  <div class="waveform-wrap"><canvas id="wave-${id}" aria-hidden="true"></canvas><input id="seek-${id}" type="range" min="0" max="${deck.buffer?.duration||track?.duration||1}" step=".01" value="${deck.position}" data-control="seek" data-deck="${index}" aria-label="Seek deck ${id}"></div>
  <div class="wave-time num"><span id="time-${id}" class="elapsed">${time(deck.position)}</span><span id="remaining-${id}">−${time((deck.buffer?.duration||track?.duration||0)-deck.position)}</span></div>
  <div class="transport"><button id="play-${id}" class="button primary play-button" data-action="play" data-deck="${index}" aria-label="${deck.playing?'Pause':'Play'} deck ${id}">${deck.playing?icons.pause:icons.play}<span>${deck.playing?'Pause':'Play'}</span></button><button class="button cue-button" data-action="cue" data-deck="${index}" aria-label="Return to cue on deck ${id}">Cue</button><button class="set-cue" data-action="setcue" data-deck="${index}">Set cue</button></div>
  <div class="tempo-row"><div class="tempo-control"><label class="control-label" for="tempo-${id}">Tempo <output id="rate-${id}">${((deck.rate-1)*100).toFixed(1)}%</output></label><input id="tempo-${id}" type="range" min="80" max="120" step=".05" value="${deck.rate*100}" data-control="tempo" data-deck="${index}" aria-label="Deck ${id} tempo percentage"></div><button class="button sync-button" data-action="sync" data-deck="${index}" aria-label="Sync deck ${id} to the other deck">Sync</button></div>
  <div class="eq-controls">${['low','mid','high'].map(band=>`<div><label class="control-label" for="${band}-${id}">${{low:'Low',mid:'Mid',high:'High'}[band]} <output id="${band}-value-${id}">${deck[band]}<span class="visually-hidden"> dB</span></output></label><input id="${band}-${id}" type="range" min="-24" max="6" step="1" value="${deck[band]}" data-control="eq" data-band="${band}" data-deck="${index}" aria-label="Deck ${id} ${band} EQ in dB"></div>`).join('')}</div>
  <div class="loop-row"><span class="loop-label">Loop <span class="small">/ beats</span></span>${[4,8,16].map(n=>`<button class="loop-button" data-action="loop" data-beats="${n}" data-deck="${index}" aria-pressed="${deck.loop===n}" aria-label="Deck ${id} ${n} beat loop">${n}</button>`).join('')}<button class="nudge-button" data-action="nudge" data-direction="-1" data-deck="${index}" aria-label="Nudge deck ${id} back 25 milliseconds">−</button><button class="nudge-button" data-action="nudge" data-direction="1" data-deck="${index}" aria-label="Nudge deck ${id} forward 25 milliseconds">+</button></div></section>`;
}

function lessonHTML(){
  const l=session.lesson,count=l.steps.length;
  if(session.complete){const next=lessons[lessons.findIndex(x=>x.id===l.id)+1];return `<aside id="lesson-panel" class="lesson-panel" aria-label="Lesson complete"><div class="lesson-kicker"><span>Practice, meet progress.</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></div><h2>You’ve got this.</h2><p class="instruction">${esc(l.title)} is complete. Keep playing, or try ${next?'the next lesson':'the lessons again with a different track'}.</p><div class="progress-track"><span style="width:100%"></span></div><span class="step-count">${count} of ${count} steps complete</span><div class="lesson-why"><h3>Keep your ears in charge</h3><p>Try the same controls without the guide. Confidence comes from hearing what each change does.</p></div><div class="lesson-actions"><button class="text-button restart-lesson" data-action="lesson" data-lesson="${l.id}">Practice again</button>${next?`<button class="button small-button" data-action="lesson" data-lesson="${next.id}">Next lesson</button>`:'<a href="#learn">All lessons</a>'}</div></aside>`;}
  const step=l.steps[session.step];
  return `<aside id="lesson-panel" class="lesson-panel" aria-label="Guided lesson"><div class="lesson-kicker"><span>Learning by doing</span>${icons.headphones}</div><h2>${esc(step.title)}</h2><p class="instruction">${esc(step.instruction)}</p><div class="progress-track"><span style="width:${session.step/count*100}%"></span></div><span class="step-count">Step ${session.step+1} of ${count} · ${esc(l.title)}</span><div class="lesson-why"><h3>Behind the mix</h3><p>${esc(step.why)}</p></div><div class="lesson-actions"><button class="text-button restart-lesson" data-action="lesson" data-lesson="${l.id}">Start over</button><a href="#learn">All lessons</a></div></aside>`;
}

function renderStudio(){
  main.innerHTML=`<div class="page-heading"><div><h1>Mix studio</h1><p>A place to find your rhythm. One blend at a time.</p></div><div class="mode-label">${preparing?'Preparing practice…':'Guided practice'}</div></div><div class="studio-layout"><div class="mixing-workspace"><div class="decks">${mixer.decks.map(deckHTML).join('')}</div><div class="mixer-strip"><div><label class="fader-label" for="crossfader"><span>Deck A</span><strong>Crossfader</strong><span>Deck B</span></label><input class="crossfader" id="crossfader" type="range" min="0" max="1" step=".005" value="${mixer.fader}" data-control="fader" aria-label="Crossfader: left is deck A, right is deck B"><div class="fader-scale"><span>A only</span><span>Blend</span><span>B only</span></div></div><div class="master-control"><label class="control-label" for="master">Master <output id="master-value">${Math.round(mixer.volume*100)}%</output></label><input id="master" type="range" min="0" max="1" step=".01" value="${mixer.volume}" data-control="master" aria-label="Master volume"></div></div><div class="beat-ruler"><div class="beat-lights"><span>A</span>${[0,1,2,3].map(i=>`<span class="beat-light" data-beat="A-${i}"></span>`).join('')}</div><div class="beat-lights"><span>B</span>${[0,1,2,3].map(i=>`<span class="beat-light" data-beat="B-${i}"></span>`).join('')}</div><span id="phase-caption" class="phase-caption">Two tracks. One rhythm.</span></div></div>${lessonHTML()}</div><section class="crate-preview" aria-label="Quick load tracks"><div class="section-heading"><h2>In your crate <span> / ${allTracks().length} tracks</span></h2><a class="text-button" href="#library">Open crate</a></div><div class="track-list">${allTracks().slice(0,4).map(trackRow).join('')}</div><p class="hint">Practice loops are original. Catalog tracks are credited in <a href="#music">Music sources</a>. Tempo changes pitch in this version.</p></section>`;
}

function trackRow(t){return `<div class="track-row"><div class="track-art ${t.kind==='practice'?'house':''}">${icons.art}</div><div class="track-row-copy"><span class="track-row-title">${esc(t.title)}</span><span class="track-row-subtitle">${esc(t.artist)} · ${t.kind==='practice'?'Practice loop':t.kind==='catalog'?`${t.genre} · ${t.license}${t.aiGenerated?' · AI-generated':''}`:'On this device'}</span></div><span class="track-data num">${t.bpm.toFixed(0)} BPM${t.estimated?'*':''}</span><span class="track-data duration num">${time(t.duration)}</span><div class="track-actions">${[0,1].map(i=>`<button class="button ${mixer.decks[i].track?.id===t.id?'loaded':''}" data-action="load" data-track="${esc(t.id)}" data-deck="${i}" aria-label="Load ${esc(t.title)} on deck ${i?'B':'A'}">${i?'B':'A'}</button>`).join('')}${t.blob?`<button class="button delete" data-action="delete" data-track="${esc(t.id)}" aria-label="Remove ${esc(t.title)}">×</button>`:''}</div></div>`;}

function renderLearn(){main.innerHTML=`<div class="page-heading learn-header"><div><h1>A little practice goes a long way.</h1><p>Four short lessons. Real controls. Your first mix starts here.</p></div></div><div class="lessons-list">${lessons.map(l=>`<article class="lesson-card"><div class="topic"><span>${esc(l.topic)}</span><span>${completed.includes(l.id)?'Completed':`${l.minutes} min`}</span></div><h2>${esc(l.title)}</h2><p>${esc(l.summary)}</p><ul>${l.steps.map(s=>`<li>· ${esc(s.title.replace(/\.$/,''))}</li>`).join('')}</ul><button class="button ${!completed.includes(l.id)&&lessons.find(x=>!completed.includes(x.id))?.id===l.id?'primary':''}" data-action="lesson" data-lesson="${l.id}">${completed.includes(l.id)?'Practice again':'Start lesson'}</button></article>`).join('')}</div><p class="hint">Each lesson resets the decks to the original practice tracks. Your progress saves on this device. Use speakers or wired headphones; Bluetooth adds delay.</p>`;}

function filteredTracks(){return allTracks().filter(t=>(filter==='all'||(filter==='mine'?t.kind==='imported':t.kind===filter))&&(musicStyle==='all'||t.collection===musicStyle)&&`${t.title} ${t.artist}`.toLowerCase().includes(search.toLowerCase()));}
function renderLibrary(){main.innerHTML=`<div class="page-heading"><div><h1>Your crate</h1><p>Good tracks. A little curiosity. Everything you need to start.</p></div><button class="button primary" data-action="import">${icons.plus}Import <span>audio</span></button></div><div class="tab-row" role="tablist" aria-label="Track source">${[['all','All tracks'],['practice','Practice'],['catalog','The catalog'],['mine','Your files']].map(([id,name])=>`<button role="tab" data-filter="${id}" aria-selected="${filter===id}">${name}</button>`).join('')}</div><div class="library-toolbar"><input type="search" id="track-search" class="search-box" placeholder="Find a track or artist" aria-label="Search tracks" value="${esc(search)}"><label class="visually-hidden" for="style-filter">Music style</label><select id="style-filter" class="style-select"><option value="all" ${musicStyle==='all'?'selected':''}>All styles</option><option value="house" ${musicStyle==='house'?'selected':''}>House / techno</option><option value="afro" ${musicStyle==='afro'?'selected':''}>Afrobeat / amapiano</option><option value="hiphop" ${musicStyle==='hiphop'?'selected':''}>Hip-hop / R&B</option></select><span id="library-count" class="library-count">${filteredTracks().length} tracks</span></div><div id="library-rows" class="track-list">${libraryRows()}</div><p class="hint">A and B load a track onto that deck. Imported files stay on this device and are never uploaded. Up to 30 MB and 12 minutes per file. * Catalog BPM is an estimate; use your ears and the grid editor. <a href="#music">Track credits & music sources</a>.</p>`;}
function libraryRows(){const rows=filteredTracks();return rows.length?rows.map(trackRow).join(''):'<div class="empty">No tracks here yet. Try a different search, or import an audio file from your iPad.</div>';}

function renderMusic(){main.innerHTML=`<div class="page-heading"><div><h1>More music. More possibilities.</h1><p>A crate you can actually mix. With credit where it belongs.</p></div></div><div class="music-layout"><section class="content-panel prose"><h2>A good place to dig.</h2><p>The shared catalog uses music that permits redistribution and remixing. Start with CC BY tracks and keep the artist, source and license attached.</p>${[['https://www.toucanmusic.com/releases/search/eplicence.php?q=by','Toucan Music','House, electro, trance & breaks · CC BY selection'],['https://ccmixter.org/how-to-attribute-ccmixter-tracks','ccMixter','Remixes, vocals & independent tracks · check each license'],['https://freemusicarchive.org/License_Guide','Free Music Archive','Explore genres · filter by a suitable license']].map(([url,title,subtitle])=>`<a class="source-link" href="${url}" target="_blank" rel="noopener noreferrer"><div><strong>${title}</strong><span>${subtitle}</span></div>${icons.external}</a>`).join('')}<h3>Our starter catalog</h3><div class="credits-list">${catalog.filter(t=>t.kind==='catalog').map(t=>`<div class="credit"><strong>${esc(t.title)}</strong><br>${esc(t.artist)} · <a href="${t.providerUrl}" target="_blank" rel="noopener noreferrer">${esc(t.provider)}</a>${t.extraCredit?`<br>${esc(t.extraCredit)}`:''}${t.aiGenerated?'<br>AI-generated, as disclosed by the artist.':''}<br><a href="${t.source}" target="_blank" rel="noopener noreferrer">Original release</a> · <a href="${t.licenseUrl}" target="_blank" rel="noopener noreferrer">${t.license}</a> · <a href="${t.url}" download>Download track</a><br>Audio file hosted unchanged. Playback can alter tempo and EQ. BPM/grid values are estimates.</div>`).join('')}<div class="credit"><strong>After Hours / Open Water</strong><br>Original synthesized practice loops created for First Mix. No third-party samples. Generated at 120 / 124 BPM. <a href="./assets/MUSIC-CREDITS.txt" target="_blank" rel="noopener">Full credits & license records</a>.</div></div></section><div><section class="content-panel prose"><svg class="spotify-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M6 9c5-2 8-1 12 0m-11 4c4-1 6-1 9 0m-8 3c3-1 4-1 6 0"/></svg><h2>Your Spotify library</h2><p>Spotify mixing is available in selected partner DJ apps. First Mix does not have access to Spotify’s licensed DJ integration.</p><p>The public Spotify API does not permit this app to mix or overlap Spotify audio. A Spotify login alone cannot unlock it.</p><a class="button" href="https://www.algoriddim.com/spotify" target="_blank" rel="noopener noreferrer">Spotify in djay</a><p class="small"><a href="https://newsroom.spotify.com/2025-09-24/dj-software-integration-premium/" target="_blank" rel="noopener noreferrer">Official Spotify DJ availability</a> · <a href="https://developer.spotify.com/policy" target="_blank" rel="noopener noreferrer">Developer policy</a></p></section><section class="content-panel prose" style="margin-top:14px"><h2>Make it your own.</h2><p>Import MP3, WAV or M4A files you’re allowed to use. They save locally in this browser, ready for your next practice session.</p><button class="button" data-action="import">Import a track</button><p class="small">For a shared server catalog, use CC0, CC BY, or direct artist permission covering hosting and mixing. Check each release; “free download” and a standard music purchase do not automatically permit redistribution.</p></section></div></div>`;}

function updateLive(){
  if(page!=='studio')return;
  for(const deck of mixer.decks){const id=deck.id,pos=deck.position,track=deck.track;
    const value=(selector,text)=>{const el=$(selector);if(el&&el.textContent!==String(text))el.textContent=text;};
    value(`#bpm-${id}`,deck.bpm.toFixed(1));value(`#rate-${id}`,`${((deck.rate-1)*100).toFixed(1)}%`);value(`#time-${id}`,time(pos));value(`#remaining-${id}`,`−${time((deck.buffer?.duration||track?.duration||0)-pos)}`);value(`#state-${id}`,loading.has(id)?'Loading track…':deck.playing?'Playing':deck.cue>0?'Cue ready':'Ready when you are');
    for(const band of ['low','mid','high'])value(`#${band}-value-${id}`,`${deck[band]} dB`);
    const seek=$(`#seek-${id}`);if(seek&&document.activeElement!==seek)seek.value=pos;
    const play=$(`#play-${id}`);if(play&&play.dataset.playing!==String(deck.playing)){play.innerHTML=`${deck.playing?icons.pause:icons.play}<span>${deck.playing?'Pause':'Play'}</span>`;play.setAttribute('aria-label',`${deck.playing?'Pause':'Play'} deck ${id}`);play.dataset.playing=String(deck.playing);}
    const beat=Math.floor(Math.max(0,pos-(track?.beatOffset||0))*(track?.bpm||120)/60)%4;
    document.querySelectorAll(`[data-beat^="${id}-"]`).forEach((el,i)=>el.classList.toggle('on',deck.playing&&i===beat));
    document.querySelectorAll(`.loop-button[data-deck="${id==='A'?0:1}"]`).forEach(el=>el.setAttribute('aria-pressed',String(deck.loop===+el.dataset.beats)));
    drawWave(deck);
  }
  const a=mixer.decks[0],b=mixer.decks[1];
  $('#phase-caption').textContent=a.playing&&b.playing?(Math.abs(a.bpm-b.bpm)>.2?'Match the tempos first':phaseDistance(a.beatPhase,b.beatPhase)<.1?'Beats in step':'Try Sync to align the beats'):'Two tracks. One rhythm.';
}

function drawWave(deck){
  const canvas=$(`#wave-${deck.id}`);if(!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width)return;
  const ratio=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(rect.width*ratio)||canvas.height!==Math.round(rect.height*ratio)){canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);}
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const peaks=deck.peaks.length?deck.peaks:deck.track?.peaks||[],duration=deck.buffer?.duration||deck.track?.duration||1;
  const bars=Math.floor(rect.width/4),progress=deck.position/duration;
  for(let i=0;i<bars;i++){const sample=peaks[Math.min(peaks.length-1,Math.floor(i/bars*peaks.length))]||.025;const height=Math.max(3,sample*h*.88);ctx.fillStyle=i/bars<progress?(deck.id==='A'?'#e4ae64':'#e6e6e6'):(deck.id==='A'?'#725a39':'#666');ctx.fillRect(i*w/bars,(h-height)/2,2*ratio,height);}
  const cueX=deck.cue/duration*w;if(deck.cue>0){ctx.fillStyle='#e4ae64';ctx.fillRect(cueX,0,ratio,8*ratio);}
  if(deck.loop&&deck.track){ctx.fillStyle='#e4ae6420';ctx.fillRect(deck.loopStart/duration*w,0,Math.min(deck.loop*60/deck.track.bpm/duration*w,w),h);}
  ctx.fillStyle='#eee';ctx.fillRect(Math.max(0,Math.min(w-2*ratio,progress*w)),0,ratio,h);
}

function receive(event){
  if(preparing||!mixer.ctx)return;
  if(session.receive(event,mixer.snapshot())){
    if(session.complete&&!completed.includes(session.lesson.id)){completed.push(session.lesson.id);if(!saveProgress(completed))toast('Lesson complete. Progress could not be saved in this browser.');else toast('Lesson complete. Nice work behind the decks.');}
    const panel=$('#lesson-panel');if(panel)panel.outerHTML=lessonHTML();$('#progress-count').textContent=`${completed.length} of 4 lessons`;$('#progress-fill').style.width=`${completed.length/4*100}%`;
    const step=session.complete?'Lesson complete':session.lesson.steps[session.step].title;$('#toast').setAttribute('aria-label',step);
  }
}

async function enableAudio(){
  if(enablingPromise)return enablingPromise;
  enablingPromise=prepareAudio();
  try{return await enablingPromise;}finally{enablingPromise=null;}
}
async function prepareAudio(){
  const button=$('#audio-enable');button.disabled=true;
  try{
    await mixer.enable();
    for(let i=0;i<2;i++){const deck=mixer.decks[i];if(!deck.buffer){const track=deck.track||practice()[i];if(track)await deck.load(track);}}
    button.textContent='Pause all';button.classList.remove('primary');
    if(page==='studio'){for(const d of mixer.decks){const seek=$(`#seek-${d.id}`);if(seek)seek.max=d.buffer?.duration||1;}}
  }finally{button.disabled=false;}
}

async function loadDeck(index,track){
  const deck=mixer.decks[index];if(loading.has(deck.id))return;loading.add(deck.id);updateLive();
  try{await mixer.enable();await deck.load(track);$('#audio-enable').textContent='Pause all';$('#audio-enable').classList.remove('primary');toast(`Loaded ${track.title} on deck ${deck.id}`);render();}
  finally{loading.delete(deck.id);updateLive();}
}

async function startLesson(id){
  if(preparing)return;preparing=true;
  try{await mixer.enable();mixer.pauseAll();await Promise.all(mixer.decks.map((d,i)=>d.load(practice()[i])));mixer.setFader(id==='beatmatch'?.5:0);session=new LessonSession(id);location.hash='studio';$('#audio-enable').textContent='Pause all';$('#audio-enable').classList.remove('primary');render();toast('Practice decks reset. Follow the lesson beside your controls.');}
  finally{preparing=false;render();}
}

function chooseTrack(index){showModal(`<h2>Load deck ${index?'B':'A'}</h2><p>Choose the next track from your crate.</p>${allTracks().map(t=>`<div class="track-row"><div class="track-row-copy"><span class="track-row-title">${esc(t.title)}</span><span class="track-row-subtitle">${esc(t.artist)}</span></div><button class="button small-button" data-modal-track="${esc(t.id)}" data-deck="${index}">Load</button></div>`).join('')}<div class="modal-actions"><button class="button" data-close>Close</button></div>`);}

async function performAction(button){
  const action=button.dataset.action,index=+button.dataset.deck,deck=mixer.decks[index];
  if(action==='import'){$('#audio-file').click();return;}
  if(action==='pick'){chooseTrack(index);return;}
  if(action==='grid'){
    const track=deck.track;if(!track)return;
    showModal(`<h2>Deck ${deck.id} beat grid</h2><p>Use the track’s BPM and the time of its first downbeat. Sync and loops follow this grid.</p><form id="grid-form"><label for="grid-bpm">BPM</label><input id="grid-bpm" type="number" min="60" max="200" step=".1" value="${track.bpm}" required><label for="grid-offset">First downbeat (seconds)</label><input id="grid-offset" type="number" min="0" max="${Math.max(0,(track.duration||1)-1)}" step=".01" value="${track.beatOffset||0}" required><p class="small">Saving pauses the deck, releases its loop and resets the tempo adjustment. Grid edits save on this device.</p><p id="grid-error" class="error-message" role="alert"></p><div class="modal-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary" type="submit">Save grid</button></div></form>`);
    $('#grid-form').onsubmit=async event=>{event.preventDefault();try{const edited={...track,bpm:+$('#grid-bpm').value,beatOffset:+$('#grid-offset').value,estimated:false};
      if(edited.blob){await saveTrack(edited);imported=imported.map(t=>t.id===edited.id?edited:t);}
      else{let overrides={};try{overrides=JSON.parse(localStorage.getItem('first-mix-grids')||'{}');}catch{}overrides[edited.id]={bpm:edited.bpm,beatOffset:edited.beatOffset,estimated:false};localStorage.setItem('first-mix-grids',JSON.stringify(overrides));catalog=catalog.map(t=>t.id===edited.id?edited:t);}
      deck.pause();deck.track=edited;deck.loop=0;if(mixer.ctx)deck.setRate(1);closeModal();render();toast('Beat grid saved on this device.');
    }catch(error){$('#grid-error').textContent=error.message||'The grid could not be saved.';}};return;
  }
  if(action==='lesson'){button.disabled=true;try{await startLesson(button.dataset.lesson);}finally{button.disabled=false;}return;}
  if(action==='load'){const track=allTracks().find(t=>t.id===button.dataset.track);if(track)await loadDeck(index,track);return;}
  if(action==='delete'){const track=imported.find(t=>t.id===button.dataset.track);if(!track)return;showModal(`<h2>Remove this track?</h2><p>Remove “${esc(track.title)}” from this device’s crate? Your original file stays where it is. Any deck using it will be paused.</p><div class="modal-actions"><button class="button" data-close>Keep track</button><button class="button primary" id="confirm-delete">Remove track</button></div>`);$('#confirm-delete').onclick=async()=>{try{await deleteTrack(track.id);imported=imported.filter(t=>t.id!==track.id);for(let i=0;i<2;i++)if(mixer.decks[i].track?.id===track.id)await loadDeck(i,practice()[i]);closeModal();render();toast('Removed from this device.');}catch(e){toast(e.message);}};return;}
  if(!deck||loading.has(deck.id)||preparing)return;
  await enableAudio();
  if(action==='play'){if(deck.playing)deck.pause();else deck.play();receive(`play${deck.id}`);}
  if(action==='cue'){deck.returnCue();receive(`cue${deck.id}`);}
  if(action==='setcue'){deck.cue=deck.position;receive(`setCue${deck.id}`);toast(`Deck ${deck.id} cue set at ${time(deck.cue)}`);}
  if(action==='sync'){if(mixer.sync(index)){const tempo=$(`#tempo-${deck.id}`);if(tempo)tempo.value=deck.rate*100;receive(`sync${deck.id}`);toast(`Deck ${deck.id} synced to ${mixer.decks[1-index].bpm.toFixed(1)} BPM`);}}
  if(action==='loop'){deck.setLoop(+button.dataset.beats);receive(`loop${deck.id}`);}
  if(action==='nudge')deck.nudge(+button.dataset.direction);
  updateLive();
}

main.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)performAction(button).catch(e=>toast(e.message||'Something went wrong. Try again.'));const tab=e.target.closest('[data-filter]');if(tab){filter=tab.dataset.filter;renderLibrary();}});
main.addEventListener('change',e=>{if(e.target.id==='style-filter'){musicStyle=e.target.value;$('#library-rows').innerHTML=libraryRows();$('#library-count').textContent=`${filteredTracks().length} tracks`;}});
main.addEventListener('input',async e=>{
  const input=e.target;if(input.id==='track-search'){search=input.value;$('#library-rows').innerHTML=libraryRows();$('#library-count').textContent=`${filteredTracks().length} tracks`;return;}
  const type=input.dataset.control;if(!type)return;
  if(type==='fader'){mixer.setFader(+input.value);receive('crossfade');return;}
  if(type==='master'){mixer.setVolume(+input.value);$('#master-value').textContent=`${Math.round(mixer.volume*100)}%`;return;}
  const deck=mixer.decks[+input.dataset.deck];if(!deck?.buffer||loading.has(deck.id)){if(deck){if(type==='tempo')input.value=deck.rate*100;if(type==='eq')input.value=deck[input.dataset.band];if(type==='seek')input.value=0;}toast('Press Play or Enable audio first.');return;}
  if(type==='tempo')deck.setRate(+input.value/100);
  if(type==='eq'){deck.setEQ(input.dataset.band,+input.value);receive(`eq${deck.id}`);}
  if(type==='seek')deck.seek(+input.value);
  receive('tick');updateLive();
});
modal.addEventListener('click',e=>{const button=e.target.closest('[data-modal-track]');if(button){closeModal();loadDeck(+button.dataset.deck,allTracks().find(t=>t.id===button.dataset.modalTrack)).catch(e=>toast(e.message));}});

$('#audio-enable').addEventListener('click',()=>{if(mixer.ctx?.state==='running'){mixer.pauseAll();updateLive();toast('Both decks paused.');}else enableAudio().then(()=>toast('Audio is ready. Press Play on a deck.')).catch(e=>toast(e.message));});

$('#audio-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;if(file.size>30*1024*1024){e.target.value='';toast('Choose an audio file smaller than 30 MB.');return;}
  // Snapshot bytes before clearing the picker: WebKit can revoke access to a selected File.
  let fileData;try{fileData=await file.arrayBuffer();}catch{toast('The selected file could not be read. Choose it again.');return;}
  const storedBlob=new Blob([fileData],{type:file.type||'application/octet-stream'});e.target.value='';
  showModal(`<h2>Add to your crate</h2><p>${esc(file.name)}</p><form id="import-form"><label for="import-title">Track name</label><input id="import-title" value="${esc(file.name.replace(/\.[^.]+$/,''))}" required maxlength="100"><label for="import-artist">Artist</label><input id="import-artist" placeholder="Your artist name" maxlength="100"><label for="import-bpm">BPM (manual)</label><input id="import-bpm" type="number" min="60" max="200" step=".1" value="120" required><p class="small">Enter the track’s tempo. The first beat is assumed to be at 0:00; use Edit grid after loading to adjust it. Files stay on this device.</p><p id="import-error" class="error-message" role="alert"></p><div class="modal-actions"><button type="button" class="button" data-close>Cancel</button><button type="submit" class="button primary">Add track</button></div></form>`);
  $('#import-form').onsubmit=async event=>{event.preventDefault();const submit=event.target.querySelector('[type=submit]');submit.disabled=true;submit.textContent='Reading audio…';let stage='decode';
    try{await mixer.enable();const buffer=await mixer.ctx.decodeAudioData(fileData.slice(0));if(buffer.duration>720)throw new Error('Choose a track shorter than 12 minutes.');
      const track={id:crypto.randomUUID(),title:$('#import-title').value.trim()||file.name,artist:$('#import-artist').value.trim()||'Your collection',bpm:clamp(+$('#import-bpm').value,60,200),beatOffset:0,duration:buffer.duration,kind:'imported',blob:storedBlob,peaks:waveform(buffer)};
      stage='save';await saveTrack(track);imported.push(track);closeModal();location.hash='library';filter='mine';render();toast(`Added ${track.title}. Saved on this device.`);
    }catch(error){$('#import-error').textContent=error?.name==='QuotaExceededError'?'Not enough browser storage. Remove an imported track and try again.':error?.message||(stage==='save'?'This browser could not save the audio file. Free some device storage and try again.':'This audio format could not be decoded. Try MP3, WAV or M4A.');submit.disabled=false;submit.textContent='Add track';}
  };
});

function installInstructions(){if(installPrompt){installPrompt.prompt();installPrompt.userChoice.then(()=>{installPrompt=null;});return;}showModal('<h2>Take the studio with you.</h2><p>On iPad, open this site in <strong>Safari</strong>, then:</p><ol><li>Tap the Share button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Turn on <strong>Open as Web App</strong> if shown, then tap Add.</li></ol><p>Open First Mix from its new icon. Once the offline status says “Ready offline,” the practice tracks and app work without a connection. Catalog tracks become available offline after you load them.</p><p class="small">On desktop, look for Install in your browser’s address bar or app menu. Browser storage can be cleared by the device; keep your original audio files.</p><div class="modal-actions"><button class="button primary" data-close>Got it</button></div>');}
document.querySelectorAll('.install-action').forEach(b=>b.onclick=installInstructions);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
$('#shortcuts').onclick=()=>showModal('<h2>Keep your hands on the mix.</h2><ul><li><kbd>A</kbd> Play / pause deck A</li><li><kbd>B</kbd> Play / pause deck B</li><li><kbd>Space</kbd> Pause both decks</li><li><kbd>←</kbd> / <kbd>→</kbd> Move the crossfader</li></ul><p class="small">Shortcuts are active in the studio when you aren’t typing or adjusting a control. Each slider also supports arrow keys when focused.</p><div class="modal-actions"><button class="button" data-close>Close</button></div>');
window.addEventListener('keydown',e=>{if(page!=='studio'||modal.open||e.metaKey||e.ctrlKey||e.altKey||['INPUT','TEXTAREA','BUTTON','SELECT'].includes(document.activeElement?.tagName))return;if(e.code==='Space'){e.preventDefault();mixer.pauseAll();updateLive();}if(e.key.toLowerCase()==='a'||e.key.toLowerCase()==='b'){e.preventDefault();performAction({dataset:{action:'play',deck:e.key.toLowerCase()==='a'?'0':'1'}}).catch(e=>toast(e.message));}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();mixer.setFader(mixer.fader+(e.key==='ArrowRight'?.05:-.05));const input=$('#crossfader');if(input)input.value=mixer.fader;receive('crossfade');}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mixer.ctx){mixer.pauseAll();updateLive();}});

async function setupOffline(){
  if(!('serviceWorker'in navigator)||!isSecureContext)return;
  try{const registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('#offline-status').textContent='Ready offline';
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){toast('An app update is ready. Close and reopen First Mix when you finish your session.');}});});
  }catch{$('#offline-status').textContent='Online only';}
}

async function boot(){
  try{const response=await fetch('./catalog.json');if(!response.ok)throw new Error('Could not load the music catalog. Reload when online.');catalog=await response.json();
    try{const overrides=JSON.parse(localStorage.getItem('first-mix-grids')||'{}');catalog=catalog.map(t=>({...t,...overrides[t.id]}));}catch{}
    try{imported=await readTracks();}catch{toast('Local file storage is unavailable. Practice tracks still work.');}
    mixer.decks.forEach((deck,i)=>{deck.track=practice()[i];deck.peaks=deck.track?.peaks||[];});render();setupOffline();
  }catch(e){main.innerHTML=`<h1>Let’s try that again.</h1><p class="hint">${esc(e.message)}</p><button class="button primary" id="retry-boot">Retry</button>`;$('#retry-boot').onclick=boot;}
}
setInterval(()=>{updateLive();if(page==='studio')receive('tick');},80);
boot();
