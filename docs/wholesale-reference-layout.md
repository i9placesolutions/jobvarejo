# Atacado — referência lateral (4 preços)

Modelo visual independente (`tpl_wholesale_reference_v1`) para ofertas de embalagem com preço avulso, unitário avulso, especial e unitário especial.

- Fonte Barlow; nome acima da imagem e dos preços.
- Imagem à esquerda; etiqueta à direita.
- Embalagem e quantidade acima da faixa azul.
- Faixa azul: caixa avulsa e unitário.
- Faixa vermelha: preço especial maior (46 contra 36 na base), com unitário complementar.
- Condição comercial na faixa amarela inferior.

Disponível na lista de Etiquetas como novo modelo. O layout lateral depende da presença do marcador `wholesale_reference_packaging` no modelo escolhido; produtos e etiquetas anteriores mantêm seu layout. Nenhum encarte existente é alterado diretamente no banco por esta implementação.

Valores ausentes permanecem ausentes. O selo ilustrado CENSURADO da referência não é gerado automaticamente por esta opção.

Validação: testes de estrutura, compatibilidade comercial, fonte e isolamento; prova visual da etiqueta em Fabric no navegador. A prova isolada não substitui a revisão do encarte completo após selecionar o modelo.
