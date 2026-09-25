import io
import json
import unittest
from unittest.mock import patch
from chromium_image_search import relevant_candidates, search_retailer_catalog

class SearchTest(unittest.TestCase):
    def test_irrelevant_bing_does_not_prevent_fallback(self):
        self.assertEqual(relevant_candidates([{'title': 'Libbs Farmacêutica', 'url': 'https://example.com/a.png'}], 'Sanditos 27g'), [])

    def test_catalog_preserves_requested_size(self):
        products = [{'productName': f'Salgadinho Sanditos Presunto Pacote {size}', 'link': 'https://www.bretas.com.br/produto/p', 'items': [{'images': [{'imageUrl': 'https://example.com/'+size+'.png'}]}]} for size in ('27g', '45g')]
        with patch('chromium_image_search.urlopen', return_value=io.BytesIO(json.dumps(products).encode())):
            result = search_retailer_catalog('SALGADINHOS SANDITOS SABORES 27G')
        self.assertEqual(len(result), 1)
        self.assertIn('27g', result[0]['title'])

    def test_catalog_unavailable_keeps_search_fallback(self):
        with patch('chromium_image_search.urlopen', side_effect=OSError('offline')):
            self.assertEqual(search_retailer_catalog('Sanditos 27g'), [])

if __name__ == '__main__':
    unittest.main()
