<script setup lang="ts">
const auth = useAuth()
const accounts = ref<{ id: string; label: string; email: string }[]>([])
const selectedId = ref('')
const search = ref('')
const loading = ref(false)
const error = ref('')

const loadAccounts = async () => {
  if (!auth.isStaff.value) return
  loading.value = true
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
onMounted(loadAccounts)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadAccounts, 250)
})
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })

const selectAccount = async () => {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/access/account', { method: 'POST', body: { id: selectedId.value || null } })
    window.location.assign('/')
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível selecionar a conta.'
    loading.value = false
  }
}
</script>

<template>
  <div v-if="auth.isStaff.value" class="account-switcher">
    <label for="account-switcher-select">Conta em uso</label>
    <input v-model="search" type="search" placeholder="Buscar cliente…" aria-label="Buscar cliente">
    <select id="account-switcher-select" v-model="selectedId" :disabled="loading" @change="selectAccount">
      <option value="">Minha conta</option>
      <option v-for="account in accounts" :key="account.id" :value="account.id">
        {{ account.label }}<template v-if="account.email"> · {{ account.email }}</template>
      </option>
    </select>
    <small v-if="error" role="alert">{{ error }}</small>
  </div>
</template>

<style scoped>
.account-switcher { display: flex; flex-direction: column; gap: 3px; min-width: 180px; max-width: 300px; }
.account-switcher label { font-size: 11px; font-weight: 700; color: #64748b; }
.account-switcher select, .account-switcher input { width: 100%; min-height: 32px; padding: 5px 9px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; color: #172b45; font-size: 12px; }
.account-switcher small { color: #b91c1c; font-size: 11px; }
</style>
