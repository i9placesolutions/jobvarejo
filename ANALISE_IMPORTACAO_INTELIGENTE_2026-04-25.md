# Diagnóstico: Matching no Wasabi Não Encontra Imagens Corretas

> Foco: Somente busca interna no Wasabi. Busca externa NÃO será reativada.

---

## Resumo das Causas

O sistema tem imagens no Wasabi, mas o `findBestS3Match` NÃO encontra a imagem correta para o produto. São **3 bugs principais** no `product-image-matching.ts` que explicam a falha:

| # | Bug | Impacto | Linha |
|---|-----|---------|-------|
| 🔴 | `isFuzzyMatchValid` rejeita match quando o **arquivo é mais específico que a busca** | ALTO — maior causa de falsos negativos | 222-232 |
| 🟠 | `isFuzzyMatchValid` trata **todos** os 47 tokens do `VARIANT_KEYWORDS` como mutuamente exclusivos | ALTO — rejeita matches válidos | 165-176 |
| 🟡 | `normalizeSearchTerm` **ordena alfabeticamente** os tokens | MÉDIO — perde semântica de ordem | 142 |

---

## Bug 1 (CRÍTICO): Arquivo mais específico que a busca é rejeitado

**Arquivo**: `server/utils/product-image-matching.ts`, linhas 222-232

```typescript
for (const variant of VARIANT_KEYWORDS) {
  const inSearch = searchWords.has(variant)
  const inMatch = matchWords.has(variant)
  if (inSearch !== inMatch) {   // ← BUG: comparação XOR
    return false                  // ← rejeita quando APENAS UM lado tem a variante
  }
}
```

### O problema:

O código exige que CADA variante esteja **presente nos dois lados OU ausente nos dois lados**. Isso rejeita casos onde o arquivo no S3 é **mais específico** que a busca:

| Busca (search) | Arquivo no S3 (match) | `inSearch !== inMatch`? | Resultado |
|---|---|---|---|
| `coca cola` | `coca-cola-zero-2l.jpg` → "zero" | `false !== true` → **REJEITADO** | ❌ |
| `leite piracanjuba` | `leite-piracanjuba-integral-1l.jpg` → "integral" | `false !== true` → **REJEITADO** | ❌ |
| `suco laranja` | `suco-laranja-1l.jpg` → contém "uva"? Não, então "uva" está ausente nos dois → OK | mas "laranja": `true !== true` → OK | ✅ |
| `coca cola zero` | `coca-cola-original-2l.jpg` → "original" presente no match, "zero" || `true !== false` (zero), `false !== true` (original) → **REJEITADO** | ✅ (correto — conflito real) |

### Exemplo concreto:

1. Usuário importa "Leite Piracanjuba 1L" (sem a palavra "integral")
2. No Wasabi existe: `uploads/leite-piracanjuba-integral-1l.jpg`
3. `normalizeSearchTerm("Leite Piracanjuba 1L")` → `"1l leite piracanjuba"`
4. `normalizeSearchTerm("leite-piracanjuba-integral-1l")` → `"1l integral leite piracanjuba"`
5. `isFuzzyMatchValid` detecta "integral" no match mas não na busca → **REJEITADO**
6. Resultado: **"Nenhuma imagem encontrada"** — mesmo com a imagem correta no Wasabi

### A lógica correta:

O match só deveria ser rejeitado quando a **busca especifica uma variante** que o **arquivo não tem** (conflito real):

```
- busca tem "zero", arquivo tem "original" → REJEITAR (conflito)
- busca tem "limao", arquivo tem "laranja" → REJEITAR (conflito)  
- busca NÃO tem "integral", arquivo TEM "integral" → ACEITAR (arquivo é mais específico)
- busca NÃO tem "zero", arquivo TEM "zero" → ACEITAR (arquivo é mais específico)
```

---

## Bug 2 (ALTO): 47 tokens tratados como mutuamente exclusivos

**Arquivo**: `server/utils/product-image-matching.ts`, linhas 165-176

