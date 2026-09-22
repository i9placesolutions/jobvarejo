FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY workers/video-studio/package*.json ./
RUN npm ci --omit=dev
COPY workers/video-studio/requirements.txt /tmp/video-requirements.txt
RUN python3 -m venv /opt/video-python && /opt/video-python/bin/pip install --no-cache-dir -r /tmp/video-requirements.txt
RUN /opt/video-python/bin/python -c "from faster_whisper import download_model; download_model('small', output_dir='/opt/video-alignment-model')"
ENV VIDEO_ALIGNMENT_MODEL=/opt/video-alignment-model
ENV VIDEO_STUDIO_PYTHON=/opt/video-python/bin/python
COPY shared/video-studio ./shared/video-studio
COPY workers/video-studio ./workers/video-studio
COPY public/art-studio/fonts ./public/art-studio/fonts
COPY public/video-studio ./public/video-studio
RUN node --input-type=module -e "import {ensureBrowser} from '@remotion/renderer'; await ensureBrowser();"
CMD ["node","workers/video-studio/runner.mjs"]
