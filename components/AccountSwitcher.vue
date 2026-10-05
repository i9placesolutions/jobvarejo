<script setup lang="ts">
import { Building2, ChevronDown, Search } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  variant?: 'topbar' | 'drawer'
}>(), {
  variant: 'topbar'
})

const auth = useAuth()
const accounts = ref<{ id: string; label: string; email: string }[]>([])
const selectedId = ref('')
const search = ref('')
const loading = ref(false)
const error = ref('')
const detailsRef = ref<HTMLDetailsElement | null>(null)

const selectedAccount = computed(() => accounts.value.find(account => account.id === selectedId.value))
const selectedLabel = computed(() => selectedAccount.value?.label || 'Minha conta')
const ownEmail = computed(() => auth.user.value?.email || 'Conta principal')

const loadAccounts = async () => {
  if (!auth.isStaff.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ accounts: typeof accounts.value; selectedId: string | null }>('/api/access/accounts', { query: { search: search.value } })
    accounts.value = result.accounts
    selectedId.value = result.selectedId || ''
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível carregar as contas.'
  } finally {
    loading.value = false
  }
}

const closePopover = () => {
  if (detailsRef.value?.open) detailsRef.value.open = false
}

const handleDocumentPointerdown = (event: PointerEvent) => {
  const target = event.target as Node | null
  if (detailsRef.value?.open && target && !detailsRef.value.contains(target)) closePopover()
}

onMounted(() => {
  void loadAccounts()
  document.addEventListener('pointerdown', handleDocumentPointerdown)
})
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadAccounts, 250)
})
onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  document.removeEventListener('pointerdown', handleDocumentPointerdown)
})

const selectAccount = async () => {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/access/account', { method: 'POST', body: { id: selectedId.value || null } })
    closePopover()
    window.location.assign('/')
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível selecionar a conta.'
    loading.value = false
  }
}
</script>

<template>
  <details
    v-if="auth.isStaff.value"
    ref="detailsRef"
    :class="['account-switcher', `account-switcher--${props.variant}`, { 'is-loading': loading }]"
  >
    <summary class="account-switcher__trigger" :aria-label="`Conta em uso: ${selectedLabel}`">
      <span class="account-switcher__icon" aria-hidden="true"><Building2 :size="16" /></span>
      <span class="account-switcher__copy">
        <small>Conta em uso</small>
        <strong>{{ selectedLabel }}</strong>
      </span>
      <ChevronDown class="account-switcher__chevron" :size="15" aria-hidden="true" />
    </summary>

    <div class="account-switcher__popover" @click.stop>
      <div class="account-switcher__popover-head">
        <span>Trocar de conta</span>
        <strong>Selecione o cliente que você quer administrar.</strong>
      </div>

      <label class="account-switcher__field">
        <span>Buscar cliente</span>
        <span class="account-switcher__input-wrap">
          <Search :size="15" aria-hidden="true" />
          <input v-model="search" type="search" placeholder="Nome, empresa ou e-mail…" aria-label="Buscar cliente">
        </span>
      </label>

      <label class="account-switcher__field">
        <span>Conta selecionada</span>
        <select id="account-switcher-select" v-model="selectedId" :disabled="loading" aria-label="Conta em uso" @change="selectAccount">
          <option value="">Minha conta · {{ ownEmail }}</option>
          <option v-for="account in accounts" :key="account.id" :value="account.id">
            {{ account.label }}<template v-if="account.email"> · {{ account.email }}</template>
          </option>
        </select>
      </label>

      <small v-if="error" class="account-switcher__error" role="alert">{{ error }}</small>
    </div>
  </details>
</template>

<style scoped>
.account-switcher {
  position: relative;
  display: block;
  min-width: 0;
  color: #172b45;
}

.account-switcher__trigger {
  display: inline-flex;
  min-height: 42px;
  max-width: 230px;
  align-items: center;
  gap: 8px;
  padding: 4px 9px 4px 5px;
  border: 1px solid #dbe7f5;
  border-radius: 12px;
  color: #4b6580;
  background: rgba(255, 255, 255, .86);
  cursor: pointer;
  list-style: none;
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease, color .18s ease;
}

.account-switcher__trigger::-webkit-details-marker {
  display: none;
}

.account-switcher__trigger::marker {
  content: '';
}

