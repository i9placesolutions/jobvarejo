# QROfertas Repo Map

## Objetivo

Mapear o builder externo do QROfertas para os pontos mais proximos da implementacao local no repo JobVarejo.

Use este arquivo quando o pedido sair da auditoria da UI e entrar em codigo.

## Arquivos principais

- [pages/builder/[id].vue](../pages/builder/[id].vue): shell da pagina do builder local.
- [components/builder/BuilderSidebar.vue](../components/builder/BuilderSidebar.vue): menu lateral, temas, regras, logo, empresa, fontes e parte da busca/configuracao.
- [components/builder/BuilderProductEditor.vue](../components/builder/BuilderProductEditor.vue): lista e fluxo geral de edicao de produtos.
- [components/builder/BuilderProductEditorCard.vue](../components/builder/BuilderProductEditorCard.vue): campos do produto, imagem, busca, upload, remove bg e controles do card.
- [components/builder/BuilderPriceOptionsModal.vue](../components/builder/BuilderPriceOptionsModal.vue): modos de preco e etiqueta.
- [components/builder/BuilderExportDialog.vue](../components/builder/BuilderExportDialog.vue): exportacao, formatos e texto para publicacao.
- [composables/useBuilderSocialText.ts](../composables/useBuilderSocialText.ts): geracao de texto social/acessibilidade.

## Mapa por dominio

### 1. Navegacao e shell

- Builder externo:
  - menu lateral
  - painel de conteudo
  - area central de render
  - modais auxiliares
- Repo local:
  - [pages/builder/[id].vue](../pages/builder/[id].vue)
  - [components/builder/BuilderSidebar.vue](../components/builder/BuilderSidebar.vue)

### 2. Produtos

- Builder externo:
  - buscar produtos
  - colar lista
  - editar campos
  - trocar imagem
  - remover fundo
  - reorder
  - destaque por produto
- Repo local:
  - [components/builder/BuilderProductEditor.vue](../components/builder/BuilderProductEditor.vue)
  - [components/builder/BuilderProductEditorCard.vue](../components/builder/BuilderProductEditorCard.vue)

### 3. Preco e etiqueta

- Builder externo:
  - 9 modos de preco
  - etiqueta
  - bubble
  - preco normal/oferta
  - clube, simbolico, parcelado
- Repo local:
  - [components/builder/BuilderPriceOptionsModal.vue](../components/builder/BuilderPriceOptionsModal.vue)
  - [components/builder/BuilderProductEditorCard.vue](../components/builder/BuilderProductEditorCard.vue)

### 4. Temas, layout e apresentacao

- Builder externo:
  - tema
  - grade
  - boxes
  - texto
  - cores
  - rodape
  - zoom
  - layout estrutural do produto
- Repo local:
  - [components/builder/BuilderSidebar.vue](../components/builder/BuilderSidebar.vue)
  - arquivos de editor/canvas relacionados ao builder da pagina

### 5. Exportacao e publicacao

- Builder externo:
  - download
  - modo leve
  - texto para redes
  - publicacao turbo
  - portal
  - TV indoor
- Repo local:
  - [components/builder/BuilderExportDialog.vue](../components/builder/BuilderExportDialog.vue)
  - [composables/useBuilderSocialText.ts](../composables/useBuilderSocialText.ts)

## Como usar este mapa

1. Se o pedido for sobre interface e comportamento do QROfertas, ler primeiro:
   - [QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md](../QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md)
   - [QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md](../QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md)
2. Se o pedido for para alterar o repo local, abrir o arquivo do dominio correspondente antes de codar.
3. Se houver conflito entre o builder externo e o repo local, documentar explicitamente:
   - comportamento do builder externo
   - comportamento atual do repo
   - gap
   - decisao recomendada

## Regra pratica

Nao tratar o builder externo como copia 1:1 do repo local.
Use o QROfertas como referencia funcional e o repo como implementacao concreta.
