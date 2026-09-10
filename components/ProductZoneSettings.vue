<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  Columns3,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Settings2,
  CreditCard,
  Type,
  Tag,
  PackagePlus,
  Sparkles
} from 'lucide-vue-next';
import {
  SPLASH_STYLES,
  type LayoutPreset,
  type ProductZoneStructure,
  type ProductZoneStructureMap
} from '~/types/product-zone';
import type { LabelTemplate } from '~/types/label-template';
import type { GlobalStyles, ProductZone } from '~/types/product-zone';
import ProductPaletteControls from './ProductPaletteControls.vue';
const { project: paletteProject } = useProject();
import ColorPicker from './ui/ColorPicker.vue';
import {
  AVAILABLE_FONT_FAMILIES,
  fontSupportsItalic,
  getFontWeightOptionsForFamily,
  normalizeFontWeightForFamily
} from '~/utils/font-catalog';
import type { ProductZoneDiagnostic } from '~/utils/product-zone-diagnostics';
import { getZoneRoleLabel, getZoneStatusLabel } from '~/utils/product-zone-metadata';
import {
  getProductZoneStructureFormatLabel,
  normalizeProductZoneStructure,
  normalizeProductZoneStructureVariantMap
} from '~/utils/product-zone-structure';

type ZoneUpdateTargetMeta = {
  targetId: string | null;
};

const props = defineProps<{
  zone: {
    id?: string;
    _customId?: string;
    name?: string;
    role?: ProductZone['role'];
    contentSource?: ProductZone['contentSource'];
    contentStatus?: ProductZone['contentStatus'];
    overflowPolicy?: ProductZone['overflowPolicy'];
    columns?: number;
    rows?: number;
    padding?: number;
    gapHorizontal?: number;
    gapVertical?: number;
    layoutDirection?: 'horizontal' | 'vertical';
    cardAspectRatio?: string;
    lastRowBehavior?: 'fill' | 'center' | 'stretch' | 'left';
    verticalAlign?: 'top' | 'center' | 'bottom' | 'stretch';
    structureByProductCountEnabled?: boolean;
    structureByProductCount?: ProductZoneStructureMap;
    structureVariantsByProductCount?: ProductZone['structureVariantsByProductCount'];
    structureVariantByProductCount?: ProductZone['structureVariantByProductCount'];
    highlightCount?: number;
    highlightPos?: string;
    highlightHeight?: number;
    isLocked?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    showBorder?: boolean;
    productCount?: number;
    frameLabel?: string;
    diagnostics?: ProductZoneDiagnostic[];
  };
  globalStyles?: Partial<GlobalStyles>;
  labelTemplates?: LabelTemplate[];
  globalStructuresLoaded?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:zone', prop: string, value: any, meta?: ZoneUpdateTargetMeta): void;
  (e: 'update:global-styles', prop: string, value: any, meta?: ZoneUpdateTargetMeta): void;
  (e: 'apply-preset', presetId: string): void;
  (e: 'sync-gaps', padding: number, meta?: ZoneUpdateTargetMeta): void;
  (e: 'recalculate-layout'): void;
  (e: 'manage-label-templates'): void;
  (e: 'apply-template-to-zone'): void;
  (e: 'open-review'): void;
  (e: 'auto-layout'): void;
}>();

const showCardColorPicker = ref(false);
const showAccentColorPicker = ref(false);
const showSplashColorPicker = ref(false);
const showSplashFillColorPicker = ref(false);
const showSplashTextColorPicker = ref(false);
const showCardBorderColorPicker = ref(false);
const showProdNameColorPicker = ref(false);
const showPriceTextColorPicker = ref(false);
const showPriceCurrencyColorPicker = ref(false);

const cardColorPickerRef = ref<HTMLElement | null>(null);
const accentColorPickerRef = ref<HTMLElement | null>(null);
const splashColorPickerRef = ref<HTMLElement | null>(null);
const splashFillColorPickerRef = ref<HTMLElement | null>(null);
const splashTextColorPickerRef = ref<HTMLElement | null>(null);
const cardBorderColorPickerRef = ref<HTMLElement | null>(null);
const prodNameColorPickerRef = ref<HTMLElement | null>(null);
const priceTextColorPickerRef = ref<HTMLElement | null>(null);
const priceCurrencyColorPickerRef = ref<HTMLElement | null>(null);

const expandedSections = ref({
  content: false,
  structure: true,
  cardStyle: false,
  typography: false,
  priceTag: false,
  diagnostics: false
});

const zoneRoleOptions = [
  { value: 'grid' as const, label: 'Grid', hint: 'Grade principal para a maioria das ofertas.' },
  { value: 'hero' as const, label: 'Hero', hint: 'Reserva destaque para um produto ancora.' },
  { value: 'sidebar' as const, label: 'Sidebar', hint: 'Boa para apoio lateral ou combo de apoio.' },
  { value: 'showcase' as const, label: 'Vitrine', hint: 'Composição mais editorial para seleções especiais.' }
] as const;

// AVISO: a opcao 'paginate' ainda nao realiza paginacao real (nova pagina para excesso).
// O comportamento atual compacta/expande linhas para caber os cards. O label foi
// corrigido para refletir o comportamento real e evitar erro comercial de encarte
// com cards minusculos quando ha muitos produtos.
const overflowPolicyOptions = [
  { value: 'warn' as const, label: 'Avisar', hint: 'Mantém o layout e mostra risco de excesso.' },
  { value: 'paginate' as const, label: 'Compactar', hint: 'Reduz a altura das linhas para caber os produtos extras.' }
] as const;

const lastRowBehaviorOptions = [
  { value: 'fill', label: 'Sempre preencher', hint: 'Alarga a linha final para evitar espaços vazios.' }
] as const;

const layoutDirectionOptions = [
  { value: 'horizontal', label: 'Linha a linha', hint: 'Preenche na leitura natural, da esquerda para a direita.' },
  { value: 'vertical', label: 'Coluna a coluna', hint: 'Desce primeiro e depois avança para o lado.' }
] as const;

