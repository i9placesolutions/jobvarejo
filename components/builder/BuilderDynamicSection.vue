<script setup lang="ts">
/**
 * Renderizador generico de template de secao (header ou footer).
 * Recebe um template JSON com elementos posicionados e preenche
 * os slots com dados da empresa/flyer.
 */
import type { BuilderSectionTemplate, CardTemplateElement } from '~/types/builder'
import { paymentBrandSvg } from '~/utils/paymentBrandSvg'

const props = defineProps<{
  template: BuilderSectionTemplate
  section: 'header' | 'footer'
}>()

const { flyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)

// ── Resolver dados da empresa para os slots ──
const resolveSlot = (slot: string): string => {
  const f = flyer.value as any
  const t = tenant.value as any
  const map: Record<string, string> = {
    // Header slots
    logo: '', // imagem, tratado separadamente
    background_image: '', // imagem
    company_name: fc.value.footer_empresa_nome || t?.name || '',
    slogan: t?.slogan || '',
    promo_phrase: f?.promo_phrase || '',
    // Footer slots
    whatsapp: fc.value.footer_whatsapp || t?.whatsapp || '',
    phone: t?.phone || '',
    address: fc.value.footer_endereco || t?.address || '',
    hours: fc.value.footer_horario || '',
    instagram: fc.value.footer_instagram || t?.instagram || '',
    facebook: fc.value.footer_facebook || t?.facebook || '',
    social: [
      fc.value.footer_instagram || t?.instagram ? `@${(fc.value.footer_instagram || t?.instagram || '').replace(/^@/, '')}` : '',
      fc.value.footer_facebook || t?.facebook || '',
    ].filter(Boolean).join('  '),
    validity: f?.show_dates && f?.start_date && f?.end_date
      ? `Ofertas validas de ${fmtDate(f.start_date)} ate ${fmtDate(f.end_date)}`
      : '',
    disclaimer: buildDisclaimer(),
    payments: '', // tratado como bandeiras visuais
  }
  return map[slot] || ''
}

const fmtDate = (d: string): string => {
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
}

const buildDisclaimer = (): string => {
  const parts: string[] = []
  const f = flyer.value as any
  if (f?.show_illustrative_note) parts.push('*Imagens meramente ilustrativas.')
  if (f?.show_stock_warning) parts.push('Ofertas enquanto durarem os estoques.')
  if (f?.show_medicine_warning) parts.push('SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO.')
  if (fc.value.footer_ofertas_texto && !f?.show_stock_warning) parts.push(fc.value.footer_ofertas_texto)
  return parts.join(' ')
}

// ── Imagens (logo, background) ──
const resolveImageUrl = (slot: string): string | null => {
  if (slot === 'logo') {
    const logo = (flyer.value as any)?.custom_logo || (tenant.value as any)?.logo
    if (!logo) return null
    if (logo.startsWith('/api/') || logo.startsWith('http')) return logo
    return `/api/storage/p?key=${encodeURIComponent(logo)}`
  }
  if (slot === 'background_image') {
    const img = (flyer.value as any)?.theme?.header_config?.backgroundImage
    if (!img) return null
    if (img.startsWith('/api/') || img.startsWith('http')) return img
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return null
}

// ── Bandeiras de pagamento ──
const pay = (key: string) => {
  const val = fc.value[`footer_pay_${key}`]
  if (val === undefined) return ['dinheiro', 'pix', 'visa', 'mastercard', 'elo'].includes(key)
  return !!val
}
const PAYMENT_KEYS = ['dinheiro', 'pix', 'visa', 'mastercard', 'elo', 'hipercard', 'alelo', 'sodexo', 'ticket', 'americanexpress', 'vr', 'vale_alimentacao', 'cielo']
const activePaymentKeys = computed(() => PAYMENT_KEYS.filter(k => pay(k)))

// ── Verificar se deve exibir ──
const shouldShow = (el: CardTemplateElement): boolean => {
  if (!el.showIf || el.showIf === 'always') return true
  if (el.showIf === 'has_value') {
    if (el.type === 'image') return !!resolveImageUrl(el.slot)
    if (el.slot === 'payments') return activePaymentKeys.value.length > 0
    return !!resolveSlot(el.slot)
  }
  return true
}

// ── Cores do tema ──
const primaryColor = computed(() => (flyer.value as any)?.footer_primary || fc.value.footer_primary || '#e85d04')
const secondaryColor = computed(() => (flyer.value as any)?.footer_secondary || fc.value.footer_secondary || '#f48c06')
const headerBg = computed(() => (flyer.value as any)?.theme?.css_config?.headerBg || '#ffffff')
const footerBg = computed(() => (flyer.value as any)?.footer_bg || fc.value.footer_bg || '#1a1a2e')
const textColor = computed(() => (flyer.value as any)?.footer_text_color || '#ffffff')
const footerLogoSize = computed(() => ((flyer.value as any)?.footer_logo_size || 52) + 'px')

// ── Resolver CSS variables nos estilos ──
const resolveVars = (val: string | undefined): string | undefined => {
  if (!val) return val
  return val
    .replace(/var\(--primary[^)]*\)/g, primaryColor.value)
    .replace(/var\(--secondary[^)]*\)/g, secondaryColor.value)
    .replace(/var\(--header-bg[^)]*\)/g, headerBg.value)
    .replace(/var\(--footer-bg[^)]*\)/g, footerBg.value)
    .replace(/var\(--card-bg[^)]*\)/g, '#ffffff')
}

