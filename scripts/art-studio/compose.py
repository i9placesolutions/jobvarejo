#!/usr/bin/env python3
"""Compõe um modelo editável a partir de um briefing usando métricas do Pillow.

python3 scripts/art-studio/compose.py briefing.json --output modelo.json --font /caminho/Barlow.ttf
Importe modelo.json no editor do super admin. Não achata textos nem logo.
As imagens devem ser enviadas pelo estúdio e referenciadas por /api/art-studio/assets/UUID.
"""
import argparse
import json
import re
import uuid
from pathlib import Path
from PIL import ImageFont


def fit_text(text, font_path, width, height, initial_size):
    for size in range(initial_size, 9, -1):
        font = ImageFont.truetype(str(font_path), size)
        lines = []
        for paragraph in text.split('\n'):
            row = ''
            for word in paragraph.split(' '):
                candidate = f'{row} {word}'.strip()
                if row and font.getlength(candidate) > width:
                    lines.append(row)
                    row = word
                else:
                    row = candidate
            lines.append(row)
        if all(font.getlength(row) <= width for row in lines) and len(lines) * size * 1.16 <= height:
            return '\n'.join(lines), size
    raise ValueError('Texto não cabe na área. Reduza o conteúdo ou aumente a caixa.')


def compose(brief, font_path):
    width, height = int(brief.get('width', 1080)), int(brief.get('height', 1350))
    if not (320 <= width <= 4096 and 320 <= height <= 4096):
        raise ValueError('Dimensões devem ficar entre 320 e 4096 px.')
    background = brief.get('background', '#f5f0e4')
    color = brief.get('color', '#254a39')
    if not all(re.fullmatch(r'#[0-9a-fA-F]{6}', value) for value in [background, color]):
        raise ValueError('Cores devem usar #RRGGBB.')
    family = brief.get('fontFamily', 'Barlow')
    if family not in ['Barlow', 'Barlow Condensed', 'Oswald', 'Anton', 'Arial', 'Georgia']:
        raise ValueError('Fonte fora do catálogo do estúdio.')
    layers = []
    def layer(kind, name, x, y, w, h, **values):
        item = dict(id=str(uuid.uuid4()), kind=kind, name=name, x=x, y=y, width=w,
                    height=h, rotation=0, opacity=1, visible=True, locked=False, fill=color)
        item.update(values)
        layers.append(item)
    def text(name, content, y, box_height, size, binding=''):
        fitted, font_size = fit_text(str(content)[:2000], font_path, width * .82, box_height, max(10, int(size)))
        layer('text', name, width*.09, y, width*.82, box_height, text=fitted,
              fontFamily=family, fontSize=font_size, fontWeight=400, align='left', binding=binding)
    layer('shape', 'Detalhe decorativo', width*.7, -height*.07, width*.55, width*.55, shape='ellipse', opacity=.12)
    text('Tema', brief.get('theme', 'SUA MARCA PRESENTE'), height*.07, height*.09, width*.03)
    image = brief.get('image', '')
    if image:
        if not re.fullmatch(r'/api/art-studio/assets/[0-9a-f-]{36}', image):
            raise ValueError('Envie a imagem pelo estúdio e use sua referência de asset.')
        layer('image', 'Imagem principal', width*.09, height*.2, width*.82, height*.3, src=image, fit='cover', cropX=.5, cropY=.5)
    title_y = height * (.54 if image else .26)
    title_h = height * (.17 if image else .31)
    text('Título', brief.get('title', 'FAÇA DO\nSEU JEITO.'), title_y, title_h, width*.105)
    text('Mensagem', brief.get('message', 'Uma mensagem especial para seus clientes.'), height*.73, height*.12, width*.034)
    # Logo é sempre um slot. Jamais embutir a marca de um admin em um modelo público.
    layer('image', 'Logo da loja', width*.72, height*.88, width*.19, height*.085, src='', fit='contain', binding='logo')
    text('Nome da loja', 'Sua empresa', height*.9, height*.045, width*.025, 'companyName')
    return dict(version=1, width=width, height=height, background=background, layers=layers)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('brief', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--font', type=Path, required=True, help='Use o arquivo da mesma fonte selecionada em fontFamily.')
    args = parser.parse_args()
    if args.brief.stat().st_size > 100_000:
        raise ValueError('Briefing muito grande.')
    result = compose(json.loads(args.brief.read_text()), args.font)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f'Composição editável criada: {args.output} ({len(result["layers"])} camadas)')

if __name__ == '__main__':
    main()
