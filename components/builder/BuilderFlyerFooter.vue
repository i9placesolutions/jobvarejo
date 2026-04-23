<script setup lang="ts">
/**
 * BuilderFlyerFooter — Rodape do encarte QROfertas Builder V2
 *
 * Arquitetura: 2 camadas empilhadas + 3 modelos visuais
 * - Camada 1 (TEXTO_RODAPE): dados da empresa (varia por modelo)
 * - Camada 2 (bar-end): marca dagua + disclaimer (igual em todos)
 *
 * Modelos (controlados por footer_shape):
 *   square.sm → V1 Compacto (bar-boxes, flex row)
 *   round-lg  → V2 Redondo Grande (grid 3 areas, border-radius arredondado)
 *   square.lg → V3 Quadrado Grande (grid 3 areas, border-radius 0)
 */
import { paymentBrandSvg } from '~/utils/paymentBrandSvg'

const { flyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const footerMode = computed(() => fc.value.footer_mode || 'premium')

// ── Modelo do rodape (V1/V2/V3) ──
const footerShape = computed(() => fc.value.footer_shape || 'round-lg')
const isV1 = computed(() => footerShape.value === 'square.sm')
const isV2 = computed(() => footerShape.value === 'round-lg')
const isV3 = computed(() => footerShape.value === 'square.lg')
const isRounded = computed(() => isV2.value)

// ── Cores ──
const bgColor = computed(() => (flyer.value as any)?.footer_bg || fc.value.footer_bg || '#1a1a2e')
const textColor = computed(() => (flyer.value as any)?.footer_text_color || '#ffffff')
const primaryColor = computed(() => (flyer.value as any)?.footer_primary || fc.value.footer_primary || '#fdd201')
const secondaryColor = computed(() => (flyer.value as any)?.footer_secondary || fc.value.footer_secondary || '#007701')

// ── Tipografia ──
const nameFont = computed(() => (flyer.value as any)?.footer_name_font || '')
const bodyFont = computed(() => (flyer.value as any)?.footer_body_font || '')
const nameTransform = computed(() => (flyer.value as any)?.footer_name_transform || 'uppercase')
const nameWeight = computed(() => (flyer.value as any)?.footer_name_weight || '900')
const nameSize = computed(() => ((flyer.value as any)?.footer_name_size || 26) + 'px')
const phoneSize = computed(() => ((flyer.value as any)?.footer_phone_size || 14) + 'px')

// ── Toggles ──
const showLogo = computed(() => (flyer.value as any)?.footer_show_logo ?? true)
const showSocialLabels = computed(() => (flyer.value as any)?.footer_show_social_labels ?? true)
const showPaymentLabel = computed(() => (flyer.value as any)?.footer_show_payment_label ?? true)

// ── Dados da empresa ──
const whatsapp = computed(() => fc.value.footer_whatsapp || (tenant.value as any)?.whatsapp || '')
const facebook = computed(() => fc.value.footer_facebook || (tenant.value as any)?.facebook || '')
const instagram = computed(() => fc.value.footer_instagram || (tenant.value as any)?.instagram || '')
const empresaNome = computed(() => fc.value.footer_empresa_nome || (tenant.value as any)?.name || '')
const empresaSlogan = computed(() => fc.value.footer_empresa_slogan || '')
const endereco = computed(() => fc.value.footer_endereco || (tenant.value as any)?.address || '')
const horario = computed(() => fc.value.footer_horario || '')
const ofertasTexto = computed(() => fc.value.footer_ofertas_texto || '')
const hasSocial = computed(() => !!(whatsapp.value || facebook.value || instagram.value))

// ── Logo ──
const footerLogoSize = computed(() => ((flyer.value as any)?.footer_logo_size || 52) + 'px')
const logoUrl = computed(() => {
  if (!showLogo.value) return null
  const logo = (flyer.value as any)?.custom_logo || (tenant.value as any)?.logo
  if (!logo) return null
  if (logo.startsWith('/api/') || logo.startsWith('http')) return logo
  return `/api/storage/p?key=${encodeURIComponent(logo)}`
})

// ── Bandeiras de pagamento ──
const pay = (key: string) => {
  const val = fc.value[`footer_pay_${key}`]
  if (val === undefined) return ['dinheiro', 'pix', 'visa', 'mastercard', 'elo'].includes(key)
  return !!val
}
const PAYMENT_METHODS = [
  { key: 'dinheiro', color: '#2d6a4f' }, { key: 'pix', color: '#00BD9D' },
  { key: 'visa', color: '#1A1F71' }, { key: 'mastercard', color: '#EB001B' },
  { key: 'elo', color: '#FFCB05' }, { key: 'hipercard', color: '#822124' },
  { key: 'alelo', color: '#00A651' }, { key: 'sodexo', color: '#E31937' },
  { key: 'ticket', color: '#D61F26' }, { key: 'americanexpress', color: '#006FCF' },
  { key: 'vr', color: '#FF6600' }, { key: 'vale_alimentacao', color: '#2E7D32' },
  { key: 'cielo', color: '#0066CC' },
]
const activePayments = computed(() => PAYMENT_METHODS.filter(p => pay(p.key)))

// ── Datas ──
const formatDate = (d: string | null | undefined): string => {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
}
const dataInicio = computed(() => formatDate(flyer.value?.start_date))
const dataFim = computed(() => formatDate(flyer.value?.end_date))
const hasDate = computed(() => flyer.value?.show_dates && flyer.value?.start_date && flyer.value?.end_date)

// ── Avisos legais ──
const showIlustrativa = computed(() => flyer.value?.show_illustrative_note ?? false)
const showEstoque = computed(() => flyer.value?.show_stock_warning ?? false)
const showMedicamento = computed(() => flyer.value?.show_medicine_warning ?? false)
const hasWarnings = computed(() => showIlustrativa.value || showEstoque.value || showMedicamento.value)

// ── Helpers de cor ──
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
function darken(hex: string, amt: number) { return adjustColor(hex, -amt) }
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 0xFF},${(n >> 8) & 0xFF},${n & 0xFF},${a})`
}

// ── Icones SVG ──
const ICON = {
  whatsapp: `<path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>`,
  facebook: `<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`,
  instagram: `<defs><linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs><path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>`,
  phone: `<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>`,
  location: `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>`,
  clock: `<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>`,
  thumbsUp: `<path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>`,
}

// Sanitiza valor de cor antes de concatenar em HTML (v-html). Aceita apenas
// #rgb/#rgba/#rrggbb/#rrggbbaa, nomes simples (letras) e rgb()/rgba() basicos.
// Qualquer valor fora do padrao vira cor default para evitar injecao de
// atributo/HTML no SVG renderizado via v-html.
function sanitizeSvgColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const v = String(value).trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v
  if (/^[a-zA-Z]+$/.test(v)) return v
  if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(v)) return v
  return fallback
}

function svgIcon(name: keyof typeof ICON, size: number, fill?: string): string {
  const safeFill = fill ? sanitizeSvgColor(fill, 'currentColor') : ''
  const f = safeFill ? ` fill="${safeFill}"` : ''
  const safeSize = Number.isFinite(Number(size)) ? Number(size) : 16
  return `<svg width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24"${f}>${ICON[name]}</svg>`
}

