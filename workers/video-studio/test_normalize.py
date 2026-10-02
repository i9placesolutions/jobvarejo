import unittest
from normalize import normalize
class SpeechTests(unittest.TestCase):
 def test_retail_portuguese(self):
  self.assertEqual(normalize('ABOBORA CABOTIA QUILO, UM E NOVENTA E NOVE'), 'abóbora cabotiá quilo, um e noventa e nove')
  self.assertEqual(normalize('LARANJA QUILO,UM E NOVENTA E OITO'), 'laranja quilo, um e noventa e oito')
  self.assertEqual(normalize('aboboras e macaco'), 'aboboras e macaco')
  self.assertEqual(normalize('CABOTIA', [{'from':'CABOTIA','to':'cabô tiá'}]), 'cabô tiá')
  self.assertEqual(normalize('BISTECA SUINA KG'), 'bisteca suína o quilo')
 def test_currency(self):
  self.assertEqual(normalize('R$ 19,90'), 'dezenove e noventa')
  self.assertEqual(normalize('R$ 1,01'), 'um e um')
  self.assertEqual(normalize('R$ 0,50'), 'zero e cinquenta')
  self.assertEqual(normalize('Bisteca por 19,90'), 'Bisteca por dezenove e noventa')
  self.assertEqual(normalize('R$ 1.299,90'), 'mil duzentos e noventa e nove e noventa')
  self.assertEqual(normalize('R$ 19,9'), 'dezenove e noventa')
  self.assertEqual(normalize('R$ 0,05'), 'zero e cinco')
  self.assertEqual(normalize('R$ 19,00'), 'dezenove reais')
  self.assertEqual(normalize(normalize('R$ 19,90')), 'dezenove e noventa')
  self.assertEqual(normalize('Promoção de 1,5 vezes'), 'Promoção de um vírgula cinco vezes')
 def test_legacy_spoken_currency_and_idempotence(self):
  cases = (
   ('dezenove reais e noventa centavos', 'dezenove e noventa'),
   ('um real e um centavo', 'um e um'),
   ('cinquenta centavos', 'zero e cinquenta'),
  )
  for original, expected in cases:
   with self.subTest(original=original):
    normalized = normalize(original)
    self.assertEqual(normalized, expected)
    self.assertEqual(normalize(normalized), normalized)
  self.assertEqual(normalize('Um limite real e uma unidade'), 'Um limite real e uma unidade')
 def test_units(self):
  self.assertEqual(normalize('500 g'), 'quinhentos gramas')
  self.assertEqual(normalize('1,5 L'), 'um litro e meio')
  self.assertEqual(normalize('R$ 29,90/kg'), 'vinte e nove e noventa o quilo')
  self.assertEqual(normalize('R$ 19,90 UN'), 'dezenove e noventa a unidade')
 def test_dates(self):
  self.assertEqual(normalize('01/09/2026'), 'primeiro de setembro de dois mil e vinte e seis')
  with self.assertRaises(ValueError): normalize('32/19')
 def test_remaining_numbers(self):
  self.assertEqual(normalize('Limite de 3 unidades por cliente'), 'Limite de três unidades por cliente')
  self.assertEqual(normalize('Leve 2 pacotes e ganhe 1'), 'Leve dois pacotes e ganhe um')
 def test_offer_shorthand(self):
  self.assertEqual(normalize('PERNIL SUINO C/ OSSO, R$ 19,99 KG'), 'pernil suíno com osso, dezenove e noventa e nove o quilo')
  self.assertEqual(normalize('BISTECA S/ OSSO, 10% OFF'), 'bisteca sem osso, dez por cento off')
  self.assertEqual(normalize('LEITE 1 L + 2 CX'), 'leite um litro mais duas caixas')
 def test_pronunciation(self):
  self.assertEqual(normalize('I9 vende I90', [{'from':'I9','to':'i nove'}]),'i nove vende I90')
if __name__=='__main__':unittest.main()