const verticalAlignOptions = [
  { value: 'top', label: 'Topo' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Base' },
  { value: 'stretch', label: 'Preencher' }
] as const;

const cardAspectRatioOptions = [
  { value: 'fill', label: 'Livre' },
  { value: 'auto', label: 'Automático' },
  { value: 'square', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '4:5', label: '4:5' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' }
] as const;

const highlightPositionOptions = [
  { value: 'first', label: 'Primeiros' },
  { value: 'last', label: 'Últimos' },
  { value: 'center', label: 'Centro' },
  { value: 'top', label: 'Topo' },
  { value: 'bottom', label: 'Base' },
  { value: 'random', label: 'Aleatório' }
] as const;

const PRICE_TAG_SCALE_MIN = 0.6;
const PRICE_TAG_SCALE_MAX = 3;

const priceTagFitPresets = [
  { id: 'compact', label: 'Compacta', splashScale: 0.88, splashTextScale: 0.92, priceFontSize: 52, splashOffsetY: 0 },
  { id: 'normal', label: 'Padrão', splashScale: 1, splashTextScale: 1, priceFontSize: 60, splashOffsetY: 0 },
  { id: 'large', label: 'Grande', splashScale: 1.16, splashTextScale: 1.08, priceFontSize: 68, splashOffsetY: 0 }
] as const;

// Auto-expandir diagnóstico quando há alertas críticos
watch(
  () => props.zone.diagnostics,
  (diags) => {
    if (Array.isArray(diags) && diags.some((d) => d.severity === 'critical')) {
      expandedSections.value.diagnostics = true;
    }
  },
  { immediate: true }
);

type HighlightPos = 'first' | 'last' | 'random' | 'center' | 'top' | 'bottom';
type PreviewTone = 'base' | 'highlight';
type NormalizedZonePresetState = {
  role: ProductZone['role'];
  columns: number;
  rows: number;
  padding: number;
  gapHorizontal: number;
  gapVertical: number;
  layoutDirection: 'horizontal' | 'vertical';
  cardAspectRatio: string;
  lastRowBehavior: 'fill' | 'center' | 'stretch' | 'left';
  verticalAlign: 'top' | 'center' | 'bottom' | 'stretch';
  highlightCount: number;
  highlightPos: HighlightPos;
  highlightHeight: number;
};

type PresetPreviewCell = {
  id: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  tone: PreviewTone;
};

const toSafeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeHexColor = (value: string, fallback: string) => {
  const raw = String(value || '').trim().replace(/^#/, '');
  return raw ? `#${raw}` : fallback;
};

const normalizeHighlightPos = (value: unknown): HighlightPos => {
  if (
    value === 'last' ||
    value === 'random' ||
    value === 'center' ||
    value === 'top' ||
    value === 'bottom'
  ) return value;
  return 'first';
};

const normalizedZoneState = computed<NormalizedZonePresetState>(() => ({
  role: props.zone.role ?? 'grid',
  columns: Math.max(0, Math.round(toSafeNumber(props.zone.columns, 0))),
  rows: Math.max(0, Math.round(toSafeNumber(props.zone.rows, 0))),
  padding: Math.max(0, Math.round(toSafeNumber(props.zone.padding, 15))),
  gapHorizontal: Math.max(0, Math.round(toSafeNumber(props.zone.gapHorizontal, props.zone.padding ?? 15))),
  gapVertical: Math.max(0, Math.round(toSafeNumber(props.zone.gapVertical, props.zone.padding ?? 15))),
  layoutDirection: props.zone.layoutDirection === 'vertical' ? 'vertical' : 'horizontal',
  cardAspectRatio: props.zone.cardAspectRatio ?? 'fill',
  lastRowBehavior: 'fill',
  verticalAlign: (props.zone.verticalAlign ?? 'stretch') as NormalizedZonePresetState['verticalAlign'],
  highlightCount: Math.max(0, Math.round(toSafeNumber(props.zone.highlightCount, 0))),
  highlightPos: normalizeHighlightPos(props.zone.highlightPos),
  highlightHeight: toSafeNumber(props.zone.highlightHeight, 1.5)
}));

const currentStructureCount = computed(() =>
  clamp(Math.round(toSafeNumber(props.zone.productCount, 1)), 1, 24)
);

const currentStructure = computed<ProductZoneStructure>(() => {
  const count = currentStructureCount.value;
  const resolved = normalizeProductZoneStructureVariantMap(
    props.zone.structureVariantsByProductCount,
    props.zone as Partial<ProductZone>,
    props.zone.structureByProductCount
  )[String(count)] || [];
  const selectedId = String(props.zone.structureVariantByProductCount?.[String(count)] || '').trim();
  const selected = resolved.find((variant) => variant.id === selectedId) || resolved[0];
  const entry = selected || props.zone.structureByProductCount?.[String(count)];
  return normalizeProductZoneStructure(entry, count, props.zone as Partial<ProductZone>);
});

const currentStructureVariants = computed(() => normalizeProductZoneStructureVariantMap(
  props.zone.structureVariantsByProductCount,
  props.zone as Partial<ProductZone>,
  props.zone.structureByProductCount
)[String(currentStructureCount.value)] || []);

const currentStructureVariantId = computed(() => {
  const selectedId = String(props.zone.structureVariantByProductCount?.[String(currentStructureCount.value)] || '').trim();
  if (selectedId && currentStructureVariants.value.some((variant) => variant.id === selectedId)) {
    return selectedId;
  }
  return currentStructureVariants.value[0]?.id || '';
});

const selectCurrentStructureVariant = (event: Event) => {
  const nextId = String((event.target as HTMLSelectElement)?.value || '').trim();
  if (!nextId || !currentStructureVariants.value.some((variant) => variant.id === nextId)) return;

  const countKey = String(currentStructureCount.value);
  const nextSelection = {
    ...(props.zone.structureVariantByProductCount || {}),
    [countKey]: nextId
  };
  updateZone('structureVariantByProductCount', nextSelection);
};

const isRightBiasedPreset = (preset: LayoutPreset) =>
  preset.highlightPos === 'last' || preset.id.endsWith('right');

const getPreviewCols = (preset: LayoutPreset) => {
  const fallback = preset.columns && preset.columns > 0 ? preset.columns : 4;
  return clamp(Math.round(toSafeNumber(preset.previewCols, fallback)), 1, 8);
};

const getPreviewRows = (preset: LayoutPreset) => {
  const fallback = preset.rows && preset.rows > 0 ? preset.rows : 3;
  return clamp(Math.round(toSafeNumber(preset.previewRows, fallback)), 2, 5);
};

const getPreviewGridStyle = (preset: LayoutPreset) => ({
  gridTemplateColumns: `repeat(${getPreviewCols(preset)}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${getPreviewRows(preset)}, minmax(0, 1fr))`
});

const getPreviewCellStyle = (cell: PresetPreviewCell) => ({
  gridColumn: `${cell.col} / span ${cell.colSpan}`,
  gridRow: `${cell.row} / span ${cell.rowSpan}`
});

const createPreviewCells = (preset: LayoutPreset): PresetPreviewCell[] => {
  const cols = getPreviewCols(preset);
  const rows = getPreviewRows(preset);
  const maxCells = clamp(
    Math.round(toSafeNumber(preset.previewCount, cols * rows)),
    1,
    cols * rows
  );

  const occupied = new Set<string>();
  const cells: PresetPreviewCell[] = [];

  const addCell = (
    id: string,
    col: number,
    row: number,
    colSpan = 1,
    rowSpan = 1,
    tone: PreviewTone = 'base'
  ) => {
    const safeCol = clamp(col, 1, cols);
    const safeRow = clamp(row, 1, rows);
    const safeColSpan = clamp(colSpan, 1, cols - safeCol + 1);
    const safeRowSpan = clamp(rowSpan, 1, rows - safeRow + 1);

    for (let r = safeRow; r < safeRow + safeRowSpan; r += 1) {
      for (let c = safeCol; c < safeCol + safeColSpan; c += 1) {
        occupied.add(`${c}:${r}`);
      }
    }

    cells.push({
      id,
      col: safeCol,
      row: safeRow,
      colSpan: safeColSpan,
      rowSpan: safeRowSpan,
      tone
    });
  };

  const previewKind = preset.previewKind ?? 'grid';

  if (
    previewKind === 'hero' ||
    previewKind === 'hero-top' ||
    previewKind === 'hero-bottom' ||
    previewKind === 'hero-center'
  ) {
    const heroWidth = cols >= 4 ? 2 : 1;
    const heroHeight = rows >= 3 ? 2 : 1;
    const defaultHeroCol = isRightBiasedPreset(preset)
      ? Math.max(1, cols - heroWidth + 1)
      : 1;
    const centeredHeroCol = Math.max(1, Math.floor((cols - heroWidth) / 2) + 1);
    const heroCol = previewKind === 'hero-center' ? centeredHeroCol : defaultHeroCol;
    const heroRow = previewKind === 'hero-bottom'
      ? Math.max(1, rows - heroHeight + 1)
      : 1;
    addCell('hero', heroCol, heroRow, heroWidth, heroHeight, 'highlight');
  }

  if (previewKind === 'sidebar') {
    const sideCol = isRightBiasedPreset(preset) ? cols : 1;
    const highlights = clamp(
      Math.round(toSafeNumber(preset.highlightCount, Math.min(rows, 3))),
      1,
      rows
    );
    for (let row = 1; row <= highlights; row += 1) {
      addCell(`sidebar-${row}`, sideCol, row, 1, 1, 'highlight');
    }
  }

  let seed = 0;
  outer: for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      if (cells.length >= maxCells) break outer;
      if (occupied.has(`${col}:${row}`)) continue;
      seed += 1;
      addCell(`cell-${seed}`, col, row);
    }
  }

  return cells.slice(0, maxCells);
};

const currentPresetName = computed(() =>
  `${getProductZoneStructureFormatLabel(currentStructure.value.format)} · ${currentStructureCount.value}`
);

const getCustomPreviewKind = (zone: NormalizedZonePresetState): LayoutPreset['previewKind'] => {
  if (zone.highlightCount <= 0) return 'grid';
  if (zone.highlightCount > 1) return 'sidebar';
  if (zone.highlightPos === 'center') return 'hero-center';
  if (zone.highlightPos === 'bottom') return 'hero-bottom';
  if (zone.highlightPos === 'top') return 'hero-top';
  return 'hero';
};

const customPreviewPreset = computed<LayoutPreset>(() => {
  const zone = normalizedZoneState.value;
  const structure = currentStructure.value;
  const previewZone: NormalizedZonePresetState = {
    ...zone,
    role: structure.role,
    columns: structure.columns,
    rows: structure.rows,
    padding: structure.padding,
    gapHorizontal: structure.gapHorizontal,
    gapVertical: structure.gapVertical,
    layoutDirection: structure.layoutDirection,
    cardAspectRatio: structure.cardAspectRatio,
    lastRowBehavior: structure.lastRowBehavior,
    verticalAlign: structure.verticalAlign,
    highlightCount: structure.highlightCount,
    highlightPos: structure.highlightPos,
    highlightHeight: structure.highlightHeight
  };
  const previewCols = clamp(structure.columns > 0 ? structure.columns : 4, 1, 6);
  const previewRows = clamp(structure.rows > 0 ? structure.rows : 3, 2, 4);
  return {
    id: 'custom-preview',
    name: 'Atual',
    category: structure.highlightCount > 0 ? 'special' : 'grid',
    columns: structure.columns,
    rows: structure.rows,
    layoutDirection: structure.layoutDirection,
    cardAspectRatio: structure.cardAspectRatio as LayoutPreset['cardAspectRatio'],
    lastRowBehavior: structure.lastRowBehavior,
    verticalAlign: structure.verticalAlign,
    highlightCount: structure.highlightCount,
    highlightPos: structure.highlightPos,
    highlightHeight: structure.highlightHeight,
    previewKind: getCustomPreviewKind(previewZone),
    previewCols,
    previewRows,
    previewCount: previewCols * previewRows
  };
});

const activePreviewPreset = computed(() => customPreviewPreset.value);
const activePreviewStyle = computed(() => getPreviewGridStyle(activePreviewPreset.value));
const activePreviewCells = computed(() => createPreviewCells(activePreviewPreset.value));

const zoneColumnsLabel = computed(() =>
  currentStructure.value.columns > 0
    ? `${currentStructure.value.columns} por linha`
    : 'Colunas automáticas'
);

const zoneRowsLabel = computed(() =>
  currentStructure.value.rows > 0
    ? `${currentStructure.value.rows} linhas`
    : 'Altura livre'
);

const activeTemplateName = computed(() => {
  const templateId = String(props.globalStyles?.splashTemplateId || '').trim();
  if (!templateId) return 'Etiqueta padrão da zona';
  return props.labelTemplates?.find((tpl) => String(tpl.id) === templateId)?.name || 'Modelo selecionado';
});

// Detecta se o template ativo é atacarejo (possui estrutura de 2 preços: varejo + atacado).
// Templates atacarejo têm layout fixo — controles como splashTextScale não se aplicam.
const isActiveTemplateAtacarejo = computed(() => {
  const templateId = String(props.globalStyles?.splashTemplateId || '').trim();
  if (!templateId) return false;
  const tpl = props.labelTemplates?.find((t) => String(t.id) === templateId);
  if (!tpl?.group) return false;
  // Verifica recursivamente se o JSON do grupo contém 'atac_retail_bg'
  const hasAtacNode = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.name === 'atac_retail_bg') return true;
    if (Array.isArray(obj.objects)) return obj.objects.some(hasAtacNode);
    return false;
  };
  return hasAtacNode(tpl.group);
});

const isActiveTemplateShapeLocked = computed(() => {
  const templateId = String(props.globalStyles?.splashTemplateId || '').trim();
  if (!templateId) return false;
  const tpl = props.labelTemplates?.find((t) => String(t.id) === templateId);
  if (!tpl?.group) return false;
  const hasPreservedGeometry = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.__preserveManualLayout === true || obj.__isCustomTemplate === true) return true;
    if (Array.isArray(obj.objects)) return obj.objects.some(hasPreservedGeometry);
    return false;
  };
  return hasPreservedGeometry(tpl.group);
});

const zoneRoleLabel = computed(() => getZoneRoleLabel(props.zone.role ?? 'grid'));
const zoneStatusLabel = computed(() => getZoneStatusLabel(props.zone.contentStatus ?? 'empty'));
const zoneSourceLabel = computed(() => {
  switch (props.zone.contentSource) {
    case 'paste-list':
      return 'Lista colada';
    case 'file-import':
      return 'Arquivo';
    case 'multi-frame':
      return 'Multi-frame';
    case 'manual':
    default:
      return 'Manual';
  }
});

