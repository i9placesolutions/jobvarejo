# Catálogo de encartes em vídeo

102 receitas derivadas dos 102 projetos de encarte inventariados em 20/09/2026. A identidade é o UUID do projeto-fonte; nomes repetidos são modelos diferentes. Cada receita suporta Reels/Stories (1080×1920) e TV (1920×1080), até 30 segundos.

## Conteúdo reutilizável

- `shared/video-studio/generated-flyer-recipes.json`: somente estilo, geometria, campanha, referências de arte e trilha. Não contém a marca, produtos, contatos ou voz da conta de demonstração.
- `public/video-studio/templates/catalog/`: cópias dos selos e fundos originais separados. Dois encartes têm título nativo editável em vez de imagem de selo; quatro mantêm seu fundo vetorial como gradiente.
- Três composições verticais e seis horizontais, distribuídas com variações de entradas, transições, câmera e atmosfera. As receitas têm a identidade de cada encarte; não são 102 geometrias independentes desenhadas manualmente.
- O preço usa `label_templates` da conta ou etiquetas globais disponíveis. Uma escolha explícita é respeitada; uma etiqueta de outra conta é recusada.
- Trocar de modelo mantém os dados do cliente. Projetos novos não recebem os dados da demonstração e começam sem locução.

## Música e som

102 instrumentais originais de 30 segundos, um por receita. `make_model_music.py` sintetiza bateria, baixo, acordes, motivos melódicos, estéreo e preenchimentos com sementes próprias, 11 famílias de arranjo e 6 andamentos. Não usa samples do CapCut nem chamadas pagas do MusicGPT. `model-music-provenance.json` registra arranjo e hash. `--changed` regenera somente receitas com estilo ou andamento alterado.

## Atmosferas

A biblioteca oferece fogo em camadas, labaredas de impacto, brasas ascendentes, fumaça, faíscas, lasers, bokeh e fitas luminosas, além das oito opções anteriores. São camadas independentes, calculadas a partir do frame e da semente, disponíveis na prévia e na exportação. A intensidade é editável e o usuário pode combinar até oito efeitos.

Os encartes distribuem folhas, fumaça, chamas, confetes, pétalas, relógios, neon, raios e luzes. Fogo tem textura mais línguas que mudam de forma; brasas têm trajetórias e profundidades diferentes. A paleta acompanha o encarte. Efeitos ficam atrás dos produtos e preços; os movimentos de câmera afetam a tela toda.

## Operação local retomável

1. `inventory-all-flyers.mjs`: leitura dos projetos-fonte da conta explicitamente informada em `VIDEO_TEST_USER_ID`.
2. `prepare-all-assets.mjs`: preserva as imagens originais e registra hashes.
3. `build-all-recipes.mjs`: gera receitas a partir das três composições-base estáveis.
4. `make_model_music.py`: gera instrumentais; Python requer NumPy e FFmpeg.
5. `render-all-model-stills.mjs --all`: confere enquadramentos dos 204 formatos; gera galeria local.
6. `publish-all-flyer-demos.mjs --render`: salva demonstrações pela API autenticada e alimenta a fila respeitando no máximo três gerações simultâneas por conta. O registro local permite acompanhar as revisões e resultados.

Os MP4s são privados, pertencem à conta da demonstração e são acessados pela API autenticada. Os modelos compartilhados não dependem desses MP4s. A geração de voz continua pertencendo a cada usuário.

Nenhuma alteração neste fluxo exige mudanças no editor de imagens ou Rádio Indoor. Publicação no servidor de produção é uma etapa separada.

## Fundos vibrantes — revisão 2

Seis fundos novos gerados com `image_gen`, cada um com arte horizontal e uma recomposição vertical independente: lava, azul elétrico, neon violeta, verde luminoso, festa de cores e vermelho/ouro. Arquivos em `public/video-studio/templates/backgrounds/`; prompts e referências em `backgrounds-provenance.json`. Não houve esticamento de arte horizontal para formar a vertical.

O fundo novo tem pan, aproximação e balanço calculados por frame; a arte original entra em outra camada para conservar elementos do encarte. Paletas saturadas, partículas e seis variações de movimento/cor por receita. O seletor “Fundo do vídeo” permite uma escolha explícita, preservada ao trocar de modelo. `templateRevision: 2` diferencia as novas demonstrações dos MP4s anteriores no fingerprint dos jobs. A revisão não constitui um repositório histórico completo de receitas.

A textura `retail-fire-curtain-v1.png` também foi gerada com `image_gen`; origem e prompt em `fire-asset-provenance.json`. Três camadas com turbulência e trajetórias independentes substituem as primeiras chamas geométricas.
