<script setup lang="ts">
import {
  Building2,
  Check,
  CreditCard,
  FileUp,
  Image as ImageIcon,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Store,
  WalletCards,
} from 'lucide-vue-next'
import {
  BUSINESS_PAYMENT_OPTIONS,
  formatBusinessAddressValues,
  formatBusinessContactValues,
} from '~/utils/businessProfile'

type SetupField =
  | 'logo'
  | 'companyName'
  | 'slogan'
  | 'phone'
  | 'whatsapp'
  | 'address'
  | 'hours'
  | 'instagram'
  | 'facebook'
  | 'website'
  | 'footerPaymentImages'
  | 'paymentMethods'
  | 'paymentNotes'

type SetupFieldDefinition = {
  label: string
  hint: string
  placeholder?: string
  kind: 'text' | 'textarea' | 'logo' | 'payments' | 'footerCards'
  icon: any
}

const FIELD_DEFINITIONS: Record<SetupField, SetupFieldDefinition> = {
  logo: {
    label: 'Logo da loja',
    hint: 'Ela aparecerá neste espaço do encarte.',
    kind: 'logo',
    icon: ImageIcon,
  },
  companyName: {
    label: 'Nome da loja',
    hint: 'Use o nome que seus clientes reconhecem.',
    placeholder: 'Ex.: Supermercado Central',
    kind: 'text',
    icon: Store,
  },
  slogan: {
    label: 'Slogan',
    hint: 'Uma frase curta que aparece no tema.',
    placeholder: 'Ex.: Economia todo dia',
    kind: 'text',
    icon: Building2,
  },
  phone: {
    label: 'Telefone',
    hint: 'Número para contato da loja.',
    placeholder: '(00) 0000-0000',
    kind: 'text',
    icon: Phone,
  },
  whatsapp: {
    label: 'WhatsApp',
    hint: 'O número que recebe pedidos e dúvidas.',
    placeholder: '(00) 00000-0000',
    kind: 'text',
    icon: MessageCircle,
  },
  address: {
    label: 'Endereço',
    hint: 'Inclua rua, número, bairro e cidade.',
    placeholder: 'Rua das Flores, 100 - Centro',
    kind: 'textarea',
    icon: MapPin,
  },
  hours: {
    label: 'Horário de funcionamento',
    hint: 'Ajuda o cliente a saber quando pode ir à loja.',
    placeholder: 'Seg. a sáb.: 8h às 20h',
    kind: 'text',
    icon: Building2,
  },
  instagram: {
    label: 'Instagram',
    hint: 'Digite o @ da loja.',
    placeholder: '@sualoja',
    kind: 'text',
    icon: Instagram,
  },
  facebook: {
    label: 'Facebook',
    hint: 'Página ou usuário da loja.',
    placeholder: 'sualoja',
    kind: 'text',
    icon: Building2,
  },
  website: {
    label: 'Site',
    hint: 'Endereço do site da loja.',
    placeholder: 'www.sualoja.com.br',
    kind: 'text',
    icon: Building2,
  },
  footerPaymentImages: { label: 'Cartões aceitos', hint: 'Escolha até cinco imagens do sistema.', kind: 'footerCards', icon: WalletCards },
  paymentMethods: {
    label: 'Formas de pagamento',
    hint: 'Marque o que sua loja realmente aceita.',
    kind: 'payments',
    icon: WalletCards,
  },
  paymentNotes: {
    label: 'Observação de pagamento',
    hint: 'Uma condição curta que aparece no tema.',
    placeholder: 'Consulte condições de pagamento.',
    kind: 'textarea',
    icon: CreditCard,
  },
}

const FIELD_ALIASES: Record<string, SetupField> = {
  logo: 'logo',
  companyname: 'companyName',
  company_name: 'companyName',
  name: 'companyName',
  slogan: 'slogan',
  phone: 'phone',
  whatsapp: 'whatsapp',
  address: 'address',
  hours: 'hours',
  instagram: 'instagram',
  facebook: 'facebook',
  website: 'website',
  footerpaymentimages: 'footerPaymentImages',
  paymentmethods: 'paymentMethods',
  payment_methods: 'paymentMethods',
  payments: 'paymentMethods',
  paymentnotes: 'paymentNotes',
  payment_notes: 'paymentNotes',
}

const props = defineProps<{
  open: boolean
  fields?: string[]
  businessProfile?: Record<string, any>
  busy?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'complete', payload: {
    businessProfile: Record<string, any>
    hiddenFields: string[]
    logoFile?: File | null
  }): void
}>()

