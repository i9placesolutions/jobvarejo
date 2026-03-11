import type { GlobalStyles, ProductZone } from '~/types/product-zone';
import { calculateGridLayout } from '~/utils/product-zone-helpers';
import { inferZoneContentStatus } from '~/utils/product-zone-metadata';

export type ProductZoneDiagnosticSeverity = 'info' | 'warning' | 'critical';

export type ProductZoneDiagnostic = {
  id: 'empty' | 'overflow-risk' | 'image-review' | 'template-risk' | 'text-risk' | 'mixed-visual-priority';
  severity: ProductZoneDiagnosticSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionId?: 'open-review' | 'open-layout' | 'open-template';
};

export type ProductZoneDiagnosticCard = {
  id?: string;
  name?: string;
  imageUrl?: string | null;
  status?: string | null;
  imageReviewReason?: string | null;
  error?: string | null;
  priceMode?: string | null;
  pricePack?: string | number | null;
  priceUnit?: string | number | null;
  priceSpecial?: string | number | null;
  priceSpecialUnit?: string | number | null;
  specialCondition?: string | null;
};

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return String(value).trim().length > 0;
};

export const buildProductZoneDiagnostics = (opts: {
  zone: Partial<ProductZone> | null | undefined;
  zoneCards: ProductZoneDiagnosticCard[];
  globalStyles?: Partial<GlobalStyles> | null;
}): ProductZoneDiagnostic[] => {
  const zone = opts.zone || {};
  const zoneCards = Array.isArray(opts.zoneCards) ? opts.zoneCards : [];
  const diagnostics: ProductZoneDiagnostic[] = [];

  if (zoneCards.length === 0) {
    diagnostics.push({
      id: 'empty',
      severity: 'info',
      title: 'Zona vazia',
      message: 'Adicione produtos para preencher a zona e testar o layout.',
      actionLabel: 'Abrir revisão',
      actionId: 'open-review'
    });
    return diagnostics;
  }

  const layout = calculateGridLayout({
    x: Number(zone.x || 0),
    y: Number(zone.y || 0),
    width: Number(zone.width || 900),
    height: Number(zone.height || 600),
    padding: Number(zone.padding ?? 15),
    gapHorizontal: Number(zone.gapHorizontal ?? zone.padding ?? 15),
    gapVertical: Number(zone.gapVertical ?? zone.padding ?? 15),
    columns: Number(zone.columns ?? 0),
    rows: Number(zone.rows ?? 0),
    layoutDirection: zone.layoutDirection ?? 'horizontal',
    cardAspectRatio: zone.cardAspectRatio ?? 'fill',
    lastRowBehavior: zone.lastRowBehavior ?? 'fill',
    verticalAlign: zone.verticalAlign ?? 'stretch',
    highlightCount: Number(zone.highlightCount ?? 0),
    highlightPos: zone.highlightPos ?? 'first',
    highlightHeight: Number(zone.highlightHeight ?? 1.5)
  }, zoneCards.length);

  const hasOverflowRisk = layout.itemWidth < 135 || layout.itemHeight < 180;
  if (hasOverflowRisk) {
    diagnostics.push({
      id: 'overflow-risk',
      severity: 'warning',
      title: 'Zona com risco de excesso',
      message: 'A densidade atual está apertando os cards. Reduza colunas ou aplique um preset com mais respiro.',
      actionLabel: 'Ajustar layout',
      actionId: 'open-layout'
    });
  }

  const needsImageReview = zoneCards.some((card) => {
    const status = String(card?.status || '').trim().toLowerCase();
    return !hasValue(card?.imageUrl) || status === 'review_pending' || status === 'error' || hasValue(card?.imageReviewReason) || hasValue(card?.error);
  });
  if (needsImageReview) {
    diagnostics.push({
      id: 'image-review',
      severity: 'warning',
      title: 'Imagens precisam de revisão',
      message: 'Há produtos com imagem ausente, erro ou revisão pendente. Revise antes de fechar o encarte.',
      actionLabel: 'Abrir revisão',
      actionId: 'open-review'
    });
  }

  const hasAtacarejo = zoneCards.some((card) => (
    hasValue(card?.pricePack) ||
    hasValue(card?.priceUnit) ||
    hasValue(card?.priceSpecial) ||
    hasValue(card?.priceSpecialUnit) ||
    hasValue(card?.specialCondition)
  ));
  const templateId = String(opts.globalStyles?.splashTemplateId || '').trim().toLowerCase();
  const looksLikeSimpleTemplate = !templateId || (!templateId.includes('atac') && !templateId.includes('pack') && !templateId.includes('unit'));
  if (hasAtacarejo && looksLikeSimpleTemplate) {
    diagnostics.push({
      id: 'template-risk',
      severity: 'warning',
      title: 'Template pode não representar o preço',
      message: 'A zona tem itens pack/unit ou condição especial, mas o template atual parece simples demais.',
      actionLabel: 'Abrir template',
      actionId: 'open-template'
    });
  }

  const hasLongText = zoneCards.some((card) => {
    const name = String(card?.name || '').trim();
    const condition = String(card?.specialCondition || '').trim();
    return name.length > 42 || condition.length > 26;
  });
  if (hasLongText) {
    diagnostics.push({
      id: 'text-risk',
      severity: 'info',
      title: 'Texto com chance de overflow',
      message: 'Alguns nomes ou condições são longos e podem quebrar a composição do card.',
      actionLabel: 'Ajustar layout',
      actionId: 'open-layout'
    });
  }

  const priceModes = Array.from(new Set(zoneCards.map((card) => String(card?.priceMode || '').trim()).filter(Boolean)));
  const highlightCount = Math.max(0, Number(zone.highlightCount ?? 0));
  if (highlightCount > 0 && priceModes.length > 1) {
    diagnostics.push({
      id: 'mixed-visual-priority',
      severity: 'info',
      title: 'Destaques misturam lógicas de preço',
      message: 'Os cards destacados combinam modos de preço diferentes. Vale revisar se o hero está no item certo.',
      actionLabel: 'Abrir revisão',
      actionId: 'open-review'
    });
  }

  return diagnostics;
};

export const getZoneContentStatusFromDiagnostics = (
  cardCount: number,
  diagnostics: ProductZoneDiagnostic[]
): ProductZone['contentStatus'] => {
  const hasOverflow = diagnostics.some((diagnostic) => diagnostic.id === 'overflow-risk');
  const hasWarnings = diagnostics.some((diagnostic) => diagnostic.severity !== 'info');
  return inferZoneContentStatus(cardCount, { hasOverflow, hasWarnings });
};