// ── Chips para V2/V3 ──
interface FooterChip {
  key: string
  icon: keyof typeof ICON
  iconColor: string
  line1: string
  line2?: string
}
const footerChips = computed<FooterChip[]>(() => {
  const chips: FooterChip[] = []
  if (whatsapp.value) {
    chips.push({ key: 'whatsapp', icon: 'whatsapp', iconColor: '#25D366', line1: whatsapp.value })
  }
  if (horario.value) {
    chips.push({ key: 'horario', icon: 'clock', iconColor: secondaryColor.value, line1: horario.value })
  }
  if (instagram.value) {
    chips.push({ key: 'instagram', icon: 'instagram', iconColor: '#DD2A7B', line1: '@' + instagram.value.replace(/^@/, '') })
  }
  if (facebook.value) {
    chips.push({ key: 'facebook', icon: 'facebook', iconColor: '#1877F2', line1: facebook.value })
  }
  return chips
})

// ── Grid areas para V2/V3 ──
const hasLeft = computed(() => !!(empresaNome.value || logoUrl.value))
const hasRight = computed(() => footerChips.value.length > 0)
const hasBottom = computed(() => !!endereco.value)

const gridAreas = computed(() => {
  if (hasLeft.value && hasRight.value && hasBottom.value) return '"C R" "C R" "F F"'
  if (!hasLeft.value && hasRight.value && hasBottom.value) return '"R R" "R R" "F F"'
  if (hasLeft.value && !hasRight.value && hasBottom.value) return '"C F" "C F" "C F"'
  if (hasLeft.value && !hasRight.value && !hasBottom.value) return '"C C" "C C" "C C"'
  if (!hasLeft.value && !hasRight.value) return '"F F" "F F" "F F"'
  return '"C R" "C R" "F F"'
})

const gridColumns = computed(() => {
  if (!hasLeft.value) return '100%'
  if (!hasRight.value) return '100%'
  return '30% 70%'
})

// ── Estilos computados ──
const borderRadiusMain = computed(() => isRounded.value ? '50px' : '0')
const borderRadiusChipIcon = computed(() => isRounded.value ? '50px' : '0')

