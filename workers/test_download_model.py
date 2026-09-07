import hashlib
import http.server
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
import download_model as model

DATA = b'weights-for-test' * 100

class Handler(http.server.BaseHTTPRequestHandler):
    requests = 0
    def do_GET(self):
        type(self).requests += 1
        if self.path == '/expired':
            self.send_error(403)
            return
        start, end = map(int, self.headers['Range'][6:].split('-'))
        self.send_response(206)
        self.send_header('Content-Range', f'bytes {start}-{end}/{len(DATA)}')
        self.end_headers()
        self.wfile.write(DATA[start:end + 1])
    def log_message(self, *args):
        pass

class DownloadTest(unittest.TestCase):
    def test_parallel_fallback_and_verified_cache(self):
        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}'
        try:
            with tempfile.TemporaryDirectory() as directory, patch.multiple(model, SIZE=len(DATA), CHUNK=100, MD5=hashlib.md5(DATA).hexdigest(), OFFICIAL=url+'/good'):
                target = Path(directory)/'model.onnx'
                model.download(url+'/expired', target)
                self.assertEqual(target.read_bytes(), DATA)
                count = Handler.requests
                model.download(url+'/expired', target)
                self.assertEqual(Handler.requests, count)
        finally:
            server.shutdown()
            server.server_close()

    def test_corrupt_parts_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory, patch.multiple(model, SIZE=100, CHUNK=100, MD5=hashlib.md5(b'x'*100).hexdigest()):
            parts=Path(directory)/'birefnet-parts'
            parts.mkdir()
            (parts/'0').write_bytes(b'y'*100)
            with self.assertRaisesRegex(RuntimeError, 'Checksum'):
                model.download('http://unused', Path(directory)/'model.onnx')
            self.assertFalse((parts/'0').exists())
            self.assertFalse((Path(directory)/'model.onnx').exists())

if __name__ == '__main__':
    unittest.main()
