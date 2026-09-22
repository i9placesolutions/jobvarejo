"""Trilhas instrumentais originais, sem samples externos. Arranjos determinísticos por modelo."""
import json,hashlib,subprocess,wave,tempfile,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[2]; RATE=44100;DURATION=30
recipes=json.loads((ROOT/'shared/video-studio/generated-flyer-recipes.json').read_text())
only=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--only=')),None)
if only:
 recipes=[r for r in recipes if r['id']==only]
 if not recipes: raise SystemExit('Modelo não encontrado: '+only)
records=[]
prior=json.loads((ROOT/'docs/video-studio/model-music-provenance.json').read_text()) if '--changed' in sys.argv or only else []
if only: records=[p for p in prior if p['id'] not in {r['music'] for r in recipes}]
def hz(n):return 440*2**((n-69)/12)
for idx,r in enumerate(recipes):
 old=next((p for p in prior if p['id']==r['music'] and p['style']==r['musicStyle'] and p['bpm']==r['bpm']),None)
 if old:
  records.append(old);continue
 out=ROOT/'public/video-studio/audio'/f"{r['music']}.mp3"
 seed=r['seed'];rng=np.random.default_rng(seed);bpm=r['bpm'];beat=60/bpm;style=r['musicStyle'];y=np.zeros((RATE*DURATION,2),dtype=np.float32)
 def put(start,duration,fn,gain=.2,pan=0):
  a=int(start*RATE);n=min(int(duration*RATE),len(y)-a)
  if a<0 or n<=0:return
  t=np.arange(n)/RATE;s=fn(t)*gain*np.minimum(1,t/.004)*np.minimum(1,(n/RATE-t)/.02)
  y[a:a+n,0]+=s*(1-pan);y[a:a+n,1]+=s*(1+pan)
 roots=[[0,5,7,5],[0,7,9,5],[0,3,7,5],[0,5,2,7],[0,9,5,7],[0,7,5,3]][seed%6]
 tonic=36+seed%12;minor=style in ['dark','synth','rock','breakbeat'];third=3 if minor else 4
 motif=rng.choice([0,third,5,7,9,12],size=16).tolist();motif[0]=0;motif[8]=7
 steps=int(DURATION/beat*4)
 for step in range(steps):
  start=step*beat/4;bar=step//16;root=tonic+roots[bar%4];section=(bar//4)%2;phase=step%16
  four=style in ['house','drive','electro','disco','synth']
  kicks=([0,4,8,12] if four else [0,6,8,11,14] if style in ['funk','tropical'] else [0,7,8,10])
  if phase in kicks:put(start,.32,lambda t:np.sin(2*np.pi*(48*t+2.8*(1-np.exp(-t*48))))*np.exp(-t*20),.5)
  if phase in [4,12]:put(start,.17,lambda t:rng.uniform(-1,1,len(t))*np.exp(-t*27)+.24*np.sin(2*np.pi*185*t)*np.exp(-t*34),.2)
  if step%2==0 or section:put(start,.055,lambda t:np.diff(rng.uniform(-1,1,len(t)+1))*np.exp(-t*90),.045,(-1 if step%4 else 1)*.35)
  if step%2==0 and phase not in ([14] if style=='rock' else []):
   note=root+(12 if phase in [6,14] else 0);freq=hz(note)
   put(start,beat*.44,lambda t,fr=freq:(np.sin(2*np.pi*fr*t)+.3*np.sin(4*np.pi*fr*t)+.12*np.sin(6*np.pi*fr*t))*np.exp(-t*9),.19)
  if phase in ([2,6,10,14] if style in ['tropical','funk','disco'] else [0,8]):
   chord=[root+12,root+12+third,root+19,root+24]
   put(start,beat*.8,lambda t,ch=chord:sum(np.sin(2*np.pi*hz(n)*t)+.15*np.sin(4*np.pi*hz(n)*t) for n in ch)/4*np.exp(-t*(6 if style=='tropical' else 4)),.19,(bar%3-1)*.25)
  if step%2==0 and (bar%4!=3 or phase<8):
   note=root+24+motif[(step//2+bar%2*4)%16];freq=hz(note)
   bright=.5 if style in ['electro','drive','synth'] else .22
   put(start,beat*.65,lambda t,fr=freq,b=bright:(np.sin(2*np.pi*fr*t)+b*np.sin(4*np.pi*fr*t))*np.exp(-t*13),.09 if section else .065,np.sin(step)*.45)
  if style in ['tropical','funk'] and phase in [3,7,10,15]:put(start,.1,lambda t:np.sin(2*np.pi*380*t)*np.exp(-t*40),.15,.45)
  if phase>=12 and bar%4==3:put(start,.08,lambda t:rng.uniform(-1,1,len(t))*np.exp(-t*50),.06)
 # Delay discreto cria profundidade; mix e limiter com margem para os efeitos sonoros.
 delay=int(beat*.75*RATE);y[delay:]+=y[:-delay,::-1]*.13
 y=np.tanh(y*1.15);y*=.85/max(.85,float(np.max(np.abs(y))))
 ramp=np.minimum(1,np.arange(len(y))/RATE/.08)*np.minimum(1,(len(y)-np.arange(len(y)))/RATE/.3);y*=ramp[:,None]
 with tempfile.TemporaryDirectory() as tmp:
  wav=Path(tmp)/'music.wav'
  with wave.open(str(wav),'wb') as f:f.setparams((2,2,RATE,0,'NONE','not compressed'));f.writeframes((y*32767).astype('<i2').tobytes())
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af','loudnorm=I=-16:TP=-2:LRA=9','-ar',str(RATE),'-codec:a','libmp3lame','-b:a','192k',str(out)],check=True)
 records.append({'id':r['music'],'style':style,'bpm':bpm,'seed':seed,'tonic':tonic,'progression':roots,'motif':motif,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'origin':'original-instrumental-synthesis','duration':DURATION})
 print(idx+1,len(recipes),r['name'],flush=True)
(ROOT/'docs/video-studio/model-music-provenance.json').write_text(json.dumps(records,indent=2))
