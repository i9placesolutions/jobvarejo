# Image And Template Rules

Ler este arquivo quando o pedido envolver imagem de produto, remocao de fundo, label template ou aplicacao visual no card.

## Imagem de produto

O fluxo principal passa por:
- cache
- registry
- matching deterministico
- busca externa
- validacao por IA
- upload final

Arquivos principais:
- [server/api/process-product-image.post.ts](/Users/rafaelmendes/Documents/jobvarejo/server/api/process-product-image.post.ts)
- [server/utils/product-image-pipeline.ts](/Users/rafaelmendes/Documents/jobvarejo/server/utils/product-image-pipeline.ts)

## Regras de escolha de imagem

Priorizar nesta ordem:
1. imagem aprovada no registry para a identidade do produto
2. cache interno reutilizavel
3. asset interno ou key ja processada
4. busca externa com validacao por metadata
5. validacao por IA para desempate

## Regras de risco

Marcar como suspeito quando:
- marca nao bate
- peso/sabor conflita
- imagem parece logo, vetor, mockup ou wallpaper
- a confianca depender apenas de heuristica fraca

Bloquear quando:
- houver conflito forte de variante
- a imagem for claramente outro produto
- a oferta estiver pronta para exportacao e ainda sem imagem confiavel

## Templates de etiqueta

O projeto ja trabalha com modelos de etiqueta e price groups.
Antes de criar um visual novo:
1. verificar se um template existente cobre o caso
2. checar se a zona ja suporta overrides de estilo
3. manter o comportamento de fit/layout da etiqueta

Entradas relevantes:
- [components/LabelTemplatesDialog.vue](/Users/rafaelmendes/Documents/jobvarejo/components/LabelTemplatesDialog.vue)
- [components/EditorCanvas.vue](/Users/rafaelmendes/Documents/jobvarejo/components/EditorCanvas.vue)
- [ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md](/Users/rafaelmendes/Documents/jobvarejo/ANALISE_EDITOR_DIAGNOSTICO_2026-02-17.md)

## Regra visual

Nao aplicar template apenas por gosto.
Escolher template conforme:
- quantidade de precos
- tipo de condicao comercial
- densidade da zona
- legibilidade do encarte
- compatibilidade com a hierarquia do card

## Saida recomendada para este fluxo

1. imagem escolhida e motivo
2. fallback se a imagem falhar
3. template de etiqueta selecionado
4. overrides de estilo aplicados
5. validacao visual obrigatoria
