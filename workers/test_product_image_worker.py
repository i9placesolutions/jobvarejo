import unittest
import io
import sys
from unittest.mock import patch
from PIL import Image
import product_image_worker as worker
from product_image_worker import WorkerError, _apply_background_mask, external_image_storage_key


class ExternalUrlTest(unittest.TestCase):
    def test_raw_spaces_and_unicode_are_percent_encoded(self):
        self.assertEqual(
            worker.assert_safe_external_http_url(
                "https://example.com/Produtos/Biscoito chocolate 80g-é.jpg"
            ),
            "https://example.com/Produtos/Biscoito%20chocolate%2080g-%C3%A9.jpg",
        )


class BackgroundRemovalTest(unittest.TestCase):
    def test_preserves_source_rgb_and_rejects_product_erasure(self):
        source = Image.new("RGBA", (40, 40), "white")
        for y in range(8, 32):
            for x in range(8, 32):
                source.putpixel((x, y), (190, 20, 25, 255))
        prediction = source.copy()
        for y in range(40):
            for x in range(40):
                pixel = prediction.getpixel((x, y))
                prediction.putpixel((x, y), (*pixel[:3], 0 if pixel[0] > 240 else 255))

        result = _apply_background_mask(source, prediction)
        self.assertEqual(result.getpixel((0, 0)), (255, 255, 255, 0))
        self.assertEqual(result.getpixel((20, 20)), (190, 20, 25, 255))
        damaged = Image.new("RGBA", (40, 40), (255, 255, 255, 0))
        with self.assertRaisesRegex(WorkerError, "recortou o produto"):
            _apply_background_mask(source, damaged)

    def test_no_removal_is_rejected(self):
        source = Image.new("RGBA", (40, 40), "white")
        prediction = Image.new("RGBA", (40, 40), "white")
        with self.assertRaisesRegex(WorkerError, "nao removeu fundo"):
            _apply_background_mask(source, prediction)

    def test_storage_key_separates_removed_and_original_assets(self):
        url = "https://example.com/product.png"
        self.assertNotEqual(external_image_storage_key(url), external_image_storage_key(url, remove_background=False))

    def test_rembg_worker_is_called_and_transparency_is_returned(self):
        source = Image.new("RGBA", (40, 40), "white")
        for y in range(8, 32):
            for x in range(8, 32):
                source.putpixel((x, y), (190, 20, 25, 255))
        calls = []

        def fake_remove(payload, **kwargs):
            calls.append(kwargs)
            with Image.open(io.BytesIO(payload)) as image:
                mask = image.convert("RGBA")
            pixels = list(mask.getdata())
            mask.putdata([(*pixel[:3], 0 if pixel[0] > 240 else 255) for pixel in pixels])
            output = io.BytesIO()
            mask.save(output, format="PNG")
            return output.getvalue()

        fake_rembg = type("RembgStub", (), {
            "new_session": staticmethod(lambda *args, **kwargs: object()),
            "remove": staticmethod(fake_remove),
        })
        original_session = worker._BIREFNET_SESSION
        worker._BIREFNET_SESSION = None
        try:
            with patch.dict(sys.modules, {"rembg": fake_rembg}):
                result = worker.remove_external_image_background(source)
        finally:
            worker._BIREFNET_SESSION = original_session
        self.assertEqual(len(calls), 1)
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(result.getpixel((20, 20)), (190, 20, 25, 255))

    def test_preserves_existing_cutout_without_loading_rembg(self):
        source = Image.new("RGBA", (40, 40), (190, 20, 25, 255))
        for y in range(4):
            for x in range(40):
                source.putpixel((x, y), (255, 255, 255, 0))
        with patch.dict(sys.modules, {"rembg": None}):
            result = worker.remove_external_image_background(source)
        self.assertEqual(result.getpixel((0, 0)), (255, 255, 255, 0))
        self.assertEqual(result.getpixel((20, 20)), (190, 20, 25, 255))


class StorageProductMatchingTest(unittest.TestCase):
    def test_external_rank_blocks_wrong_brand_and_allows_exact_identity(self):
        ranked = worker.rank_google_image_candidates([
            {
                "url": "https://cdn.example.com/arroz-tio-urbano-1kg.webp",
                "title": "Arroz Branco Tio Urbano 1Kg",
                "source": "https://shop.example.com/arroz-tio-urbano-1kg",
            },
            {
                "url": "https://cdn.example.com/arroz-tio-joao-1kg.webp",
                "title": "Arroz Tio João 1Kg",
                "source": "https://shop.example.com/arroz-tio-joao-1kg",
            },
        ], {"name": "Arroz Tio João 1kg"})

        urbano = next(item for item in ranked if "Urbano" in item["title"])
        joao = next(item for item in ranked if "João" in item["title"])
        self.assertFalse(urbano["autoApplyEligible"])
        self.assertFalse(urbano["recommended"])
        self.assertTrue(joao["autoApplyEligible"])
        self.assertTrue(joao["recommended"])

    def test_external_rank_normalizes_spaced_weight_and_keeps_variant_gate(self):
        ranked = worker.rank_google_image_candidates([
            {"url": "https://cdn.example.com/joycolate-560g.webp", "title": "Achocolatado Joycolate 560g"},
            {"url": "https://cdn.example.com/joycolate-zero-560g.webp", "title": "Achocolatado Joycolate Zero 560g"},
        ], {"name": "Achocolatado Joycolate 560 g"})

        self.assertTrue(ranked[0]["autoApplyEligible"])
        self.assertTrue(ranked[0]["recommended"])
        self.assertFalse(ranked[1]["autoApplyEligible"])

    def test_joycolate_compound_brand_and_weight_match_named_wasabi_key(self):
        key = "imagens/manual-560-560g-achocolatado-colate-g-joy-ca0faea21a72-v2.webp"
        index = worker.StorageImageIndex([key, "imagens/achocolatado-joycolate-700g.webp"])

        match = index.find({"name": "Achocolatado Joycolate 560 g"})

        self.assertEqual(match[0] if match else None, key)

    def test_refresco_query_matches_suco_key_and_rejects_wrong_flavor_weight(self):
        wanted = "imagens/suco-adorei-sabores-80g-3HAvFVtr.png"
        index = worker.StorageImageIndex([
            "imagens/smart-src-762e660fbb866838-v3.webp",
            "imagens/suco-adorei-morango-30g.webp",
            "imagens/mistura-farinha-adorei-morango-30g.webp",
            wanted,
        ])

        match = index.find({"name": "Refresco em pó Adorei sabores 80 g"})

        self.assertEqual(match[0] if match else None, wanted)

    def test_worker_prefers_compatible_named_storage_before_opaque_registry_cache(self):
        wanted = "imagens/suco-adorei-sabores-80g-3HAvFVtr.png"

        class FakeStorage:
            def exists(self, key):
                return True

            def public_url(self, key):
                return "https://storage.example/" + key

        class FakeDb:
            def save_cache(self, *args, **kwargs):
                pass

            def save_registry(self, *args, **kwargs):
                pass

            def lookup_registry(self, identity_key):
                raise AssertionError("opaque registry should not take precedence")

            def lookup_cache(self, terms):
                raise AssertionError("opaque cache should not take precedence")

        result = worker.process_product(
            {"name": "Refresco em pó Adorei sabores 80 g"},
            FakeStorage(),
            FakeDb(),
            storage_index=worker.StorageImageIndex([wanted, "imagens/smart-src-opaque-v3.webp"]),
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["s3Key"], wanted)


if __name__ == "__main__":
    unittest.main()
