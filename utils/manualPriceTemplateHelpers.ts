/** Manual single-price template helpers shared with non-UI renderers. */
export type ManualPriceTemplateHelperDeps = {
  isRedBurstPriceGroup: (group: any) => boolean
  collectObjectsDeep: (group: any) => any[]
  findByName: (objects: any[], name: string) => any
  isTextLikeObject: (object: any) => boolean
  reviveRedBurstObjectNode: (object: any, options: any) => boolean
  getSinglePriceBackgroundCandidate: (objects: any[]) => any
  getSinglePriceCurrencyTextCandidate: (objects: any[]) => any
  ensureSinglePriceCurrencyCircleAnchor: (group: any, objects?: any[]) => any
  isObjectShownForBounds: (object: any) => boolean
  getObjectHorizontalBoundsLocal: (object: any) => any
  getObjectVerticalBoundsLocal: (object: any) => any
  measureHorizontalBoundsLocal: (objects: any[]) => any
  clamp: (value: number, min: number, max: number) => number
}

export const createManualPriceTemplateHelpers = (deps: ManualPriceTemplateHelperDeps) => {
  const { isRedBurstPriceGroup, collectObjectsDeep, findByName, isTextLikeObject, reviveRedBurstObjectNode, getSinglePriceBackgroundCandidate, getSinglePriceCurrencyTextCandidate, ensureSinglePriceCurrencyCircleAnchor, isObjectShownForBounds, getObjectHorizontalBoundsLocal, getObjectVerticalBoundsLocal, measureHorizontalBoundsLocal, clamp } = deps
  const ensureRedBurstPriceGroupVisibility = (priceGroup: any): boolean => {
      if (!isRedBurstPriceGroup(priceGroup)) return false;
      const all = collectObjectsDeep(priceGroup);
      const priceBg = findByName(all, 'price_bg');
      const headerBg = findByName(all, 'price_header_bg');
      const headerText = findByName(all, 'price_header_text');
      const currencyText = findByName(all, 'price_currency_text');
      const richPrice = findByName(all, 'price_value_text');
      const priceInteger = findByName(all, 'price_integer_text');
      const priceDecimal = findByName(all, 'price_decimal_text');
      let changed = false;

      const ensureShellVisible = (obj: any) => {
          if (!obj || typeof obj.set !== 'function') return;
          const next: Record<string, any> = {};
          if (obj.visible === false) next.visible = true;
          const opacity = Number(obj.opacity ?? 1);
          if (!Number.isFinite(opacity) || opacity <= 0) next.opacity = 1;
          if (Object.keys(next).length) {
              obj.set(next);
              obj.setCoords?.();
              changed = true;
          }
      };

      ensureShellVisible(priceBg);
      ensureShellVisible(headerBg);
      changed = reviveRedBurstObjectNode(headerText, {
          fallbackFill: '#ffd94c',
          fallbackFontSize: 28,
          fallbackText: 'OFERTA'
      }) || changed;
      changed = reviveRedBurstObjectNode(currencyText, {
          fallbackFill: '#ffffff',
          fallbackFontSize: 30,
          fallbackText: 'R$'
      }) || changed;
      changed = reviveRedBurstObjectNode(priceInteger || richPrice, {
          fallbackFill: '#ffffff',
          fallbackFontSize: 92,
          fallbackText: '0'
      }) || changed;
      if (priceDecimal) {
          changed = reviveRedBurstObjectNode(priceDecimal, {
              fallbackFill: '#ffffff',
              fallbackFontSize: 44,
              fallbackText: ',00'
          }) || changed;
      }

      if (changed) {
          priceGroup.dirty = true;
          priceGroup.setCoords?.();
      }
      return changed;
  }

  const constrainSinglePriceTextInsideBackground = (priceGroup: any) => {
      if (!priceGroup || typeof priceGroup.getObjects !== 'function') return;
      const all = collectObjectsDeep(priceGroup);
      if (findByName(all, 'atac_retail_bg')) return;

      const background = getSinglePriceBackgroundCandidate(all);
      const richPrice = findByName(all, 'price_value_text') || findByName(all, 'smart_price');
      const integer = findByName(all, 'price_integer_text') || findByName(all, 'priceInteger') || findByName(all, 'price_integer');
      const decimal = findByName(all, 'price_decimal_text') || findByName(all, 'priceDecimal') || findByName(all, 'price_decimal');
      const unit = findByName(all, 'price_unit_text') || findByName(all, 'priceUnit') || findByName(all, 'price_unit');
      const currency = getSinglePriceCurrencyTextCandidate(all);
      const currencyCircle = ensureSinglePriceCurrencyCircleAnchor(priceGroup, all);
      if (!background || (!richPrice && (!integer || !decimal))) return;

      [currency, richPrice, integer, decimal, unit].forEach((obj: any) => {
          if (obj && isTextLikeObject(obj)) obj.initDimensions?.();
      });

      const bgBounds = getObjectHorizontalBoundsLocal(background);
      const bgWidth = bgBounds ? Math.max(0, bgBounds.right - bgBounds.left) : 0;
      if (!bgBounds || bgWidth <= 0) return;

      const unitVisible = isObjectShownForBounds(unit) && String(unit?.text || '').trim().length > 0;
      const chain = [richPrice || integer, richPrice ? null : decimal, unitVisible ? unit : null].filter(Boolean) as any[];
      const hasCurrencyCircle = !!(currencyCircle && isObjectShownForBounds(currencyCircle));
      const fitTargets = hasCurrencyCircle
          ? chain
          : [currency, ...chain].filter((obj: any) => isObjectShownForBounds(obj));
      if (!fitTargets.length) return;

      const pad = clamp(bgWidth * 0.1, 7, 34);
      const currencyGap = clamp(bgWidth * 0.018, 2, 10);
      const circleBounds = hasCurrencyCircle ? getObjectHorizontalBoundsLocal(currencyCircle) : null;
      const leftLimit = hasCurrencyCircle && circleBounds
          ? Math.min(bgBounds.right - pad, circleBounds.right + currencyGap)
          : bgBounds.left + pad;
      const rightLimit = bgBounds.right - pad;
      const availableW = Math.max(8, rightLimit - leftLimit);

      const scaleTargets = (targets: any[], scale: number) => {
          targets.forEach((obj: any) => {
              if (!obj || typeof obj.set !== 'function') return;
              obj.set({
                  scaleX: Number(obj.scaleX || 1) * scale,
                  scaleY: Number(obj.scaleY || 1) * scale
              });
              obj.initDimensions?.();
              obj.setCoords?.();
          });
      };
      const moveTargets = (targets: any[], dx: number) => {
          targets.forEach((obj: any) => {
              if (!obj || typeof obj.set !== 'function') return;
              obj.set({ left: Number(obj.left || 0) + dx });
              obj.setCoords?.();
          });
      };

      let bounds = measureHorizontalBoundsLocal(fitTargets);
      if (!bounds) return;
      if (bounds.width > availableW) {
          scaleTargets(fitTargets, clamp(availableW / bounds.width, 0.28, 1));
          bounds = measureHorizontalBoundsLocal(fitTargets);
          if (!bounds) return;
      }

      let dx = 0;
      if (bounds.left < leftLimit) dx += leftLimit - bounds.left;
      if ((bounds.right + dx) > rightLimit) dx += rightLimit - (bounds.right + dx);
      if (Math.abs(dx) > 0.001) moveTargets(fitTargets, dx);

      if (currency && hasCurrencyCircle) {
          const circleH = getObjectHorizontalBoundsLocal(currencyCircle);
          const currencyBoundsH = getObjectHorizontalBoundsLocal(currency);
          if (circleH && currencyBoundsH) {
              const circleCenterX = (circleH.left + circleH.right) / 2;
              const currencyCenterX = (currencyBoundsH.left + currencyBoundsH.right) / 2;
              currency.set?.({ left: Number(currency.left || 0) + (circleCenterX - currencyCenterX) });
          }
          const circleV = getObjectVerticalBoundsLocal(currencyCircle);
          const currencyBoundsV = getObjectVerticalBoundsLocal(currency);
          if (circleV && currencyBoundsV) {
              const circleCenterY = (circleV.top + circleV.bottom) / 2;
              const currencyCenterY = (currencyBoundsV.top + currencyBoundsV.bottom) / 2;
              currency.set?.({ top: Number(currency.top || 0) + (circleCenterY - currencyCenterY) });
          }
          currency.setCoords?.();
      }

      priceGroup.dirty = true;
      priceGroup.setCoords?.();
  };

  return { ensureRedBurstPriceGroupVisibility, constrainSinglePriceTextInsideBackground }
}
