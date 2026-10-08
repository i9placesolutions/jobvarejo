---
name: qrofertas-builder-v2
description: "Especialista no QROfertas Builder V2 e na replica local do builder no JobVarejo. Use quando o pedido mencionar explicitamente QROfertas, QR Ofertas, builder-v2, criar-jornal, portal qrofertas, publicacao turbo, TV indoor do QROfertas, QR Academy, ou quando precisar auditar, mapear, comparar, documentar, reproduzir ou implementar no repo fluxos especificos do builder externo, como produtos, temas, grades, etiquetas, modos de preco, layout de cards, regras e datas, fontes, exportacao e publicacao."
---

# QROfertas Builder V2

## Objetivo

Usar o QROfertas como referencia funcional de produto e o repo JobVarejo como implementacao concreta.

Esta skill serve para:

- auditar o builder externo
- comparar o builder externo com o repo local
- atualizar documentacao sobre o QROfertas
- orientar implementacoes locais inspiradas no builder
- localizar, nomear e validar funcoes reais do sistema

## Inicio rapido

1. Classifique o pedido:
   - Auditoria ou descoberta do produto: ler [QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md](QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md).
   - Funcao por funcao ou cobertura detalhada: ler [QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md](QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md).
   - Alteracao no repo local: ler [references/qrofertas-repo-map.md](references/qrofertas-repo-map.md) e depois abrir os arquivos do dominio afetado.
   - Especificacao funcional mais ampla do projeto: ler [pages/ESPECIFICACAO_QROFERTAS.md](pages/ESPECIFICACAO_QROFERTAS.md).
2. Separe logo no inicio:
   - o que foi confirmado no builder vivo
   - o que foi confirmado no source
   - o que e inferencia
   - o que depende de contexto e nao foi validado ponta a ponta
3. Feche sempre com um resultado operacional:
   - auditado
   - mapeado
   - implementado
   - bloqueado por lacuna real

## Regras de operacao

- Nao trate o builder externo como copia 1:1 do repo local.
- Nao diga que algo e "completo" sem indicar o nivel de confirmacao.
- Nao misture comportamento real do produto com suposicao sobre o repo.
- Nao repita claims de marketing ou claims legais sem fonte.
- Use os nomes reais das views, modais e controles quando eles existirem.
- Ao comparar builder e repo, entregue o gap de forma explicita:
  - comportamento no QROfertas
  - comportamento no JobVarejo
  - impacto
  - decisao recomendada

## Mapa rapido do produto

Estado validado na auditoria de 2026-04-07:

- `9` secoes visiveis no menu lateral
- `33` views detectadas no builder
- `13` modelos confirmados
- `28` grades confirmadas
- `9` modos de preco confirmados

Modulos principais:

- produtos
- temas
- regras e datas
- logo
- empresa
- fontes
- texto social
- dados do encarte
- portal

Modulos avancados e menos obvios:

- formas de pagamento
- empresa-portal
- interesses
- QR Academy
- destaque de produto
- etiqueta customizada
- bubble de desconto
- estrutura de titulo
- layout estrutural do produto
- tabela de precos
- snapshot
- render limpo
- publicacao turbo
- TV indoor

## Workflow principal

### 1. Auditoria do builder

Use esta trilha quando o pedido for sobre "o que o QROfertas faz".

Passos:

1. Abrir a auditoria geral.
2. Se o pedido for granular, abrir a matriz funcao por funcao.
3. Responder separando:
   - view ou acao
   - efeito funcional
   - endpoint ou fluxo relevante
   - status de confirmacao
4. Se houver diferenca com o `qroferta.md`, apontar a lacuna nominalmente.

### 2. Comparacao builder x repo

Use esta trilha quando o pedido for sobre paridade, clonagem funcional ou gap de implementacao.

Passos:

1. Ler [references/qrofertas-repo-map.md](references/qrofertas-repo-map.md).
2. Identificar o dominio:
   - sidebar e configuracoes
   - produtos
   - preco e etiqueta
   - exportacao/publicacao
