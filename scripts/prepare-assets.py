"""Reproducible original practice audio, PWA icons, and catalog metadata.

The two CC BY catalog MP3s must already be in dist/assets. Their bytes are not changed.
Requires Python 3 and ffmpeg/ffprobe; no Python packages.
"""
from pathlib import Path
import array, hashlib, json, math, random, struct, subprocess, wave, zlib

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'dist' / 'assets'
ASSETS.mkdir(exist_ok=True, parents=True)

def synth(filename, bpm, root, variation):
    rng = random.Random(42 + variation)
    rate = 22050
    duration = 128 * 60 / bpm
    samples = array.array('h')
    for i in range(round(duration * rate)):
        t = i / rate
        beats = t * bpm / 60
        beat = int(beats)
        p = (beats - beat) * 60 / bpm
        kick = math.sin(2 * math.pi * (49 * p + 1.8 * (1 - math.exp(-p * 40)))) * math.exp(-p * 18)
        hat_phase = (beats * 2 % 1) * 30 / bpm
        hat = (rng.random() * 2 - 1) * math.exp(-hat_phase * 100) * .12
        clap = (rng.random() * 2 - 1) * math.exp(-p * 38) * .18 if beat % 4 in (1, 3) else 0
        note = [0, 0, 7, 3][(beat // 8) % 4]
        freq = root * 2 ** (note / 12)
        bass_phase = ((beats + .5) % 1) * 60 / bpm
        bass = (.19 * math.sin(2 * math.pi * freq * t) + .07 * math.sin(4 * math.pi * freq * t)) * math.exp(-bass_phase * 6) * min(1, bass_phase * 90)
        chord_phase = ((beats + .5) % 2) * 60 / bpm
        chord = sum(math.sin(2 * math.pi * root * 4 * 2 ** (n / 12) * t) for n in (0, 3, 7)) * .038 * math.exp(-chord_phase * 3) * min(1, chord_phase * 70)
        arp_note = [0, 7, 12, 15, 7, 3, 10, 7][int(beats * 2) % 8]
        arp = math.sin(2 * math.pi * root * 4 * 2 ** (arp_note / 12) * t) * math.exp(-hat_phase * 24) * (.045 if variation else .025)
        value = (kick * .47 + hat + clap + bass + chord + arp) * .82
        samples.append(round(max(-.98, min(.98, value)) * 32767))
    with wave.open(str(ASSETS / filename), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate); f.writeframes(samples.tobytes())
    return duration

def inspect_audio(filename):
    path = ASSETS / filename
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'quiet', '-show_format', '-of', 'json', str(path)]))
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', '11025', '-'])
    samples = array.array('f'); samples.frombytes(raw)
    size = math.ceil(len(samples) / 420)
    peaks = [round(max((abs(x) for x in samples[i*size:(i+1)*size]), default=0), 3) for i in range(420)]
    # A simple offline onset autocorrelation gives an editable, explicitly estimated tempo.
    hop = 110
    energy = [sum(x*x for x in samples[i:i+hop])/hop for i in range(0, len(samples), hop)]
    onset = [max(0, energy[i] - energy[i-1]) for i in range(1, len(energy))]
    onset = onset[3000:min(len(onset), 15000)]
    fps = 11025 / hop
    scores = {}
    for lag in range(round(fps*60/150), round(fps*60/108)+1):
        scores[lag] = sum(onset[i] * onset[i-lag] for i in range(lag, len(onset))) / max(1, len(onset)-lag)
    lag = max(scores, key=scores.get)
    estimate = round(fps * 60 / lag)
    return float(info['format']['duration']), peaks, estimate

def png_icon(size):
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            fx=x/size*512;fy=y/size*512
            ink=False
            for cx,top,bottom in [(136,226,286),(196,166,346),(256,196,316),(316,136,376),(376,226,286)]:
                cy=max(top,min(bottom,fy))
                if (fx-cx)**2+(fy-cy)**2<=15**2:ink=True
            row.extend((228,174,100,255) if ink else (17,17,17,255))
        rows.append(bytes(row))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
    (ASSETS/f'icon-{size}.png').write_bytes(data)

