import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('art_studio',Path(__file__).resolve().parents[2]/'workers/art_studio.py')
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class ArtWorkerTests(unittest.TestCase):
 def doc(self):
  return {'version':1,'width':1080,'height':1350,'background':'#ffffff','layers':[{'id':'title','kind':'text','name':'Título','x':80,'y':200,'width':900,'height':400,'rotation':0,'opacity':1,'visible':True,'locked':False,'fill':'#123456','fontFamily':'Barlow','fontSize':112,'fontWeight':800,'text':'Mensagem especial para você e sua família','align':'left','binding':'companyName'}]}
 def test_five_formats_and_unicode(self):
  for width,height in [(1080,1350),(1080,1080),(1080,1920),(794,1123),(1920,1080)]:
   original=self.doc();doc=worker.compose(original,width,height,{'companyName':'Promoção • açougue • pão de queijo'})
   self.assertEqual(doc['layers'][0]['text'],'Promoção • açougue • pão de queijo')
   self.assertEqual(worker.render(doc,{}).size,(width,height))
   self.assertEqual(original['width'],1080)
 def test_missing_image_never_silent(self):
  doc=self.doc();doc['layers'][0].update(kind='image',src='/api/art-studio/assets/test')
  with self.assertRaises(ValueError):worker.render(doc,{})
 def test_dynamic_logo_remains_a_separate_layer(self):
  doc=self.doc();doc['layers'].append({**doc['layers'][0],'id':'logo','kind':'image','binding':'logo','src':''})
  composed=worker.compose(doc,794,1123,{'logo':'/api/art-studio/brand-logo'})
  self.assertEqual(composed['layers'][1]['src'],'/api/art-studio/brand-logo')
  self.assertEqual(composed['layers'][1]['kind'],'image')
 def test_invalid_dimensions(self):
  doc=self.doc();doc['width']=99999
  with self.assertRaises(ValueError):worker.render(doc,{})
 def test_each_font_and_icon(self):
  for font in worker.FAMILIES:
   self.assertGreater(worker.font_for({'fontFamily':font,'fontWeight':700},40).getlength('Você'),0)
  for icon in worker.ICONS:self.assertGreater(len(worker.icon_points(icon,100,100)),3)
 def test_no_nested_alternates(self):
  doc=self.doc();doc['alternates']=[self.doc()]
  self.assertNotIn('alternates',worker.compose(doc,794,1123,{}))

 def test_editable_gradient_and_vector_curve(self):
  doc=self.doc();layer=doc['layers'][0];layer.update(kind='shape',shape='rect',x=0,y=0,width=320,height=320,fill='#ffffff',gradient={'type':'linear','from':'#ff0000','to':'#0000ff','startOpacity':1,'endOpacity':1,'angle':0})
  image=worker.render(doc,{})
  self.assertEqual(image.getpixel((0,150))[:3],(255,0,0))
  self.assertEqual(image.getpixel((319,150))[:3],(0,0,255))
  layer['gradient'].update(type='radial',from_='#ffffff',endOpacity=0)
  layer.update(shape='path',pathData='M 0 0 L 100 0 L 0 100 Z')
  image=worker.render(doc,{})
  self.assertEqual(image.getpixel((319,319))[:3],(255,255,255))

 def test_shadow_is_independent_and_blur_changes_edge(self):
  doc=self.doc();doc['layers'][0].update(kind='shape',shape='ellipse',x=0,y=0,width=100,height=100,fill='#000000',blur=0)
  sharp=worker.render(doc,{})
  doc['layers'][0]['blur']=12
  soft=worker.render(doc,{})
  self.assertNotEqual(sharp.getpixel((10,20)),soft.getpixel((10,20)))
  doc['layers'][0]['visible']=False
  self.assertEqual(worker.render(doc,{}).getpixel((50,50))[:3],(255,255,255))

if __name__=='__main__':unittest.main()
