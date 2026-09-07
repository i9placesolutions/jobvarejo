<script setup lang="ts">
import type { BuilderThemeBusinessField, BuilderThemeElement } from '~/types/builder'
import {
  normalizeBuilderThemeComposition,
  shouldRevealBackgroundThroughProductZone,
} from '~/utils/builderThemeComposition'
import { paymentBrandSvg } from '~/utils/paymentBrandSvg'
import { isBusinessPaymentCardId } from '~/utils/paymentCards'

const { flyer, theme } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const composition = computed(() => normalizeBuilderThemeComposition(theme.value?.composition))
const visibleElements = computed(() => composition.value.elements
  .filter(element => element.visible !== false)
  .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)))

const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const inkEconomyOpacity = computed(() => 1 - ((flyer.value?.ink_economy ?? 0) / 100))

const resolveAssetUrl = (value: string | null | undefined): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/api/') || raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `/api/storage/p?key=${encodeURIComponent(raw)}`
}

const logoUrl = computed(() => resolveAssetUrl(
  (flyer.value as any)?.custom_logo || (tenant.value as any)?.logo,
))

const backgroundImageUrl = computed(() => resolveAssetUrl(
  (theme.value as any)?.background_image || composition.value.background.image,
))
const hasBackgroundImage = computed(() => !!backgroundImageUrl.value)

const fieldToggleMap: Partial<Record<BuilderThemeBusinessField, string>> = {
  company_name: 'show_company_name',
  slogan: 'show_slogan',
  whatsapp: 'show_whatsapp',
  phone: 'show_phone',
  address: 'show_address',
  instagram: 'show_instagram',
  facebook: 'show_facebook',
  website: 'show_website',
  payments: 'show_payment_methods',
  payment_notes: 'show_payment_notes',
  logo: 'show_logo',
}

const formatDate = (value: string | null | undefined): string => {
  if (!value) return ''
  try {
    const raw = String(value)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw)
    return date.toLocaleDateString('pt-BR')
  } catch {
    return String(value)
  }
}

const buildDisclaimer = (): string => {
  const f = flyer.value as any
  const parts: string[] = []
  if (f?.show_illustrative_note) parts.push('*Imagens meramente ilustrativas.')
  if (f?.show_stock_warning) parts.push('Ofertas enquanto durarem os estoques.')
  if (f?.show_medicine_warning) parts.push('SE PERSISTIREM OS SINTOMAS, O MEDICO DEVERA SER CONSULTADO.')
  if (fontConfig.value.footer_ofertas_texto && !f?.show_stock_warning) parts.push(fontConfig.value.footer_ofertas_texto)
  return parts.join(' ')
}

const PAYMENT_KEYS = [
  'dinheiro', 'pix', 'visa', 'mastercard', 'elo', 'hipercard', 'alelo',
  'sodexo', 'ticket', 'americanexpress', 'vr', 'vale_alimentacao', 'cielo',
]
const DEFAULT_PAYMENT_KEYS = ['dinheiro', 'pix', 'visa', 'mastercard', 'elo']
const activePaymentKeys = computed(() => {
  const configured = (flyer.value as any)?.payment_methods
  if (Array.isArray(configured)) {
    return configured.filter((key: unknown): key is string => (
      typeof key === 'string' && (isBusinessPaymentCardId(key) || !!paymentBrandSvg[key])
    ))
  }
  return PAYMENT_KEYS.filter(key => {
    const value = fontConfig.value[`footer_pay_${key}`]
    return value === undefined ? DEFAULT_PAYMENT_KEYS.includes(key) : !!value
  })
})

const resolveField = (field: BuilderThemeBusinessField | undefined): string => {
  const f = flyer.value as any
  const t = tenant.value as any
  const fc = fontConfig.value
  switch (field) {
    case 'company_name': return fc.footer_empresa_nome || t?.name || ''
    case 'slogan': return fc.footer_empresa_slogan || t?.slogan || ''
    case 'title': return f?.title || f?.custom_message || ''
    case 'promo_phrase': return f?.promo_phrase || ''
    case 'validity': return f?.show_dates && f?.start_date && f?.end_date
      ? `Ofertas válidas de ${formatDate(f.start_date)} até ${formatDate(f.end_date)}`
      : ''
    case 'whatsapp': return fc.footer_whatsapp || t?.whatsapp || ''
    case 'phone': return t?.phone || t?.phone2 || ''
    case 'address': return fc.footer_endereco || t?.address || ''
    case 'hours': return fc.footer_horario || ''
    case 'instagram': {
      const value = fc.footer_instagram || t?.instagram || ''
      return value ? (String(value).startsWith('@') ? value : `@${value}`) : ''
    }
    case 'facebook': return fc.footer_facebook || t?.facebook || ''
    case 'website': return t?.website || ''
    case 'payment_notes': return t?.payment_notes || fc.footer_payment_notes || ''
    case 'disclaimer': return buildDisclaimer()
    case 'payments': return activePaymentKeys.value.join(' ')
    case 'logo': return logoUrl.value ? 'logo' : ''
    default: return ''
  }
}