3. Abrir os arquivos reais do repo antes de concluir.
4. Entregar:
   - o que existe no QROfertas
   - onde isso mora no repo
   - o que esta faltando
   - qual arquivo mudar

### 3. Implementacao local

Use esta trilha quando o pedido for para codar no JobVarejo com base no QROfertas.

Passos:

1. Ler o mapa do repo.
2. Abrir somente os arquivos do modulo afetado.
3. Preservar os contratos e nomes ja usados no repo.
4. Nao importar complexidade desnecessaria do builder externo.
5. Validar no fim qual comportamento ficou:
   - igual ao builder
   - equivalente
   - simplificado de proposito

## Mapa do repo local

Abrir [references/qrofertas-repo-map.md](references/qrofertas-repo-map.md) quando precisar sair da auditoria e entrar em codigo.

Atalhos principais:

- [pages/builder/[id].vue](pages/builder/[id].vue): shell do builder local
- [components/builder/BuilderSidebar.vue](components/builder/BuilderSidebar.vue): temas, regras, logo, empresa, fontes e configuracoes
- [components/builder/BuilderProductEditor.vue](components/builder/BuilderProductEditor.vue): fluxo geral da lista de produtos
- [components/builder/BuilderProductEditorCard.vue](components/builder/BuilderProductEditorCard.vue): campos, imagem e acoes por produto
- [components/builder/BuilderPriceOptionsModal.vue](components/builder/BuilderPriceOptionsModal.vue): modos de preco
- [components/builder/BuilderExportDialog.vue](components/builder/BuilderExportDialog.vue): exportacao e formatos
- [composables/useBuilderSocialText.ts](composables/useBuilderSocialText.ts): texto social/acessibilidade

## Pistas por tipo de pedido

### Se o pedido mencionar produtos

Pense em:

- ingestao e busca
- criacao
- edicao de nome/preco/unidade/limite
- imagem do produto
- layout do card
- destaque, etiqueta e bubble

Ler primeiro:

- [QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md](QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md)
- [references/qrofertas-repo-map.md](references/qrofertas-repo-map.md)

### Se o pedido mencionar publicacao, portal ou exportacao

Pense em:

- download
- modo leve
- render remoto
- portal
- publicacao turbo
- Meta
- TV indoor

Ler primeiro:

- [QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md](QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md)
- [QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md](QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md)

### Se o pedido mencionar documentacao ou skill

Pense em:

- manter o corpo curto
- mover detalhe para referencias
- registrar nivel de confianca
- evitar claims agressivos no `description`

## Entregas obrigatorias

### Para auditoria

Entregar nesta ordem:

1. o modulo ou funcao analisada
2. o status de confirmacao
3. o que o builder faz
4. o que o `qroferta.md` cobre ou nao cobre
5. o risco residual

### Para alteracao no repo

Entregar nesta ordem:

1. modulo funcional afetado
2. arquivos reais do repo
3. comportamento desejado
4. comportamento implementado
5. como validar

## Referencias

- [QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md](QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md): inventario geral do builder vivo.
- [QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md](QROFERTAS_AUDITORIA_FUNCAO_POR_FUNCAO_2026-04-07.md): matriz operacional do front, funcao por funcao.
- [references/qrofertas-repo-map.md](references/qrofertas-repo-map.md): mapa entre o builder externo e os arquivos do repo local.
- [pages/ESPECIFICACAO_QROFERTAS.md](pages/ESPECIFICACAO_QROFERTAS.md): especificacao funcional mais ampla usada no projeto.

## Criterio de conclusao

Finalize somente quando ficar claro:

- se a resposta fala do builder externo, do repo local ou dos dois
- qual foi a fonte usada para cada afirmacao importante
- quais modulos reais do sistema foram envolvidos
- quais lacunas ainda nao foram validadas ponta a ponta