// ── Estilo do container ──
const containerStyle = computed(() => {
  const s = props.template.container_style || {}
  return {
    position: 'relative' as const,
    width: '100%',
    height: `${props.template.height || 180}px`,
    background: resolveVars(s.bg) || (props.section === 'header' ? headerBg.value : footerBg.value),
    borderRadius: s.borderRadius || '0',
    overflow: s.overflow || 'hidden',
    color: textColor.value,
    flexShrink: 0,
  }
})

// ── Estilo de cada elemento ──
const elementStyle = (el: CardTemplateElement) => ({
  position: 'absolute' as const,
  left: el.x, top: el.y, width: el.w, height: el.h,
  fontSize: el.fontSize === 'auto' ? undefined : el.fontSize,
  fontWeight: el.fontWeight,
  fontFamily: el.fontFamily || fc.value.name_font_family || 'inherit',
  textAlign: el.textAlign as any,
  textTransform: el.textTransform as any,
  color: resolveVars(el.color) || 'inherit',
  background: resolveVars(el.bg),
  borderRadius: el.borderRadius,
  overflow: el.overflow || 'hidden',
  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  zIndex: el.zIndex,
  opacity: el.opacity,
  boxShadow: el.boxShadow,
  display: shouldShow(el) ? 'flex' : 'none',
  alignItems: 'center',
  justifyContent: el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start',
  lineHeight: '1.2',
  wordBreak: 'break-word' as const,
})
</script>

<template>
  <div :style="containerStyle">
    <template v-for="el in template.elements" :key="el.id">

      <!-- IMAGEM (logo, background) -->
      <div v-if="el.type === 'image' && resolveImageUrl(el.slot)" :style="elementStyle(el)">
        <img
          :src="resolveImageUrl(el.slot)!"
          alt=""
          :style="{
            width: el.slot === 'logo' ? footerLogoSize : '100%',
            height: el.slot === 'logo' ? footerLogoSize : '100%',
            objectFit: (el.objectFit || 'contain') as any,
            maxWidth: '100%', maxHeight: '100%',
          }"
        />
      </div>

      <!-- TEXTO (qualquer slot de texto) -->
      <div v-else-if="el.type === 'text' && el.slot === 'payments'" :style="elementStyle(el)">
        <div style="display: flex; gap: 3px; flex-wrap: wrap; align-items: center; justify-content: center">
          <span
            v-for="pk in activePaymentKeys" :key="pk"
            :style="{ display: 'inline-block', width: '36px', height: '24px', borderRadius: '4px', overflow: 'hidden', lineHeight: 0 }"
            v-html="paymentBrandSvg[pk]"
          />
        </div>
      </div>

      <div v-else-if="el.type === 'text' && shouldShow(el)" :style="elementStyle(el)">
        {{ resolveSlot(el.slot) }}
      </div>

      <!-- SHAPE / SEPARATOR (decorativo) -->
      <div v-else-if="(el.type === 'shape' || el.type === 'separator')" :style="elementStyle(el)" />

    </template>
  </div>
</template>
