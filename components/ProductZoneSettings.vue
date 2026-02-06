<script setup lang="ts">
/**
 * ProductZoneSettings Component
 * 
 * Painel de configuração para Product Zone
 * Inclui: presets, layout, espaçamento, destaques, estilos
 */

import { computed, ref } from 'vue';
import {
  LayoutGrid,
  Rows3,
  Columns3,
  Wand2,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  Star,
  Palette,
  Settings2,
  Grid3X3,
  StretchHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  List,
  // NEW ICONS for expanded presets
  Sidebar,
  CreditCard,
  ArrowRight,
  BookOpen,
  Sparkles
} from 'lucide-vue-next';
import { LAYOUT_PRESETS, SPLASH_STYLES } from '~/types/product-zone';
import type { LabelTemplate } from '~/types/label-template';
import type { GlobalStyles } from '~/types/product-zone';
import ColorPicker from './ui/ColorPicker.vue';
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog';

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
  layout: true,
  spacing: true,
  highlight: false,
  styles: false
});

// Presets expansion state
const presetsExpanded = ref(true);
const activePresetCategory = ref<string | null>(null);

const syncGaps = ref(true);

// Computed
const currentPreset = computed(() => {
  const cols = props.zone.columns ?? 0;
  const rows = props.zone.rows ?? 0;
  const direction = props.zone.layoutDirection;
  const aspect = props.zone.cardAspectRatio;

  // Auto
  if (cols === 0 && rows === 0) return 'auto';

  // Grids
  if (cols === 2 && rows === 0 && aspect === '3:4') return 'grid-2';
  if (cols === 3 && rows === 0 && aspect === '3:4') return 'grid-3';
  if (cols === 4 && rows === 0 && aspect === 'square') return 'grid-4';
  if (cols === 5 && rows === 0 && aspect === 'square') return 'grid-5';
  if (cols === 6 && rows === 0 && aspect === 'square') return 'grid-6';

  // Vertical
  if (cols === 1 && direction === 'vertical') {
    if (aspect === '16:9') return 'list';
    if (aspect === '9:16') return 'sidebar';
  }

  // Cards (2 colunas square)
  if (cols === 2 && aspect === 'square' && direction === 'horizontal') return 'cards';

  // Horizontal
  if (cols === 0 && rows === 1) return 'horizontal';
  if (cols === 2 && aspect === '4:3') return 'magazine';

  // Special (featured/showcase based on highlight settings)
  if (props.zone.highlightCount === 1) {
    if (props.zone.highlightHeight === 2) return 'showcase';
    return 'featured';
  }

  return 'auto';
});

// Organize presets by category
const presetCategories = computed(() => {
  const categories = {
    basic: { label: 'Básicos', presets: [] as typeof LAYOUT_PRESETS },
    grid: { label: 'Grids', presets: [] as typeof LAYOUT_PRESETS },
    vertical: { label: 'Verticais', presets: [] as typeof LAYOUT_PRESETS },
    horizontal: { label: 'Horizontais', presets: [] as typeof LAYOUT_PRESETS },
    special: { label: 'Especiais', presets: [] as typeof LAYOUT_PRESETS }
  };

  LAYOUT_PRESETS.forEach(preset => {
    const cat = preset.category || 'basic';
    if (categories[cat]) {
      categories[cat].presets.push(preset);
    }
  });

  return categories;
});

// Handlers
const updateZone = (prop: string, value: any) => {
  console.log('🔍 [ProductZoneSettings] emitting update:zone', prop, value);
  emit('update:zone', prop, value);
};

const updateGlobal = (prop: string, value: any) => {
  console.log('🔍 [ProductZoneSettings] emitting update:global-styles', prop, value);
  emit('update:global-styles', prop, value);
};

const FONT_DATALIST_ID = 'product-zone-fonts';

const weightOptions = [
  { label: '300', value: 300 },
  { label: '400', value: 400 },
  { label: '500', value: 500 },
  { label: '600', value: 600 },
  { label: '700', value: 700 },
  { label: '800', value: 800 },
  { label: '900', value: 900 }
];

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

