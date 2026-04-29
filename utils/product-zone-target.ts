type ResolveZoneForProductImportOptions = {
  canvas: any
  target: any
  isLikelyProductZone: (value: any) => boolean
  isProductCardContainer: (value: any) => boolean
  findContainmentZoneById: (zoneId: string) => any | null
  resolveCardParentZone: (card: any, opts?: { allowNearest?: boolean }) => any | null
  findProductCardParentGroup: (value: any) => any | null
};

export const resolveZoneForProductImport = (opts: ResolveZoneForProductImportOptions): any | null => {
  const target = opts.target;
  if (!target || !opts.canvas) return null;

  if (opts.isLikelyProductZone(target)) return target;

  const resolveByZoneId = (zoneIdRaw: any): any | null => {
    const zoneId = String(zoneIdRaw || '').trim();
    if (!zoneId) return null;
    return opts.findContainmentZoneById(zoneId);
  };

  const directZoneByParent = resolveByZoneId((target as any)?.parentZoneId);
  if (directZoneByParent) return directZoneByParent;
  const directZoneBySlot = resolveByZoneId((target as any)?._zoneSlot?.zoneId);
  if (directZoneBySlot) return directZoneBySlot;

  if (opts.isProductCardContainer(target)) {
    const zoneFromCard = opts.resolveCardParentZone(target, { allowNearest: true });
    if (zoneFromCard) return zoneFromCard;
  }

  let cursor: any = target;
  const visited = new Set<any>();
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    if (opts.isLikelyProductZone(cursor)) return cursor;

    const byParent = resolveByZoneId((cursor as any)?.parentZoneId);
    if (byParent) return byParent;
    const bySlot = resolveByZoneId((cursor as any)?._zoneSlot?.zoneId);
    if (bySlot) return bySlot;

    if (opts.isProductCardContainer(cursor)) {
      const zoneFromCard = opts.resolveCardParentZone(cursor, { allowNearest: true });
      if (zoneFromCard) return zoneFromCard;
    }

    cursor = (cursor as any)?.group;
  }

  const parentCard = opts.findProductCardParentGroup(target);
  if (parentCard) {
    const zoneFromParentCard = opts.resolveCardParentZone(parentCard, { allowNearest: true });
    if (zoneFromParentCard) return zoneFromParentCard;
  }

  return null;
};

type ResolveImportTargetZoneOptions = {
  canvas: any
  targetGridZone: any
  selectedObjectSnapshot: any
  isLikelyProductZone: (value: any) => boolean
  resolveZoneForProductImport: (target: any) => any | null
};

export const resolveImportTargetZone = (opts: ResolveImportTargetZoneOptions): any | null => {
  if (!opts.canvas) return null;

  const zones = opts.canvas.getObjects().filter((obj: any) => opts.isLikelyProductZone(obj));
  const byId = new Map<string, any>();
  zones.forEach((zone: any) => {
    const id = String((zone as any)?._customId || '').trim();
    if (id) byId.set(id, zone);
  });

  const resolveById = (rawId: any): any | null => {
    const id = String(rawId || '').trim();
    if (!id) return null;
    return byId.get(id) || null;
  };

  // Resolve a zona da seleção ativa primeiro: depois de duplicar um frame, a
  // referência explícita em `targetGridZone` pode estar apontando para a zona
  // original (último import bem-sucedido). Se o usuário agora tem a zona/card
  // do frame duplicado selecionado, ela é a fonte de verdade — caso contrário,
  // a importação cai na zona errada.
  const active = opts.canvas.getActiveObject?.();
  const fromActive = opts.resolveZoneForProductImport(active);

  const explicit = opts.targetGridZone;
  if (explicit && opts.isLikelyProductZone(explicit)) {
    const refreshed = resolveById((explicit as any)?._customId);
    const explicitZone = refreshed || explicit;

    // Quando o ativo aponta para uma zona DIFERENTE da explícita, a explícita
    // está stale (ex.: confirmProductImport/openProductReviewForZone abriu o
    // modal antes da nova seleção). Prefere a zona ativa.
    if (fromActive && fromActive !== explicitZone) {
      const explicitId = String((explicitZone as any)?._customId || '').trim();
      const activeId = String((fromActive as any)?._customId || '').trim();
      if (explicitId && activeId && explicitId !== activeId) {
        return fromActive;
      }
    }
    return explicitZone;
  }
  if (explicit) {
    const byExplicitId = resolveById((explicit as any)?._customId) || resolveById((explicit as any)?.id);
    if (byExplicitId) {
      if (fromActive && fromActive !== byExplicitId) {
        const explicitId = String((byExplicitId as any)?._customId || '').trim();
        const activeId = String((fromActive as any)?._customId || '').trim();
        if (explicitId && activeId && explicitId !== activeId) {
          return fromActive;
        }
      }
      return byExplicitId;
    }
  }

  if (fromActive) return fromActive;

  const snap: any = opts.selectedObjectSnapshot;
  const fromSnapshot =
    resolveById(snap?._customId) ||
    resolveById(snap?.parentZoneId) ||
    resolveById(snap?._zoneSlot?.zoneId);
  if (fromSnapshot) return fromSnapshot;

  if (zones.length === 1) return zones[0];
  return null;
};

type OpenProductReviewForZoneOptions = {
  zone: any
  isLikelyProductZone: (value: any) => boolean
  getZoneChildren: (zone: any) => any[]
  setTargetZone: (zone: any) => void
  setExistingCount: (count: number) => void
  setReviewProducts: (products: any[]) => void
  setShowReviewModal: (value: boolean) => void
};

export const openProductReviewForZone = (opts: OpenProductReviewForZoneOptions): boolean => {
  const zone = opts.zone;
  if (!zone || !opts.isLikelyProductZone(zone)) return false;

  opts.setTargetZone(zone);
  try {
    opts.setExistingCount(opts.getZoneChildren(zone).length);
  } catch {
    opts.setExistingCount(0);
  }
  opts.setReviewProducts([]);
  opts.setShowReviewModal(true);
  return true;
};
