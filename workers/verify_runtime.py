"""Verifica os componentes reais antes de iniciar o servidor web."""
import json
import os
from pathlib import Path
from time import time
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from rembg import new_session, remove

started = time()
with sync_playwright() as p:
    options = {'headless': True}
    if os.environ.get('CHROMIUM_EXECUTABLE_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE_PATH']
    browser = p.chromium.launch(**options)
    page = browser.new_page()
    page.set_content('<title>worker-ready</title>')
    assert page.title() == 'worker-ready'
    browser.close()

session = new_session('birefnet-general', providers=['CPUExecutionProvider'])
# Uma inferência real confirma que o ONNX carrega e executa no CPU do servidor.
image = Image.new('RGB', (256, 256), 'white')
ImageDraw.Draw(image).rectangle((70, 30, 186, 226), fill='red')
output = remove(image, session=session)
assert output.size == image.size and output.mode == 'RGBA'
assert output.getchannel('A').getextrema()[0] < 255
result = {'python': True, 'chromium': True, 'birefnet': True,
          'checkedAt': int(time()), 'startupSeconds': round(time() - started, 2)}
Path('/tmp/jobvarejo-image-runtime.json').write_text(json.dumps(result))
print(json.dumps(result), flush=True)