const diagnostics = computed<ProductZoneDiagnostic[]>(() =>
  Array.isArray(props.zone.diagnostics) ? props.zone.diagnostics : []
);

const diagnosticsSummaryLabel = computed(() => {
  if (diagnostics.value.length === 0) return 'Sem alertas';
  const critical = diagnostics.value.filter((item) => item.severity === 'critical').length;
  if (critical > 0) return `${critical} crítico${critical > 1 ? 's' : ''}`;
  return `${diagnostics.value.length} alerta${diagnostics.value.length > 1 ? 's' : ''}`;
});

const styleSummaryLabel = computed(() => {
  const splashStyle = SPLASH_STYLES.find((style) => style.id === (props.globalStyles?.splashStyle ?? 'classic'));
  if (props.globalStyles?.splashTemplateId) return activeTemplateName.value;
  return `Splash ${splashStyle?.name || 'Clássico'}`;
});

const zoneLockLabel = computed(() => (
  props.zone.isLocked ? 'Zona bloqueada' : 'Zona editável'
));

const flowLabel = computed(() =>
  layoutDirectionOptions.find((option) => option.value === normalizedZoneState.value.layoutDirection)?.label ?? 'Linha a linha'
);

const verticalAlignLabel = computed(() =>
  verticalAlignOptions.find((option) => option.value === normalizedZoneState.value.verticalAlign)?.label ?? 'Preencher'
);

const aspectRatioLabel = computed(() =>
  cardAspectRatioOptions.find((option) => option.value === normalizedZoneState.value.cardAspectRatio)?.label ?? 'Livre'
);

const overviewMetrics = computed(() => ([
  { label: 'Função', value: zoneRoleLabel.value },
  { label: 'Status', value: zoneStatusLabel.value },
  { label: 'Fluxo', value: flowLabel.value },
  { label: 'Origem', value: zoneSourceLabel.value },
  { label: 'Alinhamento', value: verticalAlignLabel.value },
  { label: 'Cartões', value: aspectRatioLabel.value },
  { label: 'Etiqueta', value: styleSummaryLabel.value }
] as const));

const getZoneUpdateTargetMeta = (): ZoneUpdateTargetMeta => ({
  targetId: String((props.zone as any)?._customId || (props.zone as any)?.id || '').trim() || null
});

const updateZone = (prop: string, value: any, meta: ZoneUpdateTargetMeta = getZoneUpdateTargetMeta()) => {
  emit('update:zone', prop, value, meta);
};

const structureSummaryLabel = computed(() => {
  const count = Math.min(24, Math.max(1, Math.round(toSafeNumber(props.zone.productCount, 1))));
  if (!(props.zone.productCount ?? 0)) return 'Aguardando lista';
  return `${getProductZoneStructureFormatLabel(currentStructure.value.format)} para ${count}`;
});

const updateGlobal = (prop: string, value: any, meta: ZoneUpdateTargetMeta = getZoneUpdateTargetMeta()) => {
  emit('update:global-styles', prop, value, meta);
};

const applyPriceTagFitPreset = (presetId: typeof priceTagFitPresets[number]['id']) => {
  const preset = priceTagFitPresets.find((item) => item.id === presetId) ?? priceTagFitPresets[1];
  updateGlobal('splashScale', preset.splashScale);
  if (!isActiveTemplateAtacarejo.value) updateGlobal('splashTextScale', preset.splashTextScale);
  updateGlobal('priceFontSize', preset.priceFontSize);
  updateGlobal('splashOffsetY', preset.splashOffsetY);
};

const resetPriceTagGeometry = () => {
  applyPriceTagFitPreset('normal');
  if (!isActiveTemplateShapeLocked.value) {
    updateGlobal('splashStrokeWidth', 0);
    updateGlobal('splashRoundness', 1);
  }
};

const updateGlobalInt = (prop: string, value: unknown, fallback: number, min: number, max: number, meta?: ZoneUpdateTargetMeta) => {
  updateGlobal(prop, clamp(Math.round(toSafeNumber(value, fallback)), min, max), meta);
};

const updateGlobalFloat = (
  prop: string,
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  precision: number | ZoneUpdateTargetMeta = 1,
  meta?: ZoneUpdateTargetMeta
) => {
  const targetMeta = typeof precision === 'object' ? precision : meta;
  const resolvedPrecision = typeof precision === 'number' ? precision : 1;
  const factor = 10 ** resolvedPrecision;
  const next = clamp(Math.round(toSafeNumber(value, fallback) * factor) / factor, min, max);
  updateGlobal(prop, next, targetMeta);
};

const updateZoneInt = (prop: string, value: unknown, fallback: number, min: number, max: number, meta?: ZoneUpdateTargetMeta) => {
  updateZone(prop, clamp(Math.round(toSafeNumber(value, fallback)), min, max), meta);
};

const updateZoneFloat = (
  prop: string,
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  precision: number | ZoneUpdateTargetMeta = 1,
  meta?: ZoneUpdateTargetMeta
) => {
  const targetMeta = typeof precision === 'object' ? precision : meta;
  const resolvedPrecision = typeof precision === 'number' ? precision : 1;
  const factor = 10 ** resolvedPrecision;
  const next = clamp(Math.round(toSafeNumber(value, fallback) * factor) / factor, min, max);
  updateZone(prop, next, targetMeta);
};

const FONT_DATALIST_ID = 'product-zone-fonts';

const toWeightNumber = (value: unknown): number | null => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : null;
};

const prodNameWeightOptions = computed(() =>
  getFontWeightOptionsForFamily(props.globalStyles?.prodNameFont, {
    ensureWeight: toWeightNumber(props.globalStyles?.prodNameWeight)
  })
);

const priceWeightOptions = computed(() =>
  getFontWeightOptionsForFamily(props.globalStyles?.priceFont, {
    ensureWeight: toWeightNumber(props.globalStyles?.priceFontWeight)
  })
);

const priceFontSupportsItalic = computed(() => fontSupportsItalic(props.globalStyles?.priceFont));

const handleProdNameFontChange = (event: Event) => {
  const nextFont = String((event.target as HTMLSelectElement).value || '').trim();
  updateGlobal('prodNameFont', nextFont);

  const currentWeight = toWeightNumber(props.globalStyles?.prodNameWeight) ?? 700;
  const nextWeight = normalizeFontWeightForFamily(nextFont, currentWeight);
  if (nextWeight !== currentWeight) updateGlobal('prodNameWeight', nextWeight);
};

const handlePriceFontChange = (event: Event) => {
  const nextFont = String((event.target as HTMLSelectElement).value || '').trim();
  updateGlobal('priceFont', nextFont);

  const currentWeight = toWeightNumber(props.globalStyles?.priceFontWeight);
  if (currentWeight !== null) {
    const nextWeight = normalizeFontWeightForFamily(nextFont, currentWeight);
    if (nextWeight !== currentWeight) updateGlobal('priceFontWeight', nextWeight);
  }

  if (!fontSupportsItalic(nextFont) && props.globalStyles?.priceFontStyle === 'italic') {
    updateGlobal('priceFontStyle', 'normal');
  }
};

// ── Debounce helper ──────────────────────────────────────────────────────────
// Used for numeric text inputs so rapid keystrokes don't flood the reactive
// update pipeline. Range sliders keep using the direct (non-debounced) versions
// because they need immediate visual feedback while dragging.
function _debounceWithZoneTarget<A extends unknown[]>(
  fn: (...args: [...A, ZoneUpdateTargetMeta]) => void,
  ms: number
): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    const meta = getZoneUpdateTargetMeta();
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args, meta);
    }, ms);
  };
}
const _dUpdateZoneInt = _debounceWithZoneTarget(updateZoneInt, 180);
const _dUpdateZoneFloat = _debounceWithZoneTarget(updateZoneFloat, 180);
const _dUpdateGlobalInt = _debounceWithZoneTarget(updateGlobalInt, 180);
const _dUpdateGlobalFloat = _debounceWithZoneTarget(updateGlobalFloat, 180);
const _dUpdateZoneName = _debounceWithZoneTarget((v: string, meta: ZoneUpdateTargetMeta) => updateZone('name', v, meta), 300);

const toggleSection = (section: keyof typeof expandedSections.value) => {
  expandedSections.value[section] = !expandedSections.value[section];
};

const focusZoneSettingsFromCanvas = () => {
  expandedSections.value.content = true;
  expandedSections.value.structure = true;
};

const handleDiagnosticAction = (actionId?: ProductZoneDiagnostic['actionId']) => {
  if (!actionId) return;
  if (actionId === 'open-review') {
    emit('open-review');
    return;
  }
  if (actionId === 'open-layout') {
    expandedSections.value.structure = true;
    return;
  }
  if (actionId === 'open-template') {
    expandedSections.value.priceTag = true;
  }
};

onMounted(() => {
  if (typeof window === 'undefined') return;
  window.addEventListener('editor:focus-product-zone-settings', focusZoneSettingsFromCanvas);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  window.removeEventListener('editor:focus-product-zone-settings', focusZoneSettingsFromCanvas);
});
</script>

