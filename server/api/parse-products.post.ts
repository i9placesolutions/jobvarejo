// Lazy load OpenAI para reduzir bundle size
import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'

let openaiInstance: any = null
const getOpenAI = async () => {
  if (!openaiInstance) {
    const { default: OpenAI } = await import('openai')
    const config = useRuntimeConfig()
    openaiInstance = new OpenAI({
      apiKey: config.openaiApiKey || ''
    })
  }
  return openaiInstance
}

const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_TEXT_CHARS = 60_000
const MAX_PROMPT_SOURCE_CHARS = 20_000
const MAX_IMAGE_DATA_URL_LENGTH = 12_000_000

const clampText = (value: unknown, maxChars = MAX_TEXT_CHARS): string => {
    const text = String(value ?? '').trim()
    if (!text) return ''
    return text.length > maxChars ? text.slice(0, maxChars) : text
}

const parsePdfBufferToText = async (buf: Buffer): Promise<string> => {
    process.env.PDF2JSON_DISABLE_LOGS = process.env.PDF2JSON_DISABLE_LOGS || '1'
    const mod: any = await import('pdf2json')
    const PDFParser = mod?.default || mod
    const parser = new PDFParser(undefined, 1)

    return await new Promise<string>((resolve, reject) => {
        let settled = false

        const done = (cb: () => void) => {
            if (settled) return
            settled = true
            try {
                parser.removeAllListeners?.()
            } catch {
                // ignore cleanup errors
            }
            cb()
        }

        parser.on('pdfParser_dataError', (errData: any) => {
            done(() => reject(errData?.parserError || errData || new Error('Failed to parse PDF')))
        })

        parser.on('pdfParser_dataReady', () => {
            done(() => {
                const rawText = typeof parser.getRawTextContent === 'function'
                    ? parser.getRawTextContent()
                    : ''
                resolve(String(rawText || ''))
            })
        })

        try {
            parser.parseBuffer(buf, 0)
        } catch (err) {
            done(() => reject(err))
        }
    })
}

