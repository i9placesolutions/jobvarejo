"""Reconstruct visible display glyphs; other characters retain OFL Russo One.
Requires fonttools, opencv-python-headless, pillow. Source: user supplied reference.
"""
from pathlib import Path
import cv2
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
ROOT=Path(__file__).resolve().parents[2]
im=cv2.imread(str(ROOT/'artifacts/art-studio/consumidor/referencia.png'))
font=TTFont(ROOT/'public/art-studio/fonts/RussoOne-Regular.ttf')
scale=font['head'].unitsPerEm/50
# Separate repeated o: the reference's first o has a descender (contextual variant).
boxes=[('c',197,233,744,794),('q',238,276,744,794),('n',280,324,744,794),('s',328,362,744,794),('u',367,404,744,794),('m',197,256,795,842),('i',260,285,795,842),('d',289,324,795,842),('o',328,365,795,842),('r',369,394,795,842)]
for ch,x0,x1,y0,y1 in boxes:
 a=im[y0:y1,x0:x1]; b,g,r=cv2.split(a);mask=((r>190)&(g>55)&(g<160)&(b<100)).astype('uint8')*255
 # Upsampling and smoothing removes screenshot aliasing without changing stroke weight.
 mask=cv2.resize(mask,None,fx=8,fy=8,interpolation=cv2.INTER_CUBIC)
 mask=cv2.GaussianBlur(mask,(19,19),4);_,mask=cv2.threshold(mask,127,255,cv2.THRESH_BINARY)
 contours,_=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
 pen=TTGlyphPen(None)
 baseline=40 if y0==744 else 40
 for contour in contours:
  if cv2.contourArea(contour)<40:continue
  points=cv2.approxPolyDP(contour,3.0,True).reshape(-1,2)
  pts=[((float(x)/8+1)*scale,(baseline-float(y)/8)*scale) for x,y in points]
  def near(a,b): return tuple(.88*x+.12*y for x,y in zip(a,b))
  pen.moveTo(near(pts[0],pts[-1]))
  for j,pt in enumerate(pts):
   pen.lineTo(near(pt,pts[j-1]))
   pen.qCurveTo(pt,near(pt,pts[(j+1)%len(pts)]))
  pen.closePath()
 name=font.getBestCmap()[ord(ch)]
 font['glyf'][name]=pen.glyph();font['hmtx'][name]=(round((x1-x0+3)*scale),round(scale))
 # Same display drawing for uppercase in these headline models.
 for table in font['cmap'].tables:
  if table.isUnicode():table.cmap[ord(ch.upper())]=name
# Contextual first o preserves text content as “consumidor”, not “cqnsumidor”.
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
cmap=font.getBestCmap()
addOpenTypeFeaturesFromString(font,'feature calt { sub %s %s\' %s by %s; } calt;' % tuple(cmap[ord(c)] for c in 'conq'))
for rec in font['name'].names:
 if rec.nameID in (1,2,3,4,6):
  value={1:'Consumidor Referencia',2:'Regular',3:'ConsumidorReferencia-1.0',4:'Consumidor Referencia',6:'ConsumidorReferencia-Regular'}[rec.nameID]
  rec.string=value.encode(rec.getEncoding())
font.save(ROOT/'public/art-studio/fonts/ConsumidorReferencia-Regular.ttf')