<template>
  <div class="inspector-shell">
    <ProductPaletteControls :styles="globalStyles || {}" :authoring="paletteProject.isTemplate" @change="updateGlobal(paletteProject.isTemplate ? 'templateProductPalette' : 'productPalette', $event)" @reset="updateGlobal('productPalette', {})" />
    <section class="inspector-card overview-card">
      <div class="overview-card__copy">
        <div class="overview-card__eyebrow">
          <span class="inspector-eyebrow">Inspector da zona</span>
          <span class="status-chip" :class="zone.isLocked ? 'status-chip--warn' : 'status-chip--ok'">
            {{ zoneLockLabel }}
          </span>
        </div>
        <div>
          <h3 class="overview-card__title">{{ zone.name || 'Zona de produtos' }}</h3>
          <p v-if="zone.frameLabel" class="overview-card__description">
            Vinculada a {{ zone.frameLabel }}
          </p>
        </div>
        <div class="overview-card__chips">
          <span class="metric-chip metric-chip--accent">{{ currentPresetName }}</span>
          <span class="metric-chip">{{ zone.productCount ?? 0 }} itens</span>
          <span class="metric-chip">{{ zoneColumnsLabel }}</span>
          <span class="metric-chip">{{ zoneRowsLabel }}</span>
        </div>
      </div>

      <div class="overview-card__preview">
        <div class="overview-card__preview-head">
          <span class="inspector-eyebrow inspector-eyebrow--muted">Mapa rápido</span>
          <span class="text-[11px] text-zinc-400">Estrutura ativa</span>
        </div>
        <div class="layout-preview layout-preview--large" :style="activePreviewStyle">
          <span
            v-for="cell in activePreviewCells"
            :key="cell.id"
            :class="[
              'layout-preview__cell',
              cell.tone === 'highlight' ? 'layout-preview__cell--highlight' : 'layout-preview__cell--base'
            ]"
            :style="getPreviewCellStyle(cell)"
          />
        </div>
        <dl class="overview-metrics">
          <div v-for="metric in overviewMetrics" :key="metric.label" class="overview-metrics__item">
            <dt>{{ metric.label }}</dt>
            <dd :title="metric.value">{{ metric.value }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <div class="section-stack">
      <section v-if="!compact" class="inspector-card" :class="{ 'inspector-card--active': expandedSections.content }">
        <button type="button" class="section-toggle" @click="toggleSection('content')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--violet">
              <Settings2 class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Conteúdo</span>
                <span class="section-summary">{{ zoneStatusLabel }}</span>
              </div>
              <p class="section-description">Nome, papel e origem dos produtos.</p>
            </div>
          </div>
          <component :is="expandedSections.content ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.content" class="section-panel">
          <div class="field-stack">
            <div class="field-stack__head">
              <label for="product-zone-name" class="field-label">Nome da zona</label>
              <p class="field-hint">Identificação nas layers do editor.</p>
            </div>
            <input
              id="product-zone-name"
              type="text"
              class="field-select"
              :value="zone.name ?? 'Zona de Produtos'"
              @input="_dUpdateZoneName(($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Função da zona</label>
              <p class="field-hint">Define o comportamento visual da zona.</p>
            </div>
            <div class="segmented-grid segmented-grid--2">
              <button
                v-for="option in zoneRoleOptions"
                :key="option.value"
                type="button"
                class="segmented-option"
                :class="{ 'segmented-option--active': (zone.role ?? 'grid') === option.value }"
                @click="updateZone('role', option.value)"
              >
                <strong>{{ option.label }}</strong>
                <span>{{ option.hint }}</span>
              </button>
            </div>
          </div>

          <div class="content-metrics-grid">
            <div class="content-metric">
              <span class="content-metric__label">Status</span>
              <strong>{{ zoneStatusLabel }}</strong>
            </div>
            <div class="content-metric">
              <span class="content-metric__label">Origem</span>
              <strong>{{ zoneSourceLabel }}</strong>
            </div>
            <div class="content-metric">
              <span class="content-metric__label">Produtos</span>
              <strong>{{ zone.productCount ?? 0 }}</strong>
            </div>
            <div class="content-metric">
              <span class="content-metric__label">Frame pai</span>
              <strong>{{ zone.frameLabel || 'Sem frame' }}</strong>
            </div>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Política de overflow</label>
              <p class="field-hint">O que fazer quando os produtos não cabem.</p>
            </div>
            <div class="segmented-grid segmented-grid--2">
              <button
                v-for="option in overflowPolicyOptions"
                :key="option.value"
                type="button"
                class="segmented-option segmented-option--compact"
                :class="{ 'segmented-option--active': (zone.overflowPolicy ?? 'warn') === option.value }"
                @click="updateZone('overflowPolicy', option.value)"
              >
                <strong>{{ option.label }}</strong>
                <span>{{ option.hint }}</span>
              </button>
            </div>
          </div>

          <div class="template-card">
            <div class="template-card__head">
              <div>
                <label class="field-label">Produtos da zona</label>
                <p class="field-hint">Importe uma lista nova ou revise os produtos atuais.</p>
              </div>
              <span class="template-card__status">{{ activeTemplateName }}</span>
            </div>
            <div class="action-row">
              <button type="button" class="primary-button" @click="emit('open-review')">
                <PackagePlus class="h-4 w-4" />
                Importar produtos
              </button>
              <button
                type="button"
                class="secondary-button"
                :disabled="(zone.productCount ?? 0) <= 0"
                @click="emit('auto-layout')"
              >
                <Sparkles class="h-4 w-4" />
                Auto layout
              </button>
            </div>
          </div>

        </div>
      </section>

      <section class="inspector-card" :class="{ 'inspector-card--active': expandedSections.structure }">
        <button type="button" class="section-toggle" @click="toggleSection('structure')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--cyan">
              <Columns3 class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Estrutura por quantidade</span>
                <span class="section-summary">{{ structureSummaryLabel }}</span>
              </div>
              <p class="section-description">Uma receita independente para cada total de produtos.</p>
            </div>
          </div>
          <component :is="expandedSections.structure ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.structure" class="section-panel">
          <div class="automatic-structure-card">
            <div class="automatic-structure-card__icon">
              <Columns3 class="h-4 w-4" />
            </div>
            <div class="automatic-structure-card__copy">
              <strong>Receita aplicada automaticamente</strong>
              <p>
                O editor usa a estrutura de {{ zone.productCount || 0 }} produto{{ (zone.productCount || 0) === 1 ? '' : 's' }}
                assim que a lista é importada.
              </p>
              <span class="automatic-structure-card__recipe">
                {{ structureSummaryLabel }} · {{ currentStructure.columns || 'auto' }} colunas · {{ currentStructure.rows || 'auto' }} linhas
              </span>
            </div>
            <div v-if="currentStructureVariants.length > 1" class="automatic-structure-card__variant">
              <label for="product-zone-structure-variant" class="field-label">Variação para esta zona</label>
              <select
                id="product-zone-structure-variant"
                class="automatic-structure-card__variant-select"
                :value="currentStructureVariantId"
                @change="selectCurrentStructureVariant"
              >
                <option v-for="variant in currentStructureVariants" :key="variant.id" :value="variant.id">
                  {{ variant.name }}
                </option>
              </select>
              <small v-if="globalStructuresLoaded">
                A biblioteca vem de Estruturas por quantidade. Esta escolha vale somente para a zona selecionada.
              </small>
              <small v-else>
                Carregando a biblioteca global de estruturas. A configuração do projeto é apenas um fallback temporário.
              </small>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink to="/zone-structures" class="automatic-structure-card__link">
                Estruturas por quantidade
              </NuxtLink>
              <NuxtLink to="/card-configurations" class="automatic-structure-card__link">
                Elementos do card
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <section v-if="!compact" class="inspector-card" :class="{ 'inspector-card--active': expandedSections.cardStyle }">
        <button type="button" class="section-toggle" @click="toggleSection('cardStyle')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--neutral">
              <CreditCard class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Visual do Card</span>
                <span class="section-summary">Aparência da oferta</span>
              </div>
              <p class="section-description">Cores, cantos e borda dos cards.</p>
            </div>
          </div>
          <component :is="expandedSections.cardStyle ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.cardStyle" class="section-panel">
          <div class="field-stack">
            <label class="flex items-start gap-2 text-sm">
              <input type="checkbox" :checked="globalStyles?.cardColorMode === 'auto'" @change="updateGlobal('cardColorMode', ($event.target as HTMLInputElement).checked ? 'auto' : 'manual')" />
              <span>Usar paleta do encarte nos destaques<small class="block text-xs text-zinc-400">Cores individuais são mantidas. A paleta do modelo é usada quando disponível.</small></span>
            </label>
            <div class="color-field">
              <div class="color-field__copy">
                <label class="field-label">{{ globalStyles?.cardColorMode === 'auto' ? 'Cor dos destaques' : 'Cor de fundo' }}</label>
                <p class="field-hint">Cor de fundo dos cards.</p>
              </div>
              <div class="color-field__controls">
                <ColorPicker
                  :show="showCardColorPicker"
                  :model-value="(globalStyles?.cardColorMode === 'auto' ? globalStyles?.highlightCardColor : globalStyles?.cardColor) ?? '#ffffff'"
                  :trigger-element="cardColorPickerRef"
                  @update:show="showCardColorPicker = $event"
                  @update:model-value="(val) => updateGlobal(globalStyles?.cardColorMode === 'auto' ? 'highlightCardColor' : 'cardColor', val)"
                />
                <button
                  ref="cardColorPickerRef"
                  type="button"
                  class="color-trigger"
                  :style="{ backgroundColor: (globalStyles?.cardColorMode === 'auto' ? globalStyles?.highlightCardColor : globalStyles?.cardColor) ?? '#ffffff' }"
                  @click="showCardColorPicker = true"
                />
                <input
                  type="text"
                  class="hex-input"
                  :value="((globalStyles?.cardColorMode === 'auto' ? globalStyles?.highlightCardColor : globalStyles?.cardColor) ?? '#ffffff').replace('#', '').toUpperCase()"
                  @blur="updateGlobal(globalStyles?.cardColorMode === 'auto' ? 'highlightCardColor' : 'cardColor', sanitizeHexColor(($event.target as HTMLInputElement).value, (globalStyles?.cardColorMode === 'auto' ? globalStyles?.highlightCardColor : globalStyles?.cardColor) ?? '#ffffff'))"
                />
              </div>
            </div>

            <div class="color-field">
              <div class="color-field__copy">
                <label class="field-label">Cor de destaque</label>
                <p class="field-hint">Ênfase visual do card e etiqueta.</p>
              </div>
              <div class="color-field__controls">
                <ColorPicker
                  :show="showAccentColorPicker"
                  :model-value="globalStyles?.accentColor ?? '#dc2626'"
                  :trigger-element="accentColorPickerRef"
                  @update:show="showAccentColorPicker = $event"
                  @update:model-value="(val) => updateGlobal('accentColor', val)"
                />
                <button
                  ref="accentColorPickerRef"
                  type="button"
                  class="color-trigger"
                  :style="{ backgroundColor: globalStyles?.accentColor ?? '#dc2626' }"
                  @click="showAccentColorPicker = true"
                />
                <input
                  type="text"
                  class="hex-input"
                  :value="(globalStyles?.accentColor ?? '#dc2626').replace('#', '').toUpperCase()"
                  @blur="updateGlobal('accentColor', sanitizeHexColor(($event.target as HTMLInputElement).value, globalStyles?.accentColor ?? '#dc2626'))"
                />
              </div>
            </div>

            <label class="switch-card">
              <div>
                <span class="field-label">Fundo transparente</span>
                <p class="field-hint">Remove o fundo atrás da imagem do produto.</p>
              </div>
              <span class="switch" :class="{ 'switch--checked': globalStyles?.isProdBgTransparent ?? false }">
                <input
                  type="checkbox"
                  class="sr-only"
                  :checked="globalStyles?.isProdBgTransparent ?? false"
                  @change="updateGlobal('isProdBgTransparent', ($event.target as HTMLInputElement).checked)"
                />
                <span class="switch__track"></span>
                <span class="switch__thumb"></span>
              </span>
            </label>

            <div class="control-card">
              <div class="control-card__head">
                <div>
                  <label class="field-label">Cantos arredondados</label>
                  <p class="field-hint">Arredondamento dos cantos do card.</p>
                </div>
                <div class="value-editor">
                  <input
                    type="number"
                    min="0"
                    max="40"
                    step="1"
                    inputmode="numeric"
                    class="value-input"
                    :value="Math.round(globalStyles?.cardBorderRadius ?? 8)"
                    aria-label="Raio dos cantos"
                    @input="_dUpdateGlobalInt('cardBorderRadius', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.cardBorderRadius ?? 8, 0, 40)"
                  />
                  <span class="value-suffix">px</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                :value="globalStyles?.cardBorderRadius ?? 8"
                class="slider text-zinc-300"
                @input="updateGlobal('cardBorderRadius', Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div class="control-card">
              <div class="control-card__head">
                <div>
                  <label class="field-label">Borda</label>
                  <p class="field-hint">Contorno ao redor do card.</p>
                </div>
                <div class="value-editor">
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="1"
                    inputmode="numeric"
                    class="value-input"
                    :value="Math.round(globalStyles?.cardBorderWidth ?? 0)"
                    aria-label="Espessura da borda"
                    @input="_dUpdateGlobalInt('cardBorderWidth', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.cardBorderWidth ?? 0, 0, 12)"
                  />
                  <span class="value-suffix">px</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                :value="globalStyles?.cardBorderWidth ?? 0"
                class="slider text-zinc-300"
                @input="updateGlobal('cardBorderWidth', Number(($event.target as HTMLInputElement).value))"
              />
            </div>

            <div v-if="(globalStyles?.cardBorderWidth ?? 0) > 0" class="color-field">
              <div class="color-field__copy">
                <label class="field-label">Cor da borda</label>
                <p class="field-hint">Cor do contorno do card.</p>
              </div>
              <div class="color-field__controls">
                <ColorPicker
                  :show="showCardBorderColorPicker"
                  :model-value="globalStyles?.cardBorderColor ?? '#000000'"
                  :trigger-element="cardBorderColorPickerRef"
                  @update:show="showCardBorderColorPicker = $event"
                  @update:model-value="(val) => updateGlobal('cardBorderColor', val)"
                />
                <button
                  ref="cardBorderColorPickerRef"
                  type="button"
                  class="color-trigger"
                  :style="{ backgroundColor: globalStyles?.cardBorderColor ?? '#000000' }"
                  @click="showCardBorderColorPicker = true"
                />
                <input
                  type="text"
                  class="hex-input"
                  :value="(globalStyles?.cardBorderColor ?? '#000000').replace('#', '').toUpperCase()"
                  @blur="updateGlobal('cardBorderColor', sanitizeHexColor(($event.target as HTMLInputElement).value, globalStyles?.cardBorderColor ?? '#000000'))"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="!compact" class="inspector-card" :class="{ 'inspector-card--active': expandedSections.typography }">
        <button type="button" class="section-toggle" @click="toggleSection('typography')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--green">
              <Type class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Texto do Produto</span>
                <span class="section-summary">Tipografia e alinhamento</span>
              </div>
              <p class="section-description">Fonte, cor e tamanho do nome.</p>
            </div>
          </div>
          <component :is="expandedSections.typography ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.typography" class="section-panel">
          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Fonte</label>
              <p class="field-hint">Fonte usada no nome do produto.</p>
            </div>
            <select :value="globalStyles?.prodNameFont ?? 'Inter'" class="field-select" @change="handleProdNameFontChange">
              <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
            </select>
          </div>

          <div class="color-field">
            <div class="color-field__copy">
              <label class="field-label">Cor do nome</label>
            </div>
            <div class="color-field__controls">
              <ColorPicker
                :show="showProdNameColorPicker"
                :model-value="globalStyles?.prodNameColor ?? '#000000'"
                :trigger-element="prodNameColorPickerRef"
                @update:show="showProdNameColorPicker = $event"
                @update:model-value="(val) => updateGlobal('prodNameColor', val)"
              />
              <button
                ref="prodNameColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.prodNameColor ?? '#000000' }"
                @click="showProdNameColorPicker = true"
              />
              <input
                type="text"
                class="hex-input"
                :value="(globalStyles?.prodNameColor ?? '#000000').replace('#', '').toUpperCase()"
                @blur="updateGlobal('prodNameColor', sanitizeHexColor(($event.target as HTMLInputElement).value, globalStyles?.prodNameColor ?? '#000000'))"
              />
            </div>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Espessura</label>
            </div>
            <select
              :value="globalStyles?.prodNameWeight ?? 700"
              class="field-select"
              @change="updateGlobal('prodNameWeight', Number(($event.target as HTMLSelectElement).value))"
            >
              <option v-for="weight in prodNameWeightOptions" :key="weight.value" :value="weight.value">
                {{ weight.label }}
              </option>
            </select>
          </div>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Tamanho</label>
                <p class="field-hint">Tamanho relativo do nome.</p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="60"
                  max="170"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round((globalStyles?.prodNameScale ?? 1) * 100)"
                  aria-label="Escala do texto"
                  @input="_dUpdateGlobalFloat('prodNameScale', (($event.target as HTMLInputElement).valueAsNumber || 0) / 100, globalStyles?.prodNameScale ?? 1, 0.6, 1.7, 2)"
                />
                <span class="value-suffix">%</span>
              </div>
            </div>
            <input
              type="range"
              min="60"
              max="170"
              :value="Math.round((globalStyles?.prodNameScale ?? 1) * 100)"
              class="slider text-emerald-400"
              @input="updateGlobal('prodNameScale', Number(($event.target as HTMLInputElement).value) / 100)"
            />
          </div>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Entrelinhas</label>
                <p class="field-hint">Espaçamento entre linhas do texto.</p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="0.8"
                  max="1.8"
                  step="0.01"
                  inputmode="decimal"
                  class="value-input"
                  :value="(globalStyles?.prodNameLineHeight ?? 1.05).toFixed(2)"
                  aria-label="Altura de linha"
                  @input="_dUpdateGlobalFloat('prodNameLineHeight', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.prodNameLineHeight ?? 1.05, 0.8, 1.8, 2)"
                />
                <span class="value-suffix">lh</span>
              </div>
            </div>
            <input
              type="range"
              min="80"
              max="180"
              :value="Math.round((globalStyles?.prodNameLineHeight ?? 1.05) * 100)"
              class="slider text-emerald-400"
              @input="updateGlobal('prodNameLineHeight', Number(($event.target as HTMLInputElement).value) / 100)"
            />
          </div>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Posição vertical</label>
                <p class="field-hint">Ajusta a posição vertical do nome no card.</p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="-160"
                  max="160"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round(globalStyles?.prodNameOffsetY ?? 0)"
                  aria-label="Deslocamento Y do nome do produto"
                  @input="_dUpdateGlobalInt('prodNameOffsetY', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.prodNameOffsetY ?? 0, -160, 160)"
                />
                <span class="value-suffix">px</span>
              </div>
            </div>
            <input
              type="range"
              min="-160"
              max="160"
              :value="globalStyles?.prodNameOffsetY ?? 0"
              class="slider text-emerald-400"
              @input="updateGlobal('prodNameOffsetY', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Caixa do texto</label>
            </div>
            <select
              :value="globalStyles?.prodNameTransform ?? 'upper'"
              class="field-select"
              @change="updateGlobal('prodNameTransform', ($event.target as HTMLSelectElement).value)"
            >
              <option value="upper">Maiúsculas</option>
              <option value="lower">Minúsculas</option>
              <option value="none">Normal</option>
            </select>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Alinhamento do texto</label>
            </div>
            <div class="segmented-grid segmented-grid--3">
              <button
                type="button"
                class="segmented-option segmented-option--compact"
                :class="{ 'segmented-option--active': globalStyles?.prodNameAlign === 'left' }"
                @click="updateGlobal('prodNameAlign', 'left')"
              >
                <strong>Esquerda</strong>
              </button>
              <button
                type="button"
                class="segmented-option segmented-option--compact"
                :class="{ 'segmented-option--active': (globalStyles?.prodNameAlign ?? 'center') === 'center' }"
                @click="updateGlobal('prodNameAlign', 'center')"
              >
                <strong>Centro</strong>
              </button>
              <button
                type="button"
                class="segmented-option segmented-option--compact"
                :class="{ 'segmented-option--active': globalStyles?.prodNameAlign === 'right' }"
                @click="updateGlobal('prodNameAlign', 'right')"
              >
                <strong>Direita</strong>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="!compact" class="inspector-card" :class="{ 'inspector-card--active': expandedSections.priceTag }">
        <button type="button" class="section-toggle" @click="toggleSection('priceTag')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--magenta">
              <Tag class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Etiqueta de preço</span>
                <span class="section-summary">{{ styleSummaryLabel }}</span>
              </div>
              <p class="section-description">Template, cores e escala do preço.</p>
            </div>
          </div>
          <component :is="expandedSections.priceTag ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.priceTag" class="section-panel">
          <!-- Sub-área 1: Modelo -->
          <div class="section-divider">
            <span class="section-divider__label">Modelo</span>
          </div>

          <div class="template-card">
            <div class="template-card__head">
              <div>
                <label class="field-label">Modelo da zona</label>
                <p class="field-hint">Etiqueta compartilhada por todos os cards.</p>
              </div>
              <button type="button" class="ghost-button" @click="emit('manage-label-templates')">
                Biblioteca global
              </button>
            </div>

            <select
              :value="globalStyles?.splashTemplateId ?? ''"
              class="field-select"
              @change="updateGlobal('splashTemplateId', (($event.target as HTMLSelectElement).value || undefined))"
            >
              <option value="">Padrão vetorial da zona</option>
              <option v-for="tpl in (labelTemplates ?? [])" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
            </select>

            <div class="template-card__footer">
              <span class="template-card__status">{{ activeTemplateName }}</span>
              <button type="button" class="secondary-button" @click="emit('apply-template-to-zone')">
                Sincronizar cards
              </button>
            </div>
          </div>

          <div class="template-notice">
            <div>
              <strong>{{ globalStyles?.splashTemplateId ? 'Modelo ativo' : 'Ajuste padrão' }}</strong>
              <span>
                {{ globalStyles?.splashTemplateId
                  ? 'Os controles abaixo ajustam a zona sem alterar o modelo salvo.'
                  : 'Use os atalhos para voltar a uma etiqueta proporcional.' }}
              </span>
            </div>
            <span v-if="isActiveTemplateShapeLocked" class="lock-chip">Forma do modelo</span>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Ajuste rápido</label>
              <p class="field-hint">Corrige proporção da etiqueta mantendo o modelo selecionado.</p>
            </div>
            <div class="segmented-grid segmented-grid--3">
              <button
                v-for="preset in priceTagFitPresets"
                :key="preset.id"
                type="button"
                class="segmented-option segmented-option--compact"
                @click="applyPriceTagFitPreset(preset.id)"
              >
                <strong>{{ preset.label }}</strong>
              </button>
            </div>
            <button type="button" class="ghost-button ghost-button--full" @click="resetPriceTagGeometry">
              Restaurar etiqueta da zona
            </button>
          </div>

          <template v-if="!globalStyles?.splashTemplateId">
            <div class="field-stack">
              <div class="field-stack__head">
                <label class="field-label">Estilo base</label>
                <p class="field-hint">Estilo padrão quando não há template.</p>
              </div>
              <select
                :value="globalStyles?.splashStyle ?? 'classic'"
                class="field-select"
                @change="updateGlobal('splashStyle', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="style in SPLASH_STYLES" :key="style.id" :value="style.id">
                  {{ style.name }}
                </option>
              </select>
            </div>
          </template>

          <!-- Sub-área 2: Cores da Etiqueta -->
          <div class="section-divider">
            <span class="section-divider__label">Cores da Etiqueta</span>
          </div>

          <div class="color-row">
            <div class="color-row-item">
              <ColorPicker
                :show="showSplashFillColorPicker"
                :model-value="globalStyles?.splashFill ?? '#000000'"
                :trigger-element="splashFillColorPickerRef"
                @update:show="showSplashFillColorPicker = $event"
                @update:model-value="(val) => updateGlobal('splashFill', val)"
              />
              <button
                ref="splashFillColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.splashFill ?? '#000000' }"
                @click="showSplashFillColorPicker = true"
              />
              <span class="field-label">Preenchimento</span>
            </div>

            <div class="color-row-item">
              <ColorPicker
                :show="showSplashColorPicker"
                :model-value="globalStyles?.splashColor ?? '#dc2626'"
                :trigger-element="splashColorPickerRef"
                @update:show="showSplashColorPicker = $event"
                @update:model-value="(val) => updateGlobal('splashColor', val)"
              />
              <button
                ref="splashColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.splashColor ?? '#dc2626' }"
                @click="showSplashColorPicker = true"
              />
              <span class="field-label">Destaque</span>
            </div>

            <div class="color-row-item">
              <ColorPicker
                :show="showSplashTextColorPicker"
                :model-value="globalStyles?.splashTextColor ?? '#ffffff'"
                :trigger-element="splashTextColorPickerRef"
                @update:show="showSplashTextColorPicker = $event"
                @update:model-value="(val) => updateGlobal('splashTextColor', val)"
              />
              <button
                ref="splashTextColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.splashTextColor ?? '#ffffff' }"
                @click="showSplashTextColorPicker = true"
              />
              <span class="field-label">Texto</span>
            </div>
          </div>

          <!-- Sub-área 3: Preço -->
          <div class="section-divider">
            <span class="section-divider__label">Preço</span>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Fonte</label>
            </div>
            <select :value="globalStyles?.priceFont ?? 'Arial'" class="field-select" @change="handlePriceFontChange">
              <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font">{{ font }}</option>
            </select>
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Espessura</label>
            </div>
            <select
              :value="globalStyles?.priceFontWeight ?? ''"
              class="field-select"
              @change="updateGlobal('priceFontWeight', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
            >
              <option value="">Manter automático</option>
              <option v-for="weight in priceWeightOptions" :key="weight.value" :value="weight.value">
                {{ weight.label }}
              </option>
            </select>
          </div>

          <label class="switch-card">
            <div>
              <span class="field-label">Itálico</span>
              <p class="field-hint">
                {{ priceFontSupportsItalic ? 'Inclinar o texto do preço.' : 'Indisponível nesta fonte.' }}
              </p>
            </div>
            <span class="switch" :class="{ 'switch--checked': (globalStyles?.priceFontStyle ?? 'normal') === 'italic' }">
              <input
                type="checkbox"
                class="sr-only"
                :checked="(globalStyles?.priceFontStyle ?? 'normal') === 'italic'"
                :disabled="!priceFontSupportsItalic"
                @change="updateGlobal('priceFontStyle', ($event.target as HTMLInputElement).checked ? 'italic' : 'normal')"
              />
              <span class="switch__track"></span>
              <span class="switch__thumb"></span>
            </span>
          </label>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Tamanho do preço</label>
                <p class="field-hint">Tamanho base da tipografia do preço.</p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="24"
                  max="160"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round(globalStyles?.priceFontSize ?? 60)"
                  aria-label="Tamanho do preço"
                  @input="_dUpdateGlobalInt('priceFontSize', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.priceFontSize ?? 60, 24, 160)"
                />
                <span class="value-suffix">px</span>
              </div>
            </div>
            <input
              type="range"
              min="24"
              max="160"
              :value="globalStyles?.priceFontSize ?? 60"
              class="slider text-fuchsia-400"
              @input="updateGlobal('priceFontSize', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <div class="field-stack">
            <div class="field-stack__head">
              <label class="field-label">Símbolo (R$)</label>
              <p class="field-hint">Texto exibido como símbolo monetário.</p>
            </div>
            <div class="value-editor value-editor--full">
              <input
                type="text"
                maxlength="4"
                class="value-input"
                :value="globalStyles?.currencySymbol ?? 'R$'"
                aria-label="Símbolo monetário"
                @blur="updateGlobal('currencySymbol', (($event.target as HTMLInputElement).value || 'R$').trim() || 'R$')"
              />
            </div>
          </div>

          <div v-if="!isActiveTemplateAtacarejo" class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Escala geral</label>
                <p class="field-hint">Escala dos textos internos da etiqueta.</p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="60"
                  max="220"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round((globalStyles?.splashTextScale ?? 1) * 100)"
                  aria-label="Escala geral dos textos da etiqueta"
                  @input="_dUpdateGlobalFloat('splashTextScale', (($event.target as HTMLInputElement).valueAsNumber || 0) / 100, globalStyles?.splashTextScale ?? 1, 0.6, 2.2, 2)"
                />
                <span class="value-suffix">%</span>
              </div>
            </div>
            <input
              type="range"
              min="60"
              max="220"
              :value="Math.round((globalStyles?.splashTextScale ?? 1) * 100)"
              class="slider text-fuchsia-400"
              @input="updateGlobal('splashTextScale', Number(($event.target as HTMLInputElement).value) / 100)"
            />
          </div>

          <div v-else class="template-notice template-notice--muted">
            <div>
              <strong>Escala dos textos travada</strong>
              <span>Este modelo atacarejo mantém proporção própria entre varejo e atacado.</span>
            </div>
          </div>

          <!-- Sub-área 4: Formato da Etiqueta -->
          <div class="section-divider">
            <span class="section-divider__label">Formato da Etiqueta</span>
          </div>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Borda da etiqueta</label>
                <p class="field-hint">
                  {{ isActiveTemplateShapeLocked ? 'Controlada pelo modelo selecionado.' : 'Intensidade do contorno da etiqueta.' }}
                </p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round(globalStyles?.splashStrokeWidth ?? 0)"
                  aria-label="Borda da etiqueta"
                  :disabled="isActiveTemplateShapeLocked"
                  @input="_dUpdateGlobalInt('splashStrokeWidth', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.splashStrokeWidth ?? 0, 0, 24)"
                />
                <span class="value-suffix">px</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              :value="globalStyles?.splashStrokeWidth ?? 0"
              class="slider text-fuchsia-400"
              :disabled="isActiveTemplateShapeLocked"
              @input="updateGlobal('splashStrokeWidth', Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <div class="control-card">
            <div class="control-card__head">
              <div>
                <label class="field-label">Cantos</label>
                <p class="field-hint">
                  {{ isActiveTemplateShapeLocked ? 'Controlados pelo modelo selecionado.' : 'Quanto a etiqueta fica reta ou arredondada.' }}
                </p>
              </div>
              <div class="value-editor">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  inputmode="numeric"
                  class="value-input"
                  :value="Math.round((globalStyles?.splashRoundness ?? 1) * 100)"
                  aria-label="Cantos da etiqueta"
                  :disabled="isActiveTemplateShapeLocked"
                  @input="_dUpdateGlobalFloat('splashRoundness', (($event.target as HTMLInputElement).valueAsNumber || 0) / 100, globalStyles?.splashRoundness ?? 1, 0, 1, 2)"
                />
                <span class="value-suffix">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round((globalStyles?.splashRoundness ?? 1) * 100)"
              class="slider text-fuchsia-400"
              :disabled="isActiveTemplateShapeLocked"
              @input="updateGlobal('splashRoundness', Number(($event.target as HTMLInputElement).value) / 100)"
            />
          </div>

          <!-- Escala e posição lado a lado -->
          <div class="side-by-side-row">
            <div class="control-card">
              <div class="control-card__head">
                <div>
                  <label class="field-label">Escala da etiqueta</label>
                  <p class="field-hint">Tamanho da etiqueta inteira.</p>
                </div>
                <div class="value-editor">
                  <input
                    type="number"
                    min="60"
                    max="300"
                    step="1"
                    inputmode="numeric"
                    class="value-input"
                    :value="Math.round(clamp(globalStyles?.splashScale ?? 1, PRICE_TAG_SCALE_MIN, PRICE_TAG_SCALE_MAX) * 100)"
                    aria-label="Escala da etiqueta"
                    @input="_dUpdateGlobalFloat('splashScale', (($event.target as HTMLInputElement).valueAsNumber || 0) / 100, globalStyles?.splashScale ?? 1, PRICE_TAG_SCALE_MIN, PRICE_TAG_SCALE_MAX, 2)"
                  />
                  <span class="value-suffix">%</span>
                </div>
              </div>
              <input
                type="range"
                min="60"
                max="300"
                :value="Math.round(clamp(globalStyles?.splashScale ?? 1, PRICE_TAG_SCALE_MIN, PRICE_TAG_SCALE_MAX) * 100)"
                class="slider text-fuchsia-400"
                @input="updateGlobal('splashScale', Number(($event.target as HTMLInputElement).value) / 100)"
              />
            </div>

            <div class="control-card">
              <div class="control-card__head">
                <div>
                  <label class="field-label">Posição</label>
                </div>
                <div class="value-editor">
                  <input
                    type="number"
                    min="-120"
                    max="120"
                    step="1"
                    inputmode="numeric"
                    class="value-input"
                    :value="Math.round(globalStyles?.splashOffsetY ?? 0)"
                    aria-label="Posição vertical da etiqueta"
                    @input="_dUpdateGlobalInt('splashOffsetY', ($event.target as HTMLInputElement).valueAsNumber, globalStyles?.splashOffsetY ?? 0, -120, 120)"
                  />
                  <span class="value-suffix">px</span>
                </div>
              </div>
              <input
                type="range"
                min="-120"
                max="120"
                :value="globalStyles?.splashOffsetY ?? 0"
                class="slider text-fuchsia-400"
                @input="updateGlobal('splashOffsetY', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <!-- Sub-área 5: Cores do Preço -->
          <div class="section-divider">
            <span class="section-divider__label">Cores do Preço</span>
          </div>

          <div class="color-row">
            <div class="color-row-item">
              <ColorPicker
                :show="showPriceTextColorPicker"
                :model-value="globalStyles?.priceTextColor ?? '#111111'"
                :trigger-element="priceTextColorPickerRef"
                @update:show="showPriceTextColorPicker = $event"
                @update:model-value="(val) => updateGlobal('priceTextColor', val)"
              />
              <button
                ref="priceTextColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.priceTextColor ?? '#111111' }"
                @click="showPriceTextColorPicker = true"
              />
              <span class="field-label">Valor</span>
            </div>

            <div class="color-row-item">
              <ColorPicker
                :show="showPriceCurrencyColorPicker"
                :model-value="globalStyles?.priceCurrencyColor ?? '#111111'"
                :trigger-element="priceCurrencyColorPickerRef"
                @update:show="showPriceCurrencyColorPicker = $event"
                @update:model-value="(val) => updateGlobal('priceCurrencyColor', val)"
              />
              <button
                ref="priceCurrencyColorPickerRef"
                type="button"
                class="color-trigger"
                :style="{ backgroundColor: globalStyles?.priceCurrencyColor ?? '#111111' }"
                @click="showPriceCurrencyColorPicker = true"
              />
              <span class="field-label">R$</span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="!compact" class="inspector-card" :class="{ 'inspector-card--active': expandedSections.diagnostics }">
        <button type="button" class="section-toggle" @click="toggleSection('diagnostics')">
          <div class="section-toggle__lead">
            <div class="section-icon section-icon--rose">
              <Tag class="h-4 w-4" />
            </div>
            <div class="section-toggle__copy">
              <div class="section-toggle__title-row">
                <span class="section-title">Diagnóstico</span>
                <span class="section-summary">{{ diagnosticsSummaryLabel }}</span>
              </div>
              <p class="section-description">Alertas e riscos da zona.</p>
            </div>
          </div>
          <component :is="expandedSections.diagnostics ? ChevronDown : ChevronRight" class="section-chevron" />
        </button>

        <div v-show="expandedSections.diagnostics" class="section-panel">
          <div v-if="diagnostics.length === 0" class="diagnostic-empty">
            <strong>Nenhum alerta relevante.</strong>
            <span>A zona está pronta para seguir com ajuste fino ou exportação.</span>
          </div>

          <div v-else class="diagnostic-list">
            <article v-for="diagnostic in diagnostics" :key="diagnostic.id" class="diagnostic-card">
              <div class="diagnostic-card__head">
                <span class="diagnostic-severity" :class="`diagnostic-severity--${diagnostic.severity}`">
                  {{ diagnostic.severity === 'critical' ? 'Crítico' : diagnostic.severity === 'warning' ? 'Atenção' : 'Info' }}
                </span>
                <strong>{{ diagnostic.title }}</strong>
              </div>
              <p class="diagnostic-card__message">{{ diagnostic.message }}</p>
              <div v-if="diagnostic.actionLabel" class="action-row">
                <button
                  type="button"
                  class="ghost-button"
                  @click="handleDiagnosticAction(diagnostic.actionId)"
                >
                  {{ diagnostic.actionLabel }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>

    <div v-if="!compact" class="sticky-dock">
      <button
        type="button"
        class="dock-button dock-button--lock"
        :class="{ 'dock-button--lock-active': zone.isLocked }"
        @click="updateZone('isLocked', !zone.isLocked)"
      >
        <div class="dock-button__icon">
          <component :is="zone.isLocked ? Lock : Unlock" class="h-4 w-4" />
        </div>
        <span>{{ zoneLockLabel }}</span>
      </button>

      <button type="button" class="dock-button dock-button--primary" @click="emit('recalculate-layout')">
        <Settings2 class="h-4 w-4" />
        <span>Recalcular grade</span>
      </button>
    </div>

    <datalist :id="FONT_DATALIST_ID">
      <option v-for="font in AVAILABLE_FONT_FAMILIES" :key="font" :value="font" />
    </datalist>
  </div>
</template>

<style scoped>
.inspector-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  padding-bottom: 20px;
  color: #f4f4f5;
}

.section-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inspector-card {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(39, 39, 42, 0.72), rgba(15, 15, 18, 0.92));
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
}

