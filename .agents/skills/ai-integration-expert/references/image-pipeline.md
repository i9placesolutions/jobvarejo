# Pipeline de Imagem de Produto

## Fluxo completo (process-product-image.post.ts)

```
1. Registry DB (curado) -> hit? done
2. Cache DB (product_image_cache) -> hit? done
3. Redis cache (img:{term}, 24h TTL) -> hit? done
4. Asset names (uploads do usuario) -> match? done
5. Google CSE search
6. Serper API search (fallback/complemento)
7. AI validation (gpt-4o vision, multi-imagem)
8. Background removal (se aplicavel)
9. Upload para Wasabi S3
10. Save em cache DB + registry
```

## Busca Serper (server/utils/product-image-serper.ts)

API: `POST https://google.serper.dev/images`
Params: query, gl=br, hl=pt-br, num=10-15

### Scoring (`scoreByQueryRelevance`)
- Title match: +3
- Source match: +2
- URL/domain match: +1.4
- Product hints (produto/embalagem/pack): +3
- Bad hints (logo/vetor/clipart/mockup/banner): -10
- Bad domains (pinterest/freepik/shutterstock): -5
- Thumbnail/sprite: -4
- Dimensoes: minSide >= 280: +2.2, < 120: -4.5
- Token coverage >= 80%: +2, <= 20%: -2

### Filtros de ruido
Remove tokens: embalagem, produto, foto, supermercado, mercado, oferta, preco

## Busca Google CSE (server/utils/product-image-google-cse.ts)

API: `GET https://www.googleapis.com/customsearch/v1`
Params: key, cx, q, searchType=image, gl=br, hl=pt-BR
Scoring mais simples, sem relevancia.

## Validacao AI (server/utils/product-image-ai.ts)

Modelo: gpt-4o, temperature: 0.0, max_tokens: 300
Input: todas imagens candidatas como blocos text+image_url

### Criterios (em ordem):
1. Embalagem real do produto (nao foto generica)
2. Match de marca
3. Peso/volume exato
4. Sabor/variante correto
5. Qualidade da imagem
6. Tolerar erros de OCR
7. Rejeitar logos, vetores, mockups, renders

### Retorno
```ts
{ bestIndex, confidence (0-1), reason, isExactMatch, mismatchReasons[] }
```
Thresholds: strict >= 0.9, normal >= 0.75

## Variantes de query

`buildSerperQueryVariants()` e `buildExternalQueryVariants()`:
- Combina: nome + marca + peso + sabor + codigo
- Ordena por especificidade decrescente
- Tenta multiplas variantes ate coletar >= 8 candidatos

## Geracao de imagem (server/utils/openai-images.ts)

### openAiGenerateImage()
- API: `POST /v1/images/generations`
- Modelo: gpt-image-1
- Sizes: 1024x1024, 1024x1536, 1536x1024
- Background: transparent ou white
- Response: b64_json -> Buffer

### openAiEditImage()
- API: `POST /v1/images/edits`
- Modelo: gpt-image-1
- FormData: image[] (multiplas refs), mask, prompt, size, background
- Response: b64_json -> Buffer

### buildPromptFromInputs()
Combina: prompt base + site style + instrucoes extra + negative prompt + transparencia

## Remocao de fundo (remove-image-bg.post.ts, 633 linhas)

### Cascata (5 niveis)
1. **OpenAI** (Vercel): prompt em PT-BR para preservar produto
2. **Local ML large** (strict) -> **medium** (strict) -> **small** (strict)
3. **OpenAI fallback**: edit com background transparent
4. **Light-edge pixel**: flood-fill das bordas por distancia de cor
5. **Falha**: 422 com dica para configurar OpenAI

### Validacao de qualidade
- `hasMeaningfulTransparency()`: >= 1.5% pixels com alpha < 250
- `hasLikelySubjectPreserved()`: >= 7% pixels visiveis, >= 2% opacos
- Ambos devem passar

### bgPolicy modes
- `never`: resize + WebP otimizacao apenas
- `always`: processImageStrict com fallback
- `auto`: preservar original (otimizar apenas)
