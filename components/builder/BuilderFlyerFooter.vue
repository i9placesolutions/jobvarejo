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

// ── Tipografia ──
const nameFont = computed(() => (flyer.value as any)?.footer_name_font || '')
const bodyFont = computed(() => (flyer.value as any)?.footer_body_font || '')
const nameTransform = computed(() => (flyer.value as any)?.footer_name_transform || 'uppercase')
const bodyTransform = computed(() => (flyer.value as any)?.footer_body_transform || 'none')
const nameWeight = computed(() => (flyer.value as any)?.footer_name_weight || '900')
const nameSize = computed(() => ((flyer.value as any)?.footer_name_size || 20) + 'px')
const phoneSize = computed(() => ((flyer.value as any)?.footer_phone_size || 15) + 'px')
const socialSize = computed(() => ((flyer.value as any)?.footer_social_size || 11) + 'px')

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
const hasContact = computed(() => !!(whatsapp.value || endereco.value || horario.value))

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
  { key: 'dinheiro', label: 'Dinheiro', color: '#2d6a4f', text: '#fff' },
  { key: 'pix', label: 'PIX', color: '#00BD9D', text: '#fff' },
  { key: 'visa', label: 'VISA', color: '#1A1F71', text: '#fff' },
  { key: 'mastercard', label: 'Master', color: '#EB001B', text: '#fff' },
  { key: 'elo', label: 'Elo', color: '#FFCB05', text: '#000' },
  { key: 'hipercard', label: 'Hiper', color: '#822124', text: '#fff' },
  { key: 'alelo', label: 'Alelo', color: '#00A651', text: '#fff' },
  { key: 'sodexo', label: 'Sodexo', color: '#E31937', text: '#fff' },
  { key: 'ticket', label: 'Ticket', color: '#D61F26', text: '#fff' },
  { key: 'americanexpress', label: 'Amex', color: '#006FCF', text: '#fff' },
  { key: 'vr', label: 'VR', color: '#FF6600', text: '#fff' },
  { key: 'vale_alimentacao', label: 'V.A.', color: '#2E7D32', text: '#fff' },
  { key: 'cielo', label: 'Cielo', color: '#0066CC', text: '#fff' },
]
const activePayments = computed(() => PAYMENT_METHODS.filter(p => pay(p.key)))

// ── Datas ──
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('pt-BR') }
  catch { return dateStr }
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

function darken(hex: string, amount: number): string {
  return adjustColor(hex, -amount)
}

function withAlpha(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 0xFF
  const g = (num >> 8) & 0xFF
  const b = num & 0xFF
  return `rgba(${r},${g},${b},${alpha})`
}
</script>

