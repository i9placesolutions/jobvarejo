import { MANUAL_SINGLE_ANCHOR_VERSION } from './labelTemplateHelpers'
import { PRICE_INTEGER_DECIMAL_GAP_PX } from './priceTagText'

export type ManualPriceAnchorDeps = {
  MANUAL_SINGLE_ANCHOR_VERSION: number
  collectObjectsDeep: (...args: any[]) => any[]
  getSinglePriceBackgroundCandidate: (...args: any[]) => any
  getSinglePriceCurrencyTextCandidate: (...args: any[]) => any
  getSinglePriceCurrencyCircleCandidate?: (...args: any[]) => any
  ensureSinglePriceCurrencyCircleAnchor: (...args: any[]) => any
  findByName: (...args: any[]) => any
  isTextLikeObject: (...args: any[]) => boolean
  isObjectShownForBounds: (...args: any[]) => boolean
  getObjectHorizontalBoundsLocal: (...args: any[]) => any
  measureHorizontalBoundsLocal: (...args: any[]) => any
  clamp: (value: number, min: number, max: number) => number
  PRICE_INTEGER_DECIMAL_GAP_PX: number
}


export const createEnsureSinglePriceCurrencyCircleAnchor = (deps: Required<Pick<ManualPriceAnchorDeps,
  'collectObjectsDeep' | 'getSinglePriceCurrencyTextCandidate' | 'getSinglePriceCurrencyCircleCandidate'>>) =>
  (priceGroup: any, objects?: any[]): any | null => {
    const all = Array.isArray(objects)
      ? objects
      : (priceGroup && typeof priceGroup.getObjects === 'function' ? deps.collectObjectsDeep(priceGroup) : [])
    const currencyText = deps.getSinglePriceCurrencyTextCandidate(all)
    const currencyCircle = deps.getSinglePriceCurrencyCircleCandidate(all, currencyText)
    if (currencyCircle && typeof currencyCircle.set === 'function' && String(currencyCircle?.name || '') !== 'price_currency_bg') {
      currencyCircle.set('name', 'price_currency_bg')
      currencyCircle.setCoords?.()
    }
    return currencyCircle
  }