// Aspect Ratio Options
const aspectRatioOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'square', label: '1:1' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: 'fill', label: 'Preencher' }
];

const lastRowOptions = [
  { value: 'center', label: 'Centralizar' },
  { value: 'fill', label: 'Preencher' },
  { value: 'stretch', label: 'Esticar' },
  { value: 'left', label: 'Esquerda' }
];

const verticalAlignOptions = [
  { value: 'top', label: 'Topo', icon: AlignStartVertical },
  { value: 'center', label: 'Centro', icon: AlignCenterVertical },
  { value: 'bottom', label: 'Base', icon: AlignEndVertical },
  { value: 'stretch', label: 'Esticar', icon: StretchHorizontal }
];
</script>

<template>
  <div class="p-4 space-y-4 text-white text-sm">
    
    <!-- Presets Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Presets</span>
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

      <div v-if="presetsExpanded" class="space-y-4">
        <!-- Básicos -->
        <div class="space-y-2">
          <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wide">Básicos</span>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="preset in presetCategories.basic.presets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border transition-all',
                currentPreset === preset.id
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200'
              ]"
              :title="preset.description"
            >
              <component
                :is="preset.id === 'auto' ? Wand2 : Columns3"
                class="w-4 h-4"
              />
              <span class="text-[9px] font-medium">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Grids -->
        <div class="space-y-2">
          <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wide">Grids</span>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="preset in presetCategories.grid.presets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex flex-col items-center gap-1 p-2 rounded border transition-all',
                currentPreset === preset.id
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
              ]"
              :title="preset.description"
            >
              <LayoutGrid class="w-3.5 h-3.5" />
              <span class="text-[8px]">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Verticais -->
        <div class="space-y-2">
          <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wide">Verticais</span>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="preset in presetCategories.vertical.presets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex flex-col items-center gap-1 p-2 rounded border transition-all',
                currentPreset === preset.id
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
              ]"
              :title="preset.description"
            >
              <component
                :is="preset.id === 'list' ? List : preset.id === 'sidebar' ? Sidebar : CreditCard"
                class="w-3.5 h-3.5"
              />
              <span class="text-[8px]">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Horizontais -->
        <div class="space-y-2">
          <span class="text-[9px] font-semibold text-zinc-500 uppercase tracking-wide">Horizontais</span>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="preset in presetCategories.horizontal.presets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex items-center gap-2 p-2 rounded border transition-all',
                currentPreset === preset.id
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
              ]"
              :title="preset.description"
            >
              <component
                :is="preset.id === 'horizontal' ? ArrowRight : BookOpen"
                class="w-3.5 h-3.5"
              />
              <span class="text-[9px]">{{ preset.name }}</span>
            </button>
          </div>
        </div>

        <!-- Especiais -->
        <div class="space-y-2">
          <span class="text-[9px] font-semibold text-yellow-500/80 uppercase tracking-wide">Especiais</span>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="preset in presetCategories.special.presets"
              :key="preset.id"
              @click="applyPreset(preset.id)"
              :class="[
                'flex items-center gap-2 p-2 rounded border transition-all',
                currentPreset === preset.id
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                  : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300'
              ]"
              :title="preset.description"
            >
              <component
                :is="preset.id === 'featured' ? Star : Sparkles"
                class="w-3.5 h-3.5"
              />
              <span class="text-[9px]">{{ preset.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-white/5" />

    <!-- Layout Section -->
    <div class="space-y-3">
      <button 
        @click="toggleSection('layout')"
        class="flex items-center justify-between w-full text-left"
      >
        <span class="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Layout Avançado</span>
        <component :is="expandedSections.layout ? ChevronDown : ChevronRight" class="w-3.5 h-3.5 text-zinc-600" />
      </button>
      
      <div v-if="expandedSections.layout" class="space-y-3 animate-in slide-in-from-top-2 duration-200">
        
        <!-- Columns & Rows -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
              <Columns3 class="w-3 h-3" /> Colunas
            </label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="zone.columns ?? 0"
                @input="updateZone('columns', Number(($event.target as HTMLInputElement).value))"
                min="0"
                max="6"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-6 text-center text-[10px] font-mono text-zinc-400">
                {{ zone.columns === 0 ? 'Auto' : zone.columns }}
              </span>
            </div>
          </div>
          
          <div class="space-y-1.5">
            <label class="text-[10px] text-zinc-500 flex items-center gap-1.5">
              <Rows3 class="w-3 h-3" /> Linhas
            </label>
            <div class="flex items-center gap-2">
              <input
                type="range"
                :value="zone.rows ?? 0"
                @input="updateZone('rows', Number(($event.target as HTMLInputElement).value))"
                min="0"
                max="6"
                class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
              />
              <span class="w-6 text-center text-[10px] font-mono text-zinc-400">
                {{ zone.rows === 0 ? 'Auto' : zone.rows }}
              </span>
            </div>
          </div>
        </div>

        <!-- Aspect Ratio -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Proporção dos Cards</label>
          <div class="flex gap-1 flex-wrap">
            <button
              v-for="opt in aspectRatioOptions"
              :key="opt.value"
              @click="updateZone('cardAspectRatio', opt.value)"
              :class="[
                'px-2 py-1 text-[9px] font-medium rounded transition-all',
                zone.cardAspectRatio === opt.value
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              ]"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Last Row Behavior -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Última Linha</label>
          <select
            :value="zone.lastRowBehavior ?? 'center'"
            @change="updateZone('lastRowBehavior', ($event.target as HTMLSelectElement).value)"
            class="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option v-for="opt in lastRowOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Vertical Alignment -->
        <div class="space-y-1.5">
          <label class="text-[10px] text-zinc-500">Alinhamento Vertical</label>
          <div class="flex gap-1">
            <button
              v-for="opt in verticalAlignOptions"
              :key="opt.value"
              @click="updateZone('verticalAlign', opt.value)"
              :class="[
                'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[9px] font-medium transition-all',
                zone.verticalAlign === opt.value
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]"
              :title="opt.label"
            >
              <component :is="opt.icon" class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- Layout Direction -->
        <div class="flex items-center gap-3">
          <label class="text-[10px] text-zinc-500">Direção:</label>
          <div class="flex gap-1">
            <button
              @click="updateZone('layoutDirection', 'horizontal')"
              :class="[
                'px-3 py-1 rounded text-[9px] font-medium transition-all',
                zone.layoutDirection === 'horizontal'
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]"
            >
              Horizontal
            </button>
            <button
              @click="updateZone('layoutDirection', 'vertical')"
              :class="[
                'px-3 py-1 rounded text-[9px] font-medium transition-all',
                zone.layoutDirection === 'vertical'
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              ]"
            >
              Vertical
            </button>
          </div>
        </div>
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
              @change="updateGlobal('prodNameFont', ($event.target as HTMLSelectElement).value)"
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
                <option v-for="w in weightOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Escala (tamanho)</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  :value="Math.round(((globalStyles?.prodNameScale ?? 1) * 100))"
                  @input="updateGlobal('prodNameScale', Number(($event.target as HTMLInputElement).value) / 100)"
                  min="60"
                  max="170"
                  class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
                  {{ Math.round((globalStyles?.prodNameScale ?? 1) * 100) }}%
                </span>
              </div>
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] text-zinc-500">Altura da linha</label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  :value="Math.round(((globalStyles?.prodNameLineHeight ?? 1.05) * 100))"
                  @input="updateGlobal('prodNameLineHeight', Number(($event.target as HTMLInputElement).value) / 100)"
                  min="80"
                  max="180"
                  class="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
                <span class="w-12 text-center text-[10px] font-mono text-zinc-400">
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
                @change="updateGlobal('priceFont', ($event.target as HTMLSelectElement).value)"
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
                <option v-for="w in weightOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
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
</style>