.inspector-card--active {
  border-color: rgba(255, 255, 255, 0.14);
}

.overview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background:
    radial-gradient(circle at top right, rgba(16, 185, 129, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(39, 39, 42, 0.84), rgba(12, 12, 14, 0.98));
}

.overview-card__copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview-card__eyebrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.inspector-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #e4e4e7;
}

.inspector-eyebrow--muted {
  color: #a1a1aa;
}

.overview-card__title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  color: #fafafa;
}

.overview-card__description {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.45;
  color: #a1a1aa;
}

.overview-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.metric-chip,
.status-chip,
.value-badge,
.section-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 8px;
  font-size: 10px;
  line-height: 1;
  color: #e4e4e7;
  background: rgba(255, 255, 255, 0.04);
}

.metric-chip--accent {
  border-color: rgba(45, 212, 191, 0.34);
  color: #ccfbf1;
  background: rgba(45, 212, 191, 0.12);
}

.status-chip {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.status-chip--ok {
  border-color: rgba(16, 185, 129, 0.28);
  background: rgba(16, 185, 129, 0.14);
  color: #d1fae5;
}

.status-chip--warn {
  border-color: rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.14);
  color: #fef3c7;
}

.overview-card__preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 10, 11, 0.48);
}

.overview-card__preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.layout-preview {
  display: grid;
  gap: 4px;
  min-height: 68px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(32, 32, 35, 0.9), rgba(18, 18, 20, 0.92));
}

