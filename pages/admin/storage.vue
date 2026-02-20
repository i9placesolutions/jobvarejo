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
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-4xl px-6 py-10">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Uso do Bucket (Wasabi)</h1>
          <p class="mt-1 text-sm text-zinc-400">
            Soma tamanho/quantidade por pasta. Se aparecer “truncated”, aumente <code class="text-zinc-200">maxKeys</code> ou filtre por prefixo.
          </p>
        </div>

        <div class="flex gap-2">
          <button
            class="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-60"
            :disabled="isLoading"
            @click="fetchStats"
          >
            {{ isLoading ? 'Carregando…' : 'Atualizar' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="stats" class="mt-6 space-y-4">
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span class="text-zinc-400">Bucket:</span>
              <span class="ml-2 font-medium text-zinc-200">{{ stats.bucket }}</span>
            </div>
            <div>
              <span class="text-zinc-400">Endpoint:</span>
              <span class="ml-2 font-medium text-zinc-200">{{ stats.endpoint }}</span>
            </div>
            <div>
              <span class="text-zinc-400">Total:</span>
              <span class="ml-2 font-semibold text-zinc-100">{{ stats.total.size }}</span>
              <span class="ml-2 text-zinc-400">({{ stats.total.objects }} objetos)</span>
            </div>
          </div>
          <div class="mt-2 text-xs text-zinc-500">
            Gerado em {{ stats.generatedAt }} | maxKeys={{ stats.maxKeys }}
          </div>
        </div>

        <div class="overflow-hidden rounded-lg border border-zinc-800">
          <table class="w-full text-left text-sm">
            <thead class="bg-zinc-900">
              <tr>
                <th class="px-4 py-3 font-medium text-zinc-200">Pasta</th>
                <th class="px-4 py-3 font-medium text-zinc-200">Tamanho</th>
                <th class="px-4 py-3 font-medium text-zinc-200">Objetos</th>
                <th class="px-4 py-3 font-medium text-zinc-200">Status</th>
              </tr>
            </thead>
            <tbody class="bg-zinc-950">
              <tr v-for="p in stats.prefixes" :key="p.prefix" class="border-t border-zinc-900">
                <td class="px-4 py-3 font-mono text-xs text-zinc-200">{{ p.prefix }}</td>
                <td class="px-4 py-3 text-zinc-100">{{ p.size }}</td>
                <td class="px-4 py-3 text-zinc-300">{{ p.objects }}</td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-xs"
                    :class="p.truncated ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'"
                  >
                    {{ p.truncated ? 'truncated' : 'ok' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="stats.warnings?.length" class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div class="font-medium text-amber-100">Avisos</div>
          <ul class="mt-2 list-disc pl-5">
            <li v-for="w in stats.warnings" :key="w">{{ w }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