catalog=[]
for filename,title,bpm,root,var in [('after-hours.wav','After Hours',120,55,0),('open-water.wav','Open Water',124,55,1)]:
    if not (ASSETS/filename).exists():synth(filename,bpm,root,var)
    duration,peaks,_=inspect_audio(filename)
    catalog.append(dict(id=filename,title=title,artist='First Mix originals',bpm=bpm,duration=duration,beatOffset=0,url='./assets/'+filename,peaks=peaks,kind='practice',collection='house',genre='House'))

licenses=[]
for filename,title,artist,release,download in [
    ('lost-the-plot.mp3','Lost The Plot','Beat Doctor','tou253',280),
    ('world-of-fantasy.mp3','World of Fantasy (Beat Doctor remix)','Psychadelik Pedestrian','tou272',338)
]:
    if not (ASSETS/filename).exists():continue
    duration,peaks,bpm=inspect_audio(filename)
    track=dict(id=filename,title=title,artist=artist,bpm=bpm,estimated=True,duration=duration,beatOffset=0,url='./assets/'+filename,peaks=peaks,kind='catalog',source='https://www.toucanmusic.com/releases/'+release,provider='Toucan Music',providerUrl='https://www.toucanmusic.com',collection='house',genre='Electro house' if release=='tou253' else 'House',license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/')
    catalog.append(track)
    licenses.append(dict(title=title,artist=artist,credit='Toucan Music',release=track['source'],download='https://www.toucanmusic.com/ccount/click.php?id='+str(download),license=track['license'],licenseUrl=track['licenseUrl'],verifiedOn='2026-11-18',file=filename,sha256=hashlib.sha256((ASSETS/filename).read_bytes()).hexdigest(),modifications='File bytes unchanged; the app permits real-time tempo, loop and EQ changes.'))
    print(title, 'estimated BPM:',bpm)

for filename,title,artist,slug,file_url,collection,genre,ai,bpm in [
    ('afrobeat.mp3','Afrobeat','Alex Morgan','alex-morgan/pop-afro-party-instrumentals/afrobeat-1','WC9pchdl5zADdeoiIl3H7WmUDAMAmHORGpiWSFNG', 'afro','Afrobeat',True,108),
    ('hot-amapiano-beats.mp3','Hot Amapiano Beats','Alex Morgan','alex-morgan/pop-afro-party-instrumentals/hot-amapiano-beats','cUcs6uMOXcjxxrLW0btTwHzwF1kK9Ga4LxlZzfAd','afro','Amapiano',True,123),
    ('scatter.mp3','Scatter','1000 Handz','1000-handz/cc-by-free-to-use-melodic-rap-instrumentals-vol-2/scatter-2','b8r6D0NgiE66xfw5a4qvJN4hjL9HJGbz6q952gYJ','hiphop','Hip-hop',False,None)
]:
    if not (ASSETS/filename).exists():continue
    duration,peaks,estimated=inspect_audio(filename)
    if bpm is None:
        # Rap can be half-time; the rough estimate remains editable in the UI.
        bpm=estimated/2 if estimated>=140 else estimated
    source='https://freemusicarchive.org/music/'+slug+'/'
    track=dict(id=filename,title=title,artist=artist,bpm=bpm,estimated=True,duration=duration,beatOffset=0,url='./assets/'+filename,peaks=peaks,kind='catalog',source=source,provider='Free Music Archive',providerUrl='https://freemusicarchive.org',collection=collection,genre=genre,aiGenerated=ai,license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/')
    if artist=='1000 Handz':track['extraCredit']='1000Handz.com — https://1000handz.com'
    catalog.append(track)
    licenses.append(dict(title=title,artist=artist,credit=track.get('extraCredit','Alex Morgan / Free Music Archive'),release=source,download='https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/'+file_url+'.mp3',license=track['license'],licenseUrl=track['licenseUrl'],verifiedOn='2026-11-18',file=filename,sha256=hashlib.sha256((ASSETS/filename).read_bytes()).hexdigest(),aiGenerated=ai,modifications='File bytes unchanged; the app permits real-time tempo, loop and EQ changes.'))
    print(title,'BPM (editable estimate):',bpm)

(ROOT/'dist'/'catalog.json').write_text(json.dumps(catalog,separators=(',',':'))+'\n')
(ASSETS/'licenses.json').write_text(json.dumps(licenses,indent=2)+'\n')
for size in (192,512):png_icon(size)
print('Prepared',len(catalog),'tracks and PWA icons.')
