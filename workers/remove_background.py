"""BiRefNet general ONNX inference; preserves original RGB and model alpha."""
import sys
from rembg import new_session, remove

session = new_session('birefnet-general', providers=['CPUExecutionProvider'])
with open(sys.argv[1], 'rb') as source:
    result = remove(source.read(), session=session, alpha_matting=False, post_process_mask=False)
with open(sys.argv[2], 'wb') as output:
    output.write(result)
