import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium,webkit}=await import(process.env.FIRSTMIX_PLAYWRIGHT||'playwright');
const base=process.env.FIRSTMIX_URL||'http://127.0.0.1:4173';
mkdirSync('artifacts/browser',{recursive:true});
const results=[];
for(const [name,type]of [['chromium',chromium],['webkit',webkit]]){
  if(process.env.FIRSTMIX_BROWSERS&&!process.env.FIRSTMIX_BROWSERS.split(',').includes(name))continue;
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base);await page.getByRole('heading',{name:'Mix studio',exact:true}).waitFor();
    await page.getByRole('button',{name:'Enable audio',exact:true}).click();
    await page.getByRole('button',{name:'Play deck A',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#time-A').textContent!=='00:00');
    assert.equal(await page.locator('#state-A').textContent(),'Playing');
    await page.locator('[data-action=setcue][data-deck="0"]').click();
    await page.getByRole('button',{name:'Return to cue on deck A',exact:true}).click();
    await page.getByRole('heading',{name:'You’ve got this.'}).waitFor();
    await page.reload();await page.waitForFunction(()=>document.querySelector('#progress-count').textContent==='1 of 4 lessons');
    await page.goto(base+'/#library');
    await page.locator('#style-filter').selectOption('afro');assert.equal(await page.locator('#library-rows .track-row').count(),2);
    await page.getByText('Hot Amapiano Beats',{exact:true}).waitFor();
    await page.locator('#style-filter').selectOption('hiphop');assert.equal(await page.locator('#library-rows .track-row').count(),1);
    await page.getByText('Scatter',{exact:true}).waitFor();await page.locator('#style-filter').selectOption('all');
    await page.goto(base+'/#learn');await page.locator('[data-lesson=beatmatch]').click();
    await page.getByRole('button',{name:'Play deck A',exact:true}).click();
    await page.getByRole('button',{name:'Play deck B',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#lesson-panel h2').textContent==='Match their speed.');
    await page.locator('#tempo-B').evaluate(el=>{el.value=String(120/124*100);el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>document.querySelector('#lesson-panel h2').textContent==='Bring the beats in line.');
    await page.getByRole('button',{name:'Sync deck B to the other deck',exact:true}).click();
    await page.getByRole('heading',{name:'You’ve got this.'}).waitFor();
    await page.getByRole('button',{name:'Pause all',exact:true}).click();
    // Import actual bytes and verify persistence after a reload.
    await page.locator('#audio-file').setInputFiles('dist/assets/after-hours.wav');
    await page.locator('#import-title').fill('My saved practice track');
    await page.getByRole('button',{name:'Add track',exact:true}).click();
    await page.getByText('My saved practice track',{exact:true}).waitFor();
    await page.reload();await page.getByText('My saved practice track',{exact:true}).waitFor();
    await page.locator('#track-search').fill('does-not-exist');
    await page.getByText('No tracks here yet.',{exact:false}).waitFor();
    await page.locator('#track-search').fill('');
    await page.getByRole('button',{name:'Load My saved practice track on deck A',exact:true}).click();
    await page.goto(base+'/#studio');
    await page.locator('.deck [data-action=grid][data-deck="0"]').click();
    await page.locator('#grid-bpm').fill('121');await page.locator('#grid-offset').fill('0.25');
    await page.getByRole('button',{name:'Save grid',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#bpm-A').textContent==='121.0');
    // A real OfflineAudioContext verifies audio, EQ and the two-deck signal graph.
    const audio=await page.evaluate(async()=>{
      const {Mixer}=await import('./audio.js');
      async function render(position,low=0){const m=new Mixer();m.ctx=new OfflineAudioContext(2,44100*2,44100);m.master=m.ctx.createGain();m.master.gain.value=.4;m.master.connect(m.ctx.destination);m.decks.forEach(d=>d.connect(m.ctx));await Promise.all(m.decks.map((d,i)=>d.load({bpm:120,url:i?'./assets/open-water.wav':'./assets/after-hours.wav'})));m.decks[0].setEQ('low',low);m.setFader(position);m.decks.forEach(d=>d.play());const b=await m.ctx.startRendering();const data=b.getChannelData(0);return {rms:Math.sqrt(data.reduce((s,v)=>s+v*v,0)/data.length),samples:Array.from(data.slice(20000,20100))};}
      return {a:await render(0),b:await render(1),blend:await render(.5),eq:await render(0,-24)};
    });
    assert.ok(audio.a.rms>.01&&audio.b.rms>.01&&audio.blend.rms>.01);
    assert.notDeepEqual(audio.a.samples,audio.b.samples);assert.ok(audio.eq.rms<audio.a.rms);
    if(name==='chromium'){
      const decoded=await page.evaluate(async()=>{const catalog=await(await fetch('./catalog.json')).json(),ctx=new OfflineAudioContext(1,1,44100),result=[];for(const track of catalog.filter(t=>t.kind==='catalog')){const bytes=await(await fetch(track.url)).arrayBuffer();const buffer=await ctx.decodeAudioData(bytes);result.push({title:track.title,duration:buffer.duration});}return result;});
      assert.equal(decoded.length,5);assert.ok(decoded.every(t=>t.duration>60));
      await page.waitForFunction(()=>document.querySelector('#offline-status').textContent==='Ready offline');
      await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Mix studio',exact:true}).waitFor();
      await page.getByRole('button',{name:'Play deck A',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#time-A').textContent!=='00:00');
      await context.setOffline(false);
    }
    for(const [width,height]of [[1440,900],[1024,768],[768,1024],[390,844]]){
      await page.setViewportSize({width,height});await page.screenshot({path:`artifacts/browser/${name}-${width}.png`,fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: horizontal overflow at ${width}`);
    }
    assert.deepEqual(errors,[]);
    results.push({browser:name,passed:true,audioRMS:audio.a.rms,errors});
  }catch(error){await page.screenshot({path:`artifacts/browser/${name}-failure.png`,fullPage:true});console.error(name,JSON.stringify({error:error.message,errors,url:page.url(),body:await page.locator('body').innerText(),storage:await page.evaluate(async()=>{try{const {readTracks}=await import('./storage.js');return(await readTracks()).map(t=>({id:t.id,title:t.title,bpm:t.bpm,hasBlob:!!t.blob}));}catch(e){return e.message;}})}));throw error;}finally{await context.close();await browser.close();}
}
writeFileSync('artifacts/browser/results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
