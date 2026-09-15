from PIL import Image
from pathlib import Path
import json,shutil
root=Path('artifacts/art-studio/rosa-varejo');(root/'assets').mkdir(parents=True,exist_ok=True);(root/'referencias').mkdir(exist_ok=True)
files=['27540f07-1263-4f0f-b6d1-87427af64bba','fa1b58e3-6cec-42ae-8908-658e3c4536e0','e1b3121a-d52b-48f5-bc39-1c8f0568ce86','0f6222d1-0a11-4564-a739-041ed7bea298','929b33ab-2950-4ebf-a376-a65a9b8bcf00','2eb0456a-6243-4744-ad3e-fb1bce63368c']
for i,f in enumerate(files):shutil.copy2('/var/folders/zm/7t1xy1ps4hz_225_0xztth3h0000gn/T/codex-clipboard-'+f+'.png',root/'referencias'/f'referencia-{i+1}.png')
gen=Path('/Users/rafaelmendes/.codex/generated_images/01a0a4fe-7c44-7e62-ac53-7486357c9561')
im=Image.open(gen/'exec-0b8b0ae8-ba2d-442e-aac5-1b63e4d96d32.png').convert('RGBA');shutil.copy2(gen/'exec-0b8b0ae8-ba2d-442e-aac5-1b63e4d96d32.png',root/'folha-elementos.png')
boxes={'punho-lenco-rosa':(0,0,414,451),'mao-laco-rosa':(457,0,780,447),'cadeira-odontologica-rosa':(810,0,1230,451),'laco-rosa-fluido':(0,459,415,914),'carrinho-amarelo':(416,447,815,910),'agricultoras-hortifruti':(790,452,1230,914),'moeda-dourada':(421,916,819,1278),'moeda-verde':(826,916,1230,1278)}
dims={}
for key,box in boxes.items():
 asset=im.crop(box);alpha=asset.getchannel('A');bbox=alpha.point(lambda a:255 if a>25 else 0).getbbox();asset=asset.crop(bbox);asset.save(root/'assets'/f'{key}.png');dims[key]={'width':asset.width,'height':asset.height}
asset=Image.open(gen/'exec-2689a8fc-bf85-4d6c-9a4b-c5051235a9e2.png').convert('RGBA');asset=asset.crop(asset.getchannel('A').getbbox());asset.save(root/'assets/cesta-azul.png');dims['cesta-azul']={'width':asset.width,'height':asset.height}
(root/'asset-dimensions.json').write_text(json.dumps(dims,indent=2))
print(dims)
