"""Trilhas e efeitos originais sintetizados para a biblioteca do módulo."""
import math, random, wave, struct, subprocess, tempfile
from pathlib import Path
RATE=22050
OUT=Path(__file__).resolve().parents[2]/'public/video-studio/audio'
OUT.mkdir(parents=True, exist_ok=True)
def save(name, duration, sample):
    rng=random.Random(71)
    with tempfile.TemporaryDirectory() as tmp:
        src=Path(tmp)/'sound.wav'
        with wave.open(str(src),'wb') as wav:
            wav.setparams((1,2,RATE,0,'NONE','not compressed'))
            for offset in range(0,int(duration*RATE),4096):
                values=[]
                for n in range(offset,min(offset+4096,int(duration*RATE))):
                    t=n/RATE
                    value=sample(t,rng)*min(1,t/.03,(duration-t)/.15)
                    values.append(struct.pack('<h',int(max(-.95,min(.95,value))*32767)))
                wav.writeframes(b''.join(values))
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-codec:a','libmp3lame','-b:a','128k',str(OUT/(name+'.mp3'))],check=True)
def track(mode):
    beat=60/({'upbeat':116,'energy':128,'calm':88}[mode]); bars=16*beat
    def sample(t,rng):
        pos=t%beat; eighth=t%(beat/2); step=int(t/(beat/2)); chord=int(t/(beat*4))%4
        notes=[48,53,55,50]; root=notes[chord]; bass=440*2**((root-69)/12)
        tone=.1*math.sin(2*math.pi*bass*t)*math.exp(-pos*5)
        kick=.23*math.sin(2*math.pi*(48*pos+5*(1-math.exp(-pos*35))))*math.exp(-pos*22)
        hat=(rng.random()*2-1)*.035*math.exp(-eighth*100)
        snare=(rng.random()*2-1)*.06*math.exp(-pos*32) if int(t/beat)%2 else 0
        melody=root+24+[0,7,4,12,7,4,2,7][step%8]; freq=440*2**((melody-69)/12)
        pluck=.09*(math.sin(2*math.pi*freq*t)+.2*math.sin(4*math.pi*freq*t))*math.exp(-eighth*8)
        if mode=='calm': return tone+pluck*.7+hat*.3
        return tone+kick+hat+snare+pluck
    save(mode,bars,sample)
for mode in ['upbeat','energy','calm']: track(mode)
save('impact',.7,lambda t,r:.55*math.sin(2*math.pi*(45*t+4*(1-math.exp(-t*30))))*math.exp(-t*9)+.06*(r.random()*2-1)*math.exp(-t*30))
save('whoosh',.55,lambda t,r:(r.random()*2-1)*.25*math.sin(math.pi*t/.55)**2)