<template>
  <!-- NENHUM -->
  <template v-if="footerMode === 'nenhum'" />

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- SIMPLES: barra compacta com accent line -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <footer v-else-if="footerMode === 'simples'" class="shrink-0 w-full">
    <!-- Accent gradient line -->
    <div :style="{ height: '4px', background: accentGradient, width: '100%' }" />
    <div
      :style="{
        background: gradientBg,
        padding: '16px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        color: textColor,
      }"
    >
      <!-- Logo + Nome -->
      <div style="display: flex; align-items: center; gap: 12px">
        <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain' }" />
        <span :style="{ fontWeight: nameWeight, fontSize: '16px', textTransform: nameTransform, fontFamily: nameFont || 'inherit', letterSpacing: '1px' }">
          {{ empresaNome }}
        </span>
      </div>
      <!-- Contatos -->
      <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap">
        <div v-if="whatsapp" style="display: flex; align-items: center; gap: 6px">
          <!-- WhatsApp SVG com glow -->
          <svg width="18" height="18" viewBox="0 0 24 24" :style="{ filter: 'drop-shadow(0 0 4px rgba(37,211,102,0.5))' }">
            <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>
          </svg>
          <span :style="{ fontSize: '14px', fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
        </div>
        <span v-if="endereco" :style="{ fontSize: '12px', fontFamily: bodyFont || 'inherit', opacity: 0.8 }">{{ endereco }}</span>
      </div>
      <!-- Bandeiras compactas -->
      <div v-if="activePayments.length" style="display: flex; gap: 3px; flex-wrap: wrap; align-items: center">
        <span
          v-for="pm in activePayments"
          :key="pm.key"
          :style="{ display: 'inline-block', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', lineHeight: 0 }"
          v-html="paymentBrandSvg[pm.key] || ''"
        ></span>
      </div>
    </div>
    <!-- Avisos micro -->
    <div v-if="hasWarnings" :style="{ background: darken(bgColor, 15), padding: '3px 28px', textAlign: 'center' }">
      <span :style="{ color: textColor, fontSize: '8px', fontStyle: 'italic', opacity: 0.4 }">
        <template v-if="showIlustrativa">*Imagens meramente ilustrativas. </template>
        <template v-if="showEstoque">Ofertas enquanto durarem os estoques. </template>
        <template v-if="showMedicamento">SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO.</template>
      </span>
    </div>
  </footer>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- PREMIUM -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <footer v-else class="shrink-0 w-full" style="position: relative; overflow: hidden">

    <!-- ── Onda SVG separadora com gradiente ── -->
    <svg viewBox="0 0 1440 50" preserveAspectRatio="none" style="display: block; width: 100%; height: 28px">
      <defs>
        <linearGradient :id="'wave-grad'" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="primaryColor" />
          <stop offset="100%" :stop-color="secondaryColor" />
        </linearGradient>
      </defs>
      <path :fill="bgColor" d="M0,50 L0,25 Q180,0 360,25 T720,25 T1080,25 T1440,25 L1440,50 Z" />
      <path fill="url(#wave-grad)" opacity="0.3" d="M0,50 L0,30 Q240,10 480,30 T960,30 T1440,30 L1440,50 Z" />
    </svg>

    <!-- ── Barra de validade de ofertas ── -->
    <div
      v-if="hasDate"
      :style="{
        background: accentGradient,
        padding: '10px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }"
    >
      <!-- Pattern decorativo sutil -->
      <div :style="{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(120deg, transparent, transparent 20px, rgba(255,255,255,0.04) 20px, rgba(255,255,255,0.04) 22px)', pointerEvents: 'none' }" />
      <span :style="{ color: '#fff', fontSize: phoneSize, fontWeight: '800', fontFamily: bodyFont || 'inherit', letterSpacing: '0.5px', textShadow: '0 1px 4px rgba(0,0,0,0.3)', position: 'relative', zIndex: 1 }">
        {{ dateLabel }} de {{ dataInicio }} ate {{ dataFim }}
      </span>
    </div>

    <!-- ── Corpo principal com fundo gradiente ── -->
    <div :style="{ background: gradientBg, width: '100%', position: 'relative' }">

      <!-- Pattern de fundo sutil -->
      <div :style="{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(${withAlpha(primaryColor, 0.06)} 1px, transparent 1px)`, backgroundSize: '20px 20px', pointerEvents: 'none' }" />

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- LAYOUT: CLASSICO (3 colunas com separadores) -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <template v-if="footerLayout === 'classico'">
        <!-- Faixa de redes sociais -->
        <div
          v-if="hasSocial"
          :style="{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', flexWrap: 'wrap',
            padding: '14px 28px',
            borderBottom: `1px solid ${withAlpha(textColor, 0.08)}`,
            position: 'relative',
          }"
        >
          <!-- WhatsApp -->
          <div v-if="whatsapp" style="display: flex; align-items: center; gap: 10px">
            <div :style="{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
              <svg width="20" height="20" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 4px rgba(37,211,102,0.4))">
                <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>
              </svg>
            </div>
            <div>
              <span v-if="whatsappLabel" :style="{ color: textColor, fontSize: '9px', opacity: 0.5, display: 'block', fontFamily: bodyFont || 'inherit', textTransform: bodyTransform }">{{ whatsappLabel }}</span>
              <span :style="{ color: textColor, fontSize: phoneSize, fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
            </div>
          </div>

          <!-- Facebook -->
          <div v-if="facebook" style="display: flex; align-items: center; gap: 8px">
            <div :style="{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(24,119,242,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit', textTransform: bodyTransform }">
              {{ showSocialLabels ? facebook : 'Facebook' }}
            </span>
          </div>

          <!-- Instagram -->
          <div v-if="instagram" style="display: flex; align-items: center; gap: 8px">
            <div :style="{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(245,133,41,0.15), rgba(221,42,123,0.15), rgba(129,52,175,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="url(#ig-g1)">
                <defs><linearGradient id="ig-g1" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </div>
            <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit', textTransform: bodyTransform }">
              {{ showSocialLabels ? '@' + instagram.replace(/^@/, '') : 'Instagram' }}
            </span>
          </div>
        </div>

        <!-- Grid principal 3 colunas -->
        <div :style="{ display: 'grid', gridTemplateColumns: hasContact ? '1fr auto 1.2fr auto 1fr' : '1fr auto 1fr', gap: '0', padding: '18px 28px', alignItems: 'center', position: 'relative' }">
          <!-- Col 1: Logo + Nome -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 8px">
            <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ maxHeight: footerLogoSize, maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }" />
            <span
              v-if="empresaNome"
              :style="{
                color: textColor, fontWeight: nameWeight, fontSize: nameSize,
                textTransform: nameTransform, fontFamily: nameFont || 'inherit',
                letterSpacing: '1.5px', textAlign: 'center', lineHeight: '1.1',
                textShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }"
            >{{ empresaNome }}</span>
          </div>

          <!-- Separador vertical gradiente -->
          <div :style="{ width: '2px', height: '50px', background: `linear-gradient(180deg, transparent, ${withAlpha(primaryColor, 0.5)}, transparent)`, alignSelf: 'center' }" />

          <!-- Col 2: Endereco + Horario -->
          <div v-if="hasContact" style="display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; padding: 0 12px">
            <div v-if="endereco" style="display: flex; align-items: flex-start; gap: 8px">
              <div :style="{ width: '28px', height: '28px', borderRadius: '8px', background: withAlpha(primaryColor, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }">
                <svg width="14" height="14" viewBox="0 0 24 24" :fill="primaryColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
              </div>
              <span :style="{ color: textColor, fontSize: '12px', fontFamily: bodyFont || 'inherit', textTransform: bodyTransform, opacity: 0.85, lineHeight: '1.4' }">{{ endereco }}</span>
            </div>
            <div v-if="horario" style="display: flex; align-items: center; gap: 8px">
              <div :style="{ width: '24px', height: '24px', borderRadius: '6px', background: withAlpha(primaryColor, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }">
                <svg width="12" height="12" viewBox="0 0 24 24" :fill="primaryColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
              </div>
              <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', textTransform: bodyTransform, opacity: 0.75 }">{{ horario }}</span>
            </div>
          </div>

          <!-- Separador vertical gradiente -->
          <div v-if="hasContact" :style="{ width: '2px', height: '50px', background: `linear-gradient(180deg, transparent, ${withAlpha(primaryColor, 0.5)}, transparent)`, alignSelf: 'center' }" />

          <!-- Col 3: Bandeiras de pagamento -->
          <div v-if="activePayments.length" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 8px">
            <span v-if="showPaymentLabel" :style="{ color: textColor, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.4, fontFamily: bodyFont || 'inherit' }">Aceitamos</span>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center">
              <span
                v-for="pm in activePayments"
                :key="pm.key"
                :style="{ display: 'inline-block', width: '42px', height: '28px', borderRadius: '5px', overflow: 'hidden', boxShadow: `0 2px 6px ${withAlpha(pm.color, 0.4)}`, lineHeight: 0 }"
                v-html="paymentBrandSvg[pm.key] || ''"
              ></span>
            </div>
          </div>
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- LAYOUT: MODERNO (cards com glass effect) -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <template v-else-if="footerLayout === 'moderno'">
        <div :style="{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }">

          <!-- Nome centralizado grande -->
          <div style="text-align: center">
            <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', margin: '0 auto 8px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }" />
            <span
              v-if="empresaNome"
              :style="{
                color: textColor, fontWeight: nameWeight, fontSize: nameSize,
                textTransform: nameTransform, fontFamily: nameFont || 'inherit',
                letterSpacing: '3px', display: 'block',
                textShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }"
            >{{ empresaNome }}</span>
            <!-- Linha accent abaixo do nome -->
            <div :style="{ width: '60px', height: '3px', background: accentGradient, borderRadius: '2px', margin: '8px auto 0' }" />
          </div>

          <!-- Row de cards glassmorphism -->
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap">
            <!-- Card WhatsApp -->
            <div
              v-if="whatsapp"
              :style="{
                background: withAlpha(textColor, 0.06),
                border: `1px solid ${withAlpha(textColor, 0.1)}`,
                borderRadius: '14px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: `0 4px 15px ${withAlpha(bgColor, 0.3)}`,
              }"
            >
              <div :style="{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
                <svg width="22" height="22" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 6px rgba(37,211,102,0.5))">
                  <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>
                </svg>
              </div>
              <div>
                <span v-if="whatsappLabel" :style="{ color: textColor, fontSize: '9px', opacity: 0.5, display: 'block', fontFamily: bodyFont || 'inherit' }">{{ whatsappLabel }}</span>
                <span :style="{ color: textColor, fontSize: phoneSize, fontWeight: '700', fontFamily: bodyFont || 'inherit' }">{{ whatsapp }}</span>
              </div>
            </div>

            <!-- Card Endereco -->
            <div
              v-if="endereco"
              :style="{
                background: withAlpha(textColor, 0.06),
                border: `1px solid ${withAlpha(textColor, 0.1)}`,
                borderRadius: '14px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: `0 4px 15px ${withAlpha(bgColor, 0.3)}`,
                maxWidth: '240px',
              }"
            >
              <div :style="{ width: '36px', height: '36px', borderRadius: '10px', background: withAlpha(primaryColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }">
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="primaryColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
              </div>
              <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', textTransform: bodyTransform, opacity: 0.85, lineHeight: '1.4' }">{{ endereco }}</span>
            </div>

            <!-- Card Horario -->
            <div
              v-if="horario"
              :style="{
                background: withAlpha(textColor, 0.06),
                border: `1px solid ${withAlpha(textColor, 0.1)}`,
                borderRadius: '14px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: '12px',
                boxShadow: `0 4px 15px ${withAlpha(bgColor, 0.3)}`,
              }"
            >
              <div :style="{ width: '32px', height: '32px', borderRadius: '8px', background: withAlpha(primaryColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }">
                <svg width="14" height="14" viewBox="0 0 24 24" :fill="primaryColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
              </div>
              <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', opacity: 0.85 }">{{ horario }}</span>
            </div>
          </div>

          <!-- Redes sociais (pills) -->
          <div v-if="hasSocial" style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap">
            <div v-if="facebook" style="display: flex; align-items: center; gap: 6px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">{{ showSocialLabels ? facebook : 'Facebook' }}</span>
            </div>
            <div v-if="instagram" style="display: flex; align-items: center; gap: 6px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="url(#ig-gm)">
                <defs><linearGradient id="ig-gm" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">{{ showSocialLabels ? '@' + instagram.replace(/^@/, '') : 'Instagram' }}</span>
            </div>
          </div>

          <!-- Bandeiras estilo pill -->
          <div v-if="activePayments.length" style="display: flex; align-items: center; justify-content: center; gap: 5px; flex-wrap: wrap">
            <span v-if="showPaymentLabel" :style="{ color: textColor, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.35, fontFamily: bodyFont || 'inherit', marginRight: '4px' }">Aceitamos</span>
            <span
              v-for="pm in activePayments"
              :key="pm.key"
              :style="{ display: 'inline-block', width: '40px', height: '26px', borderRadius: '6px', overflow: 'hidden', boxShadow: `0 2px 8px ${withAlpha(pm.color, 0.35)}`, lineHeight: 0 }"
              v-html="paymentBrandSvg[pm.key] || ''"
            ></span>
          </div>
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- LAYOUT: ELEGANTE (separadores dourados, tipografia refinada) -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <template v-else-if="footerLayout === 'elegante'">
        <div :style="{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }">

          <!-- Decoracao: linhas accent nos cantos -->
          <div :style="{ position: 'absolute', top: '12px', left: '16px', width: '40px', height: '2px', background: accentGradient, borderRadius: '1px' }" />
          <div :style="{ position: 'absolute', top: '12px', right: '16px', width: '40px', height: '2px', background: accentGradient, borderRadius: '1px' }" />

          <!-- Bloco central: Logo | Divisor | Info | Divisor | Social -->
          <div style="display: flex; align-items: center; gap: 20px; justify-content: center; flex-wrap: wrap">
            <!-- Logo -->
            <div v-if="logoUrl" style="flex-shrink: 0">
              <img :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }" />
            </div>

            <!-- Divisor gradiente -->
            <div :style="{ width: '2px', height: '52px', background: `linear-gradient(180deg, transparent, ${primaryColor}, transparent)`, flexShrink: 0 }" />

            <!-- Info central -->
            <div style="display: flex; flex-direction: column; gap: 4px">
              <span
                v-if="empresaNome"
                :style="{
                  color: textColor, fontWeight: nameWeight, fontSize: nameSize,
                  textTransform: nameTransform, fontFamily: nameFont || 'inherit',
                  letterSpacing: '4px', lineHeight: '1',
                }"
              >{{ empresaNome }}</span>
              <!-- Sub-accent line -->
              <div :style="{ width: '100%', height: '1px', background: `linear-gradient(90deg, transparent, ${withAlpha(primaryColor, 0.6)}, transparent)`, margin: '2px 0' }" />
              <div v-if="endereco" style="display: flex; align-items: center; gap: 6px">
                <svg width="11" height="11" viewBox="0 0 24 24" :fill="primaryColor" style="flex-shrink: 0"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
                <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit', opacity: 0.75, textTransform: bodyTransform }">{{ endereco }}</span>
              </div>
              <div v-if="horario" style="display: flex; align-items: center; gap: 6px">
                <svg width="10" height="10" viewBox="0 0 24 24" :fill="primaryColor" style="flex-shrink: 0"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                <span :style="{ color: textColor, fontSize: '10px', fontFamily: bodyFont || 'inherit', opacity: 0.6 }">{{ horario }}</span>
              </div>
            </div>

            <!-- Divisor -->
            <div v-if="hasSocial" :style="{ width: '2px', height: '52px', background: `linear-gradient(180deg, transparent, ${primaryColor}, transparent)`, flexShrink: 0 }" />

            <!-- Redes sociais vertical -->
            <div v-if="hasSocial" style="display: flex; flex-direction: column; gap: 6px">
              <div v-if="whatsapp" style="display: flex; align-items: center; gap: 8px">
                <svg width="18" height="18" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 4px rgba(37,211,102,0.4))">
                  <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>
                </svg>
                <span :style="{ color: textColor, fontSize: '13px', fontFamily: bodyFont || 'inherit', fontWeight: '700' }">{{ whatsapp }}</span>
              </div>
              <div v-if="instagram" style="display: flex; align-items: center; gap: 8px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="url(#ig-ge)">
                  <defs><linearGradient id="ig-ge" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit' }">@{{ instagram.replace(/^@/, '') }}</span>
              </div>
              <div v-if="facebook" style="display: flex; align-items: center; gap: 8px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span :style="{ color: textColor, fontSize: '11px', fontFamily: bodyFont || 'inherit' }">{{ facebook }}</span>
              </div>
            </div>
          </div>

          <!-- Pagamento com linha separadora accent -->
          <div v-if="activePayments.length">
            <div :style="{ width: '100%', height: '1px', background: `linear-gradient(90deg, transparent, ${withAlpha(primaryColor, 0.3)}, transparent)`, marginBottom: '10px' }" />
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px; flex-wrap: wrap">
              <span v-if="showPaymentLabel" :style="{ color: textColor, fontSize: '7px', textTransform: 'uppercase', letterSpacing: '2.5px', opacity: 0.3, fontFamily: bodyFont || 'inherit', marginRight: '6px' }">Aceitamos</span>
              <span
                v-for="pm in activePayments"
                :key="pm.key"
                :style="{ display: 'inline-block', width: '38px', height: '25px', borderRadius: '4px', overflow: 'hidden', boxShadow: `0 1px 4px ${withAlpha(pm.color, 0.3)}`, lineHeight: 0 }"
                v-html="paymentBrandSvg[pm.key] || ''"
              ></span>
            </div>
          </div>
        </div>
      </template>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- LAYOUT: BANNER (bloco gradiente de impacto maximo) -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <template v-else-if="footerLayout === 'banner'">
        <div :style="{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }">

          <!-- Bloco hero gradiente -->
          <div :style="{
            background: accentGradient,
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'space-between',
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 6px 20px ${withAlpha(primaryColor, 0.35)}`,
          }">
            <!-- Pattern overlay -->
            <div :style="{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent, transparent 30px, rgba(255,255,255,0.03) 30px, rgba(255,255,255,0.03) 32px)', pointerEvents: 'none' }" />
            <!-- Circulo decorativo -->
            <div :style="{ position: 'absolute', right: '-30px', top: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }" />

            <!-- Logo + Nome + Endereco -->
            <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; position: relative; z-index: 1">
              <img v-if="logoUrl" :src="logoUrl" alt="" :style="{ height: footerLogoSize, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }" />
              <div style="min-width: 0">
                <span
                  v-if="empresaNome"
                  :style="{
                    color: '#fff', fontWeight: nameWeight, fontSize: nameSize,
                    textTransform: nameTransform, fontFamily: nameFont || 'inherit',
                    letterSpacing: '1.5px', textShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    lineHeight: '1.1', display: 'block',
                  }"
                >{{ empresaNome }}</span>
                <span v-if="endereco" style="color: rgba(255,255,255,0.8); font-size: 10px; margin-top: 3px; display: block; line-height: 1.3">{{ endereco }}</span>
              </div>
            </div>

            <!-- WhatsApp destaque com glow -->
            <div
              v-if="whatsapp"
              :style="{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '14px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', gap: '12px',
                flexShrink: 0, position: 'relative', zIndex: 1,
                border: '1px solid rgba(255,255,255,0.1)',
              }"
            >
              <div :style="{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(37,211,102,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
                <svg width="26" height="26" viewBox="0 0 24 24" style="filter: drop-shadow(0 0 8px rgba(37,211,102,0.6))">
                  <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path fill="#25D366" d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.649-1.466A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-2.16 0-4.16-.69-5.795-1.86l-.405-.27-2.76.87.87-2.67-.295-.44A9.726 9.726 0 012.25 12 9.75 9.75 0 0112 2.25 9.75 9.75 0 0121.75 12 9.75 9.75 0 0112 21.75z"/>
                </svg>
              </div>
              <div>
                <span v-if="whatsappLabel" style="color: rgba(255,255,255,0.6); font-size: 9px; display: block">{{ whatsappLabel }}</span>
                <span :style="{ color: '#fff', fontSize: '20px', fontWeight: '800', fontFamily: bodyFont || 'inherit', letterSpacing: '0.5px' }">{{ whatsapp }}</span>
              </div>
            </div>
          </div>

          <!-- Linha inferior: redes + pagamentos -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 0 4px">
            <!-- Redes sociais -->
            <div style="display: flex; gap: 18px; align-items: center">
              <div v-if="instagram" style="display: flex; align-items: center; gap: 6px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="url(#ig-gb)">
                  <defs><linearGradient id="ig-gb" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
                <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">@{{ instagram.replace(/^@/, '') }}</span>
              </div>
              <div v-if="facebook" style="display: flex; align-items: center; gap: 6px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                <span :style="{ color: textColor, fontSize: socialSize, fontFamily: bodyFont || 'inherit' }">{{ facebook }}</span>
              </div>
              <span v-if="horario" :style="{ color: textColor, fontSize: '10px', fontFamily: bodyFont || 'inherit', opacity: 0.6 }">{{ horario }}</span>
            </div>

            <!-- Bandeiras compactas -->
            <div v-if="activePayments.length" style="display: flex; gap: 3px; flex-wrap: wrap">
              <span
                v-for="pm in activePayments"
                :key="pm.key"
                :style="{ display: 'inline-block', width: '40px', height: '26px', borderRadius: '5px', overflow: 'hidden', boxShadow: `0 1px 4px ${withAlpha(pm.color, 0.3)}`, lineHeight: 0 }"
                v-html="paymentBrandSvg[pm.key] || ''"
              ></span>
            </div>
          </div>
        </div>
      </template>

    </div>

    <!-- ── Barra final de avisos legais ── -->
    <div
      v-if="hasWarnings || ofertasTexto"
      :style="{
        background: darken(bgColor, 15),
        padding: '4px 28px',
        textAlign: 'center',
        width: '100%',
      }"
    >
      <span :style="{ color: textColor, fontSize: '8px', fontStyle: 'italic', opacity: 0.35, fontFamily: bodyFont || 'inherit' }">
        <template v-if="showIlustrativa">*Imagens meramente ilustrativas. </template>
        <template v-if="showEstoque">Ofertas validas enquanto durarem os estoques. </template>
        <template v-if="showMedicamento">SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO. </template>
        <template v-if="ofertasTexto && !showEstoque">{{ ofertasTexto }}</template>
      </span>
    </div>
  </footer>
</template>