const shouldRenderElement = (element: BuilderThemeElement): boolean => {
  if (element.visible === false) return false
  if (element.kind === 'product_zone' || element.kind === 'shape') return true
  if (element.kind === 'image') return !!resolveAssetUrl(element.content)
  if (element.kind === 'business_field' && element.field === 'logo') {
    if ((flyer.value as any)?.show_logo === false) return false
    return !!logoUrl.value
  }
  if (element.kind === 'business_field' && element.field === 'payments') {
    const show = (flyer.value as any)?.show_payment_methods
    return show !== false && activePaymentKeys.value.length > 0
  }
  if (element.kind === 'business_field' && element.field) {
    const toggle = fieldToggleMap[element.field]
    if (toggle && (flyer.value as any)?.[toggle] === false) return false
    return !!resolveField(element.field)
  }
  return element.kind === 'text' ? !!element.content : true
}

const elementStyle = (element: BuilderThemeElement) => {
  const style = element.style || {}
  const revealBackground = shouldRevealBackgroundThroughProductZone(element, hasBackgroundImage.value)
  return {
    position: 'absolute' as const,
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    zIndex: element.zIndex ?? 1,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    backgroundColor: revealBackground ? 'transparent' : style.backgroundColor,
    color: style.color || (theme.value as any)?.css_config?.textColor || '#111827',
    border: revealBackground ? undefined : (style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || 'transparent'}` : undefined),
    borderRadius: `${style.borderRadius ?? 0}px`,
    fontSize: `${style.fontSize ?? 2}cqw`,
    fontWeight: style.fontWeight || 600,
    fontFamily: style.fontFamily || undefined,
    textAlign: style.textAlign || 'left',
    opacity: revealBackground ? 1 : (style.opacity ?? 1),
    padding: `${style.padding ?? 0.5}cqw`,
    boxShadow: revealBackground ? undefined : style.boxShadow,
    overflow: 'hidden',
    lineHeight: 1.15,
    wordBreak: 'break-word' as const,
  }
}

const rootStyle = computed(() => ({
  position: 'relative' as const,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: composition.value.background.color || '#ffffff',
  containerType: 'inline-size' as const,
}))
</script>

<template>
  <div :style="rootStyle">
    <img
      v-if="backgroundImageUrl"
      :src="backgroundImageUrl"
      alt=""
      class="pointer-events-none absolute inset-0 h-full w-full"
      :style="{
        objectFit: composition.background.fit === 'stretch' ? 'fill' : composition.background.fit || 'cover',
        // PNGs de fundo podem representar o preto como alpha; este plano
        // mantém a arte visível também para arquivos gravados antes do upload
        // passar a consolidar transparência.
        backgroundColor: '#000000',
        opacity: (composition.background.opacity ?? 1) * inkEconomyOpacity,
      }"
    />

    <template v-for="element in visibleElements" :key="element.id">
      <div v-if="shouldRenderElement(element)" :style="elementStyle(element)">
        <BuilderFlyerProductGrid
          v-if="element.kind === 'product_zone'"
          class="h-full w-full"
          :transparent-background="hasBackgroundImage"
        />

        <span v-else-if="element.kind === 'shape'" class="sr-only">Elemento decorativo</span>

        <img
          v-else-if="element.kind === 'image'"
          :src="resolveAssetUrl(element.content)"
          alt=""
          class="h-full w-full"
          :style="{ objectFit: element.style?.objectFit || 'contain' }"
        />

        <img
          v-else-if="element.kind === 'business_field' && element.field === 'logo'"
          :src="logoUrl"
          alt="Logo da loja"
          class="h-full w-full"
          :style="{ objectFit: element.style?.objectFit || 'contain' }"
        />

        <div
          v-else-if="element.kind === 'business_field' && element.field === 'payments'"
          class="flex h-full w-full flex-wrap items-center justify-center gap-[1%]"
        >
          <span
            v-for="key in activePaymentKeys"
            :key="key"
            class="inline-block max-h-full max-w-[24%]"
          >
            <img v-if="isBusinessPaymentCardId(key)" :src="`/cartoes/${key}.png`" :alt="key" class="h-full w-full object-contain" />
            <span v-else v-html="paymentBrandSvg[key]" />
          </span>
        </div>

        <span v-else-if="element.kind === 'business_field'" class="block h-full w-full whitespace-pre-wrap">
          {{ resolveField(element.field) }}
        </span>

        <span v-else class="block h-full w-full whitespace-pre-wrap">
          {{ element.content || '' }}
        </span>
      </div>
    </template>
  </div>
</template>
