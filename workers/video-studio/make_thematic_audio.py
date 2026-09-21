"""Assinaturas sonoras originais por campanha; nenhuma chamada a provedor pago."""
import math,random,wave,struct,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'public/video-studio/audio'
families=['bakery','alarm','lightning','grill','clearance','harvest','children','celebration','rose','spooky','clock','neon','industrial','show','savings','impact']
rate=44100;duration=1.6
catalog=json.loads((root/'catalog-provenance.json').read_text())
for family in families:
 rng=random.Random('retail-'+family);lo=0.;mid=0.;samples=[]
 for n in range(int(rate*duration)):
  t=n/rate;noise=rng.uniform(-1,1);lo+=.025*(noise-lo);mid+=.23*(noise-mid)
  def pulse(at,decay=18):return math.exp(-(t-at)*decay) if t>=at else 0
  def tone(freq):return math.sin(2*math.pi*freq*t)
  if family=='alarm':v=.3*tone(720 if int(t*7)%2 else 980)*math.exp(-t*2)+noise*.06*pulse(0,30)
  elif family=='lightning':v=(noise*.65*pulse(0,35)+mid*.9*pulse(.08,3)+lo*2*pulse(.22,2)+mid*.3*pulse(.5,8))
  elif family in ('grill','clearance'):
   v=mid*(.8 if family=='grill' else 1.3)*math.exp(-t*2.7)+noise*.3*sum(pulse(at,120) for at in [.04,.11,.25,.38,.59,.77])+lo*.7*pulse(0,4)
  elif family=='bakery':v=.23*tone(1318)*pulse(0,5)+.13*tone(2636)*pulse(0,8)+noise*.12*sum(pulse(at,85) for at in [.2,.32,.46,.63])+mid*.12*pulse(.1,3)
  elif family=='harvest':v=noise*.16*math.exp(-t*3)+sum(.17*tone(900+i*230)*pulse(at,24) for i,at in enumerate([0,.12,.3,.49]))
  elif family=='children':v=sum((.2*math.sin(2*math.pi*(500*t+80*math.sin(t*12)))+noise*.2)*pulse(at,24) for at in [0,.16,.32,.52])
  elif family=='celebration':v=sum((noise*.48+lo)*pulse(at,15) for at in [0,.22,.47])+.12*tone(2093)*pulse(.4,4)
  elif family=='rose':v=sum(.17*tone(freq)*pulse(i*.08,4) for i,freq in enumerate([1046,1318,1568,2093]))
  elif family=='spooky':v=(mid*.35+math.sin(2*math.pi*(95*t+28*t*t))*.2)*math.exp(-t*1.8)+.12*tone(412)*pulse(.14,3)
  elif family=='clock':v=sum((noise*.3+.2*tone(2200))*pulse(at,100) for at in [0,.19,.38,.57])+.2*tone(880)*pulse(.76,6)
  elif family=='neon':v=.26*math.sin(2*math.pi*(190*t+900*t*t))*math.exp(-t*4)+.2*tone(98)*pulse(0,7)+noise*.1*pulse(.18,25)
  elif family=='industrial':v=sum(.18*tone(freq)*math.exp(-t*(4+i*3)) for i,freq in enumerate([197,491,997,1733]))+noise*.32*pulse(0,40)
  elif family=='show':v=sum(.13*tone(freq)*pulse(i*.04,3) for i,freq in enumerate([261,329,392,523]))+noise*.14*pulse(0,8)
  elif family=='savings':v=sum(.21*tone(freq)*pulse(i*.12,10) for i,freq in enumerate([1568,2093,2637]))+noise*.16*pulse(.04,55)
  else:v=(mid*.7+lo*1.5+.24*math.sin(2*math.pi*(68*t+3*(1-math.exp(-t*22)))))*math.exp(-t*5)+noise*.45*pulse(0,40)
  samples.append(math.tanh(v*1.7)*min(1,t/.0015,(duration-t)/.08))
 peak=max(abs(v) for v in samples);path=root/'sfx'/('theme-'+family+'.wav')
 with wave.open(str(path),'wb') as f:
  f.setparams((2,2,rate,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<hh',int(v/peak*.8*32767),int(v/peak*.8*32767)) for v in samples))
 record={'id':'theme-'+family,'path':'sfx/'+path.name,'seconds':duration,'origin':'original-procedural-synthesis','source':'workers/video-studio/make_thematic_audio.py','sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 catalog['assets']=[a for a in catalog['assets'] if a['id']!=record['id']]+[record]
(root/'catalog-provenance.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(len(families),'assinaturas sonoras geradas')
