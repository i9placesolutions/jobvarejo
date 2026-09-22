"""Separa os 35 efeitos da referência indicada pelo usuário, sem misturar vizinhos."""
from pathlib import Path
import hashlib, html, json, re, subprocess, wave, zipfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/video-all-models/youtube-effects'
SOURCE = OUT / '2aoLsF3-2gI.wav'
PUBLIC = ROOT / 'public/video-studio/audio'
NAMES = ['Whoosh','Gear','Click','Pop','Cash register','Aww','Wrong answer','Whoosh fire transition','Game point','Discord join','Discord leave','iPhone send','iPhone receive','Apple notification','Anime wow','Bone crack','Slap','Camera shutter','Whoosh 2','Paper','Kids yeyy','Display digits','Party horn','Glitch','Anvil','Cinematic hit','In and out','Sudden suspense','Boom','Glass shatter','Clock ticking','Mario coin','Crumpled paper','Ding','Glitch 2']
SELECTED = {1:('reference-whoosh','Passagem · referência'),8:('reference-fire-whoosh','Passagem de fogo · referência'),19:('reference-short-whoosh','Passagem rápida · referência'),27:('reference-in-out','Entrada e saída · referência'),3:('reference-click','Clique · referência'),4:('reference-pop','Pop · referência'),5:('reference-cash','Caixa registradora · referência'),34:('reference-ding','Sinal de preço · referência')}
silence = subprocess.run(['ffmpeg','-hide_banner','-i',str(SOURCE),'-af','silencedetect=noise=-38dB:d=0.3','-f','null','-'],capture_output=True,text=True,check=True).stderr
starts = [float(x) for x in re.findall(r'silence_end: ([\d.]+)',silence)]
ends = [float(x) for x in re.findall(r'silence_start: ([\d.]+)',silence)][1:]
RANGES = list(zip(starts,ends))
# O efeito 35 contém duas partes com uma pausa interna, conferidas no vídeo.
if len(RANGES) != 36:
    raise ValueError('A detecção mudou; conferir novamente os números do vídeo antes de cortar.')
RANGES[-2:] = [(RANGES[-2][0],RANGES[-1][1])]
if len(RANGES) != len(NAMES):
    raise ValueError('Os intervalos devem corresponder aos 35 números conferidos nos frames.')
(OUT/'separated').mkdir(exist_ok=True)
records, catalog = [], []
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
for i, ((start, end), name) in enumerate(zip(RANGES, NAMES), 1):
    start = max(0, start-.025)
    end += .12
    duration = end-start
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    target = OUT/'separated'/f'{i:02}-{slug}.wav'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(SOURCE),'-t',str(duration),'-ar','44100','-ac','2','-c:a','pcm_s16le',str(target)],check=True)
    record = {'number':i,'name':name,'sourceStart':start,'sourceEnd':end,'file':str(target.relative_to(OUT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    if i in SELECTED:
        sound_id, label = SELECTED[i]
        stats = subprocess.run(['ffmpeg','-hide_banner','-i',str(target),'-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True).stderr
        peak = float(re.search(r'max_volume: ([-\d.]+) dB',stats)[1])
        gain = min(18, -3-peak)
        output = PUBLIC/'sfx'/f'{sound_id}.wav'
        filters = f'volume={gain}dB,afade=t=in:d=0.003,afade=t=out:st={duration-.025}:d=0.025'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(target),'-af',filters,'-ar','44100','-ac','2','-c:a','pcm_s16le',str(output)],check=True)
        with wave.open(str(output)) as audio:
            seconds = audio.getnframes()/audio.getframerate()
        record['appliedSoundId'] = sound_id
        catalog.append({'id':sound_id,'name':label,'seconds':round(seconds,5)})
        record['asset'] = {'id':sound_id,'path':'sfx/'+output.name,'seconds':seconds,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'origin':'user-requested-video-extract','source':'https://www.youtube.com/watch?v=2aoLsF3-2gI','sourceSha256':source_hash,'sourceStart':start,'sourceEnd':end,'license':'not-specified-by-source','treatment':filters}
    records.append(record)
(OUT/'segments.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
manifest_file = PUBLIC/'catalog-provenance.json'
manifest = json.loads(manifest_file.read_text())
ids = {r['id'] for r in catalog}
manifest['assets'] = [r for r in manifest['assets'] if r['id'] not in ids]+[r['asset'] for r in records if 'asset' in r]
manifest['description'] = 'Efeitos originais, CC0 e recortes da referência solicitada; origem e condições registradas por arquivo.'
manifest_file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(ROOT/'shared/video-studio/reference-sounds.ts').write_text('// Gerado por scripts/video-studio/split-youtube-effects.py.\nexport const REFERENCE_SOUNDS = '+json.dumps(catalog,ensure_ascii=False,indent=2)+' as const\n')
with zipfile.ZipFile(OUT/'efeitos-separados.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for record in records: archive.write(OUT/record['file'],Path(record['file']).name)
    archive.write(OUT/'segments.json','segments.json')
    archive.write(OUT/'2aoLsF3-2gI.description','descricao-origem.txt')
cards = ''.join(f'<article><h2>{r["number"]:02} — {html.escape(r["name"])}</h2><audio controls preload="none" src="{r["file"]}"></audio><p>Origem: {r["sourceStart"]:.3f}–{r["sourceEnd"]:.3f} s</p></article>' for r in records)
(OUT/'ouvir.html').write_text('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Efeitos separados</title><style>body{background:#10141c;color:#eee;font:16px system-ui;max-width:900px;margin:40px auto;padding:20px}article{background:#1b2330;border-radius:12px;padding:16px;margin:12px 0}audio{width:100%}h2{font-size:18px}a{color:#8dc4ff}</style><h1>35 efeitos separados</h1><p>Recortes da referência indicada. Oito sons selecionados para transições e preços.</p>'+cards+'</html>')
print(json.dumps({'separated':len(records),'selected':catalog},ensure_ascii=False))
