<script setup lang="ts">
import { paymentBrandSvg } from '~/utils/paymentBrandSvg'

const { flyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const footerMode = computed(() => fc.value.footer_mode || 'premium')
const footerLayout = computed(() => (flyer.value as any)?.footer_layout || 'classico')

// ── Cores ──
const bgColor = computed(() => (flyer.value as any)?.footer_bg || fc.value.footer_bg || '#1a1a2e')
const textColor = computed(() => (flyer.value as any)?.footer_text_color || '#ffffff')
const primaryColor = computed(() => (flyer.value as any)?.footer_primary || fc.value.footer_primary || '#e85d04')
const secondaryColor = computed(() => (flyer.value as any)?.footer_secondary || fc.value.footer_secondary || '#f48c06')

// ── Tipografia (hierarquia corrigida: 26 > 14 > 10) ──
const nameFont = computed(() => (flyer.value as any)?.footer_name_font || '')
const bodyFont = computed(() => (flyer.value as any)?.footer_body_font || '')
const nameTransform = computed(() => (flyer.value as any)?.footer_name_transform || 'uppercase')
const bodyTransform = computed(() => (flyer.value as any)?.footer_body_transform || 'none')
const nameWeight = computed(() => (flyer.value as any)?.footer_name_weight || '900')
const nameSize = computed(() => ((flyer.value as any)?.footer_name_size || 26) + 'px')
const phoneSize = computed(() => ((flyer.value as any)?.footer_phone_size || 14) + 'px')
const socialSize = computed(() => ((flyer.value as any)?.footer_social_size || 10) + 'px')

// ── Toggles ──
const showLogo = computed(() => (flyer.value as any)?.footer_show_logo ?? true)
const showSocialLabels = computed(() => (flyer.value as any)?.footer_show_social_labels ?? true)
const showPaymentLabel = computed(() => (flyer.value as any)?.footer_show_payment_label ?? true)
const whatsappLabel = computed(() => (flyer.value as any)?.footer_whatsapp_label || '')
const phoneLabel = computed(() => (flyer.value as any)?.footer_phone_label || '')
const dateLabel = computed(() => (flyer.value as any)?.footer_date_label || 'Ofertas validas')

// ── Dados da empresa ──
const whatsapp = computed(() => fc.value.footer_whatsapp || (tenant.value as any)?.whatsapp || '')
const facebook = computed(() => fc.value.footer_facebook || (tenant.value as any)?.facebook || '')
const instagram = computed(() => fc.value.footer_instagram || (tenant.value as any)?.instagram || '')
const empresaNome = computed(() => fc.value.footer_empresa_nome || (tenant.value as any)?.name || '')
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

// ── Bandeiras ──
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
const gradientBg = computed(() => `linear-gradient(160deg, ${bgColor.value} 0%, ${adjustColor(bgColor.value, 15)} 50%, ${adjustColor(bgColor.value, 30)} 100%)`)
const accentGradient = computed(() => `linear-gradient(90deg, ${primaryColor.value}, ${secondaryColor.value})`)

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

// ── Icones SVG deduplicados ──
const ICON = {
  whatsapp: `<path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>`,
  facebook: `<path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`,
  instagram: `<defs><linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs><path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>`,
  location: `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>`,
  clock: `<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>`,
}

function icon(name: keyof typeof ICON, size: number, fill?: string): string {
  const f = fill ? ` fill="${fill}"` : ''
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${f}>${ICON[name]}</svg>`
}

// ── Computed styles reutilizaveis ──
const glassCard = computed(() => ({
  background: `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))`,
  border: `1px solid rgba(255,255,255,0.15)`,
  borderRadius: '16px',
  boxShadow: `0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)`,
  padding: '14px 20px',
  display: 'flex', alignItems: 'center', gap: '12px',
}))

const socialPill = computed(() => ({
  background: 'rgba(255,255,255,0.08)',
  borderRadius: '20px',
  padding: '6px 14px',
  display: 'flex', alignItems: 'center', gap: '6px',
}))

function badgeStyle(w: number, h: number, radius: string, color: string) {
  return {
    display: 'inline-block', width: `${w}px`, height: `${h}px`,
    borderRadius: radius, overflow: 'hidden', lineHeight: 0,
    boxShadow: `0 1px 4px ${withAlpha(color, 0.3)}`,
  }
}
</script>

<template>
  <!-- NENHUM -->
  <template v-if="footerMode === 'nenhum'" />

  <!-- ═════════════════════════════════════════════════════ -->
  <!-- SIMPLES: barra compacta -->
  <!-- ═════════════════════════════════════════════════════ -->
  <footer v-else-if="footerMode === 'simples'" class="shrink-0 w-full">
    <div :style="{ height: '3px', background: accentGradient }" />
    <div :style="{ background: gradientBg, padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', color: textColor }">
      <div style="display: flex; align-items: center; gap: 12px">
        <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain' }" />
        <span :style="{ fontWeight: nameWeight, fontSize: nameSize, textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '1px' }">{{ empresaNome }}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
        <span v-if="whatsapp" style="display: flex; align-items: center; gap: 6px" v-html="icon('whatsapp', 16) + `<span style='font-size:14px;font-weight:700'>${whatsapp}</span>`" />
        <span v-if="endereco" :style="{ fontSize: '11px', opacity: 0.8 }">{{ endereco }}</span>
      </div>
      <div v-if="activePayments.length" style="display: flex; gap: 3px; flex-wrap: wrap">
        <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(36, 24, '4px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
      </div>
    </div>
    <div v-if="hasWarnings" :style="{ background: darken(bgColor, 15), padding: '3px 28px', textAlign: 'center' }">
      <span :style="{ color: textColor, fontSize: '8px', fontStyle: 'italic', opacity: 0.4 }">
        <template v-if="showIlustrativa">*Imagens meramente ilustrativas. </template>
        <template v-if="showEstoque">Ofertas enquanto durarem os estoques. </template>
        <template v-if="showMedicamento">SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO.</template>
      </span>
    </div>
  </footer>

  <!-- ═════════════════════════════════════════════════════ -->
  <!-- PREMIUM (4 layouts) -->
  <!-- ═════════════════════════════════════════════════════ -->
  <footer v-else class="shrink-0 w-full">

    <!-- ══════════════════════════════════════════════════ -->
    <!-- CLASSICO: faixas horizontais (estilo supermercado BR) -->
    <!-- ══════════════════════════════════════════════════ -->
    <template v-if="footerLayout === 'classico'">
      <!-- Separador: linha accent 3px -->
      <div :style="{ height: '3px', background: accentGradient }" />

      <!-- Faixa social (topo, fina, escura) -->
      <div v-if="hasSocial" :style="{ background: darken(bgColor, 20), padding: '6px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }">
        <span v-if="whatsapp" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }" v-html="icon('whatsapp', 12) + whatsapp" />
        <span v-if="instagram" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }" v-html="icon('instagram', 12) + (showSocialLabels ? '@' + instagram.replace(/^@/, '') : 'Instagram')" />
        <span v-if="facebook" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }" v-html="icon('facebook', 12) + (showSocialLabels ? facebook : 'Facebook')" />
      </div>

      <!-- Faixa principal: Logo + Nome + WhatsApp + Bandeiras (HORIZONTAL) -->
      <div :style="{ background: accentGradient, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }">
        <!-- Logo + Nome -->
        <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0">
          <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }" />
          <span :style="{ color: '#fff', fontWeight: nameWeight, fontSize: nameSize, textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '1.5px', textShadow: '0 1px 3px rgba(0,0,0,0.3)', lineHeight: '1.1' }">{{ empresaNome }}</span>
        </div>
        <!-- WhatsApp destaque -->
        <div v-if="whatsapp" :style="{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '8px 14px', flexShrink: 0 }">
          <span v-html="icon('whatsapp', 20)" />
          <div>
            <span v-if="whatsappLabel" style="color: rgba(255,255,255,0.7); font-size: 8px; display: block">{{ whatsappLabel }}</span>
            <span :style="{ color: '#fff', fontSize: '16px', fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
          </div>
        </div>
        <!-- Bandeiras inline -->
        <div v-if="activePayments.length" style="display: flex; gap: 3px; flex-wrap: wrap; flex-shrink: 0">
          <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(36, 24, '4px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
        </div>
      </div>

      <!-- Faixa endereco + horario -->
      <div v-if="endereco || horario" :style="{ background: bgColor, padding: '6px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }">
        <span v-if="endereco" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: '10px', opacity: 0.7, fontFamily: bodyFont || 'inherit' }" v-html="icon('location', 11, primaryColor) + endereco" />
        <span v-if="horario" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: '10px', opacity: 0.6, fontFamily: bodyFont || 'inherit' }" v-html="icon('clock', 10, primaryColor) + horario" />
      </div>

      <!-- Faixa validade -->
      <div v-if="hasDate" :style="{ background: darken(bgColor, 5), padding: '5px 24px', textAlign: 'center' }">
        <span :style="{ color: textColor, fontSize: '12px', fontWeight: '700', fontFamily: bodyFont || 'inherit', opacity: 0.9 }">{{ dateLabel }} de {{ dataInicio }} ate {{ dataFim }}</span>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- MODERNO: cards fake-glass, tudo centralizado -->
    <!-- ══════════════════════════════════════════════════ -->
    <template v-else-if="footerLayout === 'moderno'">
      <div :style="{ height: '4px', background: accentGradient }" />

      <!-- Barra validade (topo) -->
      <div v-if="hasDate" :style="{ background: darken(bgColor, 10), padding: '7px 28px', textAlign: 'center' }">
        <span :style="{ color: textColor, fontSize: '12px', fontWeight: '700', fontFamily: bodyFont || 'inherit', opacity: 0.85 }">{{ dateLabel }} de {{ dataInicio }} ate {{ dataFim }}</span>
      </div>

      <div :style="{ background: gradientBg, padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }">
        <!-- Logo + Nome + accent underline -->
        <div style="text-align: center">
          <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', margin: '0 auto 8px', display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }" />
          <span v-if="empresaNome" :style="{ color: textColor, fontWeight: nameWeight, fontSize: nameSize, textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '3px', display: 'block', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }">{{ empresaNome }}</span>
          <div :style="{ width: '60px', height: '3px', background: accentGradient, borderRadius: '2px', margin: '8px auto 0' }" />
        </div>

        <!-- Row de cards fake-glass -->
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap">
          <div v-if="whatsapp" :style="glassCard">
            <div :style="{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }" v-html="icon('whatsapp', 22)" />
            <div>
              <span v-if="whatsappLabel" :style="{ color: textColor, fontSize: '9px', opacity: 0.5, display: 'block' }">{{ whatsappLabel }}</span>
              <span :style="{ color: textColor, fontSize: phoneSize, fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
            </div>
          </div>
          <div v-if="endereco" :style="{ ...glassCard, maxWidth: '220px' }">
            <div :style="{ width: '36px', height: '36px', borderRadius: '10px', background: withAlpha(primaryColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }" v-html="icon('location', 16, primaryColor)" />
            <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', opacity: 0.85, lineHeight: '1.4' }">{{ endereco }}</span>
          </div>
          <div v-if="horario" :style="glassCard">
            <div :style="{ width: '32px', height: '32px', borderRadius: '8px', background: withAlpha(primaryColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }" v-html="icon('clock', 14, primaryColor)" />
            <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', opacity: 0.85 }">{{ horario }}</span>
          </div>
        </div>

        <!-- Social pills -->
        <div v-if="hasSocial" style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap">
          <div v-if="facebook" :style="socialPill">
            <span v-html="icon('facebook', 14)" />
            <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">{{ showSocialLabels ? facebook : 'Facebook' }}</span>
          </div>
          <div v-if="instagram" :style="socialPill">
            <span v-html="icon('instagram', 14)" />
            <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">{{ showSocialLabels ? '@' + instagram.replace(/^@/, '') : 'Instagram' }}</span>
          </div>
        </div>

        <!-- Bandeiras pill -->
        <div v-if="activePayments.length" style="display: flex; align-items: center; justify-content: center; gap: 5px; flex-wrap: wrap">
          <span v-if="showPaymentLabel" :style="{ color: textColor, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.35, marginRight: '4px' }">Aceitamos</span>
          <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(38, 25, '8px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- ELEGANTE: horizontal minimalista, divisores finos -->
    <!-- ══════════════════════════════════════════════════ -->
    <template v-else-if="footerLayout === 'elegante'">
      <!-- Separador duplo accent -->
      <div :style="{ height: '2px', background: accentGradient }" />
      <div :style="{ height: '1px', background: withAlpha(primaryColor, 0.3), marginTop: '2px' }" />

      <!-- Validade em cor accent -->
      <div v-if="hasDate" :style="{ background: darken(bgColor, 5), padding: '6px 36px', textAlign: 'center' }">
        <span :style="{ color: primaryColor, fontSize: '11px', fontWeight: '700', fontFamily: bodyFont || 'inherit', letterSpacing: '1.5px', textTransform: 'uppercase' }">{{ dateLabel }} de {{ dataInicio }} ate {{ dataFim }}</span>
      </div>

      <div :style="{ background: gradientBg, padding: '24px 36px' }">
        <!-- Row horizontal com divisores finos -->
        <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }">
          <!-- Logo -->
          <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }" />

          <!-- Divisor vertical fino -->
          <div v-if="logoUrl" :style="{ width: '1px', height: '50px', background: `linear-gradient(180deg, transparent, ${withAlpha(primaryColor, 0.5)}, transparent)` }" />

          <!-- Nome + endereco + horario -->
          <div style="display: flex; flex-direction: column; gap: 4px">
            <span v-if="empresaNome" :style="{ color: textColor, fontWeight: nameWeight, fontSize: nameSize, textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '5px', lineHeight: '1' }">{{ empresaNome }}</span>
            <div :style="{ height: '1px', background: `linear-gradient(90deg, transparent, ${withAlpha(primaryColor, 0.5)}, transparent)`, margin: '2px 0' }" />
            <span v-if="endereco" :style="{ color: textColor, fontSize: '10px', fontFamily: bodyFont || 'inherit', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '5px' }" v-html="icon('location', 10, primaryColor) + endereco" />
            <span v-if="horario" :style="{ color: textColor, fontSize: '9px', fontFamily: bodyFont || 'inherit', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '5px' }" v-html="icon('clock', 9, primaryColor) + horario" />
          </div>

          <!-- Divisor -->
          <div v-if="hasSocial" :style="{ width: '1px', height: '50px', background: `linear-gradient(180deg, transparent, ${withAlpha(primaryColor, 0.5)}, transparent)` }" />

          <!-- Contatos (bare icons, sem caixa) -->
          <div v-if="hasSocial" style="display: flex; flex-direction: column; gap: 5px">
            <span v-if="whatsapp" :style="{ display: 'flex', alignItems: 'center', gap: '7px', color: textColor, fontSize: '13px', fontWeight: '600', fontFamily: bodyFont || 'inherit' }" v-html="icon('whatsapp', 16) + whatsapp" />
            <span v-if="instagram" :style="{ display: 'flex', alignItems: 'center', gap: '7px', color: textColor, fontSize: '10px', fontFamily: bodyFont || 'inherit', opacity: 0.8 }" v-html="icon('instagram', 13) + '@' + instagram.replace(/^@/, '')" />
            <span v-if="facebook" :style="{ display: 'flex', alignItems: 'center', gap: '7px', color: textColor, fontSize: '10px', fontFamily: bodyFont || 'inherit', opacity: 0.8 }" v-html="icon('facebook', 13) + facebook" />
          </div>
        </div>

        <!-- Bandeiras separadas por linha accent -->
        <div v-if="activePayments.length" style="margin-top: 12px">
          <div :style="{ height: '1px', background: `linear-gradient(90deg, transparent, ${withAlpha(primaryColor, 0.25)}, transparent)`, marginBottom: '10px' }" />
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap">
            <span v-if="showPaymentLabel" :style="{ color: textColor, fontSize: '7px', textTransform: 'uppercase', letterSpacing: '3px', opacity: 0.3, marginRight: '6px' }">Aceitamos</span>
            <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(34, 22, '4px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════════════════════════════════════ -->
    <!-- BANNER: hero accent + CTA WhatsApp gigante -->
    <!-- ══════════════════════════════════════════════════ -->
    <template v-else-if="footerLayout === 'banner'">
      <!-- Corte diagonal -->
      <svg viewBox="0 0 1440 24" preserveAspectRatio="none" style="display: block; width: 100%; height: 16px">
        <polygon :fill="primaryColor" points="0,24 1440,0 1440,24" />
      </svg>

      <!-- Hero block (accent gradient, edge-to-edge) -->
      <div :style="{ background: accentGradient, padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }">
        <!-- Circulo decorativo -->
        <div :style="{ position: 'absolute', right: '-40px', top: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }" />

        <!-- Logo + Nome + Endereco -->
        <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; position: relative; z-index: 1">
          <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }" />
          <div style="min-width: 0">
            <span v-if="empresaNome" :style="{ color: '#fff', fontWeight: nameWeight, fontSize: `calc(${nameSize} + 6px)`, textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '1.5px', textShadow: '0 3px 8px rgba(0,0,0,0.3)', lineHeight: '1.1', display: 'block' }">{{ empresaNome }}</span>
            <span v-if="endereco" style="color: rgba(255,255,255,0.8); font-size: 10px; margin-top: 3px; display: block; line-height: 1.3">{{ endereco }}</span>
          </div>
        </div>

        <!-- CTA WhatsApp -->
        <div v-if="whatsapp" :style="{ background: 'rgba(0,0,0,0.25)', borderRadius: '16px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, position: 'relative', zIndex: 1, border: '1px solid rgba(255,255,255,0.1)' }">
          <div :style="{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,211,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
            <span v-html="icon('whatsapp', 28)" style="filter: drop-shadow(0 0 8px rgba(37,211,102,0.6))" />
          </div>
          <div>
            <span v-if="whatsappLabel" style="color: rgba(255,255,255,0.6); font-size: 9px; display: block">{{ whatsappLabel }}</span>
            <span :style="{ color: '#fff', fontSize: '22px', fontWeight: '800', fontFamily: bodyFont || 'inherit', letterSpacing: '0.5px' }">{{ whatsapp }}</span>
          </div>
        </div>
      </div>

      <!-- Strip info (fundo escuro) -->
      <div :style="{ background: bgColor, padding: '8px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }">
        <!-- Redes sociais -->
        <div style="display: flex; gap: 16px; align-items: center">
          <span v-if="instagram" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }" v-html="icon('instagram', 14) + '@' + instagram.replace(/^@/, '')" />
          <span v-if="facebook" :style="{ display: 'flex', alignItems: 'center', gap: '5px', color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }" v-html="icon('facebook', 14) + facebook" />
          <span v-if="horario" :style="{ color: textColor, fontSize: '10px', opacity: 0.6, fontFamily: bodyFont || 'inherit' }">{{ horario }}</span>
        </div>
        <!-- Bandeiras -->
        <div v-if="activePayments.length" style="display: flex; gap: 3px; flex-wrap: wrap">
          <span v-for="pm in activePayments" :key="pm.key" :style="badgeStyle(38, 25, '5px', pm.color)" v-html="paymentBrandSvg[pm.key]" />
        </div>
      </div>

      <!-- Validade diagonal -->
      <div v-if="hasDate" :style="{ background: accentGradient, padding: '6px 32px', textAlign: 'center', clipPath: 'polygon(1% 0, 100% 0, 99% 100%, 0 100%)' }">
        <span :style="{ color: '#fff', fontSize: '12px', fontWeight: '800', fontFamily: bodyFont || 'inherit', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }">{{ dateLabel }} de {{ dataInicio }} ate {{ dataFim }}</span>
      </div>
    </template>

    <!-- ── Disclaimer (compartilhado por todos os layouts premium) ── -->
    <div v-if="hasWarnings || ofertasTexto" :style="{ background: darken(bgColor, 15), padding: '4px 28px', textAlign: 'center' }">
      <span :style="{ color: textColor, fontSize: '8px', fontStyle: 'italic', opacity: 0.35, fontFamily: bodyFont || 'inherit' }">
        <template v-if="showIlustrativa">*Imagens meramente ilustrativas. </template>
        <template v-if="showEstoque">Ofertas validas enquanto durarem os estoques. </template>
        <template v-if="showMedicamento">SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO. </template>
        <template v-if="ofertasTexto && !showEstoque">{{ ofertasTexto }}</template>
      </span>
    </div>
  </footer>
</template>
