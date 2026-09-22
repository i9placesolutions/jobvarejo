<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

type StorageStats = {
  ok: boolean
  bucket: string
  endpoint: string
  generatedAt: string
  maxKeys: number
  prefixes: Array<{
    prefix: string
    objects: number
    bytes: number
    size: string
    truncated: boolean
  }>
  total: {
    objects: number
    bytes: number
    size: string
  }
  warnings?: string[]
}

const { getApiAuthHeaders } = useApiAuth()

const isLoading = ref(false)
const error = ref<string | null>(null)
const stats = ref<StorageStats | null>(null)

const fetchStats = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<StorageStats>('/api/storage/stats', { headers })
    stats.value = data
  } catch (e: any) {
    stats.value = null
    error.value = String(e?.data?.message || e?.data?.statusMessage || e?.message || 'Falha ao carregar estatísticas')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <AdminWorkspaceShell active-nav="storage">
    <div class="admin-page">
      <div class="admin-page__inner" style="max-width: 56rem">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="admin-page__eyebrow">Configuração · Storage</p>
            <h1 class="admin-page__title">Uso do Bucket (Wasabi)</h1>
            <p class="admin-page__lead">
              Soma tamanho/quantidade por pasta. Se aparecer “truncated”, aumente <code class="rounded bg-[color:var(--jv-sky)] px-1.5 py-0.5 text-[color:var(--jv-navy)]">maxKeys</code> ou filtre por prefixo.
            </p>
          </div>
          <button class="admin-btn admin-btn--primary" :disabled="isLoading" @click="fetchStats">
            {{ isLoading ? 'Carregando…' : 'Atualizar' }}
          </button>
        </div>

        <div v-if="error" class="admin-alert admin-alert--error mt-6">{{ error }}</div>

        <div v-if="stats" class="mt-6 space-y-4">
          <div class="admin-card admin-card--pad">
            <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span class="text-[color:var(--jv-muted)]">Bucket:</span>
                <span class="ml-2 font-semibold text-[color:var(--jv-navy)]">{{ stats.bucket }}</span>
              </div>
              <div>
                <span class="text-[color:var(--jv-muted)]">Endpoint:</span>
                <span class="ml-2 font-semibold text-[color:var(--jv-navy)]">{{ stats.endpoint }}</span>
              </div>
              <div>
                <span class="text-[color:var(--jv-muted)]">Total:</span>
                <span class="ml-2 font-bold text-[color:var(--jv-navy)]">{{ stats.total.size }}</span>
                <span class="ml-2 text-[color:var(--jv-muted)]">({{ stats.total.objects }} objetos)</span>
              </div>
            </div>
            <div class="mt-2 text-xs text-[color:var(--jv-muted)]">
              Gerado em {{ stats.generatedAt }} | maxKeys={{ stats.maxKeys }}
            </div>
          </div>

          <div class="admin-table-wrap" role="region" aria-label="Tabela de registros — deslize para ver todas as colunas" tabindex="0">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Pasta</th>
                  <th>Tamanho</th>
                  <th>Objetos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in stats.prefixes" :key="p.prefix">
                  <td class="font-mono text-xs">{{ p.prefix }}</td>
                  <td>{{ p.size }}</td>
                  <td>{{ p.objects }}</td>
                  <td>
                    <span class="admin-badge" :class="p.truncated ? 'admin-badge--warn' : 'admin-badge--ok'">
                      {{ p.truncated ? 'truncated' : 'ok' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="stats.warnings?.length" class="admin-alert admin-alert--warning">
            <div>
              <div class="font-semibold">Avisos</div>
              <ul class="mt-2 list-disc pl-5">
                <li v-for="w in stats.warnings" :key="w">{{ w }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminWorkspaceShell>
</template>