.layout-preview--large {
  min-height: 120px;
}

.layout-preview__cell {
  border-radius: 8px;
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.layout-preview__cell--base {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.layout-preview__cell--highlight {
  background: linear-gradient(180deg, #fcd34d, #f59e0b);
  box-shadow: 0 10px 24px rgba(245, 158, 11, 0.18);
}

.overview-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.overview-metrics__item dt {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #71717a;
}

.overview-metrics__item dd {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #e4e4e7;
}

.section-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  text-align: left;
  transition: background-color 0.18s ease;
}

.section-toggle:hover {
  background: rgba(255, 255, 255, 0.025);
}

.section-toggle__lead {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
}

.section-icon {
  display: flex;
  height: 36px;
  width: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
}

.section-icon--emerald {
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
}

.section-icon--blue {
  color: #60a5fa;
  background: rgba(59, 130, 246, 0.12);
}

.section-icon--cyan {
  color: #22d3ee;
  background: rgba(34, 211, 238, 0.12);
}

.section-icon--amber {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.12);
}

.section-icon--green {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.12);
}

.section-icon--violet {
  color: #c4b5fd;
  background: rgba(139, 92, 246, 0.14);
}

.section-icon--magenta {
  color: #f472b6;
  background: rgba(217, 70, 239, 0.12);
}

