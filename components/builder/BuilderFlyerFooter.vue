<script setup lang="ts">
const { flyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fc = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const footerMode = computed(() => fc.value.footer_mode || 'premium')

// Cores
const colorTop = computed(() => fc.value.footer_color_bg_top || '#333333')
const colorBottom = computed(() => fc.value.footer_color_bg_bottom || '#F5B800')

// Dados da empresa (prioridade: fontConfig > tenant)
const whatsapp = computed(() => fc.value.footer_whatsapp || (tenant.value as any)?.whatsapp || '')
const facebook = computed(() => fc.value.footer_facebook || (tenant.value as any)?.facebook || '')
const instagram = computed(() => fc.value.footer_instagram || (tenant.value as any)?.instagram || '')
const empresaNome = computed(() => fc.value.footer_empresa_nome || (tenant.value as any)?.name || 'Supermercado')
const endereco = computed(() => fc.value.footer_endereco || (tenant.value as any)?.address || '')
const horario = computed(() => fc.value.footer_horario || '')
const ofertasTexto = computed(() => fc.value.footer_ofertas_texto || 'ou enquanto durarem os estoques.')

// Redes sociais existem?
const hasSocial = computed(() => !!(whatsapp.value || facebook.value || instagram.value))

// Bandeiras de pagamento (default: dinheiro, pix, visa, mastercard, elo = true)
const pay = (key: string) => {
  const val = fc.value[`footer_pay_${key}`]
  if (val === undefined) {
    // Defaults
    return ['dinheiro', 'pix', 'visa', 'mastercard', 'elo'].includes(key)
  }
  return !!val
}

// Datas
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'DD/MM/AAAA'
  try { return new Date(dateStr).toLocaleDateString('pt-BR') }
  catch { return dateStr }
}

const dataInicio = computed(() => formatDate(flyer.value?.start_date))
const dataFim = computed(() => formatDate(flyer.value?.end_date))
const hasDate = computed(() => flyer.value?.show_dates && flyer.value?.start_date && flyer.value?.end_date)

// Avisos
const showIlustrativa = computed(() => flyer.value?.show_illustrative_note ?? false)
const showEstoque = computed(() => flyer.value?.show_stock_warning ?? false)
</script>

<template>
  <!-- NENHUM -->
  <template v-if="footerMode === 'nenhum'" />

  <!-- SIMPLES: barra unica -->
  <footer v-else-if="footerMode === 'simples'" class="shrink-0" :style="{ backgroundColor: colorTop, padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', color: '#fff' }">
    <span style="font-weight: bold; font-size: 14px">{{ empresaNome }}</span>
    <span v-if="endereco" style="font-size: 12px">{{ endereco }}</span>
    <span v-if="whatsapp" style="font-size: 12px">{{ whatsapp }}</span>
    <span v-if="showEstoque" style="font-size: 11px; opacity: 0.8">Ofertas validas enquanto durarem os estoques</span>
  </footer>

  <!-- PREMIUM: rodape completo estilo supermercado brasileiro -->
  <footer v-else class="shrink-0" style="width: 100%">

    <!-- ══ FAIXA 1: Redes Sociais (fundo escuro) ══ -->
    <div v-if="hasSocial" :style="{ backgroundColor: colorTop, padding: '12px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '28px', flexWrap: 'wrap', width: '100%' }">
      <div v-if="whatsapp" style="display: flex; align-items: center; gap: 8px">
        <span style="font-size: 20px">📱</span>
        <span style="color: #fff; font-size: 18px; font-weight: bold">{{ whatsapp }}</span>
      </div>
      <div v-if="facebook" style="display: flex; align-items: center; gap: 8px">
        <span style="font-size: 20px">📘</span>
        <span style="color: #fff; font-size: 18px; font-weight: bold">{{ facebook }}</span>
      </div>
      <div v-if="instagram" style="display: flex; align-items: center; gap: 8px">
        <span style="font-size: 20px">📷</span>
        <span style="color: #fff; font-size: 18px; font-weight: bold">@{{ instagram.replace(/^@/, '') }}</span>
      </div>
    </div>

    <!-- ══ FAIXA 2: Empresa + Bandeiras + Datas (fundo amarelo) ══ -->
    <div :style="{ backgroundColor: colorBottom, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '16px', flexWrap: 'wrap' }">

      <!-- Caixa preta: nome empresa + bandeiras -->
      <div style="background: #000; border-radius: 8px; padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; max-width: 55%">
        <span style="color: #fff; font-weight: bold; font-size: 15px">{{ empresaNome }}</span>
        <div style="display: flex; flex-wrap: wrap; gap: 5px; align-items: center">
          <span v-if="pay('dinheiro')" style="background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold">💵</span>
          <span v-if="pay('pix')" style="background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #00BDAE">PIX</span>
          <span v-if="pay('elo')" style="background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold">Elo</span>
          <span v-if="pay('visa')" style="background: #1A1F71; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">VISA</span>
          <span v-if="pay('mastercard')" style="background: #EB001B; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Master</span>
          <span v-if="pay('cielo')" style="background: #0066CC; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Cielo</span>
          <span v-if="pay('sodexo')" style="background: #E31937; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Sodexo</span>
          <span v-if="pay('ticket')" style="background: #D61F26; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Ticket</span>
          <span v-if="pay('alelo')" style="background: #00A651; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Alelo</span>
          <span v-if="pay('americanexpress')" style="background: #006FCF; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Amex</span>
          <span v-if="pay('hipercard')" style="background: #822124; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">Hiper</span>
          <span v-if="pay('vr')" style="background: #FF6600; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">VR</span>
          <span v-if="pay('vale_alimentacao')" style="background: #2E7D32; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #fff">V.A.</span>
        </div>
      </div>

      <!-- Datas + texto ofertas -->
      <div style="text-align: right; flex-shrink: 0">
        <span v-if="hasDate" style="color: #333; font-size: 15px; font-weight: bold; display: block">
          Ofertas Validas de {{ dataInicio }} ate {{ dataFim }}
        </span>
        <span v-if="horario" style="color: #333; font-size: 13px; display: block; margin-top: 2px">
          {{ horario }}
        </span>
        <span style="color: #555; font-size: 12px; display: block; margin-top: 2px">
          {{ ofertasTexto }}
        </span>
      </div>

    </div>

    <!-- ══ FAIXA 3: Endereco (mesmo fundo amarelo, borda topo) ══ -->
    <div v-if="endereco" :style="{ backgroundColor: colorBottom, padding: '10px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', borderTop: '1px solid rgba(0,0,0,0.1)' }">
      <span style="font-size: 18px; margin-right: 8px">📍</span>
      <span style="color: #333; font-size: 16px; font-weight: bold">{{ endereco }}</span>
    </div>

    <!-- Avisos legais -->
    <div v-if="showIlustrativa || showEstoque" :style="{ backgroundColor: colorBottom, padding: '4px 24px 8px', textAlign: 'center', width: '100%' }">
      <span style="color: #666; font-size: 10px; font-style: italic">
        <template v-if="showIlustrativa">*Imagens meramente ilustrativas. </template>
        <template v-if="showEstoque">Ofertas validas enquanto durarem os estoques.</template>
      </span>
    </div>

  </footer>
</template>
