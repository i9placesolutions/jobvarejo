"""Verifica os componentes reais antes de iniciar o servidor web."""
import json
import os
import subprocess
import sys
from pathlib import Path
from time import time
from PIL import Image
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
source = Image.open('.output/public/coins/LEITE PO INTEGRAL ITALAC 400G.png').convert('RGBA')
source.thumbnail((512, 512))
image = Image.new('RGB', source.size, 'white')
image.paste(source, mask=source.getchannel('A'))
output = remove(image, session=session)
assert output.size == image.size and output.mode == 'RGBA'
alpha = output.getchannel('A')
assert alpha.getextrema()[0] < 255 and alpha.getextrema()[1] > 200
visible = sum(value > 127 for value in alpha.getdata()) / (output.width * output.height)
assert 0.05 < visible < 0.98
# A consulta pública não impede o servidor de iniciar se o buscador bloquear.
search = {'ok': False, 'candidates': 0}
try:
    probe = subprocess.run([sys.executable, 'workers/chromium_image_search.py', 'Leite em pó Italac 400g'], capture_output=True, text=True, timeout=65)
    candidates = json.loads(probe.stdout).get('candidates', [])
    search = {'ok': bool(candidates), 'candidates': len(candidates)}
except (subprocess.TimeoutExpired, ValueError):
    pass
result = {'python': True, 'chromium': True, 'birefnet': True,
          'search': search, 'foregroundRatio': round(visible, 3), 'checkedAt': int(time()), 'startupSeconds': round(time() - started, 2)}
Path('/tmp/jobvarejo-image-runtime.json').write_text(json.dumps(result))
print(json.dumps(result), flush=True)
