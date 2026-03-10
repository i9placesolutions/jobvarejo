---
name: jobvarejo-offer-engine
description: "Especialista no fluxo comercial do JobVarejo, da ingestao de listas, PDFs, XLSX e imagens de oferta ate a pagina pronta para exportacao. Use quando Codex precisar normalizar produtos e precos, tratar atacarejo, pack/unit/special price, limites por cliente, escolher templates de etiqueta, encaixar produtos em product zones, validar imagem de produto, revisar consistencia comercial ou endurecer o pipeline entre dados brutos e encarte final."
---

# JobVarejo Offer Engine

## Objetivo

Atuar sobre o nucleo de negocio do projeto: transformar entrada comercial bruta em oferta visual confiavel dentro do editor.
Preferir reusar a semantica e os helpers do repo em vez de inventar um modelo novo.

## Inicio rapido

1. Ler `package.json`, a rota ou componente alvo e os arquivos listados em [references/repo-map.md](references/repo-map.md).
2. Classificar o pedido em uma trilha:
   - Ingestao e normalizacao: ler [references/pricing-schema.md](references/pricing-schema.md).
   - Imagens, etiquetas e aplicacao visual: ler [references/image-and-template-rules.md](references/image-and-template-rules.md).
   - Revisao antes de exportar ou publicar: ler [references/preflight-checklist.md](references/preflight-checklist.md).
3. Preservar o modelo de dados atual do repo.
4. Fechar sempre com um resultado operacional: aprovado, suspeito ou bloqueado.

## Regras de operacao

- Tratar o projeto como motor de producao de encartes, nao como editor generico.
- Nao simplificar estruturas de preco existentes; o repo ja suporta `price`, `pricePack`, `priceUnit`, `priceSpecial`, `priceSpecialUnit`, `priceWholesale` e `specialCondition`.
- Nao mexer levianamente em algoritmos centrais de grid, parse de preco, ajuste de imagem e persistencia sem antes mapear impacto.
- Sempre separar o que e dado bruto, dado normalizado, decisao visual e validacao final.
- Se a origem vier de IA, PDF, XLSX ou OCR, assumir que ha risco comercial; validar antes de aplicar em massa.
- Reusar product zones, global styles e label templates existentes antes de criar novos formatos.

## Workflow principal

### 1. Entender a origem

Identificar o insumo:
- texto simples
- tabela
- PDF
- planilha
- screenshot/foto de lista
- pagina ja montada no editor

Definir tambem o objetivo:
- importar produtos
- corrigir precos/condicoes
- aplicar layout
- validar encarte pronto

### 2. Normalizar a oferta

Mapear cada item para o contrato de produto do repo:
- nome
- marca, peso, sabor quando houver
- tipo de preco
- condicao especial
- limite por cliente
- metadata de embalagem
- imagem

Usar a linguagem do projeto:
- `retail`
- `wholesale`
- `pack`
- atacarejo com colunas multiplas

### 3. Aplicar ao editor

Decidir:
- tipo de pagina: `RETAIL_OFFER` ou `FREE_DESIGN`
- grid e densidade da `ProductZone`
- template de etiqueta
- estilo global
- necessidade de destaque por produto

Antes de criar algo novo, checar se o repo ja tem:
- helper
- tipo
- endpoint
- template
- fluxo de persistencia

### 4. Validar comercialmente

Executar checklist de [references/preflight-checklist.md](references/preflight-checklist.md).
Nenhuma mudanca de lote deve ser considerada pronta sem revisar:
- preco
- condicao
- imagem
- overflow
- consistencia visual
- legibilidade

## Trilhas de uso

### Ingestao e parsing

Usar quando o pedido mencionar:
- importar lista de ofertas
- ler PDF/XLSX/CSV
- extrair produtos de imagem
- corrigir parse de precos
- tratar pack/unit/special

Saida obrigatoria:
1. origem analisada
2. campos esperados
3. mapeamento para o modelo do repo
4. riscos de ambiguidade
5. plano de persistencia ou aplicacao

### Imagem e template

Usar quando o pedido mencionar:
- imagem de produto errada
- busca/match de produto
- remocao de fundo
- template de etiqueta
- splash/price group
- aplicacao em zona de produto

Saida obrigatoria:
1. criterio de match ou escolha
2. fallback
3. template/estilo aplicado
4. arquivos e funcoes afetadas
5. validacao visual

### Preflight de encarte

Usar quando o pedido mencionar:
- revisar encarte
- QA antes de exportar
- checar consistencia comercial
- validar pagina pronta

Saida obrigatoria:
1. itens aprovados
2. itens suspeitos
3. itens bloqueados
4. correcao recomendada
5. risco residual

## Entregas obrigatorias

### Para mudancas de codigo

Entregar nesta ordem:
1. fluxo do negocio afetado
2. contrato de dados impactado
3. arquivos a alterar
4. implementacao
5. como validar com dados reais

### Para analise sem codigo

Entregar nesta ordem:
1. diagnostico
2. classificacao do risco comercial
3. acao recomendada
4. o que automatizar depois

## Referencias

- [references/repo-map.md](references/repo-map.md): mapa do repo para ingestao, imagem, editor e persistencia.
- [references/pricing-schema.md](references/pricing-schema.md): semantica de preco, atacarejo, limites e contrato de produto.
- [references/image-and-template-rules.md](references/image-and-template-rules.md): pipeline de imagem, matching e templates de etiqueta.
- [references/preflight-checklist.md](references/preflight-checklist.md): checklist comercial e visual antes de exportar.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual foi a origem da oferta
- como ela foi normalizada
- como entrou no modelo do repo
- quais riscos comerciais ainda existem
- como validar antes de exportar