export default defineEventHandler(async (event) => {
    const user = await requireAuthenticatedUser(event)
    enforceRateLimit(event, `parse-products:${user.id}`, 20, 60_000)

    const contentType = String(getHeader(event, 'content-type') || '');

    let text: string | undefined;
    let imageDataUrl: string | undefined;
    let filename: string | undefined;

    // Accept either JSON body `{ text }` (legacy) or multipart form-data with `file` (and optional `text`).
    if (contentType.includes('multipart/form-data')) {
        const form = await readMultipartFormData(event);
        const textPart = form?.find(p => p.name === 'text');
        if (textPart?.data) text = clampText(Buffer.from(textPart.data).toString('utf8'));

        const filePart = form?.find(p => p.name === 'file');
        if (filePart?.data) {
            filename = filePart.filename || undefined;
            const mime = String(filePart.type || '');
            const buf = Buffer.from(filePart.data);
            const fileSize = Number(buf.length || 0)
            if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
                throw createError({ statusCode: 400, statusMessage: 'Invalid file size (max 12MB)' })
            }

            if (mime.startsWith('image/')) {
                const base64 = buf.toString('base64');
                imageDataUrl = `data:${mime};base64,${base64}`;
                if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
                    throw createError({ statusCode: 400, statusMessage: 'Image payload too large (max 8MB)' })
                }
            } else {
                const ext = (filename || '').toLowerCase().split('.').pop() || '';

                if (mime === 'application/pdf' || ext === 'pdf') {
                    text = clampText(await parsePdfBufferToText(buf));
                } else if (
                    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    mime === 'application/vnd.ms-excel' ||
                    ext === 'xlsx' ||
                    ext === 'xls'
                ) {
                    // xlsx does not ship a typed declaration for this ESM subpath.
                    // @ts-expect-error subpath import is intentional to avoid heavier CJS bundle.
                    const mod: any = await import('xlsx/xlsx.mjs');
                    const XLSX = mod?.default || mod;
                    const wb = XLSX.read(buf, { type: 'buffer' });
                    const sheetName = wb.SheetNames?.[0];
                    const sheet = sheetName ? wb.Sheets?.[sheetName] : null;
                    if (!sheet) text = '';
                    else text = clampText(XLSX.utils.sheet_to_csv(sheet) || '');
                } else {
                    // CSV / TSV / TXT fallback
                    text = clampText(buf.toString('utf8'));
                }
            }
        }
    } else {
        const body: any = await readBody(event);
        text = clampText(body?.text);
    }

    if (!text && !imageDataUrl) {
        throw createError({ statusCode: 400, statusMessage: 'Text or file is required' });
    }

    const config = useRuntimeConfig();
    
    if (!config.openaiApiKey) {
        const hasNuxtKey = Boolean(process.env.NUXT_OPENAI_API_KEY);
        const hasLegacyKey = Boolean(process.env.OPENAI_API_KEY);
        throw createError({
            statusCode: 500,
            statusMessage: 'OpenAI API Key not configured',
            message: `Missing server key. Set NUXT_OPENAI_API_KEY (recommended) or OPENAI_API_KEY in .env and restart \"npm run dev\". Debug: runtimeConfig.openaiApiKey=false env.NUXT_OPENAI_API_KEY=${hasNuxtKey} env.OPENAI_API_KEY=${hasLegacyKey}`
        });
    }

    // Usar instância lazy-loaded do OpenAI
    const openai = await getOpenAI()

    const prompt = `
You extract structured products from supermarket/lists/retail price lists.

Input can be:
- plain text lines
- tables (CSV/Excel/PDF)
- screenshots/photos of tables (image)
- ANY LANGUAGE (Portuguese, English, Spanish, etc.)

IMPORTANT: This system supports MULTIPLE PRICE TYPES. Extract ALL available prices.

The system uses AI to intelligently identify price columns even when written differently:

PRICE TYPES TO EXTRACT (with variations):
1. Pack/Box Price → pricePack
   - Variations: "PREÇO CX", "PREÇO CAIXA", "PREÇO FARDO", "PRECO EMB", "CX AVULSA",
     "PACOTE", "PACK", "BOX", "FARDO", "FD", "CX", "PCT",
     "PREÇO CX. AVULSA", "PREÇO CX AVULSA", "PRC CX"

2. Unit Price → priceUnit
   - Variations: "PREÇO UND", "PREÇO UNIDADE", "PREÇO UNIT", "UNIDADE", "UNIT",
     "UND AVULSA", "UN. AVULSA", "PRICE/UN", "PR. UNIT",
     "PREÇO UND. AVULSA", "PREÇO UND AVULSA", "PRC UN",
     "PREÇO UNID. AVULSA"

3. Special/Promotional Pack Price → priceSpecial
   - Variations: "PREÇO ESPECIAL", "PREÇO PROMO", "PREÇO PROMOÇÃO", "PREÇO ACIMA",
     "PROMOÇÃO", "PROMO", "OFERTA", "SPECIAL", "PROMO PRICE", "PROMO PACK",
     "PREÇO ESPECIAL CX", "PREÇO ESPECIAL CX.", "PREÇO ESP. CX",
     "PRC ESP CX", "PROMO CX"

4. Special/Promotional Unit Price → priceSpecialUnit
   - Variations: "PREÇO ESPECIAL UN", "PREÇO UN. PROMO", "PREÇO UND PROMO",
     "UNIT PROMO", "UN. ESPECIAL", "SPECIAL UNIT", "PROMO UNIT",
     "PREÇO ESPECIAL UN.", "PREÇO ESPECIAL UND.", "PREÇO ESP. UN",
     "PRC ESP UN", "PROMO UN"

5. Special Condition → specialCondition
   - Variations: "OBSERVAÇÃO", "OBSERVAÇÕES", "OBS", "OBS.", "CONDICAO", "CONDIÇÃO",
     "ACIMA DE", "CONDITION", "OBSERVATION", "FROM", "MIN. QTY", "NOTA", "NOTAS"
   - CRITICAL: Extract the FULL text exactly as it appears in the source.
   - Examples: "ACIMA DE 24 UN.", "ACIMA DE 36 UN", "ACIMA DE 2 FARDOS",
     "ACIMA DE 5 CX", "MIN 10 CX", "FROM 5 UNITS", "A PARTIR DE 3 FARDOS"
   - If the observation column has text like "ACIMA DE 24 UN." → specialCondition = "ACIMA DE 24 UN."
   - Do NOT parse/split the condition — keep it as a single string.

PURCHASE LIMIT DETECTION (limit field):
- Extract any purchase limit restriction from the product name, description, or a dedicated column.
- Look for these patterns anywhere in the text:
  * "LIMITE X UN", "LIMITE X UND", "LIMITE X UNID", "LIMITE X UNIDADES"
  * "LIMITE X POR CLIENTE", "LIMITE X UND POR CLIENTE", "LIMITE X UN POR CLIENTE"
  * "LIM. X UN", "LIM X UN", "LIMITADO A X"
  * "MAX X UN", "MÁXIMO X", "MÁX. X UN", "MÁX X POR PESSOA"
  * "ATÉ X UN POR CLIENTE", "ATÉ X UNIDADES"
  * Just a number + "POR CLIENTE" → "X POR CLIENTE"
- Examples:
  * "ARROZ CRISTAL 5KG LIMITE 3UND POR CLIENTE 23,99"
    → name="ARROZ CRISTAL 5KG", limit="LIMITE 3 UND POR CLIENTE", price="23,99"
  * "LEITE PARMALAT 1L LIM. 5 UN 4,99"
    → name="LEITE PARMALAT 1L", limit="LIMITE 5 UN", price="4,99"
  * "ÓLEO SOYA 900ML 6,49 MÁXIMO 2 POR CLIENTE"
    → name="ÓLEO SOYA 900ML", limit="MÁXIMO 2 POR CLIENTE", price="6,49"
  * "CERVEJA BRAHMA 350ML LIMITE 12UN 2,99"
    → name="CERVEJA BRAHMA 350ML", limit="LIMITE 12 UN", price="2,99"
- CRITICAL: Remove the limit text from the product name — it should NOT appear in the name field.
- CRITICAL: The limit is about PURCHASE QUANTITY restriction, NOT about product weight/size.
- If a column header contains "LIMITE", "LIM", "LIMIT", "RESTRICAO", "RESTRIÇÃO" → extract its value.
- Normalize: always separate number from unit ("3UND" → "3 UND", "5UN" → "5 UN").

PRODUCT TYPE DETECTION:
The system must detect TWO types of products:

1. SIMPLE PRODUCTS (single price):
   Pattern: "PRODUCT_NAME [WEIGHT] PRICE"
   Examples:
   - "ARROZ CRISTAL 5KG 22,99" → name="ARROZ CRISTAL 5KG", price="22,99", priceUnit="22,99"
   - "FEIJÃO CAMIL 1KG 8,90" → name="FEIJÃO CAMIL 1KG", price="8,90", priceUnit="8,90"
   - "ACÚCAR REFINADO UNIÃO 1KG 4,50" → name="ACÚCAR REFINADO UNIÃO 1KG", price="4,50", priceUnit="4,50"

   For simple products: populate BOTH "price" AND "priceUnit" with the same value.
   Keep the WEIGHT/GRAMATURA as part of the NAME.

2. MULTI-PRICE PRODUCTS (wholesale/atacarejo):
   Products with multiple price columns or conditional pricing.
   Examples:
   - Has "PREÇO CX" and "PREÇO UND" columns → populate pricePack AND priceUnit
   - Has "PREÇO ESPECIAL" and "PREÇO NORMAL" → populate priceSpecial AND priceUnit
   - Has condition like "ACIMA DE 36 UN" → populate specialCondition

3. ATACAREJO FORMAT (4 price columns + observations):
   This is a COMMON format in Brazilian wholesale/retail (atacarejo) tables.
   Headers typically include:
   - PRODUTO | EMBALAGEM | QUANT. EMB. | PREÇO CX. AVULSA | PREÇO UND. AVULSA | PREÇO ESPECIAL CX. | PREÇO ESPECIAL UN. | OBSERVAÇÕES
   
   Mapping:
   - "PREÇO CX. AVULSA" or "PREÇO CX AVULSA" → pricePack
   - "PREÇO UND. AVULSA" or "PREÇO UND AVULSA" → priceUnit
   - "PREÇO ESPECIAL CX." or "PREÇO ESPECIAL CX" → priceSpecial
   - "PREÇO ESPECIAL UN." or "PREÇO ESPECIAL UND" → priceSpecialUnit
   - "OBSERVAÇÕES" or "OBS" or "OBS." → specialCondition (extract FULL text as-is)
   - "EMBALAGEM" → packageLabel (normalize: UNIDADE→UN, FARDO→FD, CAIXA→CX)
   - "QUANT. EMB." or "QTD EMB" or similar → packQuantity

   Example row:
   | ENERGETICO EXTRA POWER TRADICIONAL 270 ML | UNIDADE | 01 | R$ 3,49 | R$ 3,49 | R$ 3,29 | R$ 3,29 | ACIMA DE 24 UN. |
   → {
       name: "ENERGETICO EXTRA POWER TRADICIONAL 270 ML",
       pricePack: "3,49",
       priceUnit: "3,49",
       priceSpecial: "3,29",
       priceSpecialUnit: "3,29",
       specialCondition: "ACIMA DE 24 UN.",
       packageLabel: "UN",
       packQuantity: 1,
       packUnit: "UN"
   }
   
   IMPORTANT: When EMBALAGEM is "UNIDADE" and QUANT. EMB. is "01", it means each unit is sold individually.
   In this case pricePack and priceUnit may be the same value. Still populate BOTH.

COLUMN IDENTIFICATION STRATEGY:
- Look for numeric values with price format (0,00 or 0.00)
- Identify columns by HEADER names first
- If no clear headers, infer from CONTEXT:
  * Lower value in same row = promotional price
  * Higher value in same row = regular price
  * Value divided by quantity = unit price
- Common patterns:
  * "CX" / "FD" / "PACK" → pack price
  * "UN" / "UND" / "UNIT" → unit price
  * "ESP" / "PROMO" / "OFERTA" → promotional price

UNIT LABEL LOGIC (for the label below cents):
- IMPORTANT: The unit label is NOT extracted from the product name
- If product name has NUMBER before weight unit (5KG, 500G, 2L) → unitLabel = "UN" (sold by unit)
- If product name has NO NUMBER before weight unit (KG, G, ML, L alone) → unitLabel = "KG" (sold by kilo/weight)
- Examples:
  * "ARROZ 5KG 22,99" → unitLabel = "UN" (has number 5 before KG)
  * "ARROZ KG 22,99" → unitLabel = "KG" (NO number before KG)
  * "BISCOITO MAIZENA" → unitLabel = "UN" (no weight unit at all)

SPECIAL RULES FOR WEIGHT/GRAMATURA:
- ALWAYS keep weight/gramatura IN the product name
- Examples of CORRECT extraction:
  * "ARROZ CRISTAL 5KG" → name="ARROZ CRISTAL 5KG" (NOT "ARROZ CRISTAL")
  * "CAFE PILÃO 500G" → name="CAFE PILÃO 500G" (NOT "CAFE PILÃO")
  * "OLEO DE SOJA 900ML" → name="OLEO DE SOJA 900ML" (NOT "OLEO DE SOJA")
  * "AMACIANTE CONFORT 2L" → name="AMACIANTE CONFORT 2L" (NOT "AMACIANTE CONFORT")
- Only populate the "weight" field if there is a SEPARATE weight column in the input table

Return STRICT JSON in the shape:
{
  "products": [
    {
      "name": string,
      "brand": string|null,
      "weight": string|null,

      // ===== LEGACY PRICE FIELDS (for backward compatibility) =====
      "price": string|null,

      // ===== NEW PRICE FIELDS =====
      "pricePack": string|null,
      "priceUnit": string|null,
      "priceSpecial": string|null,
      "priceSpecialUnit": string|null,
      "specialCondition": string|null,

      // ===== LEGACY WHOLESALE (still supported) =====
      "priceWholesale": string|null,
      "wholesaleTrigger": number|null,
      "wholesaleTriggerUnit": string|null,

      // ===== PACK METADATA =====
      "packQuantity": number|null,
      "packUnit": string|null,
      "packageLabel": string|null,

      "limit": string|null,
      "flavor": string|null
    }
  ]
}

Rules:
- Do not invent values; if missing, use null.
- Prices MUST be strings with comma decimal and 2 digits (e.g. "23,40").
- For SIMPLE products with ONE price: populate BOTH "price" AND "priceUnit" with the same value.
- If there are both pack price and unit price columns, populate BOTH pricePack AND priceUnit.
- If there are regular prices AND special/promotional prices, populate ALL 4 fields.
- Extract specialCondition from observation/condition column or from price column headers.
- CRITICAL: Keep weight/gramatura IN the product NAME. Do NOT separate it.
- Normalize packaging words: FARDO→FD, CAIXA→CX, PACOTE→PCT, UNIDADE→UN.
- Detect packQuantity/packUnit from columns like "QUANT", "QTD", "QTY" or patterns like "C/12UN", "12X350ML".
- Be flexible with spelling: PRECO, PREÇO, PREÇO, PRECO, PÇO are all valid.
- BRAND DETECTION: If the product name contains a known brand (Nestlé, Neste, Coca-Cola, Colgate, etc.), extract it to the brand field.

FLAVOR / FRAGRANCE / VARIANT DETECTION:
- CRITICAL: Always extract flavors, fragrances, variants, and scents to the "flavor" field.
- Look for keywords: "SABOR", "SABORES", "FRAGRÂNCIA", "FRAGRÂNCIAS", "AROMA", "TIPO", "VARIANTE", "ESSÊNCIA", "PERFUME".
- Also look for the word "DIVERSOS" / "VARIADOS" / "SORTIDOS" / "VÁRIOS" / "VARIOS" — these mean "assorted flavors/variants".
- Common flavor/fragrance patterns:
  * "REFRIGERANTE COCA COLA 350ML SABORES" → flavor="SABORES" (assorted)
  * "BISCOITO OREO CHOCOLATE" → flavor="CHOCOLATE"
  * "SABONETE LUX FRAGRÂNCIAS" → flavor="FRAGRÂNCIAS" (assorted)
  * "AMACIANTE DOWNY BRISA DE VERÃO" → flavor="BRISA DE VERÃO"
  * "SUCO DEL VALLE UVA 1L" → flavor="UVA"
  * "CERVEJA HEINEKEN 350ML" → flavor=null (no flavor)
  * "IOGURTE NESTLÉ MORANGO/CHOCOLATE" → flavor="MORANGO/CHOCOLATE"
  * "DESODORANTE REXONA VARIADOS" → flavor="VARIADOS"
- If a product has multiple flavors separated by "/" or "," → keep them all in the flavor field.
- The flavor/fragrance should NOT be duplicated in the product name when extracted.
- When "SABORES" or "FRAGRÂNCIAS" appears after the product name, it means the customer wants ASSORTED variants of that product.

Source name: ${filename || 'text'}
Source content:
${text ? `"${String(text).slice(0, MAX_PROMPT_SOURCE_CHARS)}"` : '(image attached)'}
`;

    const normalizeInt = (v: any): number | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
        const s = String(v).trim();
        const m = s.match(/\d+/);
        if (!m) return null;
        const n = Number.parseInt(m[0], 10);
        return Number.isFinite(n) ? n : null;
    };

    const normalizeToken = (v: any): string | null => {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (!s) return null;
        return s.toUpperCase().replace(/\s+/g, '');
    };

    const normalizePackageUnit = (v: any): string | null => {
        const tok = normalizeToken(v);
        if (!tok) return null;
        const compact = tok.replace(/[.]/g, '');
        if (compact === 'CX' || compact === 'CAIXA' || compact === 'CAIXAS') return 'CX';
        if (compact === 'FD' || compact === 'FARDO' || compact === 'FARDOS') return 'FD';
        if (
            compact === 'UN' ||
            compact === 'UND' ||
            compact === 'UNID' ||
            compact === 'UNIDADE' ||
            compact === 'UNIDADES' ||
            compact === 'UNIT'
        ) return 'UN';
        if (compact === 'PCT' || compact === 'PACOTE' || compact === 'PACOTES') return 'PCT';
        if (compact === 'EMB' || compact === 'EMBAL' || compact === 'EMBALAGEM' || compact === 'EMBALAGENS') return 'EMB';
        return compact;
    };

    const extractDefaultSpecialRuleFromSource = (sourceText?: string | null): { minQty: number; unitHint: string | null } | null => {
        if (!sourceText) return null;

        const rawLines = String(sourceText)
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        if (!rawLines.length) return null;

        const normalizeLine = (line: string) =>
            line
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();

        const parseLine = (line: string): { minQty: number; unitHint: string | null } | null => {
            const normalized = normalizeLine(line);
            const matches = Array.from(
                normalized.matchAll(
                    /\bACIMA(?:\s+DE)?\s*(\d{1,3})(?:\s*(EMB(?:ALAGEM)?|CX|CAIXA|FD|FARDO|UN|UND|UNID(?:ADE)?|PCT|PACOTE))?/g
                )
            );
            if (!matches.length) return null;

            for (const m of matches) {
                const minQty = Number.parseInt(m[1] || '', 10);
                if (!Number.isFinite(minQty) || minQty <= 0) continue;
                const unitHint = normalizePackageUnit(m[2] || null);
                return { minQty, unitHint };
            }
            return null;
        };

        // Priorizar cabeçalhos das primeiras linhas que normalmente contêm nomes de colunas.
        const headerCandidates = rawLines.slice(0, 5);
        for (const line of headerCandidates) {
            const probe = normalizeLine(line);
            if (!probe.includes('PRECO') || !probe.includes('ACIMA')) continue;
            const parsed = parseLine(line);
            if (parsed) return parsed;
        }

        // Fallback: tentar só se a primeira linha tiver cara de cabeçalho tabular.
        const first = rawLines[0] || '';
        const firstProbe = normalizeLine(first);
        const looksTabularHeader = /[;,|\t]/.test(first) || firstProbe.includes('PRODUTO') || firstProbe.includes('EMBAL');
        if (looksTabularHeader && firstProbe.includes('ACIMA')) {
            return parseLine(first);
        }

        return null;
    };

    const parseNumber = (v: any): number | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        const s0 = String(v).trim();
        if (!s0) return null;
        const s = s0.replace(/[^\d.,-]/g, '');
        if (!s) return null;
        const hasComma = s.includes(',');
        const hasDot = s.includes('.');
        let normalized = s;
        if (hasComma && hasDot) {
            // 1.234,56 -> 1234.56
            normalized = s.replace(/\./g, '').replace(',', '.');
        } else if (hasComma) {
            // 123,45 -> 123.45
            normalized = s.replace(/\./g, '').replace(',', '.');
        } else {
            // 123.45 (or 1,234.56) -> treat comma as thousand separator
            normalized = s.replace(/,/g, '');
        }
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
    };

    const normalizePrice = (v: any): string | null => {
        const n = parseNumber(v);
        if (n === null) return null;
        return n.toFixed(2).replace('.', ',');
    };

    try {
        const messages: any[] = imageDataUrl
            ? [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageDataUrl } }
                ]
            }]
            : [{ role: "user", content: prompt }];

        const completion = await openai.chat.completions.create({
            messages,
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 3200
        });

        const content = completion.choices?.[0]?.message?.content;
        if (!content) throw new Error('No content returned');
        
        const result = JSON.parse(content);
        const rawProducts = Array.isArray(result?.products) ? result.products : [];
        const defaultSpecialRule = extractDefaultSpecialRuleFromSource(text);
        const products = rawProducts.map((p: any) => {
            const name = String(p?.name || '').trim();
            const price = normalizePrice(p?.price);

            // Novos campos de preço
            const pricePack = normalizePrice(p?.pricePack);
            const priceUnit = normalizePrice(p?.priceUnit);
            const priceSpecial = normalizePrice(p?.priceSpecial);
            const priceSpecialUnit = normalizePrice(p?.priceSpecialUnit);

            // Wholesale legado
            const priceWholesale = normalizePrice(p?.priceWholesale);
            const packQuantity = normalizeInt(p?.packQuantity);
            const packUnit = normalizeToken(p?.packUnit);
            const wholesaleTrigger = normalizeInt(p?.wholesaleTrigger);

            const packageLabel = normalizeToken(p?.packageLabel);
            const wholesaleTriggerUnit = normalizeToken(p?.wholesaleTriggerUnit) || packageLabel;

            // Condição especial (texto completo, preservar formatação)
            const specialCondition = p?.specialCondition ? String(p.specialCondition).trim() : null;

            return {
                name: name || 'Produto sem nome',
                brand: p?.brand ? String(p.brand).trim() : null,
                weight: p?.weight ? String(p.weight).trim().toUpperCase().replace(/\s+/g, '') : null,
                // Preço principal (legado)
                price,
                // Novos campos de preço
                pricePack,
                priceUnit,
                priceSpecial,
                priceSpecialUnit,
                specialCondition,
                // Wholesale legado
                priceWholesale,
                wholesaleTrigger,
                wholesaleTriggerUnit,
                // Metadata
                packQuantity,
                packUnit,
                packageLabel,
                limit: p?.limit ? String(p.limit).trim() : null,
                flavor: p?.flavor ? String(p.flavor).trim() : null
            };
        });

        // ===== PÓS-PROCESSAMENTO: preencher campos recíprocos de preço =====
        // Quando a IA não extrai todos os campos (ex: gpt-4o-mini pode pular pricePack quando = priceUnit),
        // inferimos os valores faltantes com base na lógica de embalagem/unidade.
        for (const prod of products) {
            const isUnitPackaging = normalizePackageUnit(prod.packageLabel) === 'UN';
            const isSingleUnit = (prod.packQuantity === 1 || prod.packQuantity === null) && isUnitPackaging;
            
            // Quando embalagem = UNIDADE e quantidade = 1, CX e UN são iguais
            if (isSingleUnit) {
                if (prod.priceUnit && !prod.pricePack) prod.pricePack = prod.priceUnit;
                if (prod.pricePack && !prod.priceUnit) prod.priceUnit = prod.pricePack;
                if (prod.priceSpecial && !prod.priceSpecialUnit) prod.priceSpecialUnit = prod.priceSpecial;
                if (prod.priceSpecialUnit && !prod.priceSpecial) prod.priceSpecial = prod.priceSpecialUnit;
                // Normalizar packQuantity para 1 se era null
                if (prod.packQuantity === null) prod.packQuantity = 1;
            }
            
            // Fallback genérico: se tem preço especial mas não informou a unidade,
            // e a embalagem é simples, copiar o valor
            if (prod.priceSpecial && !prod.priceSpecialUnit && prod.packQuantity === 1) {
                prod.priceSpecialUnit = prod.priceSpecial;
            }
            if (prod.priceSpecialUnit && !prod.priceSpecial && prod.packQuantity === 1) {
                prod.priceSpecial = prod.priceSpecialUnit;
            }
            
            // Se nenhum preço principal foi definido, mas tem priceUnit ou pricePack
            if (!prod.price) {
                prod.price = prod.priceUnit || prod.pricePack || null;
            }

            // Se a linha não trouxe condição especial, usar regra padrão do cabeçalho
            // (ex.: "PREÇO ACIMA 10 EMB"), respeitando a embalagem do produto.
            const hasSpecialPrice = !!(prod.priceSpecial || prod.priceSpecialUnit);
            const hasSpecialCondition = !!String(prod.specialCondition || '').trim();
            if (hasSpecialPrice && !hasSpecialCondition && defaultSpecialRule) {
                const productUnit =
                    normalizePackageUnit(prod.packageLabel) ||
                    normalizePackageUnit(prod.wholesaleTriggerUnit) ||
                    normalizePackageUnit(prod.packUnit);

                const effectiveUnit = (defaultSpecialRule.unitHint && defaultSpecialRule.unitHint !== 'EMB')
                    ? defaultSpecialRule.unitHint
                    : (productUnit || 'UN');

                prod.specialCondition = `ACIMA DE ${defaultSpecialRule.minQty} ${effectiveUnit}`;
                if (!prod.wholesaleTrigger) prod.wholesaleTrigger = defaultSpecialRule.minQty;
                if (!prod.wholesaleTriggerUnit) prod.wholesaleTriggerUnit = effectiveUnit;
            }
        }

        return { products };
    } catch (error: any) {
        console.error('OpenAI Error:', error);
        throw createError({ statusCode: 500, statusMessage: 'Failed to parse products', message: error.message });
    }
});
