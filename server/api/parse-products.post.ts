// Lazy load OpenAI para reduzir bundle size
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

export default defineEventHandler(async (event) => {
    const contentType = String(getHeader(event, 'content-type') || '');

    let text: string | undefined;
    let imageDataUrl: string | undefined;
    let filename: string | undefined;

    // Accept either JSON body `{ text }` (legacy) or multipart form-data with `file` (and optional `text`).
    if (contentType.includes('multipart/form-data')) {
        const form = await readMultipartFormData(event);
        const textPart = form?.find(p => p.name === 'text');
        if (textPart?.data) text = Buffer.from(textPart.data).toString('utf8');

        const filePart = form?.find(p => p.name === 'file');
        if (filePart?.data) {
            filename = filePart.filename || undefined;
            const mime = String(filePart.type || '');
            const buf = Buffer.from(filePart.data);

            if (mime.startsWith('image/')) {
                const base64 = buf.toString('base64');
                imageDataUrl = `data:${mime};base64,${base64}`;
            } else {
                const ext = (filename || '').toLowerCase().split('.').pop() || '';

                if (mime === 'application/pdf' || ext === 'pdf') {
                    const mod: any = await import('pdf-parse');
                    const pdfParse = mod?.default || mod;
                    const out = await pdfParse(buf);
                    text = String(out?.text || '').trim();
                } else if (
                    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    mime === 'application/vnd.ms-excel' ||
                    ext === 'xlsx' ||
                    ext === 'xls'
                ) {
                    const mod: any = await import('xlsx');
                    const XLSX = mod?.default || mod;
                    const wb = XLSX.read(buf, { type: 'buffer' });
                    const sheetName = wb.SheetNames?.[0];
                    const sheet = sheetName ? wb.Sheets?.[sheetName] : null;
                    if (!sheet) text = '';
                    else text = String(XLSX.utils.sheet_to_csv(sheet) || '').trim();
                } else {
                    // CSV / TSV / TXT fallback
                    text = buf.toString('utf8').trim();
                }
            }
        }
    } else {
        const body: any = await readBody(event);
        text = body?.text;
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
     "PACOTE", "PACK", "BOX", "FARDO", "FD", "CX", "PCT"

2. Unit Price → priceUnit
   - Variations: "PREÇO UND", "PREÇO UNIDADE", "PREÇO UNIT", "UNIDADE", "UNIT",
     "UND AVULSA", "UN. AVULSA", "PRICE/UN", "PR. UNIT"

3. Special/Promotional Pack Price → priceSpecial
   - Variations: "PREÇO ESPECIAL", "PREÇO PROMO", "PREÇO PROMOÇÃO", "PREÇO ACIMA",
     "PROMOÇÃO", "PROMO", "OFERTA", "SPECIAL", "PROMO PRICE", "PROMO PACK"

4. Special/Promotional Unit Price → priceSpecialUnit
   - Variations: "PREÇO ESPECIAL UN", "PREÇO UN. PROMO", "PREÇO UND PROMO",
     "UNIT PROMO", "UN. ESPECIAL", "SPECIAL UNIT", "PROMO UNIT"

5. Special Condition → specialCondition
   - Variations: "OBSERVAÇÃO", "OBS", "CONDICÃO", "CONDIÇÃO", "ACIMA DE",
     "CONDITION", "OBSERVATION", "FROM", "MIN. QTY"
   - Examples: "ACIMA DE 36 UN", "ACIMA DE 2 FARDOS", "MIN 10 CX", "FROM 5 UNITS"

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
- If there are both pack price and unit price columns, populate BOTH pricePack AND priceUnit.
- If there are regular prices AND special/promotional prices, populate ALL 4 fields.
- Extract specialCondition from observation/condition column or from price column headers.
- IMPORTANT: Keep weight/gramatura in the product NAME. Do NOT separate it.
  Example: "Arroz 5kg" → name="Arroz 5kg" (not "Arroz")
- The weight field should only be filled if there is a SEPARATE weight column in the input.
- Normalize packaging words: FARDO→FD, CAIXA→CX, PACOTE→PCT, UNIDADE→UN.
- Detect packQuantity/packUnit from columns like "QUANT", "QTD", "QTY" or patterns like "C/12UN", "12X350ML".
- Be flexible with spelling: PRECO, PREÇO, PREÇO, PRECO, PÇO are all valid.

Source name: ${filename || 'text'}
Source content:
${text ? `"${text}"` : '(image attached)'}
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
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error('No content returned');
        
        const result = JSON.parse(content);
        const rawProducts = Array.isArray(result?.products) ? result.products : [];
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

        return { products };
    } catch (error: any) {
        console.error('OpenAI Error:', error);
        throw createError({ statusCode: 500, statusMessage: 'Failed to parse products', message: error.message });
    }
});
