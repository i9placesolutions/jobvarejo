# Especificação Completa - Sistema de Etiquetas de Preço

> **INSTRUÇÕES PARA CLAUDE CODE**: Implemente TODOS os 8 tipos de etiqueta de preço descritos abaixo. Cada tipo tem um layout visual diferente, campos específicos e comportamento próprio. O sistema é baseado no QR Ofertas (https://www.qrofertas.com/criar-jornal/builder-v2/).

---

## Visão Geral

O modal de "Opções de Preço" aparece quando o usuário clica no ícone de engrenagem (⚙) ao lado de cada produto no encarte. Contém:

- Checkbox "Aplicar em todos os produtos do encarte"
- Checkbox "Definir como Padrão da conta"
- 8 tipos de etiqueta selecionáveis via radio button
- Cada tipo tem preview visual à direita mostrando como fica

---

## Os 8 Tipos de Etiqueta

### 1. Preço Simples (PADRÃO)
**ID**: `simple`
**Descrição**: Mostra apenas o preço de oferta do produto.

**Campos**:
- Preço Oferta (obrigatório)
- Unidade (KG, UN, L, etc.)

**Layout visual**:
```
┌─────────────────────┐
│  R$  15 ,88         │  ← fundo colorido (cor do tema)
│              /kg    │
└─────────────────────┘
```

**CSS/Estrutura**:
```
[Selo com fundo]
├── "R$" (10px, bold)
├── Parte inteira "15" (28px, extrabold)
├── ",88" (14px, bold)
└── "/kg" (8px, normal, opacidade 80%)
```

---

### 2. Preço Normal e Preço de Oferta (De/Por)
**ID**: `from_to`
**Descrição**: Mostra o preço original riscado + preço de oferta. Opcionalmente mostra % de desconto.

**Campos**:
- Preço Normal / "De" (campo à esquerda, riscado)
- Preço Oferta / "Por" (campo principal, destacado)
- Desconto % (opcional, calculado automaticamente)
- Unidade
- Checkbox "Mostrar preço normal riscado"

**Layout visual**:
```
                      Por
         DE      ┌──────────────┐
      R$40,00    │ R$  20 ,00   │  KG
      (riscado)  │              │
                 └──────────────┘
```

**CSS/Estrutura**:
```
[Coluna esquerda]
├── "DE" (label pequeno)
└── "R$40,00" (texto riscado, fundo claro)

[Label "Por" acima do selo]

[Selo principal com fundo]
├── "R$" (10px)
├── "20" (28px, extrabold)
├── ",00" (14px)
└── "KG" (8px, superscript no canto)
```

---

### 3. Preço X por Y (Quantidade por preço)
**ID**: `x_per_y`
**Descrição**: Mostra a quantidade que o cliente leva por um determinado preço. Ex: "3 Kilos Por R$15,88"

**Campos**:
- Quantidade (número, ex: 3)
- Unidade da quantidade (Kilos, Unidades, Litros, etc.)
- Preço unitário original (campo à esquerda)
- Preço total da oferta (campo principal)

**Layout visual**:
```
                   3 Kilos Por
      PREÇO    ┌──────────────┐
     R$16,88   │ R$  15 ,88   │
               └──────────────┘
```

**CSS/Estrutura**:
```
[Label superior] "3 Kilos Por" (negrito)

[Coluna esquerda]
├── "PREÇO" (label pequeno)
└── "R$16,88" (fundo claro)

[Selo principal com fundo]
├── "R$" + "15" + ",88"
```

---

### 4. Preço Leve X Pague Y
**ID**: `take_pay`
**Descrição**: Mostra o preço de oferta e quantas unidades o cliente leva ao pagar por Y.

**Campos**:
- Leve (número, ex: 3)
- Pague (número, ex: 2)
- Preço unitário original (campo à esquerda)
- Preço de oferta (campo principal)
- Unidade

**Layout visual**:
```
                 Leve 3 Pague 2
      KILO     ┌──────────────┐
     R$20,00   │ R$  40 ,00   │  KG
               └──────────────┘
```

**CSS/Estrutura**:
```
[Label superior] "Leve 3 Pague 2" (negrito)

[Coluna esquerda]
├── "KILO" (label)
└── "R$20,00" (fundo claro)

[Selo principal]
├── "R$" + "40" + ",00"
└── "KG" (superscript)
```

---

### 5. Preço À Vista e Parcelado
**ID**: `installment`
**Descrição**: Mostra o preço à vista e o valor das parcelas, com opção de "Sem Juros".

**Campos**:
- Preço À Vista (campo à esquerda)
- Número de parcelas (ex: 10)
- Valor da parcela (campo principal)
- Checkbox "Sem Juros" / "Com Juros"

**Layout visual**:
```
                Apenas 10X de
    Á VISTA  ┌──────────────────┐
   R$1.539   │ R$  153 ,90      │
             └──────────────────┘
                Sem Juros
```

**CSS/Estrutura**:
```
[Label superior] "Apenas 10X de" (negrito)

[Coluna esquerda]
├── "Á VISTA" (label)
└── "R$1.539" (fundo claro)

[Selo principal]
├── "R$" + "153" + ",90"

[Label inferior] "Sem Juros" (centralizado, negrito)
```

---

### 6. Preço Simbólico (Moedas/Notas)
**ID**: `symbolic`
**Descrição**: Mostra moedas/notas reais no lugar dos valores. Indicado para campanhas de marketing com produtos abaixo de R$5.

**Campos**:
- Preço (usado para determinar quais moedas/notas mostrar)

**Layout visual**:
```
┌─────────────────────────────┐
│   [imagem de moedas de 1R$] │  ← Para R$1,99 mostra moedas
│   [ou nota de 5 reais]      │  ← Para R$5,00 mostra nota
└─────────────────────────────┘
```

**Comportamento**:
- R$0,01 - R$0,99: moedas de centavos
- R$1,00 - R$1,99: 1 moeda de R$1
- R$2,00 - R$4,99: moedas de R$1
- R$5,00 - R$9,99: nota de R$5
- R$10,00 - R$19,99: nota de R$10
- R$20,00+: nota de R$20

**Implementação**: Usar imagens PNG de moedas/notas brasileiras armazenadas no S3. Se não quiser usar imagens, pode renderizar com CSS (círculos dourados com "R$1" dentro).

---

### 7. Preço Clube / Programa de Fidelização
**ID**: `club_price`
**Descrição**: Mostra o preço normal E o preço de clube/fidelização. Permite customizar o nome do programa.

**Campos**:
- Nome do programa (texto, ex: "Preço Clube", "Cartão Fidelidade", "Preço Sócio")
- Preço normal (campo à esquerda, pode ser riscado)
- Preço do programa (campo principal, destacado)
- Desconto % (opcional)
- Unidade

**Layout visual**:
```
                 Preço Clube
      PREÇO    ┌──────────────┐
     R$16,88   │ R$  15 ,88   │  KG
               └──────────────┘
```

**CSS/Estrutura**: Idêntico ao "De/Por" mas com label customizável no topo em vez de "Por".

---

### 8. Antecipação de Ofertas (Sem preço, só texto)
**ID**: `anticipation`
**Descrição**: Mostra um texto personalizado no lugar do preço. Usado para antecipação de ofertas: "Oferta Especial", "Venha Conferir", "Em breve", etc.

**Campos**:
- Texto do selo (customizável, ex: "Preço Especial", "Venha Conferir", "Confira")
- Subtexto opcional

**Layout visual**:
```
         Preço
┌─────────────────────┐
│                     │
│     Especial        │  ← fundo colorido, texto grande
│                     │
└─────────────────────┘
```

**CSS/Estrutura**:
```
[Label superior] "Preço" (centralizado)

[Selo com fundo grande]
└── Texto customizado "Especial" (22px, bold, centralizado)
```

---

### 9. Sem Etiqueta
**ID**: `none`
**Descrição**: Não mostra nenhum preço. O produto aparece só com imagem e nome.

**Campos**: Nenhum campo de preço.

---

## Modelo de Dados

### Tabela FlyerProduct - campos de etiqueta:

```sql
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "priceMode" TEXT NOT NULL DEFAULT 'simple';
-- Valores: simple, from_to, x_per_y, take_pay, installment, symbolic, club_price, anticipation, none

ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL;          -- Preço "De" / preço normal
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "offerPrice" DECIMAL;             -- Preço "Por" / preço oferta
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "takeQuantity" INTEGER;            -- "Leve X" / "X kilos"
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "payQuantity" INTEGER;             -- "Pague Y"
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER;        -- Número de parcelas (10x)
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "installmentPrice" DECIMAL;        -- Valor da parcela
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "noInterest" BOOLEAN DEFAULT true; -- "Sem Juros"
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "clubName" TEXT;                   -- Nome do programa ("Preço Clube")
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "anticipationText" TEXT;           -- Texto ("Especial", "Confira")
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "showDiscount" BOOLEAN DEFAULT false; -- Mostrar % desconto
ALTER TABLE "FlyerProduct" ADD COLUMN IF NOT EXISTS "quantityUnit" TEXT;               -- Unidade da qtd ("Kilos", "Unidades")
```

### TypeScript types:

```typescript
export type PriceMode =
  | "simple"          // Preço Simples
  | "from_to"         // De/Por (preço normal + oferta)
  | "x_per_y"         // X por Y (quantidade por preço)
  | "take_pay"        // Leve X Pague Y
  | "installment"     // À vista e Parcelado
  | "symbolic"        // Moedas/Notas
  | "club_price"      // Preço Clube/Fidelização
  | "anticipation"    // Antecipação (texto customizado)
  | "none";           // Sem etiqueta

export interface FlyerProductData {
  // ... campos existentes ...
  priceMode: PriceMode;
  offerPrice: number | null;
  originalPrice: number | null;
  takeQuantity: number | null;
  payQuantity: number | null;
  installmentCount: number | null;
  installmentPrice: number | null;
  noInterest: boolean;
  clubName: string | null;
  anticipationText: string | null;
  showDiscount: boolean;
  quantityUnit: string | null;  // "Kilos", "Unidades", "Litros", "Pacotes"
}
```

---

## Componente PriceTag - Implementação

### Estrutura visual comum a todos os tipos:

```
[Coluna Esquerda]        [Selo Principal]
  Label pequeno           Cor de fundo do tema
  Preço secundário        R$ | INTEIRO | ,DECIMAL
  (fundo claro)                        | /UNIDADE
```

### Props do componente:

```typescript
interface PriceTagProps {
  priceMode: PriceMode;
  offerPrice: number | null;
  originalPrice: number | null;
  unit: string;                    // "kg", "un", "L"
  takeQuantity: number | null;
  payQuantity: number | null;
  installmentCount: number | null;
  installmentPrice: number | null;
  noInterest: boolean;
  clubName: string | null;
  anticipationText: string | null;
  showDiscount: boolean;
  quantityUnit: string | null;
  // Style
  bgColor: string;        // Cor de fundo do selo (vem do tema ou PriceTagStyle)
  textColor: string;       // Cor do texto
  shape: string;           // "rounded", "square", "pill"
  isHighlight: boolean;    // Produto em destaque (20% maior)
}
```

### Renderização condicional por modo:

```tsx
function PriceTag({ priceMode, ...props }: PriceTagProps) {
  switch (priceMode) {
    case "simple":
      return <SimplePriceTag {...props} />;
    case "from_to":
      return <FromToPriceTag {...props} />;
    case "x_per_y":
      return <XPerYPriceTag {...props} />;
    case "take_pay":
      return <TakePayPriceTag {...props} />;
    case "installment":
      return <InstallmentPriceTag {...props} />;
    case "symbolic":
      return <SymbolicPriceTag {...props} />;
    case "club_price":
      return <ClubPricePriceTag {...props} />;
    case "anticipation":
      return <AnticipationPriceTag {...props} />;
    case "none":
      return null;
    default:
      return <SimplePriceTag {...props} />;
  }
}
```

---

## Modal de Seleção de Etiqueta

### UI do modal:

```
┌──────────────────────────────────────────────────┐
│ Opções                                       [X] │
│                                                  │
│ ☐ Aplicar em todos os produtos do encarte        │
│ ☐ Definir como Padrão da conta                   │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ● Preço Simples                    [PREVIEW] │ │
│ │   Mostra apenas o preço de oferta  R$ 15,88  │ │
│ │   [PADRÃO]                                   │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ○ Preço normal e Preço de oferta   [PREVIEW] │ │
│ │   Mostre o Preço de oferta e o     DE  Por   │ │
│ │   desconto em %...                 R$40 R$20 │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ○ Preço X por Y                    [PREVIEW] │ │
│ │   Mostre a quantidade que o        3 Kilos   │ │
│ │   cliente leva...                  R$ 15,88  │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ ... (mais 5 opções com mesmo padrão) ...         │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ ○ Sem Etiqueta                               │ │
│ │   Não mostra o preço do produto.             │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Comportamento ao selecionar um tipo:

1. O radio button fica selecionado
2. O modal fecha automaticamente (ou fica aberto para configurar campos extras)
3. O encarte atualiza em tempo real mostrando a nova etiqueta
4. Se "Aplicar em todos" estiver marcado, atualiza todos os produtos
5. Salva via PUT `/api/flyers/{flyerId}/products/{productId}` com o novo `priceMode`

---

## Cores das Etiquetas (PriceTagStyle)

O sistema deve ter estilos pré-definidos de cores para os selos:

```typescript
const PRICE_TAG_STYLES = [
  { id: "pts-red",     name: "Vermelho",       bgColor: "#e53e3e", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-blue",    name: "Azul",           bgColor: "#2b6cb0", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-green",   name: "Verde",          bgColor: "#38a169", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-yellow",  name: "Amarelo",        bgColor: "#ecc94b", textColor: "#1a202c", shape: "rounded" },
  { id: "pts-orange",  name: "Laranja",        bgColor: "#dd6b20", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-black",   name: "Preto",          bgColor: "#1a202c", textColor: "#f6e05e", shape: "square" },
  { id: "pts-brown",   name: "Marrom",         bgColor: "#5D4037", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-purple",  name: "Roxo",           bgColor: "#805ad5", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-pink",    name: "Rosa",           bgColor: "#d53f8c", textColor: "#ffffff", shape: "rounded" },
  { id: "pts-pill-red",  name: "Pílula Verm.", bgColor: "#e53e3e", textColor: "#ffffff", shape: "pill" },
  { id: "pts-pill-green",name: "Pílula Verde", bgColor: "#38a169", textColor: "#ffffff", shape: "pill" },
  { id: "pts-square-red", name: "Quadrado Verm.", bgColor: "#e53e3e", textColor: "#ffffff", shape: "square" },
];
```

### Formas (shape):
- `rounded` → border-radius: 8px
- `square` → border-radius: 0px
- `pill` → border-radius: 999px
- `circle` → border-radius: 50%

### Cor do tema como padrão:
Quando não há PriceTagStyle selecionado, o selo usa a `primaryColor` do tema como bgColor.

---

## Formato do Preço no Selo

O preço é sempre formatado com esta estrutura:

```typescript
function formatPrice(value: number): { integer: string; decimal: string } {
  const fixed = value.toFixed(2);
  const [integer, decimal] = fixed.split(".");
  return {
    integer: integer.replace(/\B(?=(\d{3})+(?!\d))/g, "."), // 1.539
    decimal,
  };
}
```

**Tamanhos padrão** (quando não é destaque):
- "R$": 10px, bold
- Parte inteira: 22-28px, extrabold
- Vírgula + decimais: 12-14px, bold
- "/unidade": 7-8px, normal, opacidade 80%

**Quando é destaque** (isHighlight): multiplica todos os tamanhos por 1.15

---

## Elemento à Esquerda do Selo (preço secundário)

Nos modos `from_to`, `x_per_y`, `take_pay`, `installment` e `club_price`, há um elemento à esquerda do selo principal:

```
┌──────────┐  ┌─────────────────┐
│  LABEL   │  │                 │
│ R$XX,XX  │  │  SELO PRINCIPAL │
│          │  │                 │
└──────────┘  └─────────────────┘
```

**Estilo do elemento esquerdo**:
- Fundo: mais claro que o selo principal (ou transparente)
- Texto riscado (no modo `from_to`)
- Label em cima: "DE", "PREÇO", "KILO", "Á VISTA"
- Tamanho menor que o selo principal

---

## Campos Extras por Produto (quando o tipo de etiqueta muda)

Quando o usuário seleciona um tipo de etiqueta, os campos na edição do produto mudam:

| Modo | Campos visíveis |
|------|----------------|
| simple | Preço Oferta |
| from_to | Preço Normal (De), Preço Oferta (Por), ☐ Mostrar desconto % |
| x_per_y | Quantidade, Unidade qty, Preço unitário, Preço total |
| take_pay | Leve (qty), Pague (qty), Preço unitário, Preço total |
| installment | Preço À Vista, Parcelas (qty), Valor parcela, ☐ Sem Juros |
| symbolic | Preço (para determinar moedas/notas) |
| club_price | Nome programa, Preço normal, Preço clube, ☐ Mostrar desconto |
| anticipation | Texto do selo, Subtexto |
| none | (nenhum campo de preço) |