.account-switcher__trigger:hover,
.account-switcher[open] .account-switcher__trigger,
.account-switcher__trigger:focus-visible {
  border-color: #a6c5ec;
  color: #2160b4;
  background: #fff;
  box-shadow: 0 8px 20px rgba(35, 82, 136, .09), 0 0 0 3px rgba(55, 119, 194, .08);
}

.account-switcher__icon {
  display: grid;
  width: 31px;
  height: 31px;
  flex: 0 0 31px;
  place-items: center;
  border-radius: 9px;
  color: #2160b4;
  background: #edf5ff;
}

.account-switcher__copy {
  display: grid;
  min-width: 0;
  gap: 1px;
  text-align: left;
}

.account-switcher__copy small {
  overflow: hidden;
  color: #7b93b0;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .08em;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.account-switcher__copy strong {
  max-width: 145px;
  overflow: hidden;
  color: #24405c;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-switcher__chevron {
  flex: 0 0 auto;
  color: #8194ab;
  transition: transform .18s ease;
}

.account-switcher[open] .account-switcher__chevron {
  transform: rotate(180deg);
}

.account-switcher:not([open]) > .account-switcher__popover {
  display: none;
}

.account-switcher__popover {
  position: absolute;
  z-index: 60;
  top: calc(100% + 10px);
  right: 0;
  display: grid;
  width: min(340px, calc(100vw - 24px));
  gap: 13px;
  padding: 16px;
  border: 1px solid #dbe7f5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 24px 50px rgba(24, 53, 86, .18), 0 4px 12px rgba(24, 53, 86, .06);
  max-height: calc(100dvh - 80px - env(safe-area-inset-top, 0px));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.account-switcher__popover-head {
  display: grid;
  gap: 3px;
}

.account-switcher__popover-head > span,
.account-switcher__field > span:first-child {
  color: #6e86a1;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.account-switcher__popover-head strong {
  color: #24405c;
  font-size: 12px;
  line-height: 1.45;
}

.account-switcher__field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.account-switcher__input-wrap {
  position: relative;
  display: block;
}

.account-switcher__input-wrap > svg {
  position: absolute;
  top: 50%;
  left: 11px;
  color: #8aa0b8;
  pointer-events: none;
  transform: translateY(-50%);
}

.account-switcher input,
.account-switcher select {
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid #cbd9e8;
  border-radius: 10px;
  outline: none;
  background: #fbfdff;
  color: #172b45;
  font-size: 12px;
  font-weight: 600;
  transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease;
}

.account-switcher input {
  padding: 0 11px 0 34px;
}

.account-switcher select {
  appearance: none;
  padding: 0 34px 0 11px;
  background-image: linear-gradient(45deg, transparent 50%, #6b819a 50%), linear-gradient(135deg, #6b819a 50%, transparent 50%);
  background-position: calc(100% - 15px) 17px, calc(100% - 10px) 17px;
  background-repeat: no-repeat;
  background-size: 5px 5px, 5px 5px;
}

.account-switcher input::placeholder {
  color: #8a9cb1;
  font-weight: 500;
}

.account-switcher input:focus,
.account-switcher select:focus {
  border-color: #8fb8e6;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(55, 119, 194, .11);
}

.account-switcher select:disabled {
  cursor: progress;
  opacity: .72;
}

.account-switcher__error {
  color: #b91c1c;
  font-size: 11px;
  font-weight: 700;
}

.account-switcher--drawer {
  width: 100%;
}

.account-switcher--drawer .account-switcher__trigger {
  width: 100%;
  max-width: none;
  justify-content: flex-start;
}

.account-switcher--drawer .account-switcher__popover {
  right: auto;
  left: 0;
}

.account-switcher.is-loading .account-switcher__trigger {
  cursor: progress;
}

@media (max-width: 1023px) {
  .account-switcher--topbar .account-switcher__trigger {
    width: 42px;
    min-width: 42px;
    justify-content: center;
    padding: 4px;
  }

  .account-switcher--topbar .account-switcher__copy,
  .account-switcher--topbar .account-switcher__chevron {
    display: none;
  }

  .account-switcher--topbar .account-switcher__popover {
    position: fixed;
    top: calc(62px + env(safe-area-inset-top, 0px));
    right: 12px;
  }
}

@media (max-width: 360px) {
  .account-switcher__popover {
    position: fixed;
    top: calc(62px + env(safe-area-inset-top, 0px));
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
