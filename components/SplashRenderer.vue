<script setup lang="ts">
/**
 * SplashRenderer Component
 * 
 * Renderiza a etiqueta de preço (splash) de forma independente do card
 * Suporta múltiplos estilos visuais: classic, bubble, star, explosion, ribbon, circle, modern
 */

import { computed } from 'vue';
import type { Splash } from '~/types/product-zone';
import { splitPrice } from '~/utils/product-zone-helpers';

// Props
const props = withDefaults(defineProps<{
  splash: Partial<Splash>;
  // Optional overrides
  price?: string | number;
  unit?: string;
  scale?: number;
}>(), {
  scale: 1
});

// Computed Values
const priceDisplay = computed(() => {
  const rawPrice = props.price ?? props.splash.price ?? '0,00';
  return splitPrice(rawPrice);
});

const splashStyle = computed(() => props.splash.style ?? 'classic');
const bgColor = computed(() => props.splash.color ?? '#dc2626');
const textColor = computed(() => props.splash.textColor ?? '#ffffff');
const rotation = computed(() => props.splash.rotation ?? -5);
const effectiveScale = computed(() => (props.splash.scale ?? 1) * props.scale);

// Effect styles
const textShadow = computed(() => {
  if (props.splash.textEffect === 'shadow') {
    const color = props.splash.effectColor ?? 'rgba(0,0,0,0.3)';
    return `2px 2px 4px ${color}`;
  }
  if (props.splash.textEffect === 'glow') {
    const color = props.splash.effectColor ?? 'rgba(255,255,255,0.5)';
    return `0 0 10px ${color}, 0 0 20px ${color}`;
  }
  return 'none';
});

const textStroke = computed(() => {
  if (props.splash.textEffect === 'stroke') {
    const thickness = props.splash.effectThickness ?? 2;
    const color = props.splash.effectColor ?? '#000000';
    return `${thickness}px ${color}`;
  }
  return 'none';
});

// SVG Path for different styles
const splashPath = computed(() => {
  switch (splashStyle.value) {
    case 'bubble':
      return 'M80,10 Q150,0 155,40 Q160,80 150,100 Q120,120 80,115 Q40,120 20,100 Q0,80 5,40 Q10,0 80,10 Z';
    case 'star':
      return 'M80,0 L100,55 L160,55 L110,90 L130,145 L80,110 L30,145 L50,90 L0,55 L60,55 Z';
    case 'explosion':
      return 'M80,5 L95,35 L130,10 L110,45 L155,50 L115,70 L150,105 L105,90 L90,130 L75,95 L40,120 L55,80 L10,70 L50,55 L20,25 L60,40 Z';
    case 'ribbon':
      return 'M0,30 L160,30 L145,60 L160,90 L0,90 L15,60 Z';
    case 'circle':
      return ''; // Use ellipse
    case 'modern':
      return ''; // Use rect with rounded corners
    default: // classic ellipse
      return '';
  }
});

// Unit display
const unitDisplay = computed(() => props.unit ?? props.splash.unit ?? '');
</script>

