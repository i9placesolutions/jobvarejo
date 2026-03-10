# Pricing Schema

Ler este arquivo quando o pedido envolver parse, normalizacao, exibicao ou validacao de preco.

## Contrato principal de produto

O projeto trabalha com estes campos relevantes em `Product`:

- `price`: preco principal
- `priceMode`: `retail`, `wholesale` ou `pack`
- `pricePack`: preco da caixa, fardo ou embalagem
- `priceUnit`: preco unitario
- `priceSpecial`: preco promocional de embalagem
- `priceSpecialUnit`: preco promocional unitario
- `specialCondition`: texto completo da condicao comercial
- `packQuantity`, `packUnit`, `packageLabel`: metadata de embalagem
- `priceWholesale`, `wholesaleTrigger`, `wholesaleTriggerUnit`: suporte legado e atacado
- `limitText`: restricao de compra

Fonte:
- [types/product-zone.ts](/Users/rafaelmendes/Documents/jobvarejo/types/product-zone.ts)

## Semantica de origem

O parser do repo ja considera:
- preco simples
- atacarejo
- preco por caixa
- preco por unidade
- preco especial
- observacao/condicao
- limite por cliente

Quando uma origem tiver apenas um preco, o sistema tende a povoar `price` e `priceUnit` com o mesmo valor.

## Regra de normalizacao

### Preco

Usar o helper ja existente para entrada heterogenea:
- [utils/product-zone-helpers.ts](/Users/rafaelmendes/Documents/jobvarejo/utils/product-zone-helpers.ts)

Regras praticas:
- manter numero internamente como `number` quando o fluxo permitir
- formatar para UI so na camada visual
- nunca comparar strings monetarias diretamente

### Atacarejo

Mapeamento esperado:
- `PRECO CX`, `PRECO CAIXA`, `PRECO FARDO`, `PRECO CX. AVULSA` -> `pricePack`
- `PRECO UND`, `PRECO UNIDADE`, `PRECO UND. AVULSA` -> `priceUnit`
- `PRECO ESPECIAL`, `PRECO ESPECIAL CX` -> `priceSpecial`
- `PRECO ESPECIAL UN`, `PRECO UND PROMO` -> `priceSpecialUnit`
- `OBS`, `OBSERVACOES`, `ACIMA DE ...` -> `specialCondition`

### Limite por cliente

O parser ja trata expressoes como:
- `LIMITE 3 UN`
- `LIMITE 3 UND POR CLIENTE`
- `MAXIMO 2 POR CLIENTE`
- `ATE 5 UNIDADES`

Regra:
- remover o texto de limite do nome
- preservar o texto normalizado em `limitText` ou campo equivalente do fluxo

## Decisao visual

Escolher `priceMode` com base na intencao comercial:
- `retail`: uma oferta simples e direta
- `pack`: quando o preco forte e da embalagem ou caixa
- `wholesale`: quando o desconto depende de gatilho de quantidade

Se houver mais de um preco valido, nao reduzir tudo a um unico valor sem explicitar a perda de semantica.

## Anti-erros

- Nao usar `price` como unico campo universal se a origem tiver colunas multiplas.
- Nao truncar `specialCondition`.
- Nao inferir embalagem apenas pela imagem.
- Nao transformar dado ambiguo em “correto” sem marcar como suspeito.

## Saida recomendada para normalizacao

Para cada item:
1. origem
2. campos brutos encontrados
3. payload normalizado
4. nivel de confianca
5. ponto de revisao humana, se houver