const logoInput = ref<HTMLInputElement | null>(null)
const logoFile = ref<File | null>(null)
const skippedFields = ref<Record<string, boolean>>({})
const validationMessage = ref('')

const form = reactive<Record<SetupField, any>>({
  logo: '',
  companyName: '',
  slogan: '',
  phone: '',
  whatsapp: '',
  address: '',
  hours: '',
  instagram: '',
  facebook: '',
  website: '',
  footerPaymentImages: [] as string[],
  paymentMethods: [],
  paymentNotes: '',
})

const fields = computed<SetupField[]>(() => {
  const seen = new Set<SetupField>()
  return (Array.isArray(props.fields) ? props.fields : [])
    .map(value => FIELD_ALIASES[String(value || '').trim().replace(/\s+/g, '').toLowerCase()] || null)
    .filter((field): field is SetupField => !!field)
    .filter(field => {
      if (seen.has(field)) return false
      seen.add(field)
      return true
    })
})

const visibleFields = computed(() => fields.value.filter(field => !skippedFields.value[field]))
const skippedFieldList = computed(() => fields.value.filter(field => skippedFields.value[field]))

const getProfileText = (profile: Record<string, any>, field: SetupField): string => {
  if (field === 'address') {
    return formatBusinessAddressValues(
      profile.addresses ?? profile.enderecos ?? profile.addressList,
      profile.address,
    )
  }
  if (field === 'whatsapp') {
    return formatBusinessContactValues(
      profile.whatsappNumbers ?? profile.whatsapp_numbers ?? profile.whatsapps,
      profile.whatsapp,
    )
  }
  if (field === 'paymentMethods') return ''
  if (field === 'paymentNotes') return String(profile.paymentNotes ?? profile.payment_notes ?? '').trim()
  return String(profile[field] ?? '').trim()
}

const hydrate = () => {
  const profile = props.businessProfile || {}
  const fallbackCompanyName = profile.__companyNameFromAccountFallback === true
  fields.value.forEach(field => {
    if (field === 'footerPaymentImages') { form.footerPaymentImages = [...(profile.footerPaymentImages || [])].slice(0, 5); return }
    if (field === 'paymentMethods') {
      const hasConfirmedPaymentMethods = profile.__paymentMethodsConfigured !== false
      form.paymentMethods = hasConfirmedPaymentMethods && Array.isArray(profile.paymentMethods ?? profile.payment_methods)
        ? [...(profile.paymentMethods ?? profile.payment_methods)]
        : []
      return
    }
    if (field === 'logo') {
      form.logo = String(profile.logo || '').trim()
      return
    }
    form[field] = field === 'companyName' && fallbackCompanyName
      ? ''
      : getProfileText(profile, field)
  })
  logoFile.value = null
  skippedFields.value = {}
  validationMessage.value = ''
}

watch(
  [() => props.open, fields, () => props.businessProfile],
  ([open]) => {
    if (open) hydrate()
  },
  { immediate: true, deep: true },
)

const isComplete = (field: SetupField): boolean => {
  if (skippedFields.value[field]) return true
  if (field === 'logo') return !!logoFile.value || !!String(form.logo || '').trim()
  if (field === 'footerPaymentImages') return form.footerPaymentImages.length > 0
  if (field === 'paymentMethods') return Array.isArray(form.paymentMethods) && form.paymentMethods.length > 0
  return !!String(form[field] || '').trim()
}

const incompleteFields = computed(() => visibleFields.value.filter(field => !isComplete(field)))
const canContinue = computed(() => incompleteFields.value.length === 0 && !props.busy)

const togglePayment = (id: string) => {
  const values = Array.isArray(form.paymentMethods) ? form.paymentMethods : []
  form.paymentMethods = values.includes(id)
    ? values.filter((value: string) => value !== id)
    : [...values, id]
}

const handleLogo = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  if (!file) return
  logoFile.value = file
  skippedFields.value = { ...skippedFields.value, logo: false }
  validationMessage.value = ''
  input.value = ''
}

const hideField = (field: SetupField) => {
  skippedFields.value = { ...skippedFields.value, [field]: true }
  validationMessage.value = ''
}

const restoreField = (field: SetupField) => {
  skippedFields.value = { ...skippedFields.value, [field]: false }
  validationMessage.value = ''
}

