"""Reusable transparent lighting overlays; smooth alpha, no shape outline."""
import json, math
from pathlib import Path
from PIL import Image
root=Path('artifacts/art-studio/colecao-outubro')
dims=json.loads((root/'asset-dimensions.json').read_text())
size=900
for name in ['luz-dourada-difusa','nevoa-branca-degrade']:
    im=Image.new('RGBA',(size,size)); pixels=im.load()
    for y in range(size):
        v=y/(size-1)
        for x in range(size):
            u=x/(size-1)
            if name=='luz-dourada-difusa':
                radius=((u-.48)/.48)**2+((v-.48)/.48)**2
                a=max(0,1-radius)**3*.93
                color=(255,253,218)
            else:
                # Fully transparent top, smooth ivory fog, opaque below waist.
                t=max(0,min(1,(v-.02)/.31)); a=t*t*(3-2*t)
                color=(255,254,247)
            pixels[x,y]=(*color,round(255*a))
    if name=='nevoa-branca-degrade': im=im.resize((1920,500))
    im.save(root/'assets'/f'{name}.png')
    dims[name]={'width':im.width,'height':im.height}
(root/'asset-dimensions.json').write_text(json.dumps(dims,indent=2))
