import unittest
from align_voice import scene_boundaries

class AlignmentTests(unittest.TestCase):
    def test_actual_word_times_override_equal_length_estimates(self):
        scripts = [{'text': 'Ofertas Rodrigues'}, {'text': 'Batata doce dois reais'}, {'text': 'Cenoura dois reais'}, {'text': 'Aproveite agora'}]
        text = 'Ofertas Rodrigues Batata doce dois reais Cenoura dois reais Aproveite agora'.split()
        times = [0, .5, 2, 2.2, 2.4, 2.6, 7, 7.3, 7.6, 9, 9.3]
        words = [dict(word=w, start=t, end=t+.15) for w,t in zip(text,times)]
        self.assertEqual(scene_boundaries(scripts,words,10), [0,1.92,6.92,8.92,10])

    def test_unrecognized_product_fails_instead_of_guessing(self):
        scripts=[{'text':'Ofertas Rodrigues hoje'}, {'text':'Abóbora cabotiá por dois reais'}, {'text':'Aproveite agora'}]
        words=[dict(word=w,start=i,end=i+.1) for i,w in enumerate('Ofertas Rodrigues hoje por dois reais Aproveite agora'.split())]
        with self.assertRaises(ValueError): scene_boundaries(scripts, words, 10)

    def test_repeated_prices_do_not_replace_product_anchors(self):
        scripts=[{'text':'Ofertas'}, {'text':'Batata dois e noventa'}, {'text':'Cenoura dois e noventa'}, {'text':'Volte sempre'}]
        words=[dict(word=w,start=i*.5,end=i*.5+.3) for i,w in enumerate('Ofertas Batata dois e noventa Cenoura dois e noventa Volte sempre'.split())]
        result=scene_boundaries(scripts,words,6)
        self.assertAlmostEqual(result[2],2.42)

if __name__=='__main__': unittest.main()
