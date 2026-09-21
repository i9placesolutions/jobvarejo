"""Explosão original, com energia nos médios para alto-falantes pequenos."""
import math,random,wave,struct,json,hashlib
from pathlib import Path
rate=44100;duration=1.45;rng=random.Random(14015);low=0.;body=0.;samples=[]
for n in range(int(rate*duration)):
 t=n/rate;noise=rng.uniform(-1,1)
 low+=.035*(noise-low);body+=.35*(noise-body)
 attack=min(1,t/.0015)
 crack=(noise-body)*math.exp(-t*48)*.65
 blast=body*math.exp(-t*4.2)*(1+.22*math.sin(t*53))*.95
 rumble=(low*2+math.sin(2*math.pi*(55*t+2*(1-math.exp(-t*18))))*.24)*math.exp(-t*4)
 debris=sum(math.exp(-max(0,t-delay)*75)*noise*.18 if t>=delay else 0 for delay in [.12,.19,.28,.39,.55])
 samples.append(math.tanh((crack+blast+rumble+debris)*2.2)*attack*min(1,(duration-t)/.1))
peak=max(abs(v) for v in samples);out=Path(__file__).resolve().parents[2]/'public/video-studio/audio/sfx/explosion-retail.wav'
with wave.open(str(out),'wb') as wav:
 wav.setparams((2,2,rate,0,'NONE','not compressed'))
 wav.writeframes(b''.join(struct.pack('<hh',int(v/peak*.85*32767),int(v/peak*.85*32767)) for v in samples))
out.with_suffix('.json').write_text(json.dumps({'origin':'original-procedural-synthesis','generator':'workers/video-studio/make_boom_audio.py','seconds':duration,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()},indent=2)+'\n')
catalog=out.parent.parent/'catalog-provenance.json'
data=json.loads(catalog.read_text())
record=json.loads(out.with_suffix('.json').read_text());record.update(id='explosion-retail',path='sfx/explosion-retail.wav',source=record['generator'])
data['assets']=[a for a in data['assets'] if a['id']!='explosion-retail']+[record]
catalog.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(out.name)
