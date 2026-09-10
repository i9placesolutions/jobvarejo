<script setup lang="ts">
import { ArrowLeft, Check, CreditCard, FileUp, Loader2, MapPin, MessageCircle, Plus, Save, Search, Store, Trash2, X } from 'lucide-vue-next'
import {
  BUSINESS_PAYMENT_OPTIONS,
  DEFAULT_BUSINESS_PAYMENT_METHODS,
  getBusinessPaymentAssetKey,
  normalizeBusinessProfile,
  type BusinessEntry,
} from '~/utils/businessProfile'
import { BUSINESS_PAYMENT_CARD_OPTIONS } from '~/utils/paymentCards'
import { paymentBrandSvg } from '~/utils/paymentBrandSvg'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false,
})

const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()
const route = useRoute()
const isOnboarding = computed(() => String(route.query.onboarding || '') === '1')
const profile = ref<any>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const isUploading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const logoInput = ref<HTMLInputElement | null>(null)
const paymentCardSearch = ref('')
let entrySequence = 0

const returnTarget = computed<string>(() => {
  const raw = String(Array.isArray(route.query.returnTo)
    ? route.query.returnTo[0] ?? ''
    : route.query.returnTo ?? '')
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
})
const returnLabel = computed(() => returnTarget.value.startsWith('/editor/') ? 'Voltar ao encarte' : 'Voltar ao dashboard')

const form = reactive({
  companyName: '',
  logo: '',
  phone: '',
  whatsapp: '',
  whatsappNumbers: [] as BusinessEntry[],
  address: '',
  addresses: [] as BusinessEntry[],
  instagram: '',
  facebook: '',
  website: '',
  slogan: '',
  cep: '',
  hours: '',
  footerPaymentImages: [] as string[],
  paymentNotes: '',
  paymentMethods: [...DEFAULT_BUSINESS_PAYMENT_METHODS],
})

const logoUrl = computed(() => {
  const raw = String(form.logo || '').trim()
  if (!raw) return ''
  if (/^(https?:|data:|blob:|\/api\/)/i.test(raw)) return raw
  return `/api/storage/p?key=${encodeURIComponent(raw)}`
})

const createEntry = (prefix: 'whatsapp' | 'address'): BusinessEntry => ({
  id: `${prefix}-draft-${++entrySequence}`,
  label: '',
  value: '',
})

const ensureEntryDrafts = () => {
  if (!form.whatsappNumbers.length) form.whatsappNumbers.push(createEntry('whatsapp'))
  if (!form.addresses.length) form.addresses.push(createEntry('address'))
}

const cleanEntries = (entries: BusinessEntry[]) => entries
  .map(entry => ({
    id: String(entry.id || '').trim(),
    label: String(entry.label || '').trim(),
    value: String(entry.value || '').trim(),
  }))
  .filter(entry => entry.value)

const syncLegacyContactFields = () => {
  const whatsapp = cleanEntries(form.whatsappNumbers)
  const addresses = cleanEntries(form.addresses)
  form.whatsapp = whatsapp[0]?.value || ''
  form.address = addresses[0]?.value || ''
}

const addEntry = (kind: 'whatsapp' | 'address') => {
  const target = kind === 'whatsapp' ? form.whatsappNumbers : form.addresses
  if (target.length >= 8) return
  target.push(createEntry(kind))
}

const removeEntry = (kind: 'whatsapp' | 'address', id: string) => {
  const target = kind === 'whatsapp' ? form.whatsappNumbers : form.addresses
  const index = target.findIndex(entry => entry.id === id)
  if (index >= 0) target.splice(index, 1)
  syncLegacyContactFields()
}

const loadProfile = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    await auth.getSession()
    const headers = await getApiAuthHeaders()
    profile.value = await $fetch<any>('/api/profile', { headers })
    const normalized = normalizeBusinessProfile(profile.value?.business_profile)
    Object.assign(form, normalized)
    if (!form.companyName) form.companyName = String(profile.value?.name || '')
    if (!Array.isArray(form.paymentMethods)) form.paymentMethods = [...DEFAULT_BUSINESS_PAYMENT_METHODS]
    // The empty draft makes it obvious that another number/endereço can be
    // added, without persisting a blank value.
    ensureEntryDrafts()
  } catch (error: any) {
    errorMessage.value = String(error?.data?.statusMessage || error?.message || 'Não foi possível carregar o cadastro.')
  } finally {
    isLoading.value = false
  }
}

