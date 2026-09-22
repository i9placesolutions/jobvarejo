# Cartazes: lettering e cabeçalhos

## Inventário autenticado — 21/09/2026

A sessão disponibilizada pelo usuário revelou **16 modelos**. Além dos 14 públicos, há **Leve/Pague** (entrada `SABÃO EM PÓ 500G | 4 | 3`, quantidades sem preço) e **Faixa de 2 Metros**, horizontal de **200 × 62 cm**. Ambos foram adicionados como composições próprias editáveis. A geração de dois exemplos no site de referência consumiu dois cartazes da cota da conta; nenhuma compra ou alteração de plano foi feita.

Também observados: A1–A7 incluindo A4; tema de topo, logo, validade, limite, vencimento próximo, paisagem, R$, CADA, Dobre aqui, remoção de fundo, centralização, edição individual, PNG e PDF. Categorias de cabeçalho vistas: Recentes, Novidades, Ofertas, Hortifruti, Açougue, Bebidas, Datas Comemorativas, Feriados, Limpeza, Padaria, Pet e Saudável. Ofertas expôs 11 opções e Hortifruti 5; o total de artes privadas de todas as categorias não foi contado. Não alegar que as 100 campanhas JobVarejo são cópias dessas artes.

Implementados nesta ampliação: dois modelos faltantes; A4; correção da capacidade A5/A6/A7 para 2/4/8 por folha; título, R$, CADA, dobra e remoção de fundo; campos específicos de segunda unidade, atacado, pack, combos e quantidades Leve/Pague; número de cópias; PDF real e A4 com rasterização Fabric e dimensões físicas independentes dos pixels. Faixa no PDF real mede 2000 × 620 mm. Mosaico prioriza escala física exata, podendo usar mais folhas que a referência nos formatos ISO de medidas arredondadas. O botão Imprimir todos baixa o PDF A4 pronto; não depende da impressão do DOM antes de renderizar SVG.

Limites: importação de planilhas/imagens, centralização automática e personalizações individuais de validade/limite não foram adicionadas nesta etapa. A biblioteca de cabeçalhos continua sendo a existente no JobVarejo, conforme pedido. Não foi verificado salvamento autenticado do módulo JobVarejo nem aplicada a migração. Os testes PDF validam estrutura, dimensão e paginação com imagem de teste; não substituem prova visual de um arquivo exportado com produtos reais.

Referência visual observada em 21/09/2026: https://cartazista.online/ (galeria pública com 14 modelos). Papel branco, pinceladas amarelas, título e preços vermelhos, nome preto em lettering e centavos menores. Construção própria com Knewave já disponível no projeto e formas vetoriais editáveis; não usa imagens achatadas dos cartazes da referência nem sua fonte proprietária.

O catálogo e as novas composições usam `utils/cartazista/lettering.ts`. Preços, quantidades, descontos, validade e condições permanecem dados. `CartazistaCanvas` e `CartazistaPreview` ajustam a tipografia com métricas Fabric, sem alterar os renderizadores existentes. A impressão preserva as camadas da composição editada ao trocar o produto.

## Cabeçalhos já cadastrados

`GET /api/cartazista/headers` é autenticado e projeta os 100 fundos/selos públicos disponíveis no catálogo de encartes preparado em `shared/video-studio/generated-flyer-recipes.json`. Usa os assets originais de `public/video-studio/templates/`; não instancia nem modifica o editor de vídeos. Esta é a biblioteca já preparada, não uma consulta em tempo real de todos os futuros modelos do banco.

O seletor “Cabeçalho do JobVarejo” persiste a campanha escolhida em `settings.header`. Os modelos de campanha recebem uma opção cadastrada ao criar; os demais mantêm lettering e também permitem escolher campanha. Cartazes antigos permanecem intactos até o usuário escolher “Aplicar novo visual de cartaz”.

## Revisão visual

`npx vite --config scripts/cartazista-preview/vite.config.mjs` abre a galeria técnica em `http://127.0.0.1:4412/`, com o mesmo gerador de composição e métricas Fabric do módulo. É uma revisão visual, não prova de salvamento autenticado ou deploy. Testes: `npx vitest run tests/cartazista/composition.test.ts`.