export const createReadSingleManualPriceAnchors = (deps: ManualPriceAnchorDeps) => (
  priceGroup: any, opts: { force?: boolean } = {}
) => {
    if (!priceGroup || typeof priceGroup.getObjects !== 'function') return null;
    const cached = (priceGroup as any).__manualSingleAnchors;
    // Anchor cache can become stale if it was computed before webfonts loaded.
    // Allow callers to force a recompute (used by fitting code after price text changes).
    if (
        !opts.force &&
        cached &&
        typeof cached === 'object' &&
        Number((cached as any).__version) === deps.MANUAL_SINGLE_ANCHOR_VERSION
    ) return cached;

    const all = deps.collectObjectsDeep(priceGroup);
    const priceBg = deps.getSinglePriceBackgroundCandidate(all);
    const currency = deps.getSinglePriceCurrencyTextCandidate(all);
    const currencyCircle = deps.ensureSinglePriceCurrencyCircleAnchor(priceGroup, all);
    const integer = deps.findByName(all, 'price_integer_text') || deps.findByName(all, 'priceInteger') || deps.findByName(all, 'price_integer');
    const decimal = deps.findByName(all, 'price_decimal_text') || deps.findByName(all, 'priceDecimal') || deps.findByName(all, 'price_decimal');
    const unit = deps.findByName(all, 'price_unit_text') || deps.findByName(all, 'priceUnit') || deps.findByName(all, 'price_unit');
    if (!priceBg || !integer || !decimal) return null;

    // Ensure text objects have up-to-date width/height before measuring bounds.
	    [currency, integer, decimal, unit].forEach((obj: any) => {
	        if (!obj) return;
	        if (deps.isTextLikeObject(obj) && typeof obj.initDimensions === 'function') obj.initDimensions();
	    });

	    const getOriginalNumber = (obj: any, key: string, fallback: any) => {
	        const raw = Number(obj?.[key]);
	        return Number.isFinite(raw) ? raw : Number(fallback);
	    };
	    const getOriginalHorizontalBounds = (obj: any) => {
	        if (!deps.isObjectShownForBounds(obj)) return null;
	        const widthRaw = getOriginalNumber(obj, '__originalWidth', obj?.width ?? 0);
	        const scaleX = Math.abs(getOriginalNumber(obj, '__originalScaleX', obj?.scaleX ?? 1)) || 1;
	        const width = widthRaw * scaleX;
	        if (!Number.isFinite(width) || width <= 0) return null;
	        const x = getOriginalNumber(obj, '__originalLeft', obj?.left ?? 0);
	        const ox = String((obj as any)?.__originalOriginX || obj?.originX || 'left');
	        if (ox === 'center') return { left: x - (width / 2), right: x + (width / 2) };
	        if (ox === 'right') return { left: x - width, right: x };
	        return { left: x, right: x + width };
	    };
	    const measureOriginalHorizontalBounds = (objects: any[]) => {
	        const bounds = (objects || [])
	            .map((obj: any) => getOriginalHorizontalBounds(obj))
	            .filter(Boolean) as Array<{ left: number; right: number }>;
	        if (!bounds.length) return null;
	        const left = Math.min(...bounds.map((b) => b.left));
	        const right = Math.max(...bounds.map((b) => b.right));
	        return { left, right, width: Math.max(0, right - left) };
	    };
	    const getOriginalTop = (obj: any, fallback: any) => {
	        const raw = Number((obj as any)?.__originalTop);
	        return Number.isFinite(raw) ? raw : Number(fallback);
	    };
	    const bgBounds = getOriginalHorizontalBounds(priceBg) || deps.getObjectHorizontalBoundsLocal(priceBg);
	    const intBounds = getOriginalHorizontalBounds(integer) || deps.getObjectHorizontalBoundsLocal(integer);
	    const decBounds = getOriginalHorizontalBounds(decimal) || deps.getObjectHorizontalBoundsLocal(decimal);
	    const unitShown = deps.isObjectShownForBounds(unit) && String(unit?.text || '').trim().length > 0;
	    const chain = [integer, decimal, unitShown ? unit : null].filter(Boolean) as any[];
	    const chainBounds = measureOriginalHorizontalBounds(chain) || deps.measureHorizontalBoundsLocal(chain);
	    const curBounds = getOriginalHorizontalBounds(currency) || deps.getObjectHorizontalBoundsLocal(currency);
	    const full = [currency, ...chain].filter((o: any) => deps.isObjectShownForBounds(o));
	    const fullBounds = measureOriginalHorizontalBounds(full) || deps.measureHorizontalBoundsLocal(full);

    // Anchor the chain start to the integer's authored left edge.
    // This prevents "R$ outside" glitches if centering cannot run due to missing bounds.
    const intX = intBounds ? intBounds.left : Number(integer?.left ?? 0);

    const fallbackPad = Math.max(8, (Math.abs(Number(priceBg.width || 0) * Number(priceBg.scaleX ?? 1)) || 120) * 0.08);
    const padLeft = bgBounds && fullBounds
        ? deps.clamp(fullBounds.left - bgBounds.left, 4, 80)
        : fallbackPad;
    const padRight = bgBounds && fullBounds
        ? deps.clamp(bgBounds.right - fullBounds.right, 4, 80)
        : fallbackPad;

	    const intDecGap = (intBounds && decBounds)
	        ? deps.clamp(decBounds.left - intBounds.right, deps.PRICE_INTEGER_DECIMAL_GAP_PX, 60)
	        : deps.PRICE_INTEGER_DECIMAL_GAP_PX;
	    const currencyGap = (curBounds && chainBounds)
	        ? deps.clamp(chainBounds.left - curBounds.right, -8, 36)
	        : 6;
	    const decimalCenterX = decBounds ? ((decBounds.left + decBounds.right) / 2) : Number(decimal?.left || 0);
	    const unitBounds = unitShown ? deps.getObjectHorizontalBoundsLocal(unit) : null;
	    const unitCenterX = unitBounds ? ((unitBounds.left + unitBounds.right) / 2) : Number(unit?.left || decimalCenterX);
	    const unitCenterOffsetX = unitShown
	        ? deps.clamp(unitCenterX - decimalCenterX, -80, 80)
	        : 0;
        const hasCurrencyCircle = !!(currencyCircle && deps.isObjectShownForBounds(currencyCircle));
        const currencyBaseLeft = hasCurrencyCircle && currency
            ? getOriginalNumber(currency, '__originalLeft', currency.left || 0)
            : 0;
        const currencyBaseTop = hasCurrencyCircle && currency
            ? getOriginalNumber(currency, '__originalTop', currency.top || 0)
            : 0;
        const currencyCircleBaseLeft = hasCurrencyCircle
            ? getOriginalNumber(currencyCircle, '__originalLeft', currencyCircle?.left || 0)
            : 0;
        const currencyCircleBaseTop = hasCurrencyCircle
            ? getOriginalNumber(currencyCircle, '__originalTop', currencyCircle?.top || 0)
            : 0;
        const currencyOffsetX = hasCurrencyCircle && currency
            ? deps.clamp(currencyBaseLeft - currencyCircleBaseLeft, -120, 120)
            : 0;
        const currencyOffsetY = hasCurrencyCircle && currency
            ? deps.clamp(currencyBaseTop - currencyCircleBaseTop, -120, 120)
            : 0;
        const bgCenterX = bgBounds
            ? ((bgBounds.left + bgBounds.right) / 2)
            : 0;
        const chainTargetCenterX = chainBounds
            ? ((chainBounds.left + chainBounds.right) / 2)
            : bgCenterX;
        const fullTargetCenterX = fullBounds
            ? ((fullBounds.left + fullBounds.right) / 2)
            : (chainBounds
                ? ((chainBounds.left + chainBounds.right) / 2)
                : bgCenterX);
        const targetCenterX = hasCurrencyCircle ? chainTargetCenterX : fullTargetCenterX;

	    const anchors = {
            __version: deps.MANUAL_SINGLE_ANCHOR_VERSION,
	        targetCenterX,
	        intX,
	        intY: getOriginalTop(integer, integer.top || 0),
	        decY: getOriginalTop(decimal, decimal.top || 0),
	        unitY: getOriginalTop(unit, unit?.top || decimal.top || 0),
	        unitCenterOffsetX,
	        currencyY: getOriginalTop(currency, currency?.top || integer.top || 0),
            currencyOffsetX,
            currencyOffsetY,
            currencyOriginX: String((currency as any)?.__originalOriginX || currency?.originX || 'center'),
            currencyOriginY: String((currency as any)?.__originalOriginY || currency?.originY || 'center'),
	        intDecGap,
	        currencyGap,
	        padLeft,
        padRight
    };
    (priceGroup as any).__manualSingleAnchors = anchors;
    return anchors;

}
