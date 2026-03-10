# Preflight Checklist

Ler este arquivo quando o pedido for revisar uma pagina, uma zona de produtos ou um encarte antes de exportar.

## Classificacao final

Cada item deve ser marcado como:
- aprovado
- suspeito
- bloqueado

## Checklist comercial

- nome do produto confere com a oferta?
- marca, peso e variante batem com a imagem?
- preco principal esta correto?
- preco especial nao sobrescreveu preco unitario por engano?
- `specialCondition` esta presente e legivel quando exigida?
- limite por cliente esta visivel quando existe?
- embalagem ou pack quantity estao coerentes?

## Checklist visual

- nenhum nome foi cortado ou ficou ilegivel
- a etiqueta cabe dentro do card
- preco inteiro, decimal e moeda estao alinhados
- a imagem nao invade areas reservadas do card
- o grid nao gerou orfaos ou distribuicao estranha
- contraste entre fundo, texto e destaque esta aceitavel

## Checklist estrutural

- tipo da pagina esta correto (`RETAIL_OFFER` vs `FREE_DESIGN`)
- `ProductZone` ainda respeita padding, gap e colunas esperadas
- o layout continua consistente apos reload
- thumbnails e persistencia nao foram quebrados

## Checklist de imagem

- imagem veio de fonte confiavel?
- ha cache ou registry para reaproveitar depois?
- a remocao de fundo nao deformou o produto?
- a imagem final nao e logo, mockup ou arte promocional errada?

## Checklist de lote

Para operacoes em massa:
- contar quantos itens foram aprovados
- listar suspeitos por motivo
- bloquear exportacao se houver erro comercial grave
- registrar quais regras foram automaticas e quais dependeram de revisao

## Formato de resposta recomendado

1. resumo do lote
2. aprovados
3. suspeitos
4. bloqueados
5. acoes corretivas
6. criterio para liberar exportacao
