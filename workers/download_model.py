"""Download verificável e retomável dos pesos oficiais, usado somente no build."""
import concurrent.futures
import hashlib
import os
from pathlib import Path
import sys
import urllib.request

OFFICIAL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx'
SIZE = 972666916
MD5 = '7a35a0141cbbc80de11d9c9a28f52697'
LITE_OFFICIAL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx'
LITE_SIZE = 224005088
LITE_MD5 = '4fab47adc4ff364be1713e97b7e66334'
CHUNK = 8 * 1024 * 1024


def checksum(path):
    digest = hashlib.md5()
    with path.open('rb') as source:
        for data in iter(lambda: source.read(CHUNK), b''):
            digest.update(data)
    return digest.hexdigest()


def config_for(target):
    """Select expected weights from the explicit output filename."""
    if Path(target).name == 'birefnet-general-lite.onnx':
        return LITE_OFFICIAL, LITE_SIZE, LITE_MD5
    return OFFICIAL, SIZE, MD5


def download(url, target):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    official, size, md5 = config_for(target)
    if target.exists() and target.stat().st_size == size and checksum(target) == md5:
        print('BiRefNet: cache íntegro', flush=True)
        return
    parts = target.parent / 'birefnet-parts'
    parts.mkdir(exist_ok=True)
    # A build arg from a previous General deployment may still be present in
    # Coolify. Never try those 1 GB weights when the Lite filename is selected.
    sources = [official] if official != OFFICIAL and 'birefnet-general-epoch_244.onnx' in url else list(dict.fromkeys([url, official]))

    def fetch(start):
        end = min(start + CHUNK, size) - 1
        part = parts / str(start)
        if part.exists() and part.stat().st_size == end - start + 1:
            return part
        for source in sources:
            for attempt in range(2):
                try:
                    req = urllib.request.Request(source, headers={'Range': f'bytes={start}-{end}'})
                    with urllib.request.urlopen(req, timeout=90) as response:
                        if response.status != 206 or response.headers.get('Content-Range', '').split('/')[0] != f'bytes {start}-{end}':
                            raise ValueError('Servidor não confirmou o intervalo solicitado')
                        temporary = part.with_suffix('.partial')
                        with temporary.open('wb') as output:
                            while True:
                                data = response.read(256 * 1024)
                                if not data:
                                    break
                                output.write(data)
                        if temporary.stat().st_size != end - start + 1:
                            raise ValueError('Parte incompleta')
                        temporary.replace(part)
                        return part
                except Exception:
                    # A URL assinada nunca vai para logs ou mensagens de erro.
                    continue
        raise RuntimeError(f'Não foi possível baixar a parte {start} do BiRefNet')

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        downloaded = list(pool.map(fetch, range(0, size, CHUNK)))
    temporary = target.with_suffix('.partial')
    with temporary.open('wb') as output:
        for part in downloaded:
            with part.open('rb') as source:
                for data in iter(lambda: source.read(CHUNK), b''):
                    output.write(data)
    if checksum(temporary) != md5:
        for part in downloaded:
            part.unlink()
        raise RuntimeError('Checksum do BiRefNet inválido; partes descartadas para nova tentativa')
    temporary.replace(target)
    for part in downloaded:
        part.unlink()
    print('BiRefNet: download completo e checksum oficial confirmado', flush=True)


if __name__ == '__main__':
    download(sys.argv[1], sys.argv[2])
