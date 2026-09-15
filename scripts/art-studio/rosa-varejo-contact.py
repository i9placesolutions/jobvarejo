from PIL import Image,ImageDraw
from pathlib import Path
import json
r=Path('artifacts/art-studio/rosa-varejo');items=json.loads((r/'collection.json').read_text());catalog=Image.new('RGB',(1440,1220),'#eee')
for n,item in enumerate(items):
 p=r/item['slug'];out=Image.new('RGB',(1500,620),'#ddd')
 for i,file in enumerate(sorted((p/'previews').glob('arte-*.png'))):
  im=Image.open(file).convert('RGB');im.thumbnail((290,580));out.paste(im,(i*300,30));ImageDraw.Draw(out).text((i*300,5),file.stem,fill='black')
 out.save(p/'contato.jpg');im=Image.open(p/'previews/arte-1-1080x1350.png').convert('RGB');im.thumbnail((460,575));x=(n%3)*480;y=(n//3)*610;catalog.paste(im,(x,y+25));ImageDraw.Draw(catalog).text((x+5,y+5),item['slug'],fill='black')
catalog.save(r/'catalogo.jpg')
