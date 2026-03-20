<script setup lang="ts">
import { ArrowLeft, Search, Eye, X, ChevronDown } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type Tenant = {
  id: string
  name: string
  email: string
  phone: string
  plan: string
  is_active: boolean
  created_at: string
  last_login_at: string
  flyer_count?: number
}

const tenants = ref<Tenant[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showDetails = ref<string | null>(null)
const detailTenant = ref<Tenant | null>(null)
const isSaving = ref(false)

const filteredTenants = computed(() => {
  if (!searchQuery.value.trim()) return tenants.value
  const q = searchQuery.value.toLowerCase()
  return tenants.value.filter(t =>
    (t.name || '').toLowerCase().includes(q) ||
    (t.email || '').toLowerCase().includes(q)
  )
})

const fetchTenants = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/tenants', { headers })
    tenants.value = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar empresas')
  } finally {
    isLoading.value = false
  }
}

const toggleActive = async (tenant: Tenant) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/tenants/${tenant.id}`, {
      method: 'PUT',
      headers,
      body: { is_active: !tenant.is_active }
    })
    tenant.is_active = !tenant.is_active
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao atualizar status')
  }
}

const changePlan = async (tenant: Tenant, plan: string) => {
  isSaving.value = true
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/tenants/${tenant.id}`, {
      method: 'PUT',
      headers,
      body: { plan }
    })
    tenant.plan = plan
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao atualizar plano')
  } finally {
    isSaving.value = false
  }
}

const viewDetails = async (tenant: Tenant) => {
  showDetails.value = tenant.id
  detailTenant.value = tenant
  // Try to fetch more details
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>(`/api/admin/builder/tenants/${tenant.id}`, { headers })
    if (data) {
      detailTenant.value = { ...tenant, ...data }
    }
  } catch {
    // keep what we have
  }
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

const planLabel = (plan: string) => {
  const map: Record<string, string> = { free: 'Gratuito', basic: 'Basico', pro: 'Pro' }
  return map[plan] || plan || 'Gratuito'
}

const planBadgeClass = (plan: string) => {
  const map: Record<string, string> = {
    free: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    basic: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    pro: 'bg-purple-500/10 text-purple-300 border-purple-500/20'
  }
  return map[plan] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
}

onMounted(() => {
  fetchTenants()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar
        </NuxtLink>
      </div>

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold tracking-tight">Empresas (Tenants)</h1>
        <span class="text-sm text-zinc-400">{{ filteredTenants.length }} empresa(s)</span>
      </div>

      <!-- Search -->
      <div class="mb-6">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nome ou email..."
            class="w-full rounded-lg border border-zinc-700 bg-zinc-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-zinc-500">Carregando...</div>

      <!-- Table -->
      <div v-else-if="filteredTenants.length" class="overflow-hidden rounded-lg border border-zinc-800">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-900">
            <tr>
              <th class="px-4 py-3 font-medium text-zinc-300">Nome</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Email</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Telefone</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Plano</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Status</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Criado em</th>
              <th class="px-4 py-3 font-medium text-zinc-300 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-zinc-900/50">
            <tr v-for="tenant in filteredTenants" :key="tenant.id" class="border-t border-zinc-800">
              <td class="px-4 py-3 font-medium text-zinc-100">{{ tenant.name || '-' }}</td>
              <td class="px-4 py-3 text-zinc-300">{{ tenant.email || '-' }}</td>
              <td class="px-4 py-3 text-zinc-400">{{ tenant.phone || '-' }}</td>
              <td class="px-4 py-3">
                <select
                  :value="tenant.plan || 'free'"
                  class="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  @change="changePlan(tenant, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="free">Gratuito</option>
                  <option value="basic">Basico</option>
                  <option value="pro">Pro</option>
                </select>
              </td>
              <td class="px-4 py-3">
                <button
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer transition-colors"
                  :class="tenant.is_active
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                    : 'bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20'"
                  @click="toggleActive(tenant)"
                  :title="tenant.is_active ? 'Clique para desativar' : 'Clique para ativar'"
                >
                  {{ tenant.is_active ? 'Ativo' : 'Inativo' }}
                </button>
              </td>
              <td class="px-4 py-3 text-zinc-400 text-xs">{{ formatDate(tenant.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  title="Ver detalhes"
                  @click="viewDetails(tenant)"
                >
                  <Eye class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!isLoading" class="text-center py-12 text-zinc-500">
        {{ searchQuery ? 'Nenhuma empresa encontrada para esta busca.' : 'Nenhuma empresa cadastrada.' }}
      </div>

      <!-- Details Modal -->
      <div
        v-if="showDetails && detailTenant"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDetails = null"
      >
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl max-w-lg w-full mx-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-zinc-100">Detalhes da Empresa</h3>
            <button
              class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              @click="showDetails = null"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Nome</span>
              <span class="text-zinc-100 font-medium">{{ detailTenant.name || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Email</span>
              <span class="text-zinc-100">{{ detailTenant.email || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Telefone</span>
              <span class="text-zinc-100">{{ detailTenant.phone || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Plano</span>
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                :class="planBadgeClass(detailTenant.plan)"
              >
                {{ planLabel(detailTenant.plan) }}
              </span>
            </div>
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Status</span>
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                :class="detailTenant.is_active
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  : 'bg-red-500/10 text-red-300 border-red-500/20'"
              >
                {{ detailTenant.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </div>
            <div v-if="detailTenant.flyer_count !== undefined" class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Encartes</span>
              <span class="text-zinc-100 font-medium">{{ detailTenant.flyer_count }}</span>
            </div>
            <div class="flex justify-between border-b border-zinc-800 pb-2">
              <span class="text-zinc-400">Criado em</span>
              <span class="text-zinc-100">{{ formatDate(detailTenant.created_at) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-zinc-400">Ultimo login</span>
              <span class="text-zinc-100">{{ formatDate(detailTenant.last_login_at) }}</span>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              @click="showDetails = null"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
