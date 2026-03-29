<script setup lang="ts">
const { flyer, theme } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

// ── Colors ──
const footerBg = computed(() => (flyer.value as any)?.footer_bg || theme.value?.css_config?.footerBg || '#1a1a1a')
const primaryColor = computed(() => (flyer.value as any)?.footer_primary || theme.value?.css_config?.primaryColor || '#e85d04')
const secondaryColor = computed(() => (flyer.value as any)?.footer_secondary || theme.value?.css_config?.secondaryColor || '#f48c06')
const textColor = computed(() => (flyer.value as any)?.footer_text_color || theme.value?.css_config?.textColor || '#ffffff')
const showWatermark = computed(() => theme.value?.footer_config?.showWatermark ?? true)

// ── Layout preset ──
const footerLayout = computed(() => (flyer.value as any)?.footer_layout || 'classico')

// ── Custom sizes ──
const nameSize = computed(() => `${(flyer.value as any)?.footer_name_size || 20}px`)
const phoneSize = computed(() => `${(flyer.value as any)?.footer_phone_size || 15}px`)
const socialSize = computed(() => `${(flyer.value as any)?.footer_social_size || 11}px`)

// ── Custom labels ──
const whatsappLabel = computed(() => (flyer.value as any)?.footer_whatsapp_label || '')
const phoneLabel = computed(() => (flyer.value as any)?.footer_phone_label || '')
const dateLabel = computed(() => (flyer.value as any)?.footer_date_label || 'Ofertas validas')

// ── Toggles ──
const showSocialLabels = computed(() => (flyer.value as any)?.footer_show_social_labels ?? true)
const showPaymentLabel = computed(() => (flyer.value as any)?.footer_show_payment_label ?? true)
const showFooterLogo = computed(() => (flyer.value as any)?.footer_show_logo ?? true)

// ── Fonts & text transform ──
const nameFont = computed(() => (flyer.value as any)?.footer_name_font || '')
const bodyFont = computed(() => (flyer.value as any)?.footer_body_font || '')
const nameTransform = computed(() => (flyer.value as any)?.footer_name_transform || 'uppercase')
const bodyTransform = computed(() => (flyer.value as any)?.footer_body_transform || 'none')
const nameWeight = computed(() => (flyer.value as any)?.footer_name_weight || '900')

// Style objects for reuse
const nameStyle = computed(() => ({
  color: primaryColor.value,
  fontSize: nameSize.value,
  fontFamily: nameFont.value || undefined,
  textTransform: nameTransform.value as any,
  fontWeight: nameWeight.value,
}))
const phoneStyle = computed(() => ({
  fontSize: phoneSize.value,
  fontFamily: bodyFont.value || undefined,
  textTransform: bodyTransform.value as any,
}))
const socialStyle = computed(() => ({
  fontSize: socialSize.value,
  fontFamily: bodyFont.value || undefined,
  textTransform: bodyTransform.value as any,
}))

// ── Dynamic Google Font loading ──
const { loadGoogleFont: _loadFont } = useBuilderTheme()

const loadFooterFont = (fontFamily: string) => {
  if (!fontFamily) return
  const match = fontFamily.match(/^'([^']+)'/)
  const name = match ? match[1] : fontFamily.split(',')[0].trim()
  if (['Arial', 'Impact', 'Georgia'].includes(name)) return // system fonts
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700;800;900&display=swap`
  _loadFont(url, name)
}

watch(nameFont, (v) => loadFooterFont(v), { immediate: true })
watch(bodyFont, (v) => loadFooterFont(v), { immediate: true })

// ── Warnings ──
const showIllustrativeNote = computed(() => flyer.value?.show_illustrative_note ?? false)
const showStockWarning = computed(() => flyer.value?.show_stock_warning ?? false)
const showMedicineWarning = computed(() => flyer.value?.show_medicine_warning ?? false)

// ── Field helpers ──
const getField = (field: string): string => {
  const flyerVal = (flyer.value as any)?.[`custom_${field}`]
  const tenantVal = (tenant.value as any)?.[field]
  return flyerVal || tenantVal || ''
}

const companyName = computed(() => getField('name'))
const companySlogan = computed(() => getField('slogan'))
const paymentNotes = computed(() => getField('payment_notes'))
const phoneNumber = computed(() => flyer.value?.show_phone ? getField('phone') : '')
const whatsappNumber = computed(() => flyer.value?.show_whatsapp ? getField('whatsapp') : '')
const addressText = computed(() => flyer.value?.show_address ? getField('address') : '')
const instagramHandle = computed(() => {
  if (!flyer.value?.show_instagram) return ''
  const val = getField('instagram')
  return val ? val.replace(/^@/, '') : ''
})
const facebookPage = computed(() => flyer.value?.show_facebook ? getField('facebook') : '')
const websiteUrl = computed(() => flyer.value?.show_website ? getField('website') : '')

const hasPhoneContacts = computed(() => !!(phoneNumber.value || whatsappNumber.value))
const hasSocialLinks = computed(() => !!(instagramHandle.value || facebookPage.value || websiteUrl.value))
const hasAnyContact = computed(() => hasPhoneContacts.value || hasSocialLinks.value)

const dateRange = computed(() => {
  if (!flyer.value?.show_dates || !flyer.value?.start_date || !flyer.value?.end_date) return null
  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
    catch { return d }
  }
  return { start: fmt(flyer.value.start_date), end: fmt(flyer.value.end_date) }
})

const warnings = computed(() => {
  const w: string[] = []
  if (showIllustrativeNote.value) w.push('*Imagens meramente ilustrativas.')
  if (showStockWarning.value) w.push('Ofertas validas enquanto durarem os estoques.')
  if (showMedicineWarning.value) w.push('MEDICAMENTOS PODEM CAUSAR EFEITOS INDESEJADOS. EVITE A AUTOMEDICACAO: INFORME-SE COM O FARMACEUTICO.')
  return w
})

// ── Payment methods ──
const selectedPaymentMethods = computed<string[]>(() => {
  return (flyer.value as any)?.payment_methods || ['pix', 'dinheiro', 'visa', 'mastercard', 'elo']
})

const logoUrl = computed(() => {
  const flyerLogo = (flyer.value as any)?.custom_logo
  const logo = flyerLogo || tenant.value?.logo
  if (!logo) return null
  if (logo.startsWith('/api/')) return logo
  const wasabiMatch = logo.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+)$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1])}`
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (logo.startsWith('builder/') || logo.includes('.')) return `/api/storage/p?key=${encodeURIComponent(logo)}`
  return logo
})

