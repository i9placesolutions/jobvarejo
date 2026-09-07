# Busca de imagens com Chromium

Execute `sh workers/setup.sh` e configure `PRODUCT_IMAGE_PYTHON` com o caminho informado. O Chromium roda em modo headless pelo Playwright, sem chave de API. O editor chama `workers/chromium_image_search.py` pelo endpoint de processamento; o worker de lote usa o mesmo scraper.

O acervo interno continua prioritário. Somente quando falta imagem a busca pública do Bing é consultada, com fallback para Google. URLs candidatas continuam passando pela validação, ranking e armazenamento existentes. CAPTCHA e bloqueios são reportados, nunca contornados; nesses casos use a escolha manual e tente novamente mais tarde.

Para validar somente a consulta: `$PRODUCT_IMAGE_PYTHON workers/chromium_image_search.py "Arroz Tio João 1kg"`.

Para processar lote: `$PRODUCT_IMAGE_PYTHON workers/product_image_worker.py --input produtos.json --output manifesto.json --persist-db`.

No servidor, instale Python, as dependências de `requirements.txt`, Chromium e suas bibliotecas do sistema antes de habilitar o endpoint. `CHROMIUM_EXECUTABLE_PATH` permite usar um Chromium instalado pelo sistema. O Docker inclui o runtime Python, Chromium, os scripts e os pesos BiRefNet pré-carregados. O build falha se a instalação do modelo falhar, evitando baixar os pesos na primeira solicitação.

## Catálogos de mercados

As consultas do Bing priorizam páginas de Atacadão, Bretas, Carrefour e Pão de Açúcar por domínio de origem. Se houver poucos resultados, completam com busca geral. São buscas públicas direcionadas, não integrações com APIs privadas dos mercados. O endereço original da imagem e a página de origem são mantidos; marca, variante e peso continuam sendo avaliados pelo pipeline.

Remoção de fundo: `remove_background.py` usa BiRefNet general (ONNX oficial, via rembg), CPU, sem erosão adicional. Execute setup.sh antes de iniciar o servidor; o primeiro uso baixa os pesos (~1 GB) para ~/.u2net. Para pré-carregar: `"$PRODUCT_IMAGE_PYTHON" -c "from rembg import new_session; new_session('birefnet-general')"`. O servidor serializa as inferências e limita cada execução a 180 segundos. Configure PRODUCT_IMAGE_PYTHON também no ambiente de produção e inclua workers/ no container. Imagens já transparentes são preservadas. Imagens antigas danificadas precisam ser reenviadas a partir do original.

## Build em produção

As dependências, Chromium headless e pesos são instalados em camadas separadas. O build aceita `BIREFNET_MODEL_URL` como URL temporária de uma cópia dos pesos oficiais `BiRefNet-general-epoch_244.onnx` do rembg no Wasabi do projeto, com fallback para o GitHub e verificada pelo MD5 oficial `7a35a0141cbbc80de11d9c9a28f52697`. O cache BuildKit mantém partes completas; `download_model.py` baixa até 16 partes em paralelo e retoma e o checksum é obrigatório antes de copiar para a imagem. A inicialização testa Chromium, inferência em produto real e busca pública; `/api/health` expõe o resultado em `imageRuntime`.
