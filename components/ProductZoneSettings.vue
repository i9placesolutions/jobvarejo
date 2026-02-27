<script setup lang="ts">
/**
 * ProductZoneSettings Component
 * 
 * Painel de configuração para Product Zone
 * Inclui: presets, layout, espaçamento, destaques, estilos
 */

import { computed, ref } from 'vue';
import {
  Columns3,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  Star,
  Palette,
  Settings2
} from 'lucide-vue-next';
import { LAYOUT_PRESETS, SPLASH_STYLES, type LayoutPreset } from '~/types/product-zone';
import type { LabelTemplate } from '~/types/label-template';
import type { GlobalStyles } from '~/types/product-zone';
import ColorPicker from './ui/ColorPicker.vue';
import {
  AVAILABLE_FONT_FAMILIES,
  getFontWeightOptionsForFamily,
  normalizeFontWeightForFamily
} from '~/utils/font-catalog';

// Props
const props = defineProps<{
  zone: {
    columns?: number;
    rows?: number;
    padding?: number;
    gapHorizontal?: number;
    gapVertical?: number;
    layoutDirection?: 'horizontal' | 'vertical';
    cardAspectRatio?: string;
    lastRowBehavior?: 'fill' | 'center' | 'stretch' | 'left';
    verticalAlign?: 'top' | 'center' | 'bottom' | 'stretch';
    highlightCount?: number;
    highlightPos?: string;
    highlightHeight?: number;
    isLocked?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    showBorder?: boolean;
  };
  globalStyles?: Partial<GlobalStyles>;
  labelTemplates?: LabelTemplate[];
}>();

// Emits
const emit = defineEmits<{
  (e: 'update:zone', prop: string, value: any): void;
  (e: 'update:global-styles', prop: string, value: any): void;
  (e: 'apply-preset', presetId: string): void;
  (e: 'sync-gaps', padding: number): void;
  (e: 'recalculate'): void;
  (e: 'manage-label-templates'): void;
  (e: 'apply-template-to-zone'): void;
}>();

// UI State
const showCardColorPicker = ref(false)
const showAccentColorPicker = ref(false)
const showSplashColorPicker = ref(false)
const showSplashTextColorPicker = ref(false)
const showCardBorderColorPicker = ref(false)
const showProdNameColorPicker = ref(false)
const showSplashFillPicker = ref(false)
const showPriceTextColorPicker = ref(false)
const showPriceCurrencyColorPicker = ref(false)
const cardColorPickerRef = ref<HTMLElement | null>(null)
const accentColorPickerRef = ref<HTMLElement | null>(null)
const splashColorPickerRef = ref<HTMLElement | null>(null)
const splashTextColorPickerRef = ref<HTMLElement | null>(null)
const cardBorderColorPickerRef = ref<HTMLElement | null>(null)
const prodNameColorPickerRef = ref<HTMLElement | null>(null)
const splashFillPickerRef = ref<HTMLElement | null>(null)
const priceTextColorPickerRef = ref<HTMLElement | null>(null)
const priceCurrencyColorPickerRef = ref<HTMLElement | null>(null)

const expandedSections = ref({
  layout: false,
  spacing: false,
  highlight: false,
  styles: false
});

// Presets expansion state
const presetsExpanded = ref(true);

const isSpacingSynced = () => {
  const pad = Number(props.zone.padding ?? 15);
  const gapH = Number(props.zone.gapHorizontal ?? pad);
  const gapV = Number(props.zone.gapVertical ?? pad);
  return Math.abs(gapH - pad) < 0.001 && Math.abs(gapV - pad) < 0.001;
};

const syncGaps = ref(isSpacingSynced());

type HighlightPos = 'first' | 'last' | 'random' | 'center' | 'top' | 'bottom';
type PreviewTone = 'base' | 'highlight';
type NormalizedZonePresetState = {
  columns: number;
  rows: number;
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
  columns: Math.max(0, Math.round(toSafeNumber(props.zone.columns, 0))),
  rows: Math.max(0, Math.round(toSafeNumber(props.zone.rows, 0))),
  layoutDirection: props.zone.layoutDirection === 'vertical' ? 'vertical' : 'horizontal',
  cardAspectRatio: props.zone.cardAspectRatio ?? 'fill',
  lastRowBehavior: (props.zone.lastRowBehavior ?? 'fill') as NormalizedZonePresetState['lastRowBehavior'],
  verticalAlign: (props.zone.verticalAlign ?? 'stretch') as NormalizedZonePresetState['verticalAlign'],
  highlightCount: Math.max(0, Math.round(toSafeNumber(props.zone.highlightCount, 0))),
  highlightPos: normalizeHighlightPos(props.zone.highlightPos),
  highlightHeight: toSafeNumber(props.zone.highlightHeight, 1.5)
}));

