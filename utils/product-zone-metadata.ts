import type { ProductZone } from '~/types/product-zone';

export const DEFAULT_ZONE_NAME = 'Zona de Produtos';

export const getZoneDisplayName = (zone: Partial<ProductZone> | null | undefined): string => {
  const direct = String((zone as any)?.name || (zone as any)?.zoneName || '').trim();
  if (direct) return direct;
  return DEFAULT_ZONE_NAME;
};

export const getZoneRoleLabel = (role: ProductZone['role'] | null | undefined): string => {
  switch (role) {
    case 'hero':
      return 'Hero';
    case 'sidebar':
      return 'Sidebar';
    case 'showcase':
      return 'Vitrine';
    case 'grid':
    default:
      return 'Grid';
  }
};

export const getZoneStatusLabel = (status: ProductZone['contentStatus'] | null | undefined): string => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'filled':
      return 'Preenchida';
    case 'overflow':
      return 'Lotada';
    case 'empty':
    default:
      return 'Vazia';
  }
};

export const inferZoneContentStatus = (
  cardCount: number,
  opts: { hasOverflow?: boolean; hasWarnings?: boolean } = {}
): ProductZone['contentStatus'] => {
  if (cardCount <= 0) return 'empty';
  if (opts.hasOverflow) return 'overflow';
  if (opts.hasWarnings) return 'draft';
  return 'filled';
};