// ── Bandeiras helper ──
function badgeStyle(w: number, h: number, radius: string, color: string) {
  return {
    display: 'inline-block', width: `${w}px`, height: `${h}px`,
    borderRadius: radius, overflow: 'hidden', lineHeight: 0,
    boxShadow: `0 1px 4px ${withAlpha(color, 0.3)}`,
  }
}
</script>

<template>
  <!-- SEM RODAPE -->
  <template v-if="footerMode === 'nenhum'" />

  <footer v-else class="shrink-0 w-full">

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CAMADA 1: TEXTO_RODAPE — varia conforme modelo             -->
    <!-- ═══════════════════════════════════════════════════════════ -->

    <!-- ══════════════════════════════════════════════════ -->
    <!-- MODELO V1: bar-boxes (compacto, flex row)          -->
    <!-- ══════════════════════════════════════════════════ -->
    <div
      v-if="isV1"
      :style="{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        background: bgColor,
        flexWrap: 'nowrap',
        alignContent: 'space-around',
        color: textColor,
        minHeight: '80px',
      }"
    >
      <!-- Box: Delivery (telefone, whatsapp, endereco) -->
      <div
        v-if="whatsapp || endereco"
        :style="{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px',
          gap: '4px',
          borderRight: `1px solid ${withAlpha(textColor, 0.1)}`,
        }"
      >
        <div v-if="whatsapp" :style="{ display: 'flex', alignItems: 'center', gap: '6px' }">
          <span v-html="svgIcon('whatsapp', 16)" />
          <span :style="{ fontSize: phoneSize, fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
        </div>
        <span v-if="endereco" :style="{ fontSize: '10px', opacity: 0.7, textAlign: 'center', lineHeight: '1.3', fontFamily: bodyFont || 'inherit' }">{{ endereco }}</span>
        <span v-if="horario" :style="{ fontSize: '9px', opacity: 0.5, fontFamily: bodyFont || 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }">
          <span v-html="svgIcon('clock', 10, textColor)" />
          {{ horario }}
        </span>
      </div>

      <!-- Box: Redes sociais -->
      <div
        v-if="hasSocial"
        :style="{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '10px 14px',
          borderRight: `1px solid ${withAlpha(textColor, 0.1)}`,
        }"
      >
        <span v-if="facebook" v-html="svgIcon('facebook', 18)" :style="{ cursor: 'pointer' }" />
        <span v-if="instagram" v-html="svgIcon('instagram', 18)" :style="{ cursor: 'pointer' }" />
        <span v-html="svgIcon('thumbsUp', 16, primaryColor)" />
      </div>

      <!-- Box: Validade (opcional) -->
      <div
        v-if="hasDate"
        :style="{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px',
          gap: '2px',
          borderRight: `1px solid ${withAlpha(textColor, 0.1)}`,
        }"
      >
        <span :style="{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }">Ofertas validas</span>
        <span :style="{ fontSize: '11px', fontWeight: '700' }">{{ dataInicio }} a {{ dataFim }}</span>
      </div>

      <!-- Box: Empresa info + logo -->
      <div
        :style="{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px',
          gap: '4px',
        }"
      >
        <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain' }" />
        <span v-if="empresaNome" :style="{ fontWeight: nameWeight, fontSize: '14px', textTransform: nameTransform, fontFamily: nameFont || 'inherit', textAlign: 'center', lineHeight: '1.1' }">{{ empresaNome }}</span>
        <span v-if="empresaSlogan" :style="{ fontSize: '9px', opacity: 0.6, textAlign: 'center', fontFamily: bodyFont || 'inherit' }">{{ empresaSlogan }}</span>
      </div>

      <!-- Box: Bandeiras de pagamento -->
      <div
        v-if="activePayments.length"
        :style="{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          flexWrap: 'wrap',
          padding: '10px 14px',
          borderLeft: `1px solid ${withAlpha(textColor, 0.1)}`,
          maxWidth: '180px',
        }"
      >
        <span v-if="showPaymentLabel" :style="{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.4, width: '100%', textAlign: 'center', marginBottom: '2px' }">Aceitamos</span>
        <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(32, 20, '3px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- MODELO V2/V3: line-pag-validade (grid 3 areas)    -->
    <!-- V2 = border-radius arredondado / V3 = quadrado    -->
    <!-- ══════════════════════════════════════════════════ -->
    <div
      v-else
      :style="{
        display: 'grid',
        gridTemplateAreas: gridAreas,
        gridTemplateColumns: gridColumns,
        overflow: 'hidden',
        borderRadius: borderRadiusMain,
        background: primaryColor,
        color: 'black',
        fontSize: '14px',
        margin: isRounded ? '8px 8px 4px' : '0',
      }"
    >
      <!-- Area C: coluna esquerda (nome + slogan + logo) -->
      <div
        v-if="hasLeft"
        :style="{
          gridArea: 'C',
          background: 'white',
          borderRadius: borderRadiusMain,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px',
          gap: '4px',
          minHeight: '60px',
        }"
      >
        <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', marginBottom: '4px' }" />
        <span
          v-if="empresaNome"
          :style="{
            fontWeight: nameWeight,
            fontSize: nameSize,
            textTransform: nameTransform,
            fontFamily: nameFont || 'inherit',
            color: 'black',
            lineHeight: '1.1',
            letterSpacing: '0.5px',
          }"
        >{{ empresaNome }}</span>
        <span
          v-if="empresaSlogan"
          :style="{
            fontSize: '10px',
            color: 'rgba(0,0,0,0.55)',
            fontFamily: bodyFont || 'inherit',
          }"
        >{{ empresaSlogan }}</span>
      </div>

      <!-- Area R: coluna direita (line-chips) -->
      <div
        v-if="hasRight"
        :style="{
          gridArea: 'R',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '8px 12px',
          gap: '6px',
        }"
      >
        <!-- Cada chip: grid ICONE + ITEM -->
        <div
          v-for="chip in footerChips"
          :key="chip.key"
          :style="{
            display: 'grid',
            gridTemplateAreas: '\'ICONE ITEM-1\' \'ICONE ITEM-2\'',
            gridTemplateColumns: 'auto 1fr',
            alignItems: 'center',
            gap: '0 8px',
          }"
        >
          <!-- Icone do chip -->
          <div
            :style="{
              gridArea: 'ICONE',
              background: primaryColor,
              color: secondaryColor,
              borderRadius: borderRadiusChipIcon,
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }"
            v-html="svgIcon(chip.icon, 18, chip.iconColor)"
          />
          <!-- Linha 1 do chip -->
          <span
            :style="{
              gridArea: 'ITEM-1',
              fontSize: phoneSize,
              fontWeight: '700',
              fontFamily: bodyFont || 'inherit',
              color: 'black',
              lineHeight: '1.2',
              whiteSpace: 'nowrap',
            }"
          >{{ chip.line1 }}</span>
          <!-- Linha 2 (label) -->
          <span
            v-if="chip.line2"
            :style="{
              gridArea: 'ITEM-2',
              fontSize: '9px',
              color: 'rgba(0,0,0,0.5)',
              fontFamily: bodyFont || 'inherit',
              lineHeight: '1',
            }"
          >{{ chip.line2 }}</span>
        </div>

        <!-- Bandeiras inline nos chips (V2/V3) -->
        <div v-if="activePayments.length" :style="{ display: 'flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' }">
          <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(32, 20, isRounded ? '6px' : '2px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
        </div>
      </div>

      <!-- Area F: enderecos (barra inferior do grid) -->
      <div
        v-if="hasBottom"
        :style="{
          gridArea: 'F',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: secondaryColor,
          color: 'white',
          fontSize: '10px',
          padding: '6px 14px',
          gap: '8px',
          fontFamily: bodyFont || 'inherit',
        }"
      >
        <span :style="{ display: 'flex', alignItems: 'center', gap: '5px' }">
          <span v-html="svgIcon('location', 11, 'white')" />
          {{ endereco }}
        </span>
        <span v-if="horario" :style="{ display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.85 }">
          <span v-html="svgIcon('clock', 10, 'white')" />
          {{ horario }}
        </span>
        <span v-if="hasDate" :style="{ fontWeight: '700', fontSize: '11px' }">
          Ofertas validas de {{ dataInicio }} a {{ dataFim }}
        </span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ -->
    <!-- CAMADA 2: bar-end — igual em TODOS os modelos              -->
    <!-- Marca dagua + disclaimer                                   -->
    <!-- ═══════════════════════════════════════════════════════════ -->
    <div
      :style="{
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0,0,0,0.72)',
        color: 'white',
        height: isV1 ? '24px' : '20px',
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '8px',
        gap: '1px',
      }"
    >
      <span :style="{ opacity: 0.5, fontSize: '7px' }">Feito com ❤️ qrofertas.com</span>
      <span v-if="hasWarnings || ofertasTexto" :style="{ fontStyle: 'italic', opacity: 0.35, fontSize: '7px' }">
        <template v-if="showIlustrativa">*Imagens Meramente Ilustrativas. </template>
        <template v-if="showEstoque">Ofertas enquanto durarem os estoques. </template>
        <template v-if="showMedicamento">SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO. </template>
        <template v-if="ofertasTexto && !showEstoque">{{ ofertasTexto }}</template>
      </span>
    </div>

  </footer>
</template>
