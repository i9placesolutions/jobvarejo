"""Biblioteca original de síntese: não contém amostras extraídas do CapCut."""
import hashlib
import json
import math
import sys
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parents[2] / 'public/video-studio/audio'
SFX = {'air-swipe': .42, 'whip': .24, 'suction': .55, 'riser': .8,
       'bass-hit': .7, 'metal-hit': .7, 'pop': .18, 'snap': .16,
       'coin': .6, 'sparkle': .8, 'glitch': .3, 'boom': .85}


def effect(name, t, duration, rng):
    noise = rng.uniform(-1, 1)
    p = t / duration
    if name in ('air-swipe', 'whip', 'suction', 'riser'):
        peak = {'air-swipe': .42, 'whip': .25, 'suction': .85, 'riser': .92}[name]
        env = math.exp(-((p - peak) / (.19 if name == 'whip' else .3)) ** 2)
        tone = math.sin(2 * math.pi * (180*t + (1200 if name in ('riser', 'suction') else -120)*t*t))
        return env * (noise*.28 + tone*.14)
    if name in ('bass-hit', 'boom'):
        decay = 6 if name == 'boom' else 10
        return .6*math.sin(2*math.pi*(43*t+3*(1-math.exp(-t*32))))*math.exp(-t*decay)+noise*.18*math.exp(-t*20)
    if name == 'metal-hit':
        return sum(math.sin(2*math.pi*freq*t)*math.exp(-t*(8+i*4))*.12 for i, freq in enumerate([179, 487, 971, 1739])) + noise*.07*math.exp(-t*80)
    if name in ('pop', 'snap'):
        return .45*math.sin(2*math.pi*(350*t+2*(1-math.exp(-t*90))))*math.exp(-t*45)+(noise*.25*math.exp(-t*100) if name == 'snap' else 0)
    if name in ('coin', 'sparkle'):
        return sum(.13*math.sin(2*math.pi*freq*max(0,t-i*.045))*math.exp(-max(0,t-i*.045)*12) if t>=i*.045 else 0 for i,freq in enumerate([1318,1975,2637] if name=='coin' else [1046,1568,2093,3136,4186]))
    gate = 1 if int(t*90)%3 else .1
    return gate*(.22*math.sin(2*math.pi*(220+int(t*30)%5*140)*t)+noise*.1)*math.exp(-t*9)


def music(mode, t, rng):
    bpm = 140 if mode == 'retail-drive' else 128
    beat = 60 / bpm
    pos = t % beat
    half = t % (beat/2)
    step = int(t/beat)
    root = [41, 44, 39, 46][int(t/(beat*4))%4]
    hz = 440*2**((root-69)/12)
    bass = .14*(math.sin(2*math.pi*hz*t)+.22*math.sin(4*math.pi*hz*t))*math.exp(-half*10)
    kick = .36*math.sin(2*math.pi*(46*pos+3*(1-math.exp(-pos*45))))*math.exp(-pos*24)
    clap = rng.uniform(-1,1)*.14*math.exp(-pos*44) if step%2 else 0
    hat = rng.uniform(-1,1)*.045*math.exp(-(t%(beat/4))*140)
    note = root+24+[0,7,12,7,3,10,7,12][int(t/(beat/2))%8]
    freq = 440*2**((note-69)/12)
    pluck = .045*(math.sin(2*math.pi*freq*t)+.35*math.sin(4*math.pi*freq*t))*math.exp(-half*14)
    return kick+bass+clap+hat+pluck


def save(name, duration, sample, music_file=False):
    target = OUT / ((name+'.mp3') if music_file else 'sfx/'+name+'.wav')
    target.parent.mkdir(parents=True, exist_ok=True)
    rng = random.Random(name)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp)/'source.wav'
        with wave.open(str(wav_path), 'wb') as wav:
            wav.setparams((2,2,RATE,0,'NONE','not compressed'))
            for offset in range(0, int(duration*RATE), 4096):
                chunk=[]
                for n in range(offset, min(offset+4096, int(duration*RATE))):
                    t=n/RATE
                    envelope=min(1,t/.003,(duration-t)/(.04 if not music_file else .18))
                    v=math.tanh(sample(t,rng)*1.35)*.86*envelope
                    pan=math.sin(t*(2 if music_file else 5))*.14
                    chunk.append(struct.pack('<hh',int(v*(1-pan)*32767),int(v*(1+pan)*32767)))
                wav.writeframes(b''.join(chunk))
        if music_file:
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav_path),'-codec:a','libmp3lame','-b:a','192k',str(target)],check=True)
        else:
            target.write_bytes(wav_path.read_bytes())
    return {'id':name,'path':str(target.relative_to(OUT)),'seconds':duration,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'origin':'original-procedural-synthesis','source':'workers/video-studio/make_catalog_audio.py'}


if __name__ == '__main__':
    manifest_path = OUT/'catalog-provenance.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'assets': []}
    records=[asset for asset in previous['assets'] if asset.get('origin') in ('cc0-adaptation', 'user-requested-video-extract')]
    for name,duration in SFX.items():
        records.append(save(name,duration,lambda t,r,n=name,d=duration:effect(n,t,d,r)))
    for name in ['retail-drive','retail-bounce']:
        records.append(save(name,30,lambda t,r,n=name:music(n,t,r),True))
    (OUT/'catalog-provenance.json').write_text(json.dumps({'description':'Efeitos originais, CC0 e recortes solicitados; origem e condições registradas por arquivo.','assets':records},ensure_ascii=False,indent=2)+'\n')
    subprocess.run([sys.executable,str(Path(__file__).with_name('make_boom_audio.py'))],check=True)
    subprocess.run([sys.executable,str(Path(__file__).with_name('make_thematic_audio.py'))],check=True)
    print(f'{len(records)+17} arquivos originais preparados')