.section-icon--rose {
  color: #fda4af;
  background: rgba(244, 63, 94, 0.12);
}

.section-icon--neutral {
  color: #d4d4d8;
  background: rgba(255, 255, 255, 0.06);
}

.section-toggle__copy {
  min-width: 0;
}

.section-toggle__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #fafafa;
}

.section-summary {
  max-width: 100%;
  font-size: 10px;
  color: #d4d4d8;
}

.section-description {
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.35;
  color: #71717a;
}

.section-chevron {
  flex: none;
  color: #71717a;
}

.section-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 14px;
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
}

.section-divider__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #71717a;
  white-space: nowrap;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-block__head {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #a1a1aa;
}

.section-note {
  font-size: 11px;
  line-height: 1.35;
  color: #71717a;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

.preset-card:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.14);
}

.preset-card--special .layout-preview {
  border-color: rgba(245, 158, 11, 0.2);
}

.preset-card--active {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(45, 212, 191, 0.08);
}

.preset-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-card__content strong {
  font-size: 12px;
  color: #f4f4f5;
}

.preset-card__content span {
  font-size: 10px;
  line-height: 1.35;
  color: #a1a1aa;
}

.field-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.content-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.content-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}

.content-metric__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8f8f97;
}

.content-metric strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #f4f4f5;
}