```typescript
const VARIANT_KEYWORDS = new Set([
  'zero', 'light', 'diet', 'sem', 'sugar', 'free',
  'original',
  'plus', 'max', 'mini', 'mega', 'ultra', 'pro',
  'suave', 'forte', 'extra', 'premium', 'gold', 'silver',
  'integral', 'desnatado', 'semidesnatado', 'light',
  'lactose', 'sem lactose', 'organico', 'natural',
  'limao', 'laranja', 'uva', 'morango', 'manga', 'abacaxi',
  'maca', 'pessego', 'maracuja', 'guarana', 'cereja',
  'chocolate', 'baunilha', 'caramelo', 'menta', 'hortela',
  'coco', 'amendoim', 'cafe', 'leite', 'mel'
])
```

Todos esses 47 tokens são tratados como **variantes mutuamente exclusivas**. Mas há 3 categorias diferentes que deveriam ter regras diferentes:

### Categoria A: Sabores (devem ser mutuamente exclusivos entre si)
`limao`, `laranja`, `uva`, `morango`, `manga`, `abacaxi`, `maca`, `pessego`, `maracuja`, `guarana`, `cereja`, `chocolate`, `baunilha`, `caramelo`, `menta`, `hortela`, `coco`, `amendoim`, `cafe`, `leite`, `mel`

**Regra**: Se a busca pede "laranja" e o arquivo é "uva" → REJEITAR. Mas se a busca NÃO especifica sabor e o arquivo TEM sabor → ACEITAR.

### Categoria B: Variantes de produto (devem ser mutuamente exclusivos entre si)
`zero`, `light`, `diet`, `original`, `tradicional`, `classico`

**Regra**: Se a busca pede "zero" e o arquivo é "original" → REJEITAR. Se a busca NÃO especifica → ACEITAR.

### Categoria C: Atributos de produto (NÃO deveriam ser mutuamente exclusivos)
`integral`, `desnatado`, `semidesnatado`, `organico`, `natural`, `lactose`, `suave`, `forte`, `extra`, `premium`, `gold`, `silver`, `max`, `mini`, `mega`, `ultra`, `pro`, `plus`

**Regra**: "integral" vs "desnatado" é um conflito para leite → REJEITAR. Mas "premium" vs "gold" vs "silver" NÃO são mutuamente exclusivos de forma confiável. E "max", "mini", "mega", "ultra", "pro", "plus" são sufixos de marketing que podem aparecer no nome do arquivo sem serem relevantes para matching.

**Exemplo de falso negativo**: arquivo `suco-laranja-premium-1l.jpg`, busca `suco laranja 1l`. "premium" está no arquivo mas não na busca → REJEITADO. Mas "premium" é só um sufixo de marketing, não deveria invalidar o match.

---

## Bug 3 (MÉDIO): Ordenação alfabética perde semântica

**Arquivo**: `server/utils/product-image-matching.ts`, linha 142

```typescript
return [...set].sort().join(' ')
```

Após `normalizeSearchTerm`, os tokens são ordenados alfabeticamente. Isso não causa erros diretamente (porque a comparação usa `has()` em Set), mas:

1. Torna o debug mais difícil — os termos não são legíveis na ordem natural
2. A ordenação é desnecessária para o matching (já que `isFuzzyMatchValid` usa `Set`)
3. Torna a chave determinística menos previsível

---

## Bug 4 (MÉDIO): Tokens de 2 caracteres descartados

**Arquivo**: `server/utils/product-image-matching.ts`, linhas 589-593

```typescript
const getQueryTokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter(Boolean)
    .filter((t) => t.length > 2 || /^\d{2,}$/.test(t))  // descarta tokens <= 2 chars
    .filter((t) => !WEIGHT_TOKENS.has(t))
```

Tokens com 2 caracteres (exceto números) são descartados. Exemplos de produtos afetados:
- "leite LV" → "lv" descartado (sigla do produto)
- "arroz TP" → "tp" descartado
- "refri KS" → "ks" descartado (tamanho da lata)

