# Biblioteca de efeitos de vídeo

Biblioteca isolada em `shared/video-studio`, usada pela prévia React/Remotion e pelo worker de MP4. Não depende do Fabric.js nem altera a Rádio Indoor. Controles novos são oferecidos no modelo de vitrine Impacto; os módulos são reutilizáveis para futuras composições. A skill de novos modelos continua para uma etapa posterior.

## Recursos instalados e recursos integrados

- `@remotion/effects@4.0.526`: pacote completo instalado no aplicativo e no worker. A auditoria importa todos os caminhos públicos e registra **74 funções** em [remotion-resources.json](./remotion-resources.json). `installed-callable` comprova importação, não validação visual ou controle pronto na interface.
- Sete funções integradas: `shine`, `glow`, `chromaticAberration`, `zoomBlur`, `outline`, `lightLeak` e `starburst`. Aplicadas via CanvasImage/Solid, sem exigir HTML-in-Canvas para renderizar os elementos do layout.
- `@remotion/transitions@4.0.526`: curvas springTiming com duração definida; `@remotion/noise@4.0.526`: variação determinística da câmera, poeira e descargas; `@remotion/shapes@4.0.526`: geometria vetorial das estrelas.
- Remotion, Player, bundler e renderer mantidos em 4.0.526. As versões estão fixadas nos dois lockfiles.

Referência técnica: https://www.remotion.dev/docs/effects/api

## Controles disponíveis

O registro em `effect-catalog.ts` é a fonte comum da interface, validação do backend e configuração das composições.

| Categoria | Quantidade | Exemplos |
|---|---:|---|
| Entrada dos produtos e preços | 8 | Pancada, disparo lateral, subida, queda, giro, elasticidade, recuo |
| Entrada dos textos | 8 | Palavras em sequência, expansão, inclinação, batida por palavra |
| Câmera | 6 | Impacto, tremor, câmera viva, balanço, pulso, estável |
| Transições | 12 | Zoom, chicote vertical, diagonal, persianas, portal, RGB, fumaça, foco |
| Camadas de ambiente adicionais | 8 | Velocidade, ondas, holofotes, descargas, reflexos, poeira, órbitas, túnel |
| Acabamento do produto | 6 | Original, reflexo, halo, RGB, desfoque de chegada, contorno |
| Sons sintetizados | 12 | Passagens, crescente, graves, metal, estalo, moeda, brilho, digital, explosão |
| Combinações prontas | 6 | Pancada, Flash, Explosão, Festa, Digital, Destaque |

As dez opções anteriores de atmosfera/movimento continuam disponíveis. Música: três trilhas anteriores e duas novas trilhas instrumentais originais (140 e 128 BPM); música enviada e geração MusicGPT permanecem disponíveis. A mudança de efeito não invalida a identidade da locução nem solicita nova geração paga.

## Origem dos recursos

CapCut Online foi consultado como referência de comportamento. Foram observadas categorias de câmera, Hits, Party, Motion, Light, Blur, transições, textos e sons. Entre os exemplos visíveis: Earthquake Echo, Zoom Drift, Spotlight Sway, Flash Zoom, Photon Sweep, Slash Smear, Zoom Vortex, Smoke Erosion e Snappy Impact. Catálogo consultado não significa que todos os itens foram aplicados ou reproduzidos exatamente.

**Não há pacotes, plugins, músicas, templates ou arquivos nativos extraídos do CapCut neste repositório.** Seu contrato restringe disponibilizar materiais isolados e sublicenciar a biblioteca a terceiros. Referência consultada: https://www.capcut.com/clause/material-license-agreement?lang=pt-BR (seções 1, 3 e 4). Qualquer transferência de materiais nativos para uma biblioteca SaaS depende de permissão específica, não da mera exportação de um vídeo.

Os doze sons e as duas novas músicas foram sintetizados por `workers/video-studio/make_catalog_audio.py`, sem samples externos. `public/video-studio/audio/catalog-provenance.json` registra origem, duração e SHA-256 de cada arquivo. Efeitos visuais novos usam código próprio e funções oficiais do Remotion, sob a licença do Remotion.

## Persistência e render

`document.motion` é opcional para compatibilidade. Ele contém entrada do produto, texto, preço, câmera, camadas do ambiente, velocidade, acabamento e sons. Alterações seguem o salvamento e a revisão normais do projeto. O schema rejeita IDs desconhecidos e listas duplicadas.

- Animações dependem de frames, sem relógio, CSS animation ou aleatoriedade por render.
- A segunda embalagem recebe direção oposta e atraso próprio; a entrada não recorta a imagem com máscaras.
- O wrapper da câmera move cenário e todos os elementos. Shake pode ser desligado.
- Os shaders de produto atuam em CanvasImage; dados e embalagens continuam presentes ao estabilizar a animação.
- Sons são resolvidos da biblioteca local tanto no navegador quanto no worker. Efeitos não mudam o tempo das cenas e preservam o limite de 30 segundos.
- Recursos visuais são separados em chunk de vídeo; a biblioteca não é carregada pelos editores de imagem para sua operação.

## Conferência

Auditar imports: `node scripts/video-studio/audit-remotion-resources.mjs`.

Gerar áudios originais: `python3 workers/video-studio/make_catalog_audio.py`.

Testes: `npx vitest run tests/video-studio`.

Frames de comparação: `node workers/video-studio/catalog-fixture.mjs` (usa os arquivos da demonstração local). Conferir separadamente API/persistência, navegador com WebGL e MP4 do worker. Pacote instalado, efeito integrado, render validado e aprovação estética do usuário são estados diferentes.
