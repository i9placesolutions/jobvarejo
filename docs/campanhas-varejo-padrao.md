# Coleções de varejo: encarte, cartaz e vídeo

Procedimento consolidado na revisão de Segunda da Limpeza em 28/09/2026, a partir do pedido de seguir os últimos modelos Operação Torra Tudo. A direção visual solicitada prevalece sobre receitas antigas. Não impor as cores, frase ou produtos desta campanha a outras.

## Escolher a referência correta antes de montar

1. Resolver a campanha por UUID e conferir proprietário, formatos, revisão e alterações existentes. Uma referência não autoriza copiar dados da conta para outro cliente.
2. Comparar a captura enviada, PNG/MP4 final e composição persistida. Nome de pasta, maior número de revisão ou registro atual no banco não provam aprovação visual. Se divergirem, rastrear recibos, scripts e render final que o usuário indicou.
3. A ocorrência de 28/09: o JSON/PNG local de cartaz Torra e o A4 no banco haviam voltado à composição branca genérica; os arquivos finais temáticos estavam no Wasabi. A base visual correta era `revision-3/posters/{a1..a7}.json/png` e `revision-2/posters/banner-2m.json/png`, sob o prefixo do projeto Torra `e69be142-fce7-4c83-8775-66e03030c071`. Para vídeo, `revision-2/video/recipe.json`, `props.json` e os MP4s. São pistas históricas; confirmar novamente antes de reutilizar.
4. Registrar em manifesto a origem de cada formato. Uma coleção pode usar revisões diferentes por formato. Guardar snapshot da versão destino e dos objetos de storage antes da revisão.

## Selo e identidade

- Preservar a referência como conjunto: hierarquia, tipografia, relevo, proporção e palavras integradas. O selo Limpeza inclui `HOJE É DIA DE`, `LIMPEZA` e `Segunda` na mesma imagem. Separar `Segunda` ou transformar o círculo em oval descaracteriza esta referência.
- Para lettering 3D raster, usar geração/edição de imagem com referência quando necessário. Não substituir por texto SVG fino com contorno só por facilidade. Inspecionar alpha real, bordas, acentos e recortes; preservar original e derivado.
- Selo separado do fundo e da logo dinâmica. Logo real grande e proporcional, slogan temático próprio e Instagram próximo. A frase `CASA LIMPA, PREÇO BAIXO!` pertence à campanha Limpeza, não é default universal.
- Adaptar azul/amarelo ou a paleta do tema em todos os canais, preservando legibilidade. Reutilizar assets duráveis; nunca depender de anexos temporários.

## Encartes

- Família habitual: Feed 1080×1350, quadrado 1080×1080, Story 1080×1920, A4 lógico 794×1123 e TV 1920×1080. Conferir os presets atuais e produzir composição própria por proporção.
- Retratos: selo à esquerda, logo grande à direita, slogan e Instagram abaixo da logo. Cabeçalho compacto, sem grandes vazios. Na revisão Limpeza o usuário pediu redução moderada de cerca de 10%; não repetir esse percentual cegamente em toda campanha.
- Validade em faixa nativa com pontas/curvas, contraste e texto legível. Na família recente, calendário e chamada/período/estoque formam um conjunto centralizado preferencialmente em uma linha; esta orientação prevalece sobre as duas linhas da referência histórica Nova Aliança. Evitar ícone isolado na extremidade. Manter `quickDataField: validity` e propriedades de resize/reflow, não inventar datas. Sem período informado, preservar a política de estoque existente.
- Ao reduzir o cabeçalho com autorização, aproveitar a área liberada para produtos. Atualizar painel, zona, retângulo interno, `_zoneWidth/Height` e snapshot em conjunto; preservar IDs, cards, estilos e regras da grade. Conferir após render, serialização e reload.
- TV: selo e logo na coluna esquerda, produtos à direita, validade inferior em uma linha, sem Instagram/WhatsApp/endereço. Nos demais formatos, rodapé de WhatsApp/endereço com campos dinâmicos.

## Cartazes de campanha

Não confundir o cartaz temático final com o layout branco genérico do Cartazista.