---

## Correções Propostas

### 1. Corrigir `isFuzzyMatchValid` — arquivo mais específico que a busca deve ser ACEITO

**Arquivo**: `server/utils/product-image-matching.ts`, linhas 222-232

**Lógica atual** (errada):
```typescript
if (inSearch !== inMatch) return false  // XOR — rejeita se apenas um lado tem
```

**Lógica corrigida**:
```typescript
// Só rejeita se a BUSCA especifica uma variante que o MATCH não tem
// Se o match é mais específico que a busca, aceita
if (inSearch && !inMatch) return false  // busca tem, match não tem → conflito
// Se !inSearch && inMatch → ACEITA (match é mais específico)
```

### 2. Separar `VARIANT_KEYWORDS` em grupos com regras adequadas

**Categoria A — Sabores** (conflito bidirecional):
```typescript
const FLAVOR_KEYWORDS = new Set([
  'limao', 'laranja', 'uva', 'morango', 'manga', 'abacaxi',
  'maca', 'pessego', 'maracuja', 'guarana', 'cereja',
  'chocolate', 'baunilha', 'caramelo', 'menta', 'hortela',
  'coco', 'amendoim', 'cafe', 'leite', 'mel'
])
// Regra: se a busca tem sabor X e o match tem sabor Y (X !== Y) → REJEITAR
// Se o match tem um sabor que a busca não tem → ACEITAR
```

**Categoria B — Variantes de produto** (conflito bidirecional):
```typescript
const PRODUCT_VARIANT_KEYWORDS = new Set([
  'zero', 'light', 'diet', 'original'
])
// Regra: se a busca tem variante X e o match tem variante Y (X !== Y) → REJEITAR
// Se o match tem uma variante que a busca não tem → ACEITAR
```

**Categoria C — Atributos** (apenas conflitos fortes):
```typescript
const STRONG_ATTRIBUTE_CONFLICTS: Record<string, string[]> = {
  'integral': ['desnatado', 'semidesnatado'],
  'desnatado': ['integral', 'semidesnatado'],
  'semidesnatado': ['integral', 'desnatado']
}
// Regra: só rejeitar se for um conflito forte conhecido (ex: integral vs desnatado)
// Ignorar atributos como 'premium', 'gold', 'max', 'mini', etc.
```

### 3. Remover ordenação alfabética da normalização

A ordenação na linha 142 é desnecessária para o matching e dificulta o debug.

### 4. Reduzir `getQueryTokens` para aceitar tokens de 2+ caracteres

Mudar `t.length > 2` para `t.length >= 2` para não perder siglas importantes.

---

## Plano de Implementação

| Passo | O que fazer | Arquivo | Risco |
|-------|-------------|---------|-------|
| 1 | Corrigir `isFuzzyMatchValid` — aceitar match mais específico | `product-image-matching.ts:222-232` | BAIXO — só afrouxa, não restringe |
| 2 | Separar `VARIANT_KEYWORDS` em 3 categorias | `product-image-matching.ts:165-176,222-232` | MÉDIO — reclassificar tokens |
| 3 | Remover `sort()` da normalização | `product-image-matching.ts:142` | BAIXO — não afeta matching |
| 4 | Aceitar tokens de 2 caracteres | `product-image-matching.ts:593` | BAIXO — mais tokens, melhor match |
| 5 | Validar: rodar imports de teste com produtos que antes falhavam | Ambiente dev | — |

---

## Como testar

1. Fazer upload de uma imagem no Wasabi com nome contendo variante (ex: `leite-piracanjuba-integral-1l.jpg`)
2. Importar uma lista com "Leite Piracanjuba 1L" (sem "integral")
3. **Antes**: "Nenhuma imagem encontrada"
4. **Depois**: Deve encontrar `leite-piracanjuba-integral-1l.jpg`

Ativar logs de debug:
```bash
DEBUG_FUZZY=1 npm run dev
```
