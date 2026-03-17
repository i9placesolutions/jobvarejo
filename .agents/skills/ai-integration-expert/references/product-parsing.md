# Parsing de Produtos com AI

## Arquivo: server/api/parse-products.post.ts (805 linhas)

## Input

- JSON body: `{ text: string }`
- Multipart form: arquivo (CSV, TXT, PDF, XLSX, XLS, imagem)
- Limite: 12MB
- PDF: extraido via `pdf2json`
- XLSX: extraido via `xlsx`
- Imagens: otimizadas com sharp (max 1600px), enviadas como vision

## Modelo e config

- Modelo: `gpt-4o-mini`
- Temperature: 0.1 (extracao precisa)
- max_tokens: 3200
- response_format: `{ type: 'json_object' }`
- Timeout: 28s (Vercel) / 55s (local)

## Prompt (~220 linhas)

Regras principais:
- 5 tipos de preco: pricePack, priceUnit, priceSpecial, priceSpecialUnit, specialCondition
- Deteccao de limite de compra ("LIMITE 3 UND POR CLIENTE")
- Formato atacarejo (tabelas 4 colunas: varejo + atacado)
- Logica de unidade: UN vs KG baseada em patterns de peso
- Peso/gramatura mantido no nome do produto
- Deteccao de marca e sabor/fragrancia
- Codigo do produto (EAN/GTIN) - minimo 6 chars
- Locale brasileiro: virgula decimal, termos em portugues

## Pos-processamento

### normalizePrice(raw)
- Aceita "1,99", "1.99", "199"
- Sempre retorna formato "X,XX"
- Remove caracteres nao-numericos

### normalizeProductCode(raw)
- Remove nao-alfanumericos
- Minimo 6 caracteres

### normalizePackageUnit(raw)
- CAIXA -> CX, FARDO -> FD, UNIDADE -> UN, PACOTE -> PCT, etc.

### extractDefaultSpecialRuleFromSource(source)
- Extrai regras de header como "ACIMA DE X UNIDADES"
- Propaga specialCondition para produtos sem condicao explicita

### Preenchimento reciproco
- Quando packaging unitario (qty=1): pricePack = priceUnit

## Error handling

| Erro OpenAI | Status retornado |
|-------------|-----------------|
| 408/504 | 504 (timeout) |
| 429 | 503 (rate limited) |
| 400/413/422 | 422 (validation) |
| 401/403 | 500 (server config) |
| outros | 502 (upstream) |

## Deteccao de timeout

`isLikelyTimeoutError()` checa:
- AbortError
- "timeout", "timed out", "aborted"
- "headers timeout", "socket hang up"
