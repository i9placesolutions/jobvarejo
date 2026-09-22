import unittest
from normalize import normalize
class SpeechTests(unittest.TestCase):
 def test_retail_portuguese(self):
  self.assertEqual(normalize('ABOBORA CABOTIA QUILO, UM E NOVENTA E NOVE'), 'abóbora cabotiá quilo, um e noventa e nove')
  self.assertEqual(normalize('LARANJA QUILO,UM E NOVENTA E OITO'), 'laranja quilo, um e noventa e oito')
  self.assertEqual(normalize('aboboras e macaco'), 'aboboras e macaco')
  self.assertEqual(normalize('CABOTIA', [{'from':'CABOTIA','to':'cabô tiá'}]), 'cabô tiá')
 def test_currency(self):
  self.assertEqual(normalize('R$ 19,90'), 'dezenove reais e noventa centavos')
  self.assertEqual(normalize('R$ 1,01'), 'um real e um centavo')
  self.assertEqual(normalize('R$ 0,50'), 'cinquenta centavos')
 def test_units(self):
  self.assertEqual(normalize('500 g'), 'quinhentos gramas')
  self.assertEqual(normalize('1,5 L'), 'um litro e meio')
  self.assertEqual(normalize('R$ 29,90/kg'), 'vinte e nove reais e noventa centavos o quilo')
  self.assertEqual(normalize('R$ 19,90 UN'), 'dezenove reais e noventa centavos a unidade')
 def test_dates(self):
  self.assertEqual(normalize('01/09/2026'), 'primeiro de setembro de dois mil e vinte e seis')
  with self.assertRaises(ValueError): normalize('32/19')
 def test_pronunciation(self):
  self.assertEqual(normalize('I9 vende I90', [{'from':'I9','to':'i nove'}]),'i nove vende I90')
if __name__=='__main__':unittest.main()
