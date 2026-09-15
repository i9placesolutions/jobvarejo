from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path('artifacts/art-studio/colecao-outubro');catalog=json.loads((root/'collection.json').read_text());cover=Image.new('RGB',(1600,1080),'#e9e9e9')
for i,t in enumerate(catalog):
 p=root/t['slug'];sheet=Image.new('RGB',(1800,700),'#e9e9e9');draw=ImageDraw.Draw(sheet)
 for j,f in enumerate(sorted((p/'previews').glob('arte*.png'))):
  im=Image.open(f);im.thumbnail((348,650));sheet.paste(im,(360*j+(360-im.width)//2,40));draw.text((360*j+12,10),f.stem,fill='black')
 sheet.save(p/'contato.jpg')
 first=Image.open(p/'previews/arte-1-1080x1350.png');first.thumbnail((380,485));x=(i%4)*400+10;y=(i//4)*540+35;cover.paste(first,(x,y));ImageDraw.Draw(cover).text((x,y-20),str(i+1)+' - '+t['slug'],fill='black')
cover.save(root/'catalogo.jpg')
