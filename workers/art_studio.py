#!/usr/bin/env python3
"""Motor isolado de composição e renderização do Estúdio de Artes (Pillow). Sem rede/DB."""
import argparse
import base64
import copy
import io
import json
import math
import os
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageChops, ImageFilter

FAMILIES = {'Montserrat':'Montserrat','Barlow': 'Barlow', 'Barlow Condensed': 'BarlowCondensed', 'Anton': 'Anton', 'Oswald': 'Oswald','Roboto Slab':'RobotoSlab','Audiowide':'Audiowide','Bebas Neue':'BebasNeue','Caveat':'Caveat','Russo One':'RussoOne','Consumidor Referencia':'ConsumidorReferencia','Patua One':'PatuaOne'}
WEIGHTS = {400: 'Regular', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold'}
ICONS = {
 'heart': 'M 50 88 C 0 55 0 12 27 12 C 40 12 48 22 50 28 C 52 22 60 12 73 12 C 100 12 100 55 50 88 Z',
 'star': 'M 50 3 L 62 35 L 97 36 L 70 58 L 80 92 L 50 72 L 20 92 L 30 58 L 3 36 L 38 35 Z',
 'bolt': 'M 57 2 L 12 57 L 44 57 L 35 98 L 90 37 L 57 37 Z',
 'check': 'M 10 50 L 35 77 L 90 18 L 99 28 L 35 95 L 1 60 Z',
 'flower': 'M 50 30 C 5 -20 -20 30 30 50 C -20 70 5 120 50 70 C 95 120 120 70 70 50 C 120 30 95 -20 50 30 Z'
}

def fonts_dir():
    candidates = [Path(os.environ.get('ART_STUDIO_FONT_DIR', '/nonexistent')), Path.cwd()/'public/art-studio/fonts', Path.cwd()/'.output/public/art-studio/fonts']
    for candidate in candidates:
        if (candidate/'Barlow-Regular.ttf').exists(): return candidate
    raise ValueError('Fontes do Estúdio de Artes não encontradas.')


def font_for(layer, size):
    family = layer.get('fontFamily', 'Barlow')
    if family not in FAMILIES: raise ValueError('Fonte não suportada.')
    weight = int(layer.get('fontWeight', 400))
    prefix = FAMILIES[family]
    filename = f'{prefix}-{WEIGHTS.get(weight, "Regular")}.ttf'
    if family == 'Anton': filename = 'Anton-Regular.ttf'
    if family == 'Oswald': filename = 'Oswald[wght].ttf'
    if family in ['Roboto Slab','Caveat','Montserrat']: filename=FAMILIES[family]+'[wght].ttf'
    if family in ['Audiowide','Bebas Neue','Russo One','Consumidor Referencia','Patua One']: filename=FAMILIES[family]+'-Regular.ttf'
    font = ImageFont.truetype(str(fonts_dir()/filename), max(6, int(size)))
    if family == 'Oswald': font.set_variation_by_axes([min(700, weight)])
    if family in ['Roboto Slab','Caveat','Montserrat']: font.set_variation_by_axes([min(700 if family=='Caveat' else 900,weight)])
    return font


def wrap(text, font, width):
    rows = []
    for paragraph in text.split('\n'):
        row = ''
        for word in paragraph.split(' '):
            candidate = (row+' '+word).strip()
            if row and font.getlength(candidate) > width: rows.append(row); row = word
            else: row = candidate
        rows.append(row)
    return rows


def fit(layer):
    text = layer.get('text', '')
    if layer.get('fontFamily') == 'Consumidor Referencia':
        # Variante contextual do o antes de n; mantém o texto do documento intacto.
        # Também funciona em builds Pillow sem HarfBuzz/RAQM.
        text = re.sub(r'([cC])[oO]([nN])',lambda m:m[1]+'q'+m[2],text)
    if not text: return [''], max(6, layer.get('fontSize', 48))
    initial = max(6, min(1000, round(layer.get('fontSize',48))))
    lo, hi, best = 6, initial, None
    while lo <= hi:
        size = (lo+hi)//2
        font = font_for(layer,size); rows = wrap(text,font,layer['width']/layer.get('fontScaleX',1))
        if len(rows)*size*layer.get('lineHeight',1.16) <= layer['height'] and all(font.getlength(row)*layer.get('fontScaleX',1)<=layer['width'] for row in rows):
            best=(rows,size);lo=size+1
        else: hi=size-1
    if not best: raise ValueError('Um texto não cabe na área. Aumente a caixa ou reduza o conteúdo.')
    return best


def validate(doc):
    if doc.get('version')!=1: raise ValueError('Versão inválida.')
    if not all(isinstance(doc[k],int) and 320<=doc[k]<=4096 for k in ['width','height']): raise ValueError('Dimensões inválidas.')
    if len(doc['layers'])>150: raise ValueError('Limite de camadas excedido.')
    for layer in doc['layers']:
        if not all(isinstance(layer[k],(int,float)) and math.isfinite(layer[k]) for k in ['x','y','width','height','rotation','opacity']): raise ValueError('Geometria inválida.')
        if not (1<=layer['width']<=8192 and 1<=layer['height']<=8192): raise ValueError('Área inválida.')


def compose(source, width, height, values):
    validate(source)
    doc=copy.deepcopy(source);doc.pop('alternates',None);sx=width/source['width'];sy=height/source['height']
    doc['width']=width;doc['height']=height
    for layer in doc['layers']:
        layer['x']*=sx;layer['y']*=sy;layer['width']*=sx;layer['height']*=sy
        if layer.get('binding') in values and values[layer['binding']]:
            if layer['kind']=='text': layer['text']=values[layer['binding']]
            elif layer['kind']=='image' and layer['binding']=='logo': layer['src']=values['logo']
        if layer['kind']=='text':
            layer['fontSize']=max(6,layer.get('fontSize',48)*min(sx,sy))
            rows,size=fit(layer);layer['fontSize']=size
            # Mantém o conteúdo original; a quebra é recalculada pelo editor/renderer sem perder palavras.
    validate(doc)
    return doc


def icon_points(name,w,h,path=None):
    tokens=re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?',path or ICONS[name]);i=0;points=[];current=(0,0)
    while i<len(tokens):
        command=tokens[i];i+=1
        if command in ['M','L']:
            current=(float(tokens[i]),float(tokens[i+1]));i+=2;points.append(current)
        elif command=='C':
            vals=list(map(float,tokens[i:i+6]));i+=6;p0=current;p1=vals[:2];p2=vals[2:4];p3=vals[4:6]
            for step in range(1,25):
                t=step/24;u=1-t
                points.append(tuple(u**3*p0[k]+3*u*u*t*p1[k]+3*u*t*t*p2[k]+t**3*p3[k] for k in [0,1]))
            current=tuple(p3)
    xs=[p[0] for p in points];ys=[p[1] for p in points];xmin,xmax=min(xs),max(xs);ymin,ymax=min(ys),max(ys)
    return [((x-xmin)*w/(xmax-xmin),(y-ymin)*h/(ymax-ymin)) for x,y in points]


def render(doc,assets):
    validate(doc)
    image=Image.new('RGBA',(doc['width'],doc['height']),doc['background'])
    for layer in doc['layers']:
        if not layer['visible']: continue
        # Limita bitmap intermediário à área necessária; JSON já limitado no endpoint.
        w,h=max(1,math.ceil(layer['width'])),max(1,math.ceil(layer['height']))
        if w*h>24_000_000: raise ValueError('Elemento grande demais para exportar.')
        tile=Image.new('RGBA',(w,h));draw=ImageDraw.Draw(tile)
        if layer['kind']=='text':
            rows,size=fit(layer);font=font_for(layer,size)
            text_width=max(1,round(w/layer.get('fontScaleX',1)))
            text_tile=Image.new('RGBA',(text_width,h));draw=ImageDraw.Draw(text_tile)
            for n,row in enumerate(rows):
                length=font.getlength(row);align=layer.get('align','left');x=(text_width-length)/2 if align=='center' else text_width-length if align=='right' else 0
                draw.text((x,n*size*layer.get('lineHeight',1.16)),row,font=font,fill=layer['fill'],anchor='lt')
            tile=text_tile.resize((w,h),Image.Resampling.LANCZOS)
        elif layer['kind']=='shape':
            if layer.get('shape')=='path': draw.polygon(icon_points('heart',w,h,layer['pathData']),fill=layer['fill'])
            elif layer.get('shape')=='ellipse': draw.ellipse((0,0,w-1,h-1),fill=layer['fill'])
            else: draw.rounded_rectangle((0,0,w,h),radius=layer.get('cornerRadius',0),fill=layer['fill'])
        elif layer['kind']=='icon': draw.polygon(icon_points(layer.get('icon','heart'),w,h),fill=layer['fill'])
        elif layer['kind']=='image':
            src=layer.get('src','')
            if not src: continue
            if src not in assets: raise ValueError('Imagem da composição não está disponível.')
            raw=base64.b64decode(assets[src]);asset=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGBA')
            if layer.get('fit')=='cover': tile=ImageOps.fit(asset,(w,h),method=Image.Resampling.LANCZOS,centering=(layer.get('cropX',.5),layer.get('cropY',.5)))
            else:
                asset.thumbnail((w,h),Image.Resampling.LANCZOS);tile.alpha_composite(asset,((w-asset.width)//2,(h-asset.height)//2))
        if layer.get('gradient') and layer['kind'] in ['shape','icon']:
            g=layer['gradient'];smallw=min(w,128);smallh=min(h,128)
            a=tuple(int(g['from'][k:k+2],16) for k in (1,3,5));b=tuple(int(g['to'][k:k+2],16) for k in (1,3,5))
            theta=math.radians(g['angle']);dx=math.cos(theta);dy=math.sin(theta)
            pixels=bytearray(smallw*smallh*4)
            for yy in range(smallh):
                ny=yy/max(1,smallh-1)-.5
                for xx in range(smallw):
                    nx=xx/max(1,smallw-1)-.5
                    t=min(1,max(0,math.hypot(nx,ny)*2 if g['type']=='radial' else .5+nx*dx+ny*dy))
                    offset=(yy*smallw+xx)*4
                    for ch in range(3): pixels[offset+ch]=round(a[ch]*(1-t)+b[ch]*t)
                    pixels[offset+3]=round(255*(g['startOpacity']*(1-t)+g['endOpacity']*t))
            effect=Image.frombytes('RGBA',(smallw,smallh),bytes(pixels)).resize((w,h),Image.Resampling.BILINEAR)
            effect.putalpha(ImageChops.multiply(effect.getchannel('A'),tile.getchannel('A')));tile=effect
        if layer.get('blur',0)>0:
            radius=min(150,layer['blur']);pad=math.ceil(radius*3)
            tile=ImageOps.expand(tile,border=pad,fill=(0,0,0,0)).filter(ImageFilter.GaussianBlur(radius))
        if layer['opacity']<1: tile.putalpha(tile.getchannel('A').point(lambda a:round(a*layer['opacity'])))
        angle=layer['rotation'];r=math.radians(angle);c=math.cos(r);s=math.sin(r)
        cx=layer['x']+w/2*c-h/2*s;cy=layer['y']+w/2*s+h/2*c
        if angle: tile=tile.rotate(-angle,resample=Image.Resampling.BICUBIC,expand=True)
        image.alpha_composite(tile,(round(cx-tile.width/2),round(cy-tile.height/2)))
    return image


def run(payload,output):
    mode=payload['mode']
    if mode=='compose':
        return {'compositions':[compose(payload['composition'],f['width'],f['height'],payload.get('values',{})) for f in payload['formats']]}
    if mode=='render':
        files=[]
        for index,doc in enumerate(payload['compositions']):
            filename=f'arte-{index+1}-{doc["width"]}x{doc["height"]}.png'
            render(doc,payload.get('assets',{})).save(output/filename,'PNG');files.append(filename)
        return {'files':files}
    raise ValueError('Operação inválida.')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path);parser.add_argument('--output-dir',type=Path);parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test:
        for family in FAMILIES: font_for({'fontFamily':family,'fontWeight':400},24)
        print(json.dumps({'ok':True,'engine':'Pillow','fonts':list(FAMILIES)}));return
    if args.input.stat().st_size>90*1024*1024: raise ValueError('Entrada excede o limite.')
    payload=json.loads(args.input.read_text());print(json.dumps(run(payload,args.output_dir),ensure_ascii=False))

if __name__=='__main__':
    try: main()
    except Exception as exc: print(str(exc),file=sys.stderr);sys.exit(1)