- Nesta família: fundo temático ocupa toda a página, selo e logo têm destaque, slogan tem faixa própria, Instagram no cabeçalho, nome do produto branco em Barlow Condensed 800, etiqueta retangular com borda/profundidade, preço branco com `richPrice: true`, validade central abaixo do preço e contatos no rodapé.
- Preservar `cartaz-campaign-scene`, sombras, camadas da frase, contatos e bindings. Apenas preencher `settings.header.tagline` não cria necessariamente a faixa visual.
- Partir da composição final verificada. `rebuildCartazistaComposition()` pode substituir uma composição customizada por um layout antigo; não executá-lo sobre a cena final sem comparar o resultado e preservar o padrão.
- Para atualizar os campos da cena preservada, conferir e usar `updatePosterLettering` quando compatível com o contrato atual, mantendo as camadas customizadas; validar o retorno visual.
- Conferir A1–A7 e banner de 2 m. Banner tem composição própria, não é retrato esticado. A base final do banner pode estar em revisão diferente da base dos retratos.
- Transportar estilo/geometria, nunca produtos, preços, logo ou contatos da campanha doadora como dados comerciais da campanha destino. Preservar os produtos destino e os bindings da conta.

## Vídeos no mesmo estilo dos últimos prontos

- Comparar a receita e o documento efetivamente usados no MP4 final, incluindo overrides. Alterar só a receita do catálogo pode não afetar um documento com configurações próprias.
- A direção Torra verificada usava transição `shutter`, entrada de produto `slam`, texto `stomp` e impacto `metal-hit`. A primeira Limpeza havia mudado para `slide`, `rise`, `word-pop` e `retail-pop-v1`, suavizando o resultado. Quando o pedido for a mesma dinâmica, preservar os valores efetivos suportados pelo runtime e adaptar apenas a identidade visual necessária.
- Comparar música, volume e efeitos; hash de áudio igual prova origem igual, não audição integral. Fundo animado deve combinar com o novo tema; não copiar fogo de Torra para uma campanha de limpeza por automatismo.
- Produto e etiqueta grandes, preço estável após a entrada. Conferir abertura, oferta, transições e fechamento nos dois formatos. Stills não comprovam movimento nem áudio; renderizar e conferir MP4.
- A foto precisa corresponder ao nome/quantidade/volume. Não mostrar três embalagens distintas quando a oferta descreve um único multiuso. Em demonstração sem dados reais, sinalizar claramente produto/preço ilustrativos e usar imagem coerente.

## Persistência e entrega

- Revisões atualizam os mesmos IDs do projeto, páginas, cartazes e vídeo. Scripts de criação que usam `randomUUID()` ou `INSERT` não servem como scripts de revisão.
- Upload em novos caminhos de revisão, seguido de leitura/hash. Só depois atualizar ponteiros em transação, com comparação do snapshot/revisão e proprietário. Abortar diante de alteração concorrente.
- Atualizar páginas, blueprints, miniatura, `template_config.assets.seal`, receitas custom/gerada, documento de vídeo quando necessário e registros de assets/renders. Preservar originais no storage.
- Confirmar leitura do banco e do storage; não basta existir arquivo local ou upload parcial. Validar schemas/IDs e conteúdo preservado. Código sem alteração funcional pede testes focados, não repetição automática de build completo.
- Galerias e links entregues precisam apontar para a revisão final, inclusive uma galeria já aberta. Criar também links revisionados para evitar cache antigo.
- Separar: prévia renderizada, dados persistidos, interação autenticada e deploy. Mostrar a arte revisada e mencionar apenas verificações realmente executadas.

## Pontos de retomada desta correção

`output/segunda-da-limpeza-2026-09-27/`: snapshot `revision-2/before.json`, selos/receitas e renders revisionados, scripts `revise-r3.mjs`, scripts de cartazes e persistência da revisão final. Conferir nomes existentes e recibos antes de executar: não presumir que um script intermediário é o último.

As skills `jobvarejo-modelos-encarte`, `jobvarejo-cartazes-campanha` e `jobvarejo-video-retail` aplicam este procedimento aos respectivos módulos. `jobvarejo-estudio-artes` trata `/art-studio`; não usar seu schema como substituto dos três módulos de ofertas.