<template>
  <div 
    class="splash-renderer absolute pointer-events-none select-none"
    :style="{
      transform: `translate(-50%, 0) rotate(${rotation}deg) scale(${effectiveScale})`,
      left: '50%',
      transformOrigin: 'center center'
    }"
  >
    <!-- Classic/Bubble/Shape Styles with SVG -->
    <svg 
      v-if="['classic', 'bubble', 'explosion', 'star', 'ribbon'].includes(splashStyle)"
      :width="splashStyle === 'ribbon' ? 180 : 160" 
      :height="splashStyle === 'ribbon' ? 80 : 130"
      viewBox="0 0 160 130"
      class="overflow-visible"
    >
      <!-- Background Shape -->
      <ellipse 
        v-if="splashStyle === 'classic'"
        cx="80" cy="65" rx="75" ry="55" 
        :fill="bgColor"
        filter="drop-shadow(2px 3px 4px rgba(0,0,0,0.2))"
      />
      <path 
        v-else
        :d="splashPath"
        :fill="bgColor"
        filter="drop-shadow(2px 3px 4px rgba(0,0,0,0.2))"
      />

      <!-- Currency Symbol -->
      <text
        x="30" y="55"
        :fill="textColor"
        :style="{ 
          fontFamily: splash.fontFamily ?? 'Arial',
          fontSize: '18px',
          fontWeight: 'bold',
          textShadow,
          WebkitTextStroke: textStroke
        }"
      >
        {{ priceDisplay.currency }}
      </text>

      <!-- Main Price (Integer) -->
      <text
        x="85" y="80"
        :fill="textColor"
        text-anchor="end"
        :style="{ 
          fontFamily: splash.fontFamily ?? 'Arial',
          fontSize: `${splash.fontSize ?? 60}px`,
          fontWeight: splash.fontWeight ?? 700,
          textShadow,
          WebkitTextStroke: textStroke
        }"
      >
        {{ priceDisplay.integer }}
      </text>

      <!-- Decimal Part -->
      <text
        x="88" y="55"
        :fill="textColor"
        :style="{ 
          fontFamily: splash.fontFamily ?? 'Arial',
          fontSize: `${(splash.fontSize ?? 60) * ((splash.decimalSize ?? 50) / 100)}px`,
          fontWeight: splash.fontWeight ?? 700,
          textShadow,
          WebkitTextStroke: textStroke
        }"
      >
        ,{{ priceDisplay.decimal }}
      </text>

      <!-- Unit (if any) -->
      <text
        v-if="unitDisplay"
        x="80" y="115"
        :fill="textColor"
        text-anchor="middle"
        :style="{ 
          fontFamily: splash.fontFamily ?? 'Arial',
          fontSize: '16px',
          fontWeight: 600
        }"
      >
        {{ unitDisplay }}
      </text>
    </svg>

    <!-- Circle Style -->
    <div 
      v-else-if="splashStyle === 'circle'"
      class="flex items-center justify-center rounded-full"
      :style="{
        width: '130px',
        height: '130px',
        backgroundColor: bgColor,
        boxShadow: '2px 3px 8px rgba(0,0,0,0.2)'
      }"
    >
      <div class="text-center" :style="{ color: textColor }">
        <span class="text-sm font-bold block" :style="{ textShadow }">
          {{ priceDisplay.currency }}
        </span>
        <div class="flex items-start justify-center">
          <span 
            :style="{ 
              fontSize: `${splash.fontSize ?? 48}px`,
              fontWeight: splash.fontWeight ?? 700,
              fontFamily: splash.fontFamily ?? 'Arial',
              lineHeight: 1,
              textShadow,
              WebkitTextStroke: textStroke
            }"
          >
            {{ priceDisplay.integer }}
          </span>
          <span 
            :style="{ 
              fontSize: `${(splash.fontSize ?? 48) * 0.5}px`,
              fontWeight: splash.fontWeight ?? 700,
              fontFamily: splash.fontFamily ?? 'Arial',
              textShadow
            }"
          >
            ,{{ priceDisplay.decimal }}
          </span>
        </div>
        <span v-if="unitDisplay" class="text-xs font-medium block mt-0.5">
          {{ unitDisplay }}
        </span>
      </div>
    </div>

    <!-- Modern Style (Rounded Rectangle) -->
    <div 
      v-else-if="splashStyle === 'modern'"
      class="flex items-center gap-1 px-4 py-2 rounded-xl"
      :style="{
        backgroundColor: bgColor,
        boxShadow: '2px 3px 8px rgba(0,0,0,0.15)'
      }"
    >
      <span 
        :style="{ 
          color: textColor,
          fontSize: '16px',
          fontWeight: 500,
          fontFamily: splash.fontFamily ?? 'Inter, Arial',
        }"
      >
        {{ priceDisplay.currency }}
      </span>
      <span 
        :style="{ 
          color: textColor,
          fontSize: `${splash.fontSize ?? 40}px`,
          fontWeight: splash.fontWeight ?? 700,
          fontFamily: splash.fontFamily ?? 'Inter, Arial',
          lineHeight: 1,
          textShadow
        }"
      >
        {{ priceDisplay.integer }}
      </span>
      <span 
        :style="{ 
          color: textColor,
          fontSize: `${(splash.fontSize ?? 40) * 0.5}px`,
          fontWeight: splash.fontWeight ?? 700,
          fontFamily: splash.fontFamily ?? 'Inter, Arial',
          alignSelf: 'flex-start',
          marginTop: '4px'
        }"
      >
        ,{{ priceDisplay.decimal }}
      </span>
      <span 
        v-if="unitDisplay"
        :style="{ 
          color: textColor,
          fontSize: '14px',
          fontWeight: 500,
          marginLeft: '4px'
        }"
      >
        {{ unitDisplay }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.splash-renderer {
  z-index: 100;
  will-change: transform;
}
</style>
