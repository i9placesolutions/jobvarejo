# Repo Map

Use esta referencia quando o pedido sair da auditoria e entrar no codigo do JobVarejo.

Arquivos principais:

- [pages/builder/[id].vue](../../../pages/builder/[id].vue): shell da pagina do builder local.
- [components/builder/BuilderSidebar.vue](../../../components/builder/BuilderSidebar.vue): menu lateral, temas, regras, logo, empresa, fontes e parte da busca/configuracao.
- [components/builder/BuilderProductEditor.vue](../../../components/builder/BuilderProductEditor.vue): lista e fluxo geral de edicao de produtos.
- [components/builder/BuilderProductEditorCard.vue](../../../components/builder/BuilderProductEditorCard.vue): campos do produto, imagem, busca, upload, remove bg e controles do card.
- [components/builder/BuilderPriceOptionsModal.vue](../../../components/builder/BuilderPriceOptionsModal.vue): modos de preco e etiqueta.
- [components/builder/BuilderExportDialog.vue](../../../components/builder/BuilderExportDialog.vue): exportacao, formatos e texto para publicacao.
- [composables/useBuilderSocialText.ts](../../../composables/useBuilderSocialText.ts): geracao de texto social/acessibilidade.

Mapa por dominio:

- shell e navegacao:
  - [pages/builder/[id].vue](../../../pages/builder/[id].vue)
  - [components/builder/BuilderSidebar.vue](../../../components/builder/BuilderSidebar.vue)
- produtos:
  - [components/builder/BuilderProductEditor.vue](../../../components/builder/BuilderProductEditor.vue)
  - [components/builder/BuilderProductEditorCard.vue](../../../components/builder/BuilderProductEditorCard.vue)
- preco e etiqueta:
  - [components/builder/BuilderPriceOptionsModal.vue](../../../components/builder/BuilderPriceOptionsModal.vue)
  - [components/builder/BuilderProductEditorCard.vue](../../../components/builder/BuilderProductEditorCard.vue)
- exportacao e publicacao:
  - [components/builder/BuilderExportDialog.vue](../../../components/builder/BuilderExportDialog.vue)
  - [composables/useBuilderSocialText.ts](../../../composables/useBuilderSocialText.ts)

Regra pratica:

- use o QROfertas como referencia funcional
- use o repo como implementacao concreta
- documente qualquer gap antes de implementar