// ── Color utils ──
const lighten = (hex: string, amt: number): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (n >> 16) + amt)
  const g = Math.min(255, ((n >> 8) & 0xFF) + amt)
  const b = Math.min(255, (n & 0xFF) + amt)
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}
const darken = (hex: string, amt: number): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amt)
  const g = Math.max(0, ((n >> 8) & 0xFF) - amt)
  const b = Math.max(0, (n & 0xFF) - amt)
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`
}

// ── Footer mode (nenhum, simples, premium) ──
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const footerMode = computed(() => fontConfig.value.footer_mode || 'simples')

// ── Cores customizaveis do rodape premium ──
const footerColor1 = computed(() => fontConfig.value.footer_color_1 || '#1B5E20')
const footerColor2 = computed(() => fontConfig.value.footer_color_2 || '#FDD835')
const footerColor3 = computed(() => fontConfig.value.footer_color_3 || '#D32F2F')
const footerTextColorPremium = computed(() => fontConfig.value.footer_text_color_premium || '#ffffff')

// ── Collapse when nothing to show ──
const hasPayments = computed(() => flyer.value?.show_payment_methods && selectedPaymentMethods.value.length > 0)
const hasWarnings = computed(() => warnings.value.length > 0)
const hasDate = computed(() => !!dateRange.value)
const hasPromo = computed(() => flyer.value?.show_promo_phrase && !!flyer.value?.promo_phrase)
const hasCompanyName = computed(() => flyer.value?.show_company_name && !!companyName.value)
const hasSlogan = computed(() => flyer.value?.show_slogan && !!companySlogan.value)
const hasLogo = computed(() => showFooterLogo.value && !!logoUrl.value)
const hasAddress = computed(() => !!addressText.value)
const hasPaymentNotes = computed(() => flyer.value?.show_payment_notes && !!paymentNotes.value)

const hasAnyContent = computed(() => {
  return hasPayments.value || hasWarnings.value || hasDate.value || hasPromo.value
    || hasCompanyName.value || hasSlogan.value || hasLogo.value || hasAddress.value
    || hasPaymentNotes.value || hasPhoneContacts.value || hasSocialLinks.value
    || showWatermark.value
})

// ── Shape based on layout ──
const shapeClass = computed(() => {
  switch (footerLayout.value) {
    case 'moderno': return 'rounded-t-[48px]'
    case 'elegante': return 'rounded-t-[24px]'
    case 'banner': return 'rounded-none'
    default: return 'rounded-none'
  }
})
</script>

<template>
  <!-- Nenhum rodape -->
  <template v-if="footerMode === 'nenhum'" />

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- RODAPE PREMIUM: 3 secoes empilhadas com cores customizaveis       -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <footer v-else-if="footerMode === 'premium'" class="shrink-0 overflow-hidden">
    <!-- SECAO 1: Redes sociais — min-height 40px, padding 8px, icones grandes -->
    <div class="flex items-center justify-center flex-wrap" style="min-height: 40px; padding: 8px 16px; gap: 20px; font-size: 14px" :style="{ backgroundColor: footerColor1, color: footerTextColorPremium }">
      <div v-if="whatsappNumber" class="flex items-center gap-2">
        <svg style="width: 18px; height: 18px" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.537-1.462A11.948 11.948 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.312-.727-5.994-1.96l-.424-.316-2.687.866.882-2.632-.346-.45A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        <span class="font-bold">{{ whatsappNumber }}</span>
      </div>
      <div v-if="phoneNumber" class="flex items-center gap-2">
        <svg style="width: 16px; height: 16px" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        <span class="font-bold">{{ phoneNumber }}</span>
      </div>
      <div v-if="facebookPage" class="flex items-center gap-2">
        <svg style="width: 16px; height: 16px" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        <span>{{ facebookPage }}</span>
      </div>
      <div v-if="instagramHandle" class="flex items-center gap-2">
        <svg style="width: 16px; height: 16px" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        <span>@{{ instagramHandle }}</span>
      </div>
    </div>

    <!-- SECAO 2: Info empresa + pagamento + validade — min-height 50px, padding 10px -->
    <div class="flex items-center justify-between flex-wrap" style="min-height: 50px; padding: 10px 16px; gap: 10px; font-size: 13px" :style="{ backgroundColor: footerColor2, color: footerColor2 === '#FDD835' || footerColor2 === '#FFEB3B' || footerColor2 === '#FFF176' || footerColor2 === '#FFFF00' ? '#1a1a1a' : footerTextColorPremium }">
      <!-- Nome empresa esquerda -->
      <div v-if="companyName" class="shrink-0 font-black leading-tight" style="font-size: 16px">
        {{ companyName }}
      </div>

      <!-- Bandeiras de pagamento centro -->
      <div v-if="hasPayments" class="flex-1 flex items-center justify-center gap-2 flex-wrap">
        <span v-for="pm in selectedPaymentMethods" :key="pm" class="font-bold" style="padding: 3px 8px; border-radius: 4px; font-size: 10px; min-height: 20px; display: flex; align-items: center; background: rgba(0,0,0,0.12)">
          {{ pm === 'pix' ? 'PIX' : pm === 'dinheiro' ? 'DINHEIRO' : pm === 'visa' ? 'VISA' : pm === 'mastercard' ? 'MASTER' : pm === 'elo' ? 'ELO' : pm === 'hipercard' ? 'HIPER' : pm === 'alelo' ? 'ALELO' : pm === 'sodexo' ? 'SODEXO' : pm === 'ticket' ? 'TICKET' : pm === 'amex' ? 'AMEX' : pm === 'debito' ? 'DEBITO' : pm === 'credito' ? 'CREDITO' : pm.toUpperCase() }}
        </span>
      </div>

      <!-- Validade direita -->
      <div v-if="dateRange" class="shrink-0 text-right leading-tight" style="font-size: 12px">
        <span class="font-bold">{{ dateLabel }}</span><br />
        <span>{{ dateRange.start }} ate {{ dateRange.end }}</span>
      </div>
    </div>

    <!-- SECAO 3: Endereco + avisos — min-height 35px, padding 6px -->
    <div class="text-center" style="min-height: 35px; padding: 6px 16px; font-size: 12px" :style="{ backgroundColor: footerColor3, color: footerTextColorPremium }">
      <div v-if="addressText" class="flex items-center justify-center gap-2">
        <svg style="width: 14px; height: 14px" class="shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        <span>{{ addressText }}</span>
      </div>
      <p v-if="warnings.length" class="opacity-70 mt-1" style="font-size: 9px">
        <span v-for="(w, idx) in warnings" :key="idx">{{ w }} </span>
      </p>
    </div>
  </footer>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- RODAPE SIMPLES: Layout original existente                          -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <footer
    v-else-if="hasAnyContent"
    class="shrink-0 overflow-hidden relative"
    :class="shapeClass"
    :style="{ backgroundColor: footerBg, color: textColor }"
  >
    <!-- ╔══════════════════════════════════════════════════════════════════╗ -->
    <!-- ║  LAYOUT: CLÁSSICO — barra horizontal com divisores verticais    ║ -->
    <!-- ╚══════════════════════════════════════════════════════════════════╝ -->
    <template v-if="footerLayout === 'classico'">
      <!-- Top accent line -->
      <div class="h-1" :style="{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})` }" />

      <!-- Date strip — compact single line -->
      <div
        v-if="dateRange || (flyer?.show_promo_phrase && flyer?.promo_phrase)"
        class="flex items-center justify-center gap-3 px-4 py-1.5"
        :style="{ backgroundColor: secondaryColor }"
      >
        <svg v-if="dateRange" class="w-3.5 h-3.5 shrink-0 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
        <span v-if="dateRange" class="font-extrabold uppercase tracking-wide text-[11px]">{{ dateLabel }}</span>
        <span v-if="dateRange" class="font-black text-[13px] px-2 py-0 rounded" :style="{ backgroundColor: 'rgba(0,0,0,0.2)' }">{{ dateRange.start }}</span>
        <span v-if="dateRange" class="font-bold text-[10px] opacity-80">ate</span>
        <span v-if="dateRange" class="font-black text-[13px] px-2 py-0 rounded" :style="{ backgroundColor: 'rgba(0,0,0,0.2)' }">{{ dateRange.end }}</span>
        <span v-if="flyer?.show_promo_phrase && flyer?.promo_phrase" class="font-extrabold uppercase tracking-wider text-[11px] opacity-90">· {{ flyer.promo_phrase }}</span>
      </div>

      <!-- MAIN horizontal bar: 3 sections with vertical dividers -->
      <div class="flex items-stretch min-h-13">
        <!-- LEFT: Payment cards -->
        <div
          v-if="flyer?.show_payment_methods && selectedPaymentMethods.length"
          class="flex flex-col items-center justify-center px-3 py-2 gap-1 shrink-0"
          :style="{ borderRight: `1px solid rgba(255,255,255,0.12)` }"
        >
          <p v-if="showPaymentLabel" class="text-[7px] uppercase tracking-[0.15em] font-bold opacity-40 whitespace-nowrap">Aceitamos</p>
          <div class="flex items-center gap-0.5 flex-wrap max-w-32.5">
            <div v-for="pm in selectedPaymentMethods" :key="pm" class="w-9 h-6 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
              <template v-if="pm === 'pix'"><svg class="w-7 h-4" viewBox="0 0 512 512" fill="none"><path d="M382.56 349.48c-16.76 0-32.53-6.53-44.39-18.39l-67.56-67.56a15.7 15.7 0 00-22.22 0l-67.56 67.56c-11.86 11.86-27.63 18.39-44.39 18.39H120l85.32 85.32c24.22 24.22 63.48 24.22 87.7 0l85.32-85.32h-5.78z" fill="#32BCAD"/><path d="M136.44 162.52c16.76 0 32.53 6.53 44.39 18.39l67.56 67.56a15.7 15.7 0 0022.22 0l67.56-67.56c11.86-11.86 27.63-18.39 44.39-18.39h5.78l-85.32-85.32c-24.22-24.22-63.48-24.22-87.7 0L130 162.52h6.44z" fill="#32BCAD"/><path d="M434.8 205.2l-40.38-40.38h-12.86c-12.1 0-24.2 4.65-33.52 13.97l-67.56 67.56c-12.22 12.22-31.74 12.22-43.96 0l-67.56-67.56c-9.32-9.32-21.42-13.97-33.52-13.97H122.58L82.2 205.2c-24.22 24.22-24.22 63.48 0 87.7l40.38 40.38h12.86c12.1 0 24.2-4.65 33.52-13.97l67.56-67.56c12.22-12.22 31.74-12.22 43.96 0l67.56 67.56c9.32 9.32 21.42 13.97 33.52 13.97h12.86l40.38-40.38c24.22-24.22 24.22-63.48 0-87.7z" fill="#32BCAD"/></svg></template>
              <template v-else-if="pm === 'dinheiro'"><span class="text-green-700 font-black text-[9px]">R$</span></template>
              <template v-else-if="pm === 'visa'"><svg class="w-full h-full" viewBox="0 0 780 500"><rect width="780" height="500" fill="#1A1F71"/><path d="M333 349l39-229h62l-39 229h-62zm246-228c-12-5-32-10-56-10-62 0-105 31-106 76 0 33 31 51 55 62 24 11 33 19 33 29 0 16-20 23-38 23-25 0-38-3-59-12l-8-4-9 51c15 6 42 12 70 12 66 0 109-31 109-78 0-26-16-46-53-62-22-11-35-18-35-28 0-10 11-20 36-20 20 0 35 4 47 9l6 3 8-51zm130-1h-48c-15 0-26 4-33 19l-93 210h66l13-34h80c2 8 8 34 8 34h58l-51-229zm-72 148l25-64 13-35 7 32 14 67h-59zM286 120l-61 156-7-32c-11-37-47-76-86-96l56 200h66l99-228h-67z" fill="white"/><path d="M182 120H93l-1 4c79 19 131 65 153 121l-22-106c-4-14-15-19-29-19z" fill="#F9A533"/></svg></template>
              <template v-else-if="pm === 'mastercard'"><svg class="w-full h-full" viewBox="0 0 152 108"><rect width="152" height="108" fill="#252525"/><circle cx="60" cy="54" r="30" fill="#EB001B"/><circle cx="92" cy="54" r="30" fill="#F79E1B"/><path d="M76 30.4A29.9 29.9 0 0060 54a29.9 29.9 0 0016 23.6A29.9 29.9 0 0092 54a29.9 29.9 0 00-16-23.6z" fill="#FF5F00"/></svg></template>
              <template v-else-if="pm === 'elo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#000"/><text x="60" y="48" text-anchor="middle" fill="#FFCB05" font-size="28" font-weight="900" font-family="Arial">elo</text></svg></template>
              <template v-else-if="pm === 'hipercard'"><svg class="w-full h-full" viewBox="0 0 140 80"><rect width="140" height="80" fill="#822124"/><text x="70" y="50" text-anchor="middle" fill="white" font-size="18" font-weight="800" font-family="Arial">HIPER</text></svg></template>
              <template v-else-if="pm === 'amex'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#016FD0"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="900" font-family="Arial">AMEX</text></svg></template>
              <template v-else-if="pm === 'alelo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00965E"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="Arial">alelo</text></svg></template>
              <template v-else-if="pm === 'sodexo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#ED1C24"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="700" font-family="Arial">sodexo</text></svg></template>
              <template v-else-if="pm === 'ticket'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#DC0032"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="800" font-family="Arial">Ticket</text></svg></template>
              <template v-else-if="pm === 'vr'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#003399"/><text x="50" y="50" text-anchor="middle" fill="#FF6600" font-size="30" font-weight="900" font-family="Arial">VR</text></svg></template>
              <template v-else-if="pm === 'greencard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#006837"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Arial">Green</text></svg></template>
              <template v-else-if="pm === 'ben'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#FF6900"/><text x="50" y="50" text-anchor="middle" fill="white" font-size="26" font-weight="900" font-family="Arial">ben</text></svg></template>
              <template v-else-if="pm === 'goodcard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#0066B3"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial">GoodCard</text></svg></template>
              <template v-else-if="pm === 'cabal'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00529B"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="20" font-weight="800" font-family="Arial">CABAL</text></svg></template>
              <template v-else-if="pm === 'banescard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#003366"/><text x="60" y="48" text-anchor="middle" fill="#FFD700" font-size="13" font-weight="700" font-family="Arial">Banes</text></svg></template>
            </div>
          </div>
          <p v-if="flyer?.show_payment_notes && paymentNotes" class="text-[7px] opacity-35 font-medium text-center">{{ paymentNotes }}</p>
        </div>

        <!-- CENTER: Company name + address + slogan -->
        <div class="flex-1 flex flex-col items-center justify-center px-4 py-2 text-center">
          <div class="flex items-center gap-2 justify-center">
            <img v-if="showFooterLogo && logoUrl" :src="logoUrl" alt="Logo" class="max-h-10 max-w-16 object-contain shrink-0" :style="{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }" />
            <div>
              <p v-if="flyer?.show_company_name && companyName" class="leading-tight" :style="{ ...nameStyle, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }">{{ companyName }}</p>
              <p v-if="flyer?.show_slogan && companySlogan" class="text-[9px] opacity-50 font-medium">{{ companySlogan }}</p>
            </div>
          </div>
          <div v-if="addressText" class="flex items-center gap-1 mt-1">
            <svg class="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span class="text-[10px] font-medium opacity-55">{{ addressText }}</span>
          </div>
        </div>

        <!-- RIGHT: Social + contacts -->
        <div
          v-if="hasAnyContact"
          class="flex flex-col items-center justify-center px-3 py-2 gap-1 shrink-0"
          :style="{ borderLeft: `1px solid rgba(255,255,255,0.12)` }"
        >
          <div v-if="whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span class="font-black" :style="phoneStyle">{{ whatsappNumber }}</span>
          </div>
          <div v-if="whatsappLabel" class="text-[7px] opacity-40">{{ whatsappLabel }}</div>
          <div v-if="phoneNumber && phoneNumber !== whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <span class="font-bold" :style="phoneStyle">{{ phoneNumber }}</span>
          </div>
          <div v-if="phoneLabel" class="text-[7px] opacity-40">{{ phoneLabel }}</div>
          <div v-if="hasSocialLinks" class="flex items-center gap-1.5 mt-0.5">
            <div v-if="instagramHandle" class="flex items-center gap-1">
              <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style="background: linear-gradient(45deg, #f09433, #dc2743, #bc1888)">
                <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="font-bold opacity-80" :style="socialStyle">@{{ instagramHandle }}</span>
            </div>
            <div v-if="facebookPage" class="flex items-center gap-1">
              <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 bg-[#1877F2]">
                <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="font-bold opacity-80" :style="socialStyle">{{ facebookPage }}</span>
            </div>
            <div v-if="websiteUrl" class="flex items-center gap-1">
              <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0" :style="{ backgroundColor: primaryColor }">
                <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="font-bold opacity-80" :style="socialStyle">{{ websiteUrl }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ╔══════════════════════════════════════════════════════════════════╗ -->
    <!-- ║  LAYOUT: MODERNO — duas faixas horizontais com glass effect     ║ -->
    <!-- ╚══════════════════════════════════════════════════════════════════╝ -->
    <template v-else-if="footerLayout === 'moderno'">
      <!-- TOP STRIP: WhatsApp | Endereço | Social — tudo inline -->
      <div
        class="flex items-stretch"
        :style="{ backgroundColor: darken(footerBg, 20) }"
      >
        <!-- WhatsApp / Telefone -->
        <div v-if="hasPhoneContacts" class="flex items-center gap-3 px-4 py-2" :style="{ borderRight: `1px solid rgba(255,255,255,0.10)` }">
          <div v-if="whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span class="font-black text-[13px]" :style="phoneStyle">{{ whatsappNumber }}</span>
          </div>
          <div v-if="phoneNumber && phoneNumber !== whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <span class="font-bold text-[12px]" :style="phoneStyle">{{ phoneNumber }}</span>
          </div>
        </div>
        <!-- Endereço — centro expansível -->
        <div v-if="addressText" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2" :style="{ borderRight: hasSocialLinks ? `1px solid rgba(255,255,255,0.10)` : '' }">
          <svg class="w-3.5 h-3.5 shrink-0 opacity-50" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <span class="text-[10px] font-medium opacity-60 text-center">{{ addressText }}</span>
        </div>
        <div v-else class="flex-1" />
        <!-- Social -->
        <div v-if="hasSocialLinks" class="flex items-center gap-2 px-4 py-2">
          <div v-if="instagramHandle" class="flex items-center gap-1">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: linear-gradient(45deg, #f09433, #dc2743, #bc1888)">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </div>
            <span v-if="showSocialLabels" class="font-bold opacity-80 text-[11px]" :style="socialStyle">@{{ instagramHandle }}</span>
          </div>
          <div v-if="facebookPage" class="flex items-center gap-1">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-[#1877F2]">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <span v-if="showSocialLabels" class="font-bold opacity-80 text-[11px]" :style="socialStyle">{{ facebookPage }}</span>
          </div>
          <div v-if="websiteUrl" class="flex items-center gap-1">
            <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" :style="{ backgroundColor: primaryColor }">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </div>
            <span v-if="showSocialLabels" class="font-bold opacity-80 text-[11px]" :style="socialStyle">{{ websiteUrl }}</span>
          </div>
        </div>
      </div>

      <!-- BOTTOM STRIP: Cartões | Nome + Datas | Frase promo -->
      <div class="flex items-stretch">
        <!-- Cartões esquerda -->
        <div v-if="flyer?.show_payment_methods && selectedPaymentMethods.length" class="flex items-center gap-0.5 flex-wrap px-3 py-2 shrink-0" :style="{ borderRight: `1px solid rgba(255,255,255,0.10)` }">
          <p v-if="showPaymentLabel" class="w-full text-[7px] uppercase tracking-[0.15em] font-bold opacity-35 mb-0.5">Aceitamos</p>
          <div v-for="pm in selectedPaymentMethods" :key="pm" class="w-9 h-6 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
            <template v-if="pm === 'pix'"><svg class="w-7 h-4" viewBox="0 0 512 512" fill="none"><path d="M382.56 349.48c-16.76 0-32.53-6.53-44.39-18.39l-67.56-67.56a15.7 15.7 0 00-22.22 0l-67.56 67.56c-11.86 11.86-27.63 18.39-44.39 18.39H120l85.32 85.32c24.22 24.22 63.48 24.22 87.7 0l85.32-85.32h-5.78z" fill="#32BCAD"/><path d="M136.44 162.52c16.76 0 32.53 6.53 44.39 18.39l67.56 67.56a15.7 15.7 0 0022.22 0l67.56-67.56c11.86-11.86 27.63-18.39 44.39-18.39h5.78l-85.32-85.32c-24.22-24.22-63.48-24.22-87.7 0L130 162.52h6.44z" fill="#32BCAD"/><path d="M434.8 205.2l-40.38-40.38h-12.86c-12.1 0-24.2 4.65-33.52 13.97l-67.56 67.56c-12.22 12.22-31.74 12.22-43.96 0l-67.56-67.56c-9.32-9.32-21.42-13.97-33.52-13.97H122.58L82.2 205.2c-24.22 24.22-24.22 63.48 0 87.7l40.38 40.38h12.86c12.1 0 24.2-4.65 33.52-13.97l67.56-67.56c12.22-12.22 31.74-12.22 43.96 0l67.56 67.56c9.32 9.32 21.42 13.97 33.52 13.97h12.86l40.38-40.38c24.22-24.22 24.22-63.48 0-87.7z" fill="#32BCAD"/></svg></template>
            <template v-else-if="pm === 'dinheiro'"><span class="text-green-700 font-black text-[9px]">R$</span></template>
            <template v-else-if="pm === 'visa'"><svg class="w-full h-full" viewBox="0 0 780 500"><rect width="780" height="500" fill="#1A1F71"/><path d="M333 349l39-229h62l-39 229h-62zm246-228c-12-5-32-10-56-10-62 0-105 31-106 76 0 33 31 51 55 62 24 11 33 19 33 29 0 16-20 23-38 23-25 0-38-3-59-12l-8-4-9 51c15 6 42 12 70 12 66 0 109-31 109-78 0-26-16-46-53-62-22-11-35-18-35-28 0-10 11-20 36-20 20 0 35 4 47 9l6 3 8-51zm130-1h-48c-15 0-26 4-33 19l-93 210h66l13-34h80c2 8 8 34 8 34h58l-51-229zm-72 148l25-64 13-35 7 32 14 67h-59zM286 120l-61 156-7-32c-11-37-47-76-86-96l56 200h66l99-228h-67z" fill="white"/><path d="M182 120H93l-1 4c79 19 131 65 153 121l-22-106c-4-14-15-19-29-19z" fill="#F9A533"/></svg></template>
            <template v-else-if="pm === 'mastercard'"><svg class="w-full h-full" viewBox="0 0 152 108"><rect width="152" height="108" fill="#252525"/><circle cx="60" cy="54" r="30" fill="#EB001B"/><circle cx="92" cy="54" r="30" fill="#F79E1B"/><path d="M76 30.4A29.9 29.9 0 0060 54a29.9 29.9 0 0016 23.6A29.9 29.9 0 0092 54a29.9 29.9 0 00-16-23.6z" fill="#FF5F00"/></svg></template>
            <template v-else-if="pm === 'elo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#000"/><text x="60" y="48" text-anchor="middle" fill="#FFCB05" font-size="28" font-weight="900" font-family="Arial">elo</text></svg></template>
            <template v-else-if="pm === 'hipercard'"><svg class="w-full h-full" viewBox="0 0 140 80"><rect width="140" height="80" fill="#822124"/><text x="70" y="50" text-anchor="middle" fill="white" font-size="18" font-weight="800" font-family="Arial">HIPER</text></svg></template>
            <template v-else-if="pm === 'amex'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#016FD0"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="900" font-family="Arial">AMEX</text></svg></template>
            <template v-else-if="pm === 'alelo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00965E"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="Arial">alelo</text></svg></template>
            <template v-else-if="pm === 'sodexo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#ED1C24"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="700" font-family="Arial">sodexo</text></svg></template>
            <template v-else-if="pm === 'ticket'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#DC0032"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="800" font-family="Arial">Ticket</text></svg></template>
            <template v-else-if="pm === 'vr'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#003399"/><text x="50" y="50" text-anchor="middle" fill="#FF6600" font-size="30" font-weight="900" font-family="Arial">VR</text></svg></template>
            <template v-else-if="pm === 'greencard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#006837"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Arial">Green</text></svg></template>
            <template v-else-if="pm === 'ben'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#FF6900"/><text x="50" y="50" text-anchor="middle" fill="white" font-size="26" font-weight="900" font-family="Arial">ben</text></svg></template>
            <template v-else-if="pm === 'goodcard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#0066B3"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial">GoodCard</text></svg></template>
            <template v-else-if="pm === 'cabal'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00529B"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="20" font-weight="800" font-family="Arial">CABAL</text></svg></template>
            <template v-else-if="pm === 'banescard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#003366"/><text x="60" y="48" text-anchor="middle" fill="#FFD700" font-size="13" font-weight="700" font-family="Arial">Banes</text></svg></template>
          </div>
          <p v-if="flyer?.show_payment_notes && paymentNotes" class="w-full text-[7px] opacity-35 mt-0.5">{{ paymentNotes }}</p>
        </div>

        <!-- Centro: nome + datas -->
        <div class="flex-1 flex flex-col items-center justify-center px-4 py-2 text-center gap-0.5">
          <div class="flex items-center gap-2">
            <img v-if="showFooterLogo && logoUrl" :src="logoUrl" alt="Logo" class="max-h-9 max-w-14 object-contain" />
            <p v-if="flyer?.show_company_name && companyName" class="leading-tight" :style="nameStyle">{{ companyName }}</p>
          </div>
          <div v-if="dateRange" class="flex items-center gap-1.5 mt-0.5">
            <svg class="w-3 h-3 shrink-0 opacity-60" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
            <span class="text-[10px] font-bold opacity-70">{{ dateLabel }}: <span :style="{ color: primaryColor }">{{ dateRange.start }}</span> ate <span :style="{ color: primaryColor }">{{ dateRange.end }}</span></span>
          </div>
          <p v-if="flyer?.show_slogan && companySlogan" class="text-[8px] opacity-40">{{ companySlogan }}</p>
        </div>

        <!-- Direita: frase promo -->
        <div v-if="flyer?.show_promo_phrase && flyer?.promo_phrase" class="flex items-center justify-center px-4 py-2 shrink-0" :style="{ borderLeft: `1px solid rgba(255,255,255,0.10)`, backgroundColor: primaryColor }">
          <span class="font-extrabold uppercase tracking-wider text-[11px] text-white text-center" style="text-shadow: 0 1px 3px rgba(0,0,0,0.3)">{{ flyer.promo_phrase }}</span>
        </div>
      </div>
    </template>

    <!-- ╔══════════════════════════════════════════════════════════════════╗ -->
    <!-- ║  LAYOUT: ELEGANTE — logo central, info dos lados               ║ -->
    <!-- ╚══════════════════════════════════════════════════════════════════╝ -->
    <template v-else-if="footerLayout === 'elegante'">
      <!-- TOP STRIP: validade + frase ilustrativa — full width, compacto -->
      <div
        v-if="dateRange || (flyer?.show_promo_phrase && flyer?.promo_phrase) || showIllustrativeNote"
        class="flex items-center justify-center gap-4 px-4 py-1.5"
        :style="{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }"
      >
        <span v-if="showIllustrativeNote" class="text-[9px] font-medium opacity-80">*Imagens ilustrativas</span>
        <span v-if="showIllustrativeNote && dateRange" class="opacity-40 text-[9px]">|</span>
        <template v-if="dateRange">
          <svg class="w-3 h-3 shrink-0 opacity-80" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg>
          <span class="text-[10px] font-extrabold uppercase tracking-wide">OFERTAS VALIDAS</span>
          <span class="text-[11px] font-black px-1.5 rounded" :style="{ backgroundColor: 'rgba(0,0,0,0.2)' }">{{ dateRange.start }}</span>
          <span class="text-[9px] opacity-80">a</span>
          <span class="text-[11px] font-black px-1.5 rounded" :style="{ backgroundColor: 'rgba(0,0,0,0.2)' }">{{ dateRange.end }}</span>
        </template>
        <span v-if="flyer?.show_promo_phrase && flyer?.promo_phrase" class="text-[10px] font-extrabold uppercase tracking-wide opacity-90">· {{ flyer.promo_phrase }}</span>
      </div>

      <!-- MAIN BAR: contatos esquerda | logo+nome centro | social+pagamentos direita -->
      <div class="flex items-stretch min-h-13.5">
        <!-- LEFT: endereço + contatos -->
        <div class="flex flex-col items-start justify-center px-4 py-2 gap-1 flex-1" :style="{ borderRight: `1px solid rgba(255,255,255,0.10)` }">
          <div v-if="whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span class="font-black" :style="phoneStyle">{{ whatsappNumber }}</span>
          </div>
          <div v-if="phoneNumber && phoneNumber !== whatsappNumber" class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 shrink-0 opacity-55" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <span class="font-bold" :style="phoneStyle">{{ phoneNumber }}</span>
          </div>
          <div v-if="addressText" class="flex items-center gap-1">
            <svg class="w-3 h-3 shrink-0 opacity-45" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span class="text-[9px] font-medium opacity-55">{{ addressText }}</span>
          </div>
        </div>

        <!-- CENTER: logo + nome -->
        <div class="flex flex-col items-center justify-center px-5 py-2 shrink-0">
          <img v-if="showFooterLogo && logoUrl" :src="logoUrl" alt="Logo" class="max-h-10 max-w-20 object-contain" :style="{ filter: 'drop-shadow(0 1px 5px rgba(0,0,0,0.5))' }" />
          <p v-if="flyer?.show_company_name && companyName" class="text-center leading-tight mt-0.5" :style="{ ...nameStyle, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }">{{ companyName }}</p>
          <p v-if="flyer?.show_slogan && companySlogan" class="text-[8px] opacity-40 text-center mt-0.5">{{ companySlogan }}</p>
        </div>

        <!-- RIGHT: social + cartões -->
        <div class="flex flex-col items-end justify-center px-4 py-2 gap-1.5 flex-1" :style="{ borderLeft: `1px solid rgba(255,255,255,0.10)` }">
          <div v-if="hasSocialLinks" class="flex items-center gap-2">
            <div v-if="instagramHandle" class="flex items-center gap-1">
              <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: linear-gradient(45deg, #f09433, #dc2743, #bc1888)">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="text-[10px] font-bold opacity-75" :style="socialStyle">@{{ instagramHandle }}</span>
            </div>
            <div v-if="facebookPage" class="flex items-center gap-1">
              <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-[#1877F2]">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="text-[10px] font-bold opacity-75" :style="socialStyle">{{ facebookPage }}</span>
            </div>
          </div>
          <div v-if="flyer?.show_payment_methods && selectedPaymentMethods.length" class="flex items-center gap-0.5 flex-wrap justify-end">
            <div v-for="pm in selectedPaymentMethods" :key="pm" class="w-9 h-6 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
              <template v-if="pm === 'pix'"><svg class="w-7 h-4" viewBox="0 0 512 512" fill="none"><path d="M382.56 349.48c-16.76 0-32.53-6.53-44.39-18.39l-67.56-67.56a15.7 15.7 0 00-22.22 0l-67.56 67.56c-11.86 11.86-27.63 18.39-44.39 18.39H120l85.32 85.32c24.22 24.22 63.48 24.22 87.7 0l85.32-85.32h-5.78z" fill="#32BCAD"/><path d="M136.44 162.52c16.76 0 32.53 6.53 44.39 18.39l67.56 67.56a15.7 15.7 0 0022.22 0l67.56-67.56c11.86-11.86 27.63-18.39 44.39-18.39h5.78l-85.32-85.32c-24.22-24.22-63.48-24.22-87.7 0L130 162.52h6.44z" fill="#32BCAD"/><path d="M434.8 205.2l-40.38-40.38h-12.86c-12.1 0-24.2 4.65-33.52 13.97l-67.56 67.56c-12.22 12.22-31.74 12.22-43.96 0l-67.56-67.56c-9.32-9.32-21.42-13.97-33.52-13.97H122.58L82.2 205.2c-24.22 24.22-24.22 63.48 0 87.7l40.38 40.38h12.86c12.1 0 24.2-4.65 33.52-13.97l67.56-67.56c12.22-12.22 31.74-12.22 43.96 0l67.56 67.56c9.32 9.32 21.42 13.97 33.52 13.97h12.86l40.38-40.38c24.22-24.22 24.22-63.48 0-87.7z" fill="#32BCAD"/></svg></template>
              <template v-else-if="pm === 'dinheiro'"><span class="text-green-700 font-black text-[9px]">R$</span></template>
              <template v-else-if="pm === 'visa'"><svg class="w-full h-full" viewBox="0 0 780 500"><rect width="780" height="500" fill="#1A1F71"/><path d="M333 349l39-229h62l-39 229h-62zm246-228c-12-5-32-10-56-10-62 0-105 31-106 76 0 33 31 51 55 62 24 11 33 19 33 29 0 16-20 23-38 23-25 0-38-3-59-12l-8-4-9 51c15 6 42 12 70 12 66 0 109-31 109-78 0-26-16-46-53-62-22-11-35-18-35-28 0-10 11-20 36-20 20 0 35 4 47 9l6 3 8-51zm130-1h-48c-15 0-26 4-33 19l-93 210h66l13-34h80c2 8 8 34 8 34h58l-51-229zm-72 148l25-64 13-35 7 32 14 67h-59zM286 120l-61 156-7-32c-11-37-47-76-86-96l56 200h66l99-228h-67z" fill="white"/><path d="M182 120H93l-1 4c79 19 131 65 153 121l-22-106c-4-14-15-19-29-19z" fill="#F9A533"/></svg></template>
              <template v-else-if="pm === 'mastercard'"><svg class="w-full h-full" viewBox="0 0 152 108"><rect width="152" height="108" fill="#252525"/><circle cx="60" cy="54" r="30" fill="#EB001B"/><circle cx="92" cy="54" r="30" fill="#F79E1B"/><path d="M76 30.4A29.9 29.9 0 0060 54a29.9 29.9 0 0016 23.6A29.9 29.9 0 0092 54a29.9 29.9 0 00-16-23.6z" fill="#FF5F00"/></svg></template>
              <template v-else-if="pm === 'elo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#000"/><text x="60" y="48" text-anchor="middle" fill="#FFCB05" font-size="28" font-weight="900" font-family="Arial">elo</text></svg></template>
              <template v-else-if="pm === 'hipercard'"><svg class="w-full h-full" viewBox="0 0 140 80"><rect width="140" height="80" fill="#822124"/><text x="70" y="50" text-anchor="middle" fill="white" font-size="18" font-weight="800" font-family="Arial">HIPER</text></svg></template>
              <template v-else-if="pm === 'amex'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#016FD0"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="900" font-family="Arial">AMEX</text></svg></template>
              <template v-else-if="pm === 'alelo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00965E"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="Arial">alelo</text></svg></template>
              <template v-else-if="pm === 'sodexo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#ED1C24"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="700" font-family="Arial">sodexo</text></svg></template>
              <template v-else-if="pm === 'ticket'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#DC0032"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="800" font-family="Arial">Ticket</text></svg></template>
              <template v-else-if="pm === 'vr'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#003399"/><text x="50" y="50" text-anchor="middle" fill="#FF6600" font-size="30" font-weight="900" font-family="Arial">VR</text></svg></template>
              <template v-else-if="pm === 'greencard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#006837"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Arial">Green</text></svg></template>
              <template v-else-if="pm === 'ben'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#FF6900"/><text x="50" y="50" text-anchor="middle" fill="white" font-size="26" font-weight="900" font-family="Arial">ben</text></svg></template>
              <template v-else-if="pm === 'goodcard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#0066B3"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial">GoodCard</text></svg></template>
              <template v-else-if="pm === 'cabal'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00529B"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="20" font-weight="800" font-family="Arial">CABAL</text></svg></template>
              <template v-else-if="pm === 'banescard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#003366"/><text x="60" y="48" text-anchor="middle" fill="#FFD700" font-size="13" font-weight="700" font-family="Arial">Banes</text></svg></template>
            </div>
            <p v-if="flyer?.show_payment_notes && paymentNotes" class="w-full text-right text-[7px] opacity-35 mt-0.5">{{ paymentNotes }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- ╔══════════════════════════════════════════════════════════════════╗ -->
    <!-- ║  LAYOUT: BANNER — impacto máximo, faixas bold full-width       ║ -->
    <!-- ╚══════════════════════════════════════════════════════════════════╝ -->
    <template v-else-if="footerLayout === 'banner'">
      <!-- TOP STRIP: datas em destaque bold -->
      <div
        v-if="dateRange"
        class="flex items-center justify-center gap-3 px-6 py-2"
        :style="{ backgroundColor: secondaryColor }"
      >
        <span class="font-black text-[15px] uppercase tracking-widest" style="text-shadow: 0 1px 3px rgba(0,0,0,0.3)">{{ dateLabel.toUpperCase() }}</span>
        <span class="font-black text-[18px] px-3 py-0.5 rounded-lg" :style="{ backgroundColor: 'rgba(0,0,0,0.25)' }">{{ dateRange.start }}</span>
        <span class="font-bold text-[12px] opacity-75">ATE</span>
        <span class="font-black text-[18px] px-3 py-0.5 rounded-lg" :style="{ backgroundColor: 'rgba(0,0,0,0.25)' }">{{ dateRange.end }}</span>
      </div>

      <!-- MAIN BAR: empresa+logo | divisor | whatsapp+contatos | divisor | cartões+social -->
      <div class="flex items-stretch">
        <!-- LEFT: Logo + nome + slogan -->
        <div
          class="flex items-center gap-3 px-4 py-2.5 shrink-0"
          :style="{ backgroundColor: primaryColor, borderRight: `2px solid rgba(0,0,0,0.15)` }"
        >
          <img v-if="showFooterLogo && logoUrl" :src="logoUrl" alt="Logo" class="max-h-11 max-w-16 object-contain shrink-0" :style="{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.4))' }" />
          <div v-if="(flyer?.show_company_name && companyName) || (flyer?.show_slogan && companySlogan)">
            <p v-if="flyer?.show_company_name && companyName" class="leading-tight" :style="{ ...nameStyle, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }">{{ companyName }}</p>
            <p v-if="flyer?.show_slogan && companySlogan" class="text-[9px] opacity-75 mt-0.5">{{ companySlogan }}</p>
          </div>
        </div>

        <!-- CENTER: WhatsApp + phone + endereço -->
        <div
          v-if="hasPhoneContacts || addressText"
          class="flex flex-col items-start justify-center px-4 py-2 gap-1 flex-1"
          :style="{ borderRight: `1px solid rgba(255,255,255,0.12)` }"
        >
          <div v-if="whatsappNumber" class="flex items-center gap-2">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span class="font-black" :style="phoneStyle">{{ whatsappNumber }}</span>
            <span v-if="whatsappLabel" class="text-[8px] opacity-50">{{ whatsappLabel }}</span>
          </div>
          <div v-if="phoneNumber && phoneNumber !== whatsappNumber" class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 shrink-0 opacity-55" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            <span class="font-bold" :style="phoneStyle">{{ phoneNumber }}</span>
          </div>
          <div v-if="addressText" class="flex items-center gap-1">
            <svg class="w-3 h-3 shrink-0 opacity-45" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span class="text-[9px] font-medium opacity-55">{{ addressText }}</span>
          </div>
          <div v-if="flyer?.show_promo_phrase && flyer?.promo_phrase" class="flex items-center gap-1.5 mt-0.5">
            <span class="font-extrabold uppercase tracking-wide text-[10px]" :style="{ color: secondaryColor }">{{ flyer.promo_phrase }}</span>
          </div>
        </div>

        <!-- RIGHT: cartões + social -->
        <div class="flex flex-col items-center justify-center px-4 py-2 gap-1.5 shrink-0" :style="{ borderLeft: `1px solid rgba(255,255,255,0.12)` }">
          <div v-if="flyer?.show_payment_methods && selectedPaymentMethods.length" class="flex items-center gap-0.5 flex-wrap max-w-32">
            <div v-for="pm in selectedPaymentMethods" :key="pm" class="w-9 h-6 rounded overflow-hidden bg-white flex items-center justify-center shrink-0">
              <template v-if="pm === 'pix'"><svg class="w-7 h-4" viewBox="0 0 512 512" fill="none"><path d="M382.56 349.48c-16.76 0-32.53-6.53-44.39-18.39l-67.56-67.56a15.7 15.7 0 00-22.22 0l-67.56 67.56c-11.86 11.86-27.63 18.39-44.39 18.39H120l85.32 85.32c24.22 24.22 63.48 24.22 87.7 0l85.32-85.32h-5.78z" fill="#32BCAD"/><path d="M136.44 162.52c16.76 0 32.53 6.53 44.39 18.39l67.56 67.56a15.7 15.7 0 0022.22 0l67.56-67.56c11.86-11.86 27.63-18.39 44.39-18.39h5.78l-85.32-85.32c-24.22-24.22-63.48-24.22-87.7 0L130 162.52h6.44z" fill="#32BCAD"/><path d="M434.8 205.2l-40.38-40.38h-12.86c-12.1 0-24.2 4.65-33.52 13.97l-67.56 67.56c-12.22 12.22-31.74 12.22-43.96 0l-67.56-67.56c-9.32-9.32-21.42-13.97-33.52-13.97H122.58L82.2 205.2c-24.22 24.22-24.22 63.48 0 87.7l40.38 40.38h12.86c12.1 0 24.2-4.65 33.52-13.97l67.56-67.56c12.22-12.22 31.74-12.22 43.96 0l67.56 67.56c9.32 9.32 21.42 13.97 33.52 13.97h12.86l40.38-40.38c24.22-24.22 24.22-63.48 0-87.7z" fill="#32BCAD"/></svg></template>
              <template v-else-if="pm === 'dinheiro'"><span class="text-green-700 font-black text-[9px]">R$</span></template>
              <template v-else-if="pm === 'visa'"><svg class="w-full h-full" viewBox="0 0 780 500"><rect width="780" height="500" fill="#1A1F71"/><path d="M333 349l39-229h62l-39 229h-62zm246-228c-12-5-32-10-56-10-62 0-105 31-106 76 0 33 31 51 55 62 24 11 33 19 33 29 0 16-20 23-38 23-25 0-38-3-59-12l-8-4-9 51c15 6 42 12 70 12 66 0 109-31 109-78 0-26-16-46-53-62-22-11-35-18-35-28 0-10 11-20 36-20 20 0 35 4 47 9l6 3 8-51zm130-1h-48c-15 0-26 4-33 19l-93 210h66l13-34h80c2 8 8 34 8 34h58l-51-229zm-72 148l25-64 13-35 7 32 14 67h-59zM286 120l-61 156-7-32c-11-37-47-76-86-96l56 200h66l99-228h-67z" fill="white"/><path d="M182 120H93l-1 4c79 19 131 65 153 121l-22-106c-4-14-15-19-29-19z" fill="#F9A533"/></svg></template>
              <template v-else-if="pm === 'mastercard'"><svg class="w-full h-full" viewBox="0 0 152 108"><rect width="152" height="108" fill="#252525"/><circle cx="60" cy="54" r="30" fill="#EB001B"/><circle cx="92" cy="54" r="30" fill="#F79E1B"/><path d="M76 30.4A29.9 29.9 0 0060 54a29.9 29.9 0 0016 23.6A29.9 29.9 0 0092 54a29.9 29.9 0 00-16-23.6z" fill="#FF5F00"/></svg></template>
              <template v-else-if="pm === 'elo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#000"/><text x="60" y="48" text-anchor="middle" fill="#FFCB05" font-size="28" font-weight="900" font-family="Arial">elo</text></svg></template>
              <template v-else-if="pm === 'hipercard'"><svg class="w-full h-full" viewBox="0 0 140 80"><rect width="140" height="80" fill="#822124"/><text x="70" y="50" text-anchor="middle" fill="white" font-size="18" font-weight="800" font-family="Arial">HIPER</text></svg></template>
              <template v-else-if="pm === 'amex'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#016FD0"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="900" font-family="Arial">AMEX</text></svg></template>
              <template v-else-if="pm === 'alelo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00965E"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="Arial">alelo</text></svg></template>
              <template v-else-if="pm === 'sodexo'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#ED1C24"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="18" font-weight="700" font-family="Arial">sodexo</text></svg></template>
              <template v-else-if="pm === 'ticket'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#DC0032"/><text x="60" y="46" text-anchor="middle" fill="white" font-size="14" font-weight="800" font-family="Arial">Ticket</text></svg></template>
              <template v-else-if="pm === 'vr'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#003399"/><text x="50" y="50" text-anchor="middle" fill="#FF6600" font-size="30" font-weight="900" font-family="Arial">VR</text></svg></template>
              <template v-else-if="pm === 'greencard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#006837"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Arial">Green</text></svg></template>
              <template v-else-if="pm === 'ben'"><svg class="w-full h-full" viewBox="0 0 100 80"><rect width="100" height="80" fill="#FF6900"/><text x="50" y="50" text-anchor="middle" fill="white" font-size="26" font-weight="900" font-family="Arial">ben</text></svg></template>
              <template v-else-if="pm === 'goodcard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#0066B3"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Arial">GoodCard</text></svg></template>
              <template v-else-if="pm === 'cabal'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00529B"/><text x="60" y="48" text-anchor="middle" fill="white" font-size="20" font-weight="800" font-family="Arial">CABAL</text></svg></template>
              <template v-else-if="pm === 'banescard'"><svg class="w-full h-full" viewBox="0 0 120 80"><rect width="120" height="80" fill="#003366"/><text x="60" y="48" text-anchor="middle" fill="#FFD700" font-size="13" font-weight="700" font-family="Arial">Banes</text></svg></template>
            </div>
            <p v-if="flyer?.show_payment_notes && paymentNotes" class="w-full text-center text-[7px] opacity-35 mt-0.5">{{ paymentNotes }}</p>
          </div>
          <div v-if="hasSocialLinks" class="flex items-center gap-1.5">
            <div v-if="instagramHandle" class="flex items-center gap-1">
              <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style="background: linear-gradient(45deg, #f09433, #dc2743, #bc1888)">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="font-bold opacity-80 text-[10px]" :style="socialStyle">@{{ instagramHandle }}</span>
            </div>
            <div v-if="facebookPage" class="flex items-center gap-1">
              <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-[#1877F2]">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </div>
              <span v-if="showSocialLabels" class="font-bold opacity-80 text-[10px]" :style="socialStyle">{{ facebookPage }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ COMMON: Warnings + Watermark (all layouts) ═══ -->
    <div v-if="warnings.length || showWatermark" class="px-6 pb-2" :class="warnings.length ? 'pt-1' : ''">
      <div v-if="warnings.length" class="border-t border-white/5 pt-1.5">
        <p v-for="(w, idx) in warnings" :key="idx" class="text-center opacity-35 leading-tight text-[8px]">{{ w }}</p>
      </div>
      <p v-if="showWatermark" class="text-center opacity-15 text-[7px] mt-1">Feito com JobVarejo</p>
    </div>
  </footer>
</template>
