# Dia do Consumidor — seis conjuntos

Cada modelo contém feed, quadrado, stories, A4 lógico e banner horizontal. São documentos nativos do Estúdio de Artes, com fotos substituíveis, textos, logo dinâmica e efeitos separados. `manifest.json` registra os IDs persistidos, revisões e assets duráveis no Wasabi. `modelo-N.json` contém o documento editável correspondente.

## Edição

- Degradês lineares: cor inicial, cor final, intensidades e direção.
- Luzes, reflexos e sombras: gradientes radiais/lineares separados; cor, intensidade, posição, dimensão e opacidade.
- Fitas e curvas: formas vetoriais com cor e transformação.
- Celular: moldura, tela, câmera, sombra, reflexo e textos separados; cantos arredondados editáveis.
- Fotos, cesta e coração 3D: imagens independentes, substituíveis; não são vetorizadas.
- Logo: vínculo com a marca do cliente, auto trim e opções de contorno existentes.

## Fontes

Rascunhos revisados usam Patua One, Anton, Barlow, Caveat e Consumidor Referencia. Esta última reconstrói os caracteres visíveis do título geométrico sobre a base OFL Russo One; os demais caracteres ainda vêm da base. A fonte original não foi identificada. A fidelidade de fotografias, tipografia e composição ainda não está concluída.

O carregador foi corrigido para não trocar famílias especiais pelo arquivo da Oswald. Peso, tamanho, entrelinhas e largura horizontal das letras são independentes. Sombras de formas permitem desfoque e permanecem em camadas separadas.

Fontes oficiais: https://github.com/google/fonts/tree/main/apache/robotoslab, https://github.com/google/fonts/tree/main/ofl/audiowide, https://github.com/google/fonts/tree/main/ofl/bebasneue, https://github.com/google/fonts/tree/main/ofl/caveat.

As imagens de fundo completas geradas durante a exploração NÃO foram usadas nos rascunhos: os efeitos são camadas editáveis, conforme a correção solicitada pelo usuário.

`index.html` mostra a revisão com o Fabric real. `previews/` contém exportações do worker Pillow. A etiqueta SUA LOGO existe somente na galeria de revisão; o documento salvo contém o slot dinâmico.

Visibilidade restaurada no catálogo a pedido do usuário. Estarem disponíveis não significa que a revisão de fidelidade esteja concluída. O script preserva o estado publicado; somente `--draft` explícito o retira do catálogo.