const isPaymentSelected = (id: string) => form.paymentMethods.includes(id)

const togglePayment = (id: string) => {
  form.paymentMethods = isPaymentSelected(id)
    ? form.paymentMethods.filter(item => item !== id)
    : [...form.paymentMethods, id]
}

const selectAllPayments = () => {
  const cardIds = form.paymentMethods.filter(isCardPaymentId)
  form.paymentMethods = Array.from(new Set([...BUSINESS_PAYMENT_OPTIONS.map(option => option.id), ...cardIds]))
}

const clearAllPayments = () => {
  form.paymentMethods = []
}

const isCardPaymentId = (id: string) => id.startsWith('cartao-')

const filteredPaymentCards = computed(() => {
  const query = paymentCardSearch.value.trim().toLocaleLowerCase('pt-BR')
  if (!query) return BUSINESS_PAYMENT_CARD_OPTIONS
  return BUSINESS_PAYMENT_CARD_OPTIONS.filter(card => `${card.label} ${card.id}`.toLocaleLowerCase('pt-BR').includes(query))
})

const selectedPaymentCardCount = computed(() => form.paymentMethods.filter(isCardPaymentId).length)

const selectAllPaymentCards = () => {
  form.paymentMethods = Array.from(new Set([
    ...form.paymentMethods,
    ...BUSINESS_PAYMENT_CARD_OPTIONS.map(card => card.id),
  ]))
}

const clearPaymentCards = () => {
  form.paymentMethods = form.paymentMethods.filter(id => !isCardPaymentId(id))
}

const saveProfile = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  syncLegacyContactFields()
  try {
    const headers = await getApiAuthHeaders()
    const response = await $fetch<any>('/api/profile', {
      method: 'PUT',
      headers,
      body: {
        business_profile: {
          ...form,
          whatsappNumbers: cleanEntries(form.whatsappNumbers),
          addresses: cleanEntries(form.addresses),
        },
      },
    })
    profile.value = response
    const saved = normalizeBusinessProfile(response?.business_profile)
    Object.assign(form, saved)
    ensureEntryDrafts()
    successMessage.value = 'Cadastro comercial atualizado.'
    if (isOnboarding.value && typeof window !== 'undefined') {
      window.localStorage.removeItem('jobvarejo:business-profile-onboarding-pending')
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('business-profile:updated', { detail: response }))
    }
  } catch (error: any) {
    errorMessage.value = String(error?.data?.statusMessage || error?.message || 'Não foi possível salvar o cadastro.')
  } finally {
    isSaving.value = false
  }
}

const chooseLogo = () => logoInput.value?.click()

