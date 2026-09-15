from PIL import Image
from pathlib import Path
import json
root=Path('artifacts/art-studio/dia-das-criancas');out=root/'assets';out.mkdir(exist_ok=True)
gen=Path('/Users/rafaelmendes/.codex/generated_images/01a0a4fe-7c44-7e62-ac53-7486357c9561')
children=Image.open(gen/'exec-d9c1761d-b591-45a9-8c09-3f4c71efe7d0.png').convert('RGBA')
decor=Image.open(gen/'exec-5b92e7fc-3afb-49e1-ae08-2530fdb16802.png').convert('RGBA')
assert children.getextrema()[3][0]==0 and decor.getextrema()[3][0]==0
assets={}
def cut(im,name,box):
 tile=im.crop(box);alpha=tile.getchannel('A');box=alpha.point(lambda a:255 if a>40 else 0).getbbox();tile=tile.crop(box);tile.save(out/(name+'.png'));assets[name]={'width':tile.width,'height':tile.height}
w,h=children.size
for name,box in zip(['menina','ruivo','amarelo','cacheado'],[(0,0,w//2,h//2),(w//2,0,w,h//2),(0,h//2,w//2,h),(w//2,h//2,w,h)]):cut(children,name,box)
w,h=decor.size
for name,box in [('titulo',(0,0,w,395)),('placa',(0,395,680,875)),('presente',(680,395,w,865)),('aviao',(0,880,680,h)),('foguete',(680,865,w,h))]:cut(decor,name,box)
(root/'asset-dimensions.json').write_text(json.dumps(assets,indent=2))
print(assets)
