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
    free: 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border-[color:var(--jv-line)]',
    basic: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    pro: 'bg-blue-500/10 text-blue-300 border-blue-500/20'
  }
  return map[plan] || 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border-[color:var(--jv-line)]'
}

onMounted(() => {
  fetchTenants()
})
</script>

<template>
  <AdminWorkspaceShell>
  <div class="admin-page admin-page--builder">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="admin-page__back inline-flex items-center gap-1.5 text-sm text-[color:var(--jv-muted)] hover:text-[color:var(--jv-blue)] transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar
        </NuxtLink>
      </div>

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold tracking-tight">Empresas (Tenants)</h1>
        <span class="text-sm text-[color:var(--jv-muted)]">{{ filteredTenants.length }} empresa(s)</span>
      </div>

      <!-- Search -->
      <div class="mb-6">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--jv-muted)]" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nome ou email..."
            class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] pl-10 pr-4 py-2.5 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">Carregando...</div>

      <!-- Table -->
      <div v-else-if="filteredTenants.length" class="overflow-x-auto rounded-lg border border-[color:var(--jv-line)]" role="region" aria-label="Tabela de registros — deslize para ver todas as colunas" tabindex="0">
        <table class="w-full text-left text-sm">
          <thead class="bg-[#f3f8fd]">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Nome</th>
              <th class="px-4 py-3 font-medium text-slate-600">Email</th>
              <th class="px-4 py-3 font-medium text-slate-600">Telefone</th>
              <th class="px-4 py-3 font-medium text-slate-600">Plano</th>
              <th class="px-4 py-3 font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 font-medium text-slate-600">Criado em</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="tenant in filteredTenants" :key="tenant.id" class="border-t border-[color:var(--jv-line)]">
              <td class="px-4 py-3 font-medium text-[color:var(--jv-ink)]">{{ tenant.name || '-' }}</td>
              <td class="px-4 py-3 text-slate-600">{{ tenant.email || '-' }}</td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ tenant.phone || '-' }}</td>
              <td class="px-4 py-3">
                <select
                  :value="tenant.plan || 'free'"
                  class="rounded-md border border-[color:var(--jv-line)] bg-[#f3f8fd] px-2 py-1 text-xs text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-[#1a4f96]/20'
                    : 'bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20'"
                  @click="toggleActive(tenant)"
                  :title="tenant.is_active ? 'Clique para desativar' : 'Clique para ativar'"
                >
                  {{ tenant.is_active ? 'Ativo' : 'Inativo' }}
                </button>
              </td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)] text-xs">{{ formatDate(tenant.created_at) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)] transition-colors"
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

      <div v-else-if="!isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">
        {{ searchQuery ? 'Nenhuma empresa encontrada para esta busca.' : 'Nenhuma empresa cadastrada.' }}
      </div>

      <!-- Details Modal -->
      <div
        v-if="showDetails && detailTenant"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDetails = null"
      >
        <div class="rounded-xl border border-[color:var(--jv-line)] bg-[#f3f8fd] p-6 shadow-xl max-w-lg w-full mx-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-[color:var(--jv-ink)]">Detalhes da Empresa</h3>
            <button
              class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)]"
              @click="showDetails = null"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Nome</span>
              <span class="text-[color:var(--jv-ink)] font-medium">{{ detailTenant.name || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Email</span>
              <span class="text-[color:var(--jv-ink)]">{{ detailTenant.email || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Telefone</span>
              <span class="text-[color:var(--jv-ink)]">{{ detailTenant.phone || '-' }}</span>
            </div>
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Plano</span>
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                :class="planBadgeClass(detailTenant.plan)"
              >
                {{ planLabel(detailTenant.plan) }}
              </span>
            </div>
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Status</span>
              <span
                class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                :class="detailTenant.is_active
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                  : 'bg-red-500/10 text-red-300 border-red-500/20'"
              >
                {{ detailTenant.is_active ? 'Ativo' : 'Inativo' }}
              </span>
            </div>
            <div v-if="detailTenant.flyer_count !== undefined" class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Encartes</span>
              <span class="text-[color:var(--jv-ink)] font-medium">{{ detailTenant.flyer_count }}</span>
            </div>
            <div class="flex justify-between border-b border-[color:var(--jv-line)] pb-2">
              <span class="text-[color:var(--jv-muted)]">Criado em</span>
              <span class="text-[color:var(--jv-ink)]">{{ formatDate(detailTenant.created_at) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-[color:var(--jv-muted)]">Ultimo login</span>
              <span class="text-[color:var(--jv-ink)]">{{ formatDate(detailTenant.last_login_at) }}</span>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              class="rounded-lg bg-[color:var(--jv-sky)] px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              @click="showDetails = null"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </AdminWorkspaceShell>
</template>
