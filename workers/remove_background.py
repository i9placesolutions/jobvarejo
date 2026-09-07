"""BiRefNet ONNX inference; preserves original RGB and model alpha."""
import os
import sys
from rembg import new_session, remove

model = os.environ.get('BIREFNET_MODEL', 'birefnet-general-lite')
if model not in {'birefnet-general', 'birefnet-general-lite'}:
    raise ValueError(f'Modelo BiRefNet não suportado: {model}')
session = new_session(model, providers=['CPUExecutionProvider'])
with open(sys.argv[1], 'rb') as source:
    result = remove(source.read(), session=session, alpha_matting=False, post_process_mask=False)
with open(sys.argv[2], 'wb') as output:
    output.write(result)