.field-stack__head {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #f4f4f5;
}

.field-hint {
  font-size: 11px;
  line-height: 1.4;
  color: #8f8f97;
}

.field-select,
.hex-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  padding: 10px 12px;
  font-size: 12px;
  color: #f4f4f5;
  outline: none;
  transition: border-color 0.16s ease, background-color 0.16s ease;
}

.field-select:focus,
.hex-input:focus {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(255, 255, 255, 0.06);
}

.hex-input {
  max-width: 88px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  text-transform: uppercase;
  padding: 8px 10px;
}

.control-card,
.switch-card,
.template-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
  padding: 12px;
}

.switch-card {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-card__head,
.template-card__head,
.template-card__footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.control-card__head--stacked {
  flex-direction: column;
  align-items: stretch;
}

.control-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.control-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.template-card__footer {
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
}

.template-card__status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #d4d4d8;
}

.template-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 14px;
  border: 1px solid rgba(45, 212, 191, 0.16);
  background: rgba(45, 212, 191, 0.06);
  padding: 10px 12px;
}

.template-notice--muted {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
}

.template-notice div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.template-notice strong {
  font-size: 11px;
  color: #f4f4f5;
}

.template-notice span {
  font-size: 10px;
  line-height: 1.35;
  color: #a1a1aa;
}

.lock-chip {
  flex: none;
  border-radius: 999px;
  border: 1px solid rgba(250, 204, 21, 0.24);
  background: rgba(250, 204, 21, 0.1);
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 700;
  color: #fde68a;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.value-badge {
  flex: none;
  font-weight: 600;
  color: #fafafa;
}

.value-editor {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.value-editor--full {
  width: 100%;
}

.value-editor--full .value-input {
  width: auto;
  flex: 1 1 auto;
}

.value-input {
  min-width: 0;
  width: 92px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(9, 9, 11, 0.7);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fafafa;
}

.value-input::placeholder {
  color: #71717a;
}

.value-suffix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  color: #e4e4e7;
}

.range-scale {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #71717a;
}

.segmented-grid {
  display: grid;
  gap: 8px;
}

.segmented-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.segmented-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.segmented-grid--5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.segmented-option {
  display: flex;
  min-height: 60px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

.segmented-option:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.14);
}

.segmented-option:disabled {
  cursor: not-allowed;
  transform: none;
  opacity: 0.48;
}

.segmented-option strong {
  font-size: 11px;
  color: #f4f4f5;
}

.segmented-option span {
  font-size: 10px;
  line-height: 1.3;
  color: #8f8f97;
}

.segmented-option--compact {
  min-height: 44px;
  align-items: center;
  padding: 8px 10px;
  text-align: center;
}

.segmented-option--active {
  border-color: rgba(45, 212, 191, 0.34);
  background: rgba(45, 212, 191, 0.09);
}

.segmented-option--active strong,
.segmented-option--active span {
  color: #ecfeff;
}

.color-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* Layout compacto de cores em linha */
.color-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 8px;
}

.color-row-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.color-row-item .color-trigger {
  width: 32px;
  height: 32px;
}

.color-row-item .field-label {
  font-size: 10px;
  text-align: center;
}

/* Linha lado a lado para escala e posição */
.side-by-side-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.diagnostic-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.diagnostic-empty,
.diagnostic-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 12px;
}

.diagnostic-empty strong,
.diagnostic-card strong {
  font-size: 12px;
  color: #f4f4f5;
}

.diagnostic-empty span,
.diagnostic-card__message {
  font-size: 11px;
  line-height: 1.45;
  color: #a1a1aa;
}

.diagnostic-card__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.diagnostic-severity {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.diagnostic-severity--info {
  background: rgba(56, 189, 248, 0.12);
  color: #bae6fd;
}

.diagnostic-severity--warning {
  background: rgba(245, 158, 11, 0.14);
  color: #fde68a;
}

.diagnostic-severity--critical {
  background: rgba(244, 63, 94, 0.16);
  color: #fecdd3;
}

.color-field__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.color-field__controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

.color-trigger {
  height: 34px;
  width: 34px;
  flex: none;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  cursor: pointer;
}

.switch {
  position: relative;
  display: inline-flex;
  height: 24px;
  width: 42px;
  flex: none;
}

.switch__track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(113, 113, 122, 0.56);
  transition: background-color 0.16s ease;
}

.switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  height: 18px;
  width: 18px;
  border-radius: 999px;
  background: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.22);
  transition: transform 0.16s ease;
}

.switch--checked .switch__track {
  background: rgba(45, 212, 191, 0.34);
}

.switch--checked .switch__thumb {
  transform: translateX(18px);
}

.ghost-button,
.secondary-button,
.dock-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  transition: transform 0.16s ease, border-color 0.16s ease, background-color 0.16s ease;
}

.ghost-button:hover,
.secondary-button:hover,
.dock-button:hover {
  transform: translateY(-1px);
}

.ghost-button:disabled,
.secondary-button:disabled,
.dock-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
}

.ghost-button {
  background: rgba(255, 255, 255, 0.04);
  color: #f4f4f5;
}

.ghost-button--full {
  width: 100%;
}

.secondary-button {
  background: rgba(217, 70, 239, 0.12);
  border-color: rgba(217, 70, 239, 0.24);
  color: #f5d0fe;
}

.sticky-dock {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  margin-top: 4px;
  margin-left: -12px;
  margin-right: -12px;
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(20, 20, 22, 0.75), rgba(12, 12, 14, 0.96));
  backdrop-filter: blur(12px);
}

.dock-button {
  min-height: 48px;
}

.dock-button--lock {
  background: rgba(255, 255, 255, 0.04);
  color: #f4f4f5;
}

.dock-button--lock-active {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(245, 158, 11, 0.12);
  color: #fef3c7;
}

.dock-button__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dock-button--primary {
  border-color: rgba(45, 212, 191, 0.28);
  background: linear-gradient(135deg, rgba(45, 212, 191, 0.94), rgba(52, 211, 153, 0.92));
  color: #042f2e;
  box-shadow: 0 14px 24px rgba(16, 185, 129, 0.22);
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(63, 63, 70, 0.9);
}

input[type="range"]::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(63, 63, 70, 0.9);
}

input[type="range"]::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  border: 0;
  background: rgba(63, 63, 70, 0.9);
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -4px;
  height: 14px;
  width: 14px;
  border-radius: 999px;
  border: 2px solid rgba(9, 9, 11, 0.9);
  background: currentColor;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}

input[type="range"]::-moz-range-thumb {
  height: 14px;
  width: 14px;
  border-radius: 999px;
  border: 2px solid rgba(9, 9, 11, 0.9);
  background: currentColor;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
}

.slider {
  cursor: pointer;
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid rgba(45, 212, 191, 0.8);
  outline-offset: 2px;
}

.structure-panel__head,
.structure-editor__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.structure-panel__head {
  margin-bottom: 12px;
}

.structure-count-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}

.structure-count-button {
  min-height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 700;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.structure-count-button:hover {
  border-color: rgba(45, 212, 191, 0.34);
  color: #ccfbf1;
}

.structure-count-button--active {
  border-color: rgba(45, 212, 191, 0.62);
  background: rgba(45, 212, 191, 0.16);
  color: #ccfbf1;
  box-shadow: inset 0 0 0 1px rgba(45, 212, 191, 0.12);
}

.structure-count-button--current:not(.structure-count-button--active) {
  border-color: rgba(251, 191, 36, 0.42);
  color: #fde68a;
}

.automatic-structure-card {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 11px;
  padding: 13px;
  border: 1px solid rgba(34, 211, 238, 0.22);
  border-radius: 12px;
  background: rgba(8, 145, 178, 0.07);
}

.automatic-structure-card__icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 9px;
  color: #67e8f9;
  background: rgba(8, 145, 178, 0.18);
}

.automatic-structure-card__copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.automatic-structure-card__copy strong {
  color: #f0fdfa;
  font-size: 12px;
}

.automatic-structure-card__copy p {
  margin: 0;
  color: #a5f3fc;
  font-size: 11px;
  line-height: 1.45;
}

.automatic-structure-card__recipe {
  color: #67e8f9;
  font-size: 10px;
  font-weight: 700;
}

.automatic-structure-card__variant {
  display: grid;
  flex: 1 1 100%;
  gap: 5px;
  min-width: 0;
}

.automatic-structure-card > .flex {
  flex: 1 1 100%;
}

.automatic-structure-card__variant-select {
  width: 100%;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid rgba(103, 232, 249, 0.35);
  border-radius: 7px;
  outline: none;
  color: #e0f2fe;
  background: rgba(15, 23, 42, 0.7);
  font-size: 11px;
}

.automatic-structure-card__variant-select:focus {
  border-color: #22d3ee;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
}

.automatic-structure-card__variant small {
  color: #94a3b8;
  font-size: 9px;
  line-height: 1.35;
}

.automatic-structure-card__link {
  flex: 0 0 auto;
  color: #fef08a;
  font-size: 10px;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}

.automatic-structure-card__link:hover {
  color: #fff7ed;
  text-decoration: underline;
}

.structure-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(9, 9, 11, 0.34);
}

.structure-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.structure-fields-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.structure-number-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: #a1a1aa;
  font-size: 11px;
  font-weight: 600;
}

.structure-number-field input {
  width: 100%;
  min-height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.055);
  padding: 0 10px;
  color: #fafafa;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 360px) {
  .preset-grid,
  .segmented-grid--2,
  .segmented-grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }

  .sticky-dock {
    grid-template-columns: minmax(0, 1fr);
  }

  .overview-metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .content-metrics-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .structure-fields-grid,
  .structure-fields-grid--three {
    grid-template-columns: minmax(0, 1fr);
  }

  .structure-panel__head,
  .structure-editor__title-row {
    flex-direction: column;
    align-items: stretch;
  }

  .color-field,
  .color-field__controls,
  .template-card__footer,
  .template-card__head,
  .switch-card,
  .control-card__head {
    flex-direction: column;
    align-items: stretch;
  }

  .side-by-side-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .hex-input {
    max-width: none;
  }

  .value-editor {
    width: 100%;
  }

  .value-input {
    width: 100%;
  }
}
</style>
