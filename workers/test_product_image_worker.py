import unittest
import io
import sys
from unittest.mock import patch
from PIL import Image
import product_image_worker as worker
from product_image_worker import WorkerError, _apply_background_mask, external_image_storage_key


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


if __name__ == "__main__":
    unittest.main()