const submit = () => {
  if (!canContinue.value) {
    validationMessage.value = 'Preencha os campos visíveis ou escolha não mostrá-los neste encarte.'
    return
  }

  const businessProfile: Record<string, any> = {}
  fields.value.forEach(field => {
    if (skippedFields.value[field] || field === 'logo') return
    if (field === 'paymentMethods') {
      businessProfile.paymentMethods = [...form.paymentMethods]
      return
    }
    if (field === 'footerPaymentImages') { businessProfile.footerPaymentImages = [...form.footerPaymentImages]; return }
    businessProfile[field] = String(form[field] || '').trim()
  })

  emit('complete', {
    businessProfile,
    hiddenFields: skippedFieldList.value,
    logoFile: logoFile.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="quick-setup-dialog">
      <div v-if="open" class="quick-setup-backdrop" role="presentation">
        <section
          class="quick-setup-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-setup-title"
          aria-describedby="quick-setup-description"
        >
          <header class="quick-setup-dialog__header">
            <span class="quick-setup-dialog__badge"><Check :size="15" />Etapa rápida</span>
            <h2 id="quick-setup-title">Complete os dados deste encarte</h2>
            <p id="quick-setup-description">
              Este modelo usa os campos abaixo. Preencha uma vez para reutilizá-los nos próximos encartes.
            </p>
          </header>

          <form class="quick-setup-dialog__body" @submit.prevent="submit">
            <article
              v-for="field in visibleFields"
              :key="field"
              class="quick-setup-field"
            >
              <div class="quick-setup-field__heading">
                <span class="quick-setup-field__icon"><component :is="FIELD_DEFINITIONS[field].icon" :size="17" /></span>
                <div>
                  <strong>{{ FIELD_DEFINITIONS[field].label }}</strong>
                  <small>{{ FIELD_DEFINITIONS[field].hint }}</small>
                </div>
              </div>

              <template v-if="FIELD_DEFINITIONS[field].kind === 'logo'">
                <div class="quick-setup-logo-picker">
                  <span v-if="logoFile" class="quick-setup-logo-picker__file">{{ logoFile.name }}</span>
                  <span v-else-if="form.logo" class="quick-setup-logo-picker__file">Logo já cadastrada</span>
                  <span v-else class="quick-setup-logo-picker__empty">Nenhum arquivo selecionado</span>
                  <button type="button" :disabled="busy" @click="logoInput?.click()"><FileUp :size="16" />Escolher imagem</button>
                  <input ref="logoInput" type="file" accept="image/*" hidden @change="handleLogo" />
                </div>
              </template>

              <FooterPaymentPicker v-else-if="field === 'footerPaymentImages'" v-model="form.footerPaymentImages" />
              <template v-else-if="FIELD_DEFINITIONS[field].kind === 'payments'">
                <div class="quick-setup-payments" role="group" aria-label="Formas de pagamento">
                  <button
                    v-for="option in BUSINESS_PAYMENT_OPTIONS"
                    :key="option.id"
                    type="button"
                    :aria-pressed="form.paymentMethods.includes(option.id)"
                    :class="{ 'is-selected': form.paymentMethods.includes(option.id) }"
                    :disabled="busy"
                    @click="togglePayment(option.id)"
                  >
                    <span class="quick-setup-payments__dot" :style="{ backgroundColor: option.color }"></span>{{ option.label }}
                  </button>
                </div>
              </template>

              <textarea
                v-else-if="FIELD_DEFINITIONS[field].kind === 'textarea'"
                v-model="form[field]"
                :disabled="busy"
                :placeholder="FIELD_DEFINITIONS[field].placeholder"
                rows="2"
              />
              <input
                v-else
                v-model="form[field]"
                :disabled="busy"
                :placeholder="FIELD_DEFINITIONS[field].placeholder"
                type="text"
              />

              <button type="button" class="quick-setup-field__skip" :disabled="busy" @click="hideField(field)">
                Não quero mostrar {{ FIELD_DEFINITIONS[field].label.toLocaleLowerCase('pt-BR') }} neste encarte
              </button>
            </article>

            <section v-if="skippedFieldList.length" class="quick-setup-skipped">
              <strong>Não será mostrado neste encarte</strong>
              <div>
                <button v-for="field in skippedFieldList" :key="field" type="button" :disabled="busy" @click="restoreField(field)">
                  {{ FIELD_DEFINITIONS[field].label }} <span>Adicionar</span>
                </button>
              </div>
            </section>

            <p v-if="validationMessage || errorMessage" class="quick-setup-dialog__feedback" role="alert">
              {{ errorMessage || validationMessage }}
            </p>

            <footer class="quick-setup-dialog__footer">
              <p>Você poderá alterar esses dados depois em “Ajustes”.</p>
              <button type="submit" :disabled="!canContinue">
                <span v-if="busy" class="quick-setup-dialog__spinner" aria-hidden="true"></span>
                {{ busy ? 'Salvando...' : 'Salvar e continuar' }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.quick-setup-backdrop { position:fixed; inset:0; z-index:920; display:grid; place-items:center; padding:24px; background:rgba(8, 12, 22, .76); backdrop-filter:blur(12px); }
.quick-setup-dialog { width:min(100%, 620px); max-height:min(760px, calc(100dvh - 48px)); overflow:hidden; border:1px solid rgba(191, 219, 254, .28); border-radius:26px; color:#edf4ff; background:linear-gradient(150deg, #172238 0%, #111827 58%, #17152a 100%); box-shadow:0 26px 90px rgba(0,0,0,.5); }
.quick-setup-dialog__header { padding:28px 28px 18px; border-bottom:1px solid rgba(255,255,255,.09); }
.quick-setup-dialog__badge { display:inline-flex; align-items:center; gap:6px; border:1px solid rgba(125,211,252,.28); border-radius:999px; padding:5px 9px; color:#bae6fd; background:rgba(14,165,233,.1); font-size:10px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
.quick-setup-dialog__header h2 { margin:13px 0 6px; font-size:24px; line-height:1.08; letter-spacing:-.025em; }
.quick-setup-dialog__header p { max-width:500px; margin:0; color:#aabbd4; font-size:13px; line-height:1.5; }
.quick-setup-dialog__body { display:grid; gap:12px; max-height:calc(min(760px, 100dvh - 48px) - 178px); overflow-y:auto; padding:18px 28px 28px; }
.quick-setup-field { display:grid; gap:11px; border:1px solid rgba(255,255,255,.095); border-radius:16px; padding:15px; background:rgba(255,255,255,.045); }
.quick-setup-field__heading { display:flex; align-items:flex-start; gap:10px; }
.quick-setup-field__icon { display:grid; flex:0 0 34px; width:34px; height:34px; place-items:center; border:1px solid rgba(186,230,253,.18); border-radius:11px; color:#bae6fd; background:rgba(14,165,233,.1); }
.quick-setup-field__heading div { display:grid; gap:2px; min-width:0; }
.quick-setup-field__heading strong { color:#f8fbff; font-size:14px; line-height:1.2; }
.quick-setup-field__heading small { color:#9baec9; font-size:11px; line-height:1.35; }
.quick-setup-field input:not([type=file]), .quick-setup-field textarea { width:100%; min-height:44px; border:1px solid rgba(191,219,254,.22); border-radius:11px; outline:none; color:#f8fbff; background:rgba(3,7,18,.42); padding:11px 12px; font-size:15px; transition:border-color .18s ease, box-shadow .18s ease, background .18s ease; }
.quick-setup-field textarea { resize:vertical; min-height:74px; line-height:1.4; }
.quick-setup-field input:focus, .quick-setup-field textarea:focus { border-color:#60a5fa; box-shadow:0 0 0 3px rgba(59,130,246,.16); background:rgba(3,7,18,.63); }
.quick-setup-field input::placeholder, .quick-setup-field textarea::placeholder { color:#70829d; }
.quick-setup-field__skip { justify-self:start; border:0; border-radius:7px; padding:3px 0; color:#a5b4fc; background:transparent; font-size:11px; text-align:left; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
.quick-setup-field__skip:hover { color:#ddd6fe; }
.quick-setup-logo-picker { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:48px; border:1px dashed rgba(191,219,254,.28); border-radius:11px; padding:7px 8px 7px 12px; background:rgba(3,7,18,.28); }
.quick-setup-logo-picker__file, .quick-setup-logo-picker__empty { overflow:hidden; color:#c9d7eb; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
.quick-setup-logo-picker__empty { color:#7f90aa; }
.quick-setup-logo-picker button { display:inline-flex; flex:0 0 auto; align-items:center; gap:6px; min-height:34px; border:1px solid rgba(147,197,253,.34); border-radius:9px; color:#dbeafe; background:rgba(59,130,246,.16); padding:0 10px; font-size:11px; font-weight:750; cursor:pointer; }
.quick-setup-logo-picker button:hover:not(:disabled) { background:rgba(59,130,246,.28); }
.quick-setup-payments { display:flex; flex-wrap:wrap; gap:7px; }
.quick-setup-payments button { display:inline-flex; align-items:center; gap:6px; min-height:34px; border:1px solid rgba(255,255,255,.13); border-radius:9px; color:#b7c5d9; background:rgba(3,7,18,.25); padding:0 10px; font-size:11px; font-weight:700; cursor:pointer; transition:transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease; }
.quick-setup-payments button:hover:not(:disabled) { transform:translateY(-1px); border-color:rgba(147,197,253,.55); color:#fff; }
.quick-setup-payments button.is-selected { border-color:rgba(74,222,128,.5); color:#d1fae5; background:rgba(22,163,74,.14); }
.quick-setup-payments__dot { width:7px; height:7px; border-radius:999px; }
.quick-setup-skipped { display:grid; gap:8px; border:1px dashed rgba(196,181,253,.33); border-radius:14px; padding:13px; color:#c4b5fd; background:rgba(124,58,237,.08); }
.quick-setup-skipped strong { font-size:11px; }
.quick-setup-skipped div { display:flex; flex-wrap:wrap; gap:7px; }
.quick-setup-skipped button { border:1px solid rgba(196,181,253,.22); border-radius:8px; color:#e9d5ff; background:rgba(255,255,255,.04); padding:7px 8px; font-size:11px; cursor:pointer; }
.quick-setup-skipped button span { margin-left:5px; color:#a5b4fc; font-weight:800; }
.quick-setup-dialog__feedback { margin:0; border:1px solid rgba(251,113,133,.38); border-radius:11px; color:#fecdd3; background:rgba(190,24,93,.14); padding:10px 12px; font-size:12px; line-height:1.4; }
.quick-setup-dialog__footer { display:flex; align-items:center; justify-content:space-between; gap:15px; border-top:1px solid rgba(255,255,255,.09); margin-top:4px; padding-top:17px; }
.quick-setup-dialog__footer p { max-width:240px; margin:0; color:#8799b3; font-size:10px; line-height:1.4; }
.quick-setup-dialog__footer > button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; border:1px solid rgba(147,197,253,.3); border-radius:12px; color:#fff; background:linear-gradient(135deg, #2563eb, #7c3aed); padding:0 16px; font-size:12px; font-weight:800; cursor:pointer; box-shadow:0 8px 22px rgba(37,99,235,.24); transition:transform .18s ease, filter .18s ease, opacity .18s ease; }
.quick-setup-dialog__footer > button:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px); }
.quick-setup-dialog__footer > button:disabled, .quick-setup-field button:disabled { cursor:wait; opacity:.52; }
.quick-setup-dialog__spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,.42); border-top-color:#fff; border-radius:50%; animation:quick-setup-spin .72s linear infinite; }
.quick-setup-dialog-enter-active, .quick-setup-dialog-leave-active { transition:opacity .2s ease; }
.quick-setup-dialog-enter-active .quick-setup-dialog, .quick-setup-dialog-leave-active .quick-setup-dialog { transition:transform .24s ease, opacity .2s ease; }
.quick-setup-dialog-enter-from, .quick-setup-dialog-leave-to { opacity:0; }
.quick-setup-dialog-enter-from .quick-setup-dialog, .quick-setup-dialog-leave-to .quick-setup-dialog { opacity:0; transform:translateY(18px) scale(.98); }
@keyframes quick-setup-spin { to { transform:rotate(360deg); } }
@media (max-width: 640px) {
  .quick-setup-backdrop { align-items:end; padding:0; }
  .quick-setup-dialog { max-height:calc(100dvh - env(safe-area-inset-top, 0px)); border-right:0; border-bottom:0; border-left:0; border-radius:25px 25px 0 0; }
  .quick-setup-dialog__header { padding:23px 20px 16px; }
  .quick-setup-dialog__header h2 { font-size:22px; }
  .quick-setup-dialog__body { max-height:calc(100dvh - 174px - env(safe-area-inset-top, 0px)); padding:15px 16px calc(18px + env(safe-area-inset-bottom, 0px)); }
  .quick-setup-dialog__footer { align-items:stretch; flex-direction:column; }
  .quick-setup-dialog__footer p { max-width:none; }
  .quick-setup-dialog__footer > button { width:100%; min-height:50px; font-size:14px; }
  .quick-setup-payments button { min-height:38px; }
}
</style>