const presetMatchesZone = (preset: LayoutPreset, zone: NormalizedZonePresetState) => {
  const presetColumns = Math.max(0, Math.round(toSafeNumber(preset.columns, 0)));
  const presetRows = Math.max(0, Math.round(toSafeNumber(preset.rows, 0)));
  const presetLayout = (preset.layoutDirection ?? 'horizontal') as NormalizedZonePresetState['layoutDirection'];
  const presetAspect = preset.cardAspectRatio ?? 'fill';
  const presetLastRow = (preset.lastRowBehavior ?? 'fill') as NormalizedZonePresetState['lastRowBehavior'];
  const presetHighlightCount = Math.max(0, Math.round(toSafeNumber(preset.highlightCount, 0)));

  if (zone.columns !== presetColumns) return false;
  if (zone.rows !== presetRows) return false;
  if (zone.layoutDirection !== presetLayout) return false;
  if (zone.cardAspectRatio !== presetAspect) return false;
  if (zone.lastRowBehavior !== presetLastRow) return false;
  if (preset.verticalAlign && zone.verticalAlign !== preset.verticalAlign) return false;
  if (zone.highlightCount !== presetHighlightCount) return false;

  if (presetHighlightCount > 0) {
    const presetPos = normalizeHighlightPos(preset.highlightPos ?? 'first');
    const presetHeight = toSafeNumber(preset.highlightHeight, 1.5);
    if (zone.highlightPos !== presetPos) return false;
    if (Math.abs(zone.highlightHeight - presetHeight) > 0.05) return false;
  }

  return true;
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

const previewCellsByPreset = computed<Record<string, PresetPreviewCell[]>>(() => {
  const map: Record<string, PresetPreviewCell[]> = {};
  for (const preset of LAYOUT_PRESETS) {
    map[preset.id] = createPreviewCells(preset);
  }
  return map;
});

const getPreviewCells = (preset: LayoutPreset) => previewCellsByPreset.value[preset.id] ?? [];

// Computed - detect active preset from zone signature
const currentPreset = computed(() => {
  const zone = normalizedZoneState.value;
  const exact = LAYOUT_PRESETS.find(preset => presetMatchesZone(preset, zone));
  return exact?.id ?? 'auto';
});

// Organize presets by category
const gridPresets = computed(() => LAYOUT_PRESETS.filter(p => p.category === 'grid'));
const specialPresets = computed(() => LAYOUT_PRESETS.filter(p => p.category === 'special'));

// Handlers
const updateZone = (prop: string, value: any) => {
  emit('update:zone', prop, value);
};

const updateGlobal = (prop: string, value: any) => {
  emit('update:global-styles', prop, value);
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
  if (currentWeight === null) return;

  const nextWeight = normalizeFontWeightForFamily(nextFont, currentWeight);
  if (nextWeight !== currentWeight) updateGlobal('priceFontWeight', nextWeight);
};

const handlePaddingChange = (value: number) => {
  if (syncGaps.value) {
    emit('sync-gaps', value);
  } else {
    updateZone('padding', value);
  }
};

const applyPreset = (presetId: string) => {
  emit('apply-preset', presetId);
};

const toggleSection = (section: keyof typeof expandedSections.value) => {
  expandedSections.value[section] = !expandedSections.value[section];
};
</script>

<template>
  <div class="p-4 space-y-4 text-white text-sm">
    
    <!-- Presets Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Produtos por Linha</span>
        <button
          @click="presetsExpanded = !presetsExpanded"
          class="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <component
            :is="presetsExpanded ? ChevronDown : ChevronRight"
            class="w-3.5 h-3.5"
          />
        </button>
      </div>

      <div v-if="presetsExpanded" class="space-y-3">
        <!-- Grid Presets: mini previews -->
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="preset in gridPresets"
            :key="preset.id"
            @click="applyPreset(preset.id)"
            :class="[
              'flex flex-col gap-1.5 p-2 rounded-lg border transition-all',
              currentPreset === preset.id
                ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200'
            ]"
            :title="preset.description"
          >
            <div class="preset-preview" :style="getPreviewGridStyle(preset)">
              <span
                v-for="cell in getPreviewCells(preset)"
                :key="cell.id"
                :class="[
                  'preset-preview-cell',
                  cell.tone === 'highlight'
                    ? 'preset-preview-cell--highlight'
                    : 'preset-preview-cell--base'
                ]"
                :style="getPreviewCellStyle(cell)"
              />
            </div>
            <span class="text-[8px] font-medium leading-tight text-center">{{ preset.name }}</span>
          </button>
        </div>

        <!-- Special Presets -->
        <div class="space-y-1.5">
          <span class="text-[9px] font-semibold text-yellow-500/80 uppercase tracking-wide">Destaques</span>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="preset in specialPresets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex flex-col gap-1.5 p-2 rounded-lg border transition-all',
                currentPreset === preset.id
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                  : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200'
              ]"
              :title="preset.description"
            >
              <div class="preset-preview" :style="getPreviewGridStyle(preset)">
                <span
                  v-for="cell in getPreviewCells(preset)"
                  :key="cell.id"
                  :class="[
                    'preset-preview-cell',
                    cell.tone === 'highlight'
                      ? 'preset-preview-cell--highlight'
                      : 'preset-preview-cell--base'
                  ]"
                  :style="getPreviewCellStyle(cell)"
                />
              </div>
              <span class="text-[8px] font-medium leading-tight text-center">{{ preset.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Layout Avançado Section (simplified: just columns slider + highlight controls) -->
    <div class="space-y-3">
      <button 
        @click="toggleSection('layout')"
        class="flex items-center justify-between w-full text-left"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Layout Avançado</span>
        <component :is="expandedSections.layout ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-600" />
      </button>
      
      <div v-if="expandedSections.layout" class="space-y-3 animate-in slide-in-from-top-2 duration-200">
        
        <!-- Columns Slider -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <Columns3 class="w-3 h-3" /> Colunas por Linha
          </label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="zone.columns ?? 0"
              @input="updateZone('columns', Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="8"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <span class="w-8 text-center text-[10px] font-mono text-zinc-400">
              {{ zone.columns === 0 ? 'Auto' : zone.columns }}
            </span>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Última linha</label>
          <select
            :value="zone.lastRowBehavior ?? 'fill'"
            @change="updateZone('lastRowBehavior', ($event.target as HTMLSelectElement).value)"
            class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="fill">Preencher largura</option>
            <option value="center">Centralizar</option>
            <option value="left">Alinhar à esquerda</option>
          </select>
        </div>

        <p class="text-[10px] text-zinc-500 leading-relaxed">
          Use <strong class="text-zinc-300">Auto</strong> em colunas para ajuste responsivo.
          O sistema mantém os cards dentro da zona automaticamente.
        </p>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Spacing Section -->
    <div class="space-y-3">
      <button 
        @click="toggleSection('spacing')"
        class="flex items-center justify-between w-full text-left"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Espaçamento</span>
        <component :is="expandedSections.spacing ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-600" />
      </button>
      
      <div v-if="expandedSections.spacing" class="space-y-3 animate-in slide-in-from-top-2 duration-200">
        
        <!-- Sync Toggle -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            v-model="syncGaps"
            class="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
          />
          <span class="text-[10px] text-zinc-400">Sincronizar gaps com padding</span>
        </label>

        <!-- Main Padding -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <AlignVerticalSpaceAround class="w-3 h-3" /> Padding Principal
          </label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="zone.padding ?? 15"
              @input="handlePaddingChange(Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="50"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <input
              type="number"
              :value="zone.padding ?? 15"
              @blur="handlePaddingChange(Number(($event.target as HTMLInputElement).value))"
              class="w-12 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-center"
            />
          </div>
        </div>

        <!-- Horizontal Gap (if not synced) -->
        <div v-if="!syncGaps" class="space-y-1.5">
          <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <AlignHorizontalSpaceAround class="w-3 h-3" /> Gap Horizontal
          </label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="zone.gapHorizontal ?? 15"
              @input="updateZone('gapHorizontal', Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="50"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <input
              type="number"
              :value="zone.gapHorizontal ?? 15"
              @blur="updateZone('gapHorizontal', Number(($event.target as HTMLInputElement).value))"
              class="w-12 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-center"
            />
          </div>
        </div>

        <!-- Vertical Gap (if not synced) -->
        <div v-if="!syncGaps" class="space-y-1.5">
          <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
            <AlignVerticalSpaceAround class="w-3 h-3" /> Gap Vertical
          </label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="zone.gapVertical ?? 15"
              @input="updateZone('gapVertical', Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="50"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
            />
            <input
              type="number"
              :value="zone.gapVertical ?? 15"
              @blur="updateZone('gapVertical', Number(($event.target as HTMLInputElement).value))"
              class="w-12 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-center"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Highlight Section -->
    <div class="space-y-3">
      <button 
        @click="toggleSection('highlight')"
        class="flex items-center justify-between w-full text-left"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Star class="w-3 h-3" /> Destaques
        </span>
        <component :is="expandedSections.highlight ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-600" />
      </button>
      
      <div v-if="expandedSections.highlight" class="space-y-3 animate-in slide-in-from-top-2 duration-200">
        
        <!-- Highlight Count -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Quantidade de Destaques</label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="zone.highlightCount ?? 0"
              @input="updateZone('highlightCount', Number(($event.target as HTMLInputElement).value))"
              min="0"
              max="4"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
            />
            <span class="w-6 text-center text-[10px] font-mono text-zinc-400">
              {{ zone.highlightCount ?? 0 }}
            </span>
          </div>
        </div>

        <!-- Highlight Position (if count > 0) -->
        <div v-if="(zone.highlightCount ?? 0) > 0" class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Posição</label>
          <select
            :value="zone.highlightPos ?? 'first'"
            @change="updateZone('highlightPos', ($event.target as HTMLSelectElement).value)"
            class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="first">Primeiros</option>
            <option value="last">Últimos</option>
            <option value="center">Centro</option>
            <option value="top">Cima</option>
            <option value="bottom">Baixo</option>
            <option value="random">Aleatório</option>
          </select>
        </div>

        <!-- Highlight Height Multiplier -->
        <div v-if="(zone.highlightCount ?? 0) > 0" class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Altura do Destaque (multiplicador)</label>
          <div class="flex items-center gap-2">
            <input
              type="range"
              :value="(zone.highlightHeight ?? 1.5) * 10"
              @input="updateZone('highlightHeight', Number(($event.target as HTMLInputElement).value) / 10)"
              min="10"
              max="25"
              class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
            />
            <span class="w-10 text-center text-[10px] font-mono text-zinc-400">
              {{ (zone.highlightHeight ?? 1.5).toFixed(1) }}x
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Styles Section -->
    <div class="space-y-3">
      <button 
        @click="toggleSection('styles')"
        class="flex items-center justify-between w-full text-left"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Palette class="w-3 h-3" /> Estilos Globais
        </span>
        <component :is="expandedSections.styles ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-600" />
      </button>
      
      <div v-if="expandedSections.styles" class="space-y-3 animate-in slide-in-from-top-2 duration-200">
        <datalist :id="FONT_DATALIST_ID">
          <option v-for="f in AVAILABLE_FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
        </datalist>
        
        <!-- Card Color -->
        <div class="flex items-center justify-between">
          <label class="text-[10px] text-zinc-500">Cor do Card</label>
          <div class="flex items-center gap-2">
            <div ref="cardColorPickerRef" class="relative">
              <div
                class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                :style="{ backgroundColor: globalStyles?.cardColor ?? '#ffffff' }"
                @click="showCardColorPicker = true"
              ></div>
              <ColorPicker
                :show="showCardColorPicker"
                :model-value="globalStyles?.cardColor ?? '#ffffff'"
                :trigger-element="cardColorPickerRef"
                @update:show="showCardColorPicker = $event"
                @update:model-value="(val: string) => updateGlobal('cardColor', val)"
              />
            </div>
            <input
              type="text"
              :value="(globalStyles?.cardColor ?? '#ffffff').replace('#', '').toUpperCase()"
              @blur="updateGlobal('cardColor', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
              class="w-16 bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
              placeholder="FFFFFF"
              maxlength="6"
            />
          </div>
        </div>

        <!-- Accent Color -->
        <div class="flex items-center justify-between">
          <label class="text-[10px] text-zinc-500">Cor de Destaque</label>
          <div class="flex items-center gap-2">
            <div ref="accentColorPickerRef" class="relative">
              <div
                class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                :style="{ backgroundColor: globalStyles?.accentColor ?? '#dc2626' }"
                @click="showAccentColorPicker = true"
              ></div>
              <ColorPicker
                :show="showAccentColorPicker"
                :model-value="globalStyles?.accentColor ?? '#dc2626'"
                :trigger-element="accentColorPickerRef"
                @update:show="showAccentColorPicker = $event"
                @update:model-value="(val: string) => updateGlobal('accentColor', val)"
              />
            </div>
            <input
              type="text"
              :value="(globalStyles?.accentColor ?? '#dc2626').replace('#', '').toUpperCase()"
              @blur="updateGlobal('accentColor', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
              class="w-16 bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
              placeholder="DC2626"
              maxlength="6"
            />
          </div>
        </div>

        <!-- Transparent Background -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            :checked="globalStyles?.isProdBgTransparent ?? false"
            @change="updateGlobal('isProdBgTransparent', ($event.target as HTMLInputElement).checked)"
            class="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
          />
          <span class="text-[10px] text-zinc-400">Fundo transparente nos cards</span>
        </label>

        <!-- Card Border -->
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Arredondamento (Card)</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="globalStyles?.cardBorderRadius ?? 8"
                @input="updateGlobal('cardBorderRadius', Number(($event.target as HTMLInputElement).value))"
                min="0"
                max="40"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-10 text-center text-[10px] font-mono text-zinc-400">
                {{ Math.round(globalStyles?.cardBorderRadius ?? 8) }}
              </span>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Borda (Card)</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="globalStyles?.cardBorderWidth ?? 0"
                @input="updateGlobal('cardBorderWidth', Number(($event.target as HTMLInputElement).value))"
                min="0"
                max="12"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-10 text-center text-[10px] font-mono text-zinc-400">
                {{ Math.round(globalStyles?.cardBorderWidth ?? 0) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <label class="text-[10px] text-zinc-500">Cor da borda (Card)</label>
          <div class="flex items-center gap-2">
            <div ref="cardBorderColorPickerRef" class="relative">
              <div
                class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                :style="{ backgroundColor: globalStyles?.cardBorderColor ?? '#000000' }"
                @click="showCardBorderColorPicker = true"
              ></div>
              <ColorPicker
                :show="showCardBorderColorPicker"
                :model-value="globalStyles?.cardBorderColor ?? '#000000'"
                :trigger-element="cardBorderColorPickerRef"
                @update:show="showCardBorderColorPicker = $event"
                @update:model-value="(val: string) => updateGlobal('cardBorderColor', val)"
              />
            </div>
            <input
              type="text"
              :value="(globalStyles?.cardBorderColor ?? '#000000').replace('#', '').toUpperCase()"
              @blur="updateGlobal('cardBorderColor', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
              class="w-16 bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
              placeholder="000000"
              maxlength="6"
            />
          </div>
        </div>

        <!-- Label Template -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-zinc-500">Modelo de Etiqueta</label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-[10px] text-violet-300 hover:text-violet-200 transition-colors"
                @click="emit('manage-label-templates')"
              >
                Gerenciar
              </button>
            </div>
          </div>
          <select
            :value="globalStyles?.splashTemplateId ?? ''"
            @change="updateGlobal('splashTemplateId', (($event.target as HTMLSelectElement).value || undefined))"
            class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Padrão (Sem modelo)</option>
            <option v-for="tpl in (labelTemplates ?? [])" :key="tpl.id" :value="tpl.id">
              {{ tpl.name }}
            </option>
          </select>
          <div class="flex items-center gap-2">
            <p class="text-[9px] text-zinc-500 leading-snug flex-1">
              Usado para novos produtos. Para aplicar aos existentes:
            </p>
            <button
              type="button"
              class="text-[9px] text-green-400 hover:text-green-300 transition-colors underline"
              @click="emit('apply-template-to-zone')"
            >
              Aplicar a todos
            </button>
          </div>
        </div>

        <!-- Splash Style -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Estilo do Splash</label>
          <select
            :value="globalStyles?.splashStyle ?? 'classic'"
            @change="updateGlobal('splashStyle', ($event.target as HTMLSelectElement).value)"
            class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option v-for="style in SPLASH_STYLES" :key="style.id" :value="style.id">
              {{ style.name }}
            </option>
          </select>
        </div>

        <!-- Splash Colors -->
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-[9px] text-zinc-500">Cor Splash</label>
            <div ref="splashColorPickerRef" class="relative">
              <div
                class="w-full h-7 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                :style="{ backgroundColor: globalStyles?.splashColor ?? '#dc2626' }"
                @click="showSplashColorPicker = true"
              ></div>
              <ColorPicker
                :show="showSplashColorPicker"
                :model-value="globalStyles?.splashColor ?? '#dc2626'"
                :trigger-element="splashColorPickerRef"
                @update:show="showSplashColorPicker = $event"
                @update:model-value="(val: string) => updateGlobal('splashColor', val)"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] text-zinc-500">Texto Splash</label>
            <div ref="splashTextColorPickerRef" class="relative">
              <div
                class="w-full h-7 rounded border border-white/10 cursor-pointer relative overflow-hidden"
                :style="{ backgroundColor: globalStyles?.splashTextColor ?? '#ffffff' }"
                @click="showSplashTextColorPicker = true"
              ></div>
              <ColorPicker
                :show="showSplashTextColorPicker"
                :model-value="globalStyles?.splashTextColor ?? '#ffffff'"
                :trigger-element="splashTextColorPickerRef"
                @update:show="showSplashTextColorPicker = $event"
                @update:model-value="(val: string) => updateGlobal('splashTextColor', val)"
              />
            </div>
          </div>
        </div>

        <div class="h-px bg-white/5" />

        <!-- Product Name Typography -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Nome do Produto</span>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Fonte</label>
            <select
              :value="globalStyles?.prodNameFont ?? 'Inter'"
              @change="handleProdNameFontChange"
              class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option v-for="f in AVAILABLE_FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Cor</label>
              <div class="flex items-center gap-2">
                <div ref="prodNameColorPickerRef" class="relative">
                  <div
                    class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                    :style="{ backgroundColor: globalStyles?.prodNameColor ?? '#000000' }"
                    @click="showProdNameColorPicker = true"
                  ></div>
                  <ColorPicker
                    :show="showProdNameColorPicker"
                    :model-value="globalStyles?.prodNameColor ?? '#000000'"
                    :trigger-element="prodNameColorPickerRef"
                    @update:show="showProdNameColorPicker = $event"
                    @update:model-value="(val: string) => updateGlobal('prodNameColor', val)"
                  />
                </div>
                <input
                  type="text"
                  :value="(globalStyles?.prodNameColor ?? '#000000').replace('#', '').toUpperCase()"
                  @blur="updateGlobal('prodNameColor', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
                  class="w-full bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
                  placeholder="000000"
                  maxlength="6"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Peso</label>
              <select
                :value="globalStyles?.prodNameWeight ?? 700"
                @change="updateGlobal('prodNameWeight', Number(($event.target as HTMLSelectElement).value))"
                class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option v-for="w in prodNameWeightOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Escala (tamanho)</label>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <input
                  type="range"
                  :value="Math.round(((globalStyles?.prodNameScale ?? 1) * 100))"
                  @input="updateGlobal('prodNameScale', Number(($event.target as HTMLInputElement).value) / 100)"
                  min="60"
                  max="170"
                  class="w-full min-w-0 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <span class="w-12 shrink-0 text-center text-[10px] font-mono text-zinc-400">
                  {{ Math.round((globalStyles?.prodNameScale ?? 1) * 100) }}%
                </span>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Altura da linha</label>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <input
                  type="range"
                  :value="Math.round(((globalStyles?.prodNameLineHeight ?? 1.05) * 100))"
                  @input="updateGlobal('prodNameLineHeight', Number(($event.target as HTMLInputElement).value) / 100)"
                  min="80"
                  max="180"
                  class="w-full min-w-0 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <span class="w-12 shrink-0 text-center text-[10px] font-mono text-zinc-400">
                  {{ (globalStyles?.prodNameLineHeight ?? 1.05).toFixed(2) }}
                </span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Transformação</label>
              <select
                :value="globalStyles?.prodNameTransform ?? 'upper'"
                @change="updateGlobal('prodNameTransform', ($event.target as HTMLSelectElement).value)"
                class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="upper">MAIÚSCULO</option>
                <option value="lower">minúsculo</option>
                <option value="none">Normal</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Alinhamento</label>
              <select
                :value="globalStyles?.prodNameAlign ?? 'center'"
                @change="updateGlobal('prodNameAlign', ($event.target as HTMLSelectElement).value)"
                class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
          </div>
        </div>

        <div class="h-px bg-white/5" />

        <!-- Price Tag (Etiqueta) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Etiqueta de Preço</span>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Tamanho da etiqueta (escala)</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="Math.round(((globalStyles?.splashScale ?? 1) * 100))"
                @input="updateGlobal('splashScale', Number(($event.target as HTMLInputElement).value) / 100)"
                min="60"
                max="170"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
                {{ Math.round((globalStyles?.splashScale ?? 1) * 100) }}%
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Fundo da etiqueta</label>
              <div class="flex items-center gap-2">
                <div ref="splashFillPickerRef" class="relative">
                  <div
                    class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                    :style="{ backgroundColor: globalStyles?.splashFill ?? '#000000' }"
                    @click="showSplashFillPicker = true"
                  ></div>
                  <ColorPicker
                    :show="showSplashFillPicker"
                    :model-value="globalStyles?.splashFill ?? '#000000'"
                    :trigger-element="splashFillPickerRef"
                    @update:show="showSplashFillPicker = $event"
                    @update:model-value="(val: string) => updateGlobal('splashFill', val)"
                  />
                </div>
                <input
                  type="text"
                  :value="(globalStyles?.splashFill ?? '#000000').replace('#', '').toUpperCase()"
                  @blur="updateGlobal('splashFill', '#' + ($event.target as HTMLInputElement).value.replace('#', ''))"
                  class="w-full bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
                  placeholder="000000"
                  maxlength="6"
                />
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Arredondamento</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  :value="Math.round(((globalStyles?.splashRoundness ?? 1) * 100))"
                  @input="updateGlobal('splashRoundness', Number(($event.target as HTMLInputElement).value) / 100)"
                  min="0"
                  max="100"
                  class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
                  {{ Math.round((globalStyles?.splashRoundness ?? 1) * 100) }}%
                </span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Fonte (Preço)</label>
              <select
                :value="globalStyles?.priceFont ?? 'Inter'"
                @change="handlePriceFontChange"
                class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option v-for="f in AVAILABLE_FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Peso (Preço)</label>
              <select
                :value="(globalStyles?.priceFontWeight as any) ?? ''"
                @change="updateGlobal('priceFontWeight', (($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined))"
                class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="">Padrão</option>
                <option v-for="w in priceWeightOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[9px] text-zinc-500">Texto (Preço)</label>
                <button
                  v-if="globalStyles?.priceTextColor"
                  type="button"
                  class="text-[9px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  @click="updateGlobal('priceTextColor', undefined)"
                  title="Voltar para a cor do modelo"
                >
                  Padrão
                </button>
              </div>
              <div class="flex items-center gap-2">
                <div ref="priceTextColorPickerRef" class="relative">
                  <div
                    class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                    :style="{
                      backgroundColor: globalStyles?.priceTextColor ?? 'transparent',
                      backgroundImage: globalStyles?.priceTextColor ? undefined : 'linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.12) 75%, transparent 75%, transparent)',
                      backgroundSize: globalStyles?.priceTextColor ? undefined : '8px 8px'
                    }"
                    @click="showPriceTextColorPicker = true"
                  ></div>
                  <ColorPicker
                    :show="showPriceTextColorPicker"
                    :model-value="globalStyles?.priceTextColor ?? '#ffffff'"
                    :trigger-element="priceTextColorPickerRef"
                    @update:show="showPriceTextColorPicker = $event"
                    @update:model-value="(val: string) => updateGlobal('priceTextColor', val)"
                  />
                </div>
                <input
                  type="text"
                  :value="globalStyles?.priceTextColor ? globalStyles.priceTextColor.replace('#', '').toUpperCase() : ''"
                  @blur="(e) => { const v = (e.target as HTMLInputElement).value.trim(); updateGlobal('priceTextColor', v ? ('#' + v.replace('#', '')) : undefined) }"
                  class="w-full bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
                  placeholder="PADRÃO"
                  maxlength="6"
                />
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[9px] text-zinc-500">Cifra (R$)</label>
                <button
                  v-if="globalStyles?.priceCurrencyColor"
                  type="button"
                  class="text-[9px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  @click="updateGlobal('priceCurrencyColor', undefined)"
                  title="Voltar para a cor do modelo"
                >
                  Padrão
                </button>
              </div>
              <div class="flex items-center gap-2">
                <div ref="priceCurrencyColorPickerRef" class="relative">
                  <div
                    class="w-6 h-6 rounded border border-white/10 cursor-pointer shrink-0 relative overflow-hidden"
                    :style="{
                      backgroundColor: globalStyles?.priceCurrencyColor ?? 'transparent',
                      backgroundImage: globalStyles?.priceCurrencyColor ? undefined : 'linear-gradient(45deg, rgba(255,255,255,0.12) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.12) 75%, transparent 75%, transparent)',
                      backgroundSize: globalStyles?.priceCurrencyColor ? undefined : '8px 8px'
                    }"
                    @click="showPriceCurrencyColorPicker = true"
                  ></div>
                  <ColorPicker
                    :show="showPriceCurrencyColorPicker"
                    :model-value="globalStyles?.priceCurrencyColor ?? '#000000'"
                    :trigger-element="priceCurrencyColorPickerRef"
                    @update:show="showPriceCurrencyColorPicker = $event"
                    @update:model-value="(val: string) => updateGlobal('priceCurrencyColor', val)"
                  />
                </div>
                <input
                  type="text"
                  :value="globalStyles?.priceCurrencyColor ? globalStyles.priceCurrencyColor.replace('#', '').toUpperCase() : ''"
                  @blur="(e) => { const v = (e.target as HTMLInputElement).value.trim(); updateGlobal('priceCurrencyColor', v ? ('#' + v.replace('#', '')) : undefined) }"
                  class="w-full bg-[#2a2a2a] border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white focus:outline-none focus:border-violet-500/50 uppercase"
                  placeholder="PADRÃO"
                  maxlength="6"
                />
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Escala dos textos (Etiqueta)</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="Math.round(((globalStyles?.splashTextScale ?? 1) * 100))"
                @input="updateGlobal('splashTextScale', Number(($event.target as HTMLInputElement).value) / 100)"
                min="70"
                max="160"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
                {{ Math.round((globalStyles?.splashTextScale ?? 1) * 100) }}%
              </span>
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500">Offset Y (Etiqueta)</label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="globalStyles?.splashOffsetY ?? 0"
                @input="updateGlobal('splashOffsetY', Number(($event.target as HTMLInputElement).value))"
                min="-120"
                max="120"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
                {{ globalStyles?.splashOffsetY ?? 0 }}px
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Lock Toggle -->
    <div class="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
      <span class="text-[10px] text-zinc-400 flex items-center gap-2">
        <component :is="zone.isLocked ? Lock : Unlock" class="w-3.5 h-3.5" />
        Travar posição da zona
      </span>
      <button
        @click="updateZone('isLocked', !zone.isLocked)"
        :class="[
          'w-8 h-4 rounded-full transition-all relative',
          zone.isLocked ? 'bg-violet-500' : 'bg-zinc-700'
        ]"
      >
        <span 
          :class="[
            'absolute w-3 h-3 bg-white rounded-full top-0.5 transition-all',
            zone.isLocked ? 'left-4' : 'left-0.5'
          ]"
        />
      </button>
    </div>

    <!-- Recalculate Button -->
    <button
      @click="emit('recalculate')"
      class="w-full py-2 px-3 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg text-violet-300 text-[11px] font-medium transition-all flex items-center justify-center gap-2"
    >
      <Settings2 class="w-3.5 h-3.5" />
      Recalcular Layout
    </button>

  </div>
</template>

<style scoped>
/* Range slider customization */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #8b5cf6;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.15s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #8b5cf6;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.preset-preview {
  display: grid;
  width: 100%;
  height: 34px;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(24, 24, 27, 0.85);
}

.preset-preview-cell {
  border-radius: 3px;
}

.preset-preview-cell--base {
  background: rgba(255, 255, 255, 0.22);
}

.preset-preview-cell--highlight {
  background: rgba(250, 204, 21, 0.92);
}
</style>