const handleLogo = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  isUploading.value = true
  errorMessage.value = ''
  try {
    const formData = new FormData()
    formData.append('file', file)
    const headers = await getApiAuthHeaders()
    const response = await $fetch<any>('/api/brands/upload', { method: 'POST', headers, body: formData })
    form.logo = String(response?.key || response?.canonicalUrl || response?.url || '').trim()
    successMessage.value = 'Logo carregada. Salve o cadastro para aplicar.'
  } catch (error: any) {
    errorMessage.value = String(error?.data?.statusMessage || error?.message || 'Não foi possível carregar a logo.')
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

onMounted(loadProfile)
</script>

<template>
  <div class="business-profile-page min-h-screen">
    <header class="page-header">
      <div class="page-header__inner">
        <button class="icon-button" type="button" :title="returnLabel" :aria-label="returnLabel" @click="navigateTo(returnTarget)">
          <ArrowLeft class="h-4 w-4" />
        </button>
        <div class="brand">
          <span class="brand__mark"><Store class="h-4 w-4" /></span>
          <div><strong>Cadastro da loja</strong><small>Perfil comercial nativo do JobVarejo</small></div>
        </div>
        <NuxtLink class="back-link" :to="returnTarget">{{ returnLabel }}</NuxtLink>
      </div>
    </header>

    <main class="page-main">
      <div class="page-intro">
        <p>{{ isOnboarding ? 'PRIMEIRO PASSO' : 'IDENTIDADE COMERCIAL' }}</p>
        <h1>{{ isOnboarding ? 'Configure sua loja antes do primeiro encarte' : 'Dados que aparecem nos seus encartes' }}</h1>
        <span>{{ isOnboarding ? 'Preencha o que deve aparecer no encarte. Depois você poderá alterar tudo por um botão discreto na edição rápida.' : 'Salve uma vez e reutilize o cadastro nos próximos encartes da edição rápida.' }}</span>
      </div>

      <div v-if="errorMessage" class="feedback feedback--error"><X class="h-4 w-4" />{{ errorMessage }}</div>
      <div v-if="successMessage" class="feedback feedback--success"><Check class="h-4 w-4" />{{ successMessage }}</div>
      <div v-if="isLoading" class="loading"><Loader2 class="h-6 w-6 animate-spin" />Carregando cadastro...</div>

      <form v-else class="profile-layout" @submit.prevent="saveProfile">
        <section class="profile-form surface">
          <div class="surface-title"><div><p>MARCA</p><h2>Identidade</h2></div><span class="status-dot">Sincronizado</span></div>
          <div class="logo-row">
            <div class="logo-preview"><img v-if="logoUrl" :src="logoUrl" :alt="form.companyName || 'Logo da loja'" /><Store v-else class="h-7 w-7" /></div>
            <div><strong>Logo padrão da loja</strong><p>Ela será usada nos encartes quando o campo Logo da loja estiver ativo.</p><button class="secondary-button" type="button" :disabled="isUploading" @click="chooseLogo"><Loader2 v-if="isUploading" class="h-4 w-4 animate-spin" /><FileUp v-else class="h-4 w-4" />Escolher arquivo</button><input ref="logoInput" type="file" accept="image/*" hidden @change="handleLogo" /></div>
          </div>
          <div class="form-grid"><label><span>Nome da loja</span><input v-model="form.companyName" type="text" maxlength="160" /></label><label><span>Slogan</span><input v-model="form.slogan" type="text" maxlength="180" placeholder="A melhor oferta perto de você" /></label></div>
        </section>

        <section class="profile-form surface">
          <div class="surface-title"><div><p>CONTATO</p><h2>Onde o cliente encontra você</h2></div></div>
          <div class="repeatable-grid">
            <div class="repeatable-field">
              <div class="field-heading"><span><MessageCircle class="field-icon" />WhatsApp</span><small>Você pode cadastrar até 8 números</small></div>
              <div v-for="(entry, index) in form.whatsappNumbers" :key="entry.id" class="repeatable-row">
                <input v-model="entry.label" type="text" maxlength="60" :aria-label="`Nome do WhatsApp ${index + 1}`" placeholder="Ex.: Loja / Delivery" />
                <input v-model="entry.value" type="text" maxlength="80" :aria-label="`Número do WhatsApp ${index + 1}`" placeholder="(00) 00000-0000" />
                <button class="remove-entry" type="button" :aria-label="`Remover WhatsApp ${index + 1}`" @click="removeEntry('whatsapp', entry.id)"><Trash2 class="h-4 w-4" /></button>
              </div>
              <button class="add-entry" type="button" :disabled="form.whatsappNumbers.length >= 8" @click="addEntry('whatsapp')"><Plus class="h-4 w-4" />Adicionar WhatsApp</button>
            </div>

            <label class="single-field"><span>Telefone</span><input v-model="form.phone" type="text" placeholder="(00) 0000-0000" /></label>

            <div class="repeatable-field repeatable-field--wide">
              <div class="field-heading"><span><MapPin class="field-icon" />Endereço</span><small>Cadastre filiais, lojas ou mais de um endereço</small></div>
              <div v-for="(entry, index) in form.addresses" :key="entry.id" class="repeatable-row repeatable-row--address">
                <input v-model="entry.label" type="text" maxlength="60" :aria-label="`Nome do endereço ${index + 1}`" placeholder="Ex.: Loja centro" />
                <textarea v-model="entry.value" rows="2" maxlength="300" :aria-label="`Endereço ${index + 1}`" placeholder="Rua, número, bairro e cidade"></textarea>
                <button class="remove-entry" type="button" :aria-label="`Remover endereço ${index + 1}`" @click="removeEntry('address', entry.id)"><Trash2 class="h-4 w-4" /></button>
              </div>
              <button class="add-entry" type="button" :disabled="form.addresses.length >= 8" @click="addEntry('address')"><Plus class="h-4 w-4" />Adicionar endereço</button>
            </div>
          </div>
          <div class="form-grid contact-extra"><label><span>CEP</span><input v-model="form.cep" type="text" placeholder="00000-000" /></label><label><span>Site</span><input v-model="form.website" type="text" placeholder="www.sualoja.com.br" /></label><label class="full"><span>Horário de funcionamento</span><input v-model="form.hours" type="text" placeholder="Seg a sáb: 7h às 21h · Dom: 8h às 18h" /></label></div>
        </section>

        <section class="profile-form surface">
          <div class="surface-title"><div><p>REDES SOCIAIS</p><h2>Atalhos do encarte</h2></div></div>
          <div class="form-grid"><label><span>Instagram</span><input v-model="form.instagram" type="text" placeholder="@sualoja" /></label><label><span>Facebook</span><input v-model="form.facebook" type="text" placeholder="sualoja" /></label></div>
        </section>

        <section class="profile-form surface">
          <div class="surface-title"><div><p>FORMAS DE PAGAMENTO</p><h2>O que a loja aceita</h2></div><CreditCard class="section-icon" /></div>
          <p class="surface-help">Essas opções ficam disponíveis para reutilizar em qualquer encarte. Selecione também os cartões próprios da sua loja.</p>
          <div class="payment-actions"><button type="button" @click="selectAllPayments">Selecionar opções comuns</button><button type="button" @click="clearAllPayments">Limpar tudo</button><span>{{ form.paymentMethods.length }} selecionada(s)</span></div>
          <div class="payment-grid">
            <button v-for="option in BUSINESS_PAYMENT_OPTIONS" :key="option.id" type="button" :class="['payment-option', isPaymentSelected(option.id) ? 'payment-option--active' : '']" :aria-pressed="isPaymentSelected(option.id)" @click="togglePayment(option.id)">
              <span v-if="paymentBrandSvg[getBusinessPaymentAssetKey(option.id)]" class="payment-option__logo" v-html="paymentBrandSvg[getBusinessPaymentAssetKey(option.id)]"></span><span v-else class="payment-option__mark" :style="{ backgroundColor: option.color }"></span><span>{{ option.label }}</span><span v-if="isPaymentSelected(option.id)" class="payment-option__check">✓</span>
            </button>
          </div>

          <FooterPaymentPicker v-model="form.footerPaymentImages" />
          <div class="card-library">
            <div class="card-library__header"><div><h3>Cartões da loja</h3><p>Biblioteca com 92 cartões do catálogo Varejoon. A seleção vale para todos os encartes.</p></div><strong>{{ selectedPaymentCardCount }} selecionado(s)</strong></div>
            <div class="card-library__toolbar"><label class="search-field"><Search class="h-4 w-4" /><input v-model="paymentCardSearch" type="search" placeholder="Buscar cartão pelo nome" aria-label="Buscar cartão" /></label><button type="button" @click="selectAllPaymentCards">Selecionar todos</button><button type="button" @click="clearPaymentCards">Limpar cartões</button></div>
            <div class="card-grid">
              <button v-for="card in filteredPaymentCards" :key="card.id" type="button" :class="['card-option', isPaymentSelected(card.id) ? 'card-option--active' : '']" :aria-pressed="isPaymentSelected(card.id)" @click="togglePayment(card.id)">
                <span class="card-option__image"><img :src="card.imageUrl" :alt="card.label" loading="lazy" /></span><span class="card-option__label">{{ card.label }}</span><span v-if="isPaymentSelected(card.id)" class="card-option__check">✓</span>
              </button>
            </div>
            <p v-if="!filteredPaymentCards.length" class="card-library__empty">Nenhum cartão encontrado.</p>
          </div>
          <label class="textarea-field"><span>Observação de pagamento</span><textarea v-model="form.paymentNotes" maxlength="240" placeholder="Ex.: Aceitamos até 2 cartões por compra."></textarea></label>
        </section>

        <button class="save-button" type="submit" :disabled="isSaving"><Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" /><Save v-else class="h-4 w-4" />Salvar cadastro comercial</button>
      </form>
    </main>
  </div>
</template>

<style scoped>
.business-profile-page { background: #f5f7fa; color: #172033; }
.page-header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,.95); border-bottom: 1px solid #e2e8f0; backdrop-filter: blur(12px); }
.page-header__inner { max-width: 1100px; min-height: 68px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 14px; }
.icon-button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; color: #64748b; background: #f8fafc; cursor: pointer; }
.brand { display: flex; align-items: center; gap: 10px; flex: 1; }.brand__mark { width: 34px; height: 34px; display: grid; place-items: center; color: #ea580c; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 9px; }.brand strong, .brand small { display: block; }.brand strong { font-size: 14px; }.brand small { color: #64748b; font-size: 10px; margin-top: 2px; }.back-link { color: #c2410c; text-decoration: none; font-size: 12px; font-weight: 800; }
.page-main { max-width: 900px; margin: 0 auto; padding: 38px 24px 64px; }.page-intro p, .surface-title p { color: #ea580c; font-size: 10px; letter-spacing: .13em; font-weight: 800; margin: 0 0 7px; }.page-intro h1 { font-size: 32px; line-height: 1.05; margin: 0; }.page-intro span { display: block; color: #64748b; font-size: 13px; margin-top: 9px; }
.feedback { display: flex; align-items: center; gap: 8px; border-radius: 9px; padding: 11px 13px; font-size: 12px; margin-top: 18px; }.feedback--error { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; }.feedback--success { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; }.loading { min-height: 360px; display: grid; place-items: center; align-content: center; gap: 10px; color: #64748b; }
.profile-layout { display: grid; gap: 14px; margin-top: 24px; }.surface { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; }.surface-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.surface-title h2 { font-size: 17px; margin: 0; }.status-dot { color: #047857; background: #ecfdf5; border-radius: 999px; padding: 5px 8px; font-size: 10px; }.section-icon { width: 20px; height: 20px; color: #ea580c; }
.logo-row { display: flex; align-items: center; gap: 14px; margin: 18px 0 20px; }.logo-preview { width: 76px; height: 76px; display: grid; place-items: center; overflow: hidden; border: 1px dashed #fdba74; border-radius: 10px; color: #ea580c; background: #fff7ed; }.logo-preview img { width: 100%; height: 100%; object-fit: contain; }.logo-row strong { font-size: 13px; }.logo-row p { color: #64748b; font-size: 11px; margin: 4px 0 9px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }.form-grid label, .single-field { display: grid; gap: 6px; }.form-grid label.full { grid-column: 1 / -1; }.form-grid span, .single-field > span, .field-heading > span { color: #475569; font-size: 11px; font-weight: 700; }.form-grid input, .single-field input { height: 40px; padding: 0 11px; border: 1px solid #dbe3ed; border-radius: 8px; color: #172033; font-size: 13px; outline: none; }.form-grid input:focus, .single-field input:focus, .repeatable-row input:focus, .repeatable-row textarea:focus, .textarea-field textarea:focus, .search-field input:focus { border-color: #fb923c; box-shadow: 0 0 0 3px rgba(251,146,60,.12); outline: none; }
.secondary-button, .save-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; cursor: pointer; font-weight: 800; }.secondary-button { min-height: 34px; padding: 0 11px; background: #f8fafc; color: #475569; border: 1px solid #dbe3ed; font-size: 11px; }.save-button { min-height: 46px; border: 0; background: #ea580c; color: #fff; font-size: 13px; }.save-button:disabled, .secondary-button:disabled, .add-entry:disabled { opacity: .5; cursor: wait; }
.repeatable-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(230px, .62fr); gap: 20px 14px; margin-top: 18px; }.repeatable-field--wide { grid-column: 1 / -1; }.field-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; }.field-heading > span { display: inline-flex; align-items: center; gap: 6px; }.field-heading small { color: #94a3b8; font-size: 10px; font-weight: 500; }.field-icon { width: 14px; height: 14px; color: #ea580c; }.repeatable-row { display: grid; grid-template-columns: minmax(110px, .42fr) minmax(0, 1fr) 34px; gap: 7px; margin-bottom: 7px; }.repeatable-row input, .repeatable-row textarea { width: 100%; border: 1px solid #dbe3ed; border-radius: 8px; color: #172033; background: #fff; font-size: 12px; outline: none; }.repeatable-row input { height: 40px; padding: 0 10px; }.repeatable-row textarea { min-height: 56px; padding: 9px 10px; resize: vertical; }.repeatable-row--address { grid-template-columns: minmax(110px, .35fr) minmax(0, 1fr) 34px; }.remove-entry { display: grid; place-items: center; height: 40px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; cursor: pointer; }.repeatable-row--address .remove-entry { height: 56px; }.add-entry { display: inline-flex; align-items: center; gap: 5px; min-height: 31px; margin-top: 2px; padding: 0 9px; color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 999px; font-size: 10px; font-weight: 800; cursor: pointer; }.contact-extra { margin-top: 20px; }
.surface-help { color: #64748b; font-size: 11px; line-height: 1.5; margin: 12px 0 14px; }.payment-actions, .card-library__toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }.payment-actions button, .card-library__toolbar > button { color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 999px; padding: 5px 9px; font-size: 10px; font-weight: 800; cursor: pointer; }.payment-actions button:nth-child(2), .card-library__toolbar > button:last-child { color: #64748b; background: #f8fafc; border-color: #dbe3ed; }.payment-actions span { color: #94a3b8; font-size: 10px; margin-left: auto; }.payment-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }.payment-option { min-height: 52px; display: flex; align-items: center; gap: 7px; position: relative; padding: 7px 8px; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; background: #f8fafc; font-size: 10px; text-align: left; cursor: pointer; transition: border-color .16s ease, background-color .16s ease, transform .16s ease; }.payment-option:hover, .card-option:hover { border-color: #fdba74; background: #fff7ed; transform: translateY(-1px); }.payment-option--active, .card-option--active { border-color: #fb923c; background: #fff7ed; color: #9a3412; box-shadow: 0 0 0 2px rgba(251,146,60,.1); }.payment-option__logo { width: 38px; height: 26px; display: block; overflow: hidden; flex: 0 0 38px; border-radius: 4px; }.payment-option__logo :deep(svg) { width: 100%; height: 100%; display: block; }.payment-option__mark { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }.payment-option__check, .card-option__check { margin-left: auto; color: #ea580c; font-size: 12px; font-weight: 900; }
.card-library { margin-top: 22px; padding-top: 18px; border-top: 1px solid #e2e8f0; }.card-library__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }.card-library__header h3 { margin: 0; font-size: 14px; }.card-library__header p { max-width: 560px; margin: 4px 0 14px; color: #64748b; font-size: 11px; line-height: 1.45; }.card-library__header strong { flex: 0 0 auto; color: #c2410c; font-size: 10px; }.search-field { min-width: 220px; flex: 1; height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 10px; color: #94a3b8; border: 1px solid #dbe3ed; border-radius: 8px; background: #fff; }.search-field input { width: 100%; min-width: 0; border: 0; color: #172033; font-size: 12px; outline: none; }.card-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; max-height: 470px; overflow: auto; padding: 2px; }.card-option { position: relative; min-width: 0; display: grid; gap: 5px; padding: 7px; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569; background: #f8fafc; text-align: left; cursor: pointer; }.card-option__image { display: block; aspect-ratio: 313 / 198; overflow: hidden; border-radius: 5px; background: #e2e8f0; }.card-option__image img { width: 100%; height: 100%; display: block; object-fit: cover; }.card-option__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 700; }.card-library__empty { color: #64748b; font-size: 11px; }.textarea-field { display: grid; gap: 6px; margin-top: 16px; }.textarea-field span { color: #475569; font-size: 11px; font-weight: 700; }.textarea-field textarea { min-height: 72px; resize: vertical; padding: 9px 11px; border: 1px solid #dbe3ed; border-radius: 8px; color: #172033; font-size: 12px; outline: none; }
@media (max-width: 700px) { .page-header__inner, .page-main { padding-left: 14px; padding-right: 14px; }.page-intro h1 { font-size: 26px; }.repeatable-grid, .form-grid { grid-template-columns: 1fr; }.form-grid label.full, .repeatable-field--wide { grid-column: auto; }.back-link { display: none; }.payment-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.card-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }.card-library__toolbar { flex-wrap: wrap; }.search-field { min-width: 100%; order: -1; }.repeatable-row, .repeatable-row--address { grid-template-columns: minmax(95px, .4fr) minmax(0, 1fr) 34px; } }
@media (max-width: 430px) { .card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.payment-actions { flex-wrap: wrap; }.payment-actions span { margin-left: 0; width: 100%; }.repeatable-row, .repeatable-row--address { grid-template-columns: 1fr 34px; }.repeatable-row input:first-child { grid-column: 1 / -1; }.repeatable-row textarea { grid-column: 1; }.repeatable-row--address .remove-entry { grid-column: 2; grid-row: 1 / span 2; height: 100%; } }
</style>
