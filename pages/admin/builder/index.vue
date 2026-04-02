<script setup lang="ts">
import {
  LayoutDashboard,
  Palette,
  Monitor,
  LayoutGrid,
  Tag,
  Award,
  Type,
  Building2,
  ArrowLeft,
  Image,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type SectionItem = {
  title: string
  description: string
  href: string
  icon: any
  countKey: string
  count: number | null
}

const sections = ref<SectionItem[]>([
  {
    title: 'Temas',
    description: 'Cores, estilos visuais e configurações de design dos encartes',
    href: '/admin/builder/themes',
    icon: Palette,
    countKey: 'themes',
    count: null
  },
  {
    title: 'Modelos',
    description: 'Formatos e dimensões (Social, Print, TV)',
    href: '/admin/builder/models',
    icon: Monitor,
    countKey: 'models',
    count: null
  },
  {
    title: 'Grades',
    description: 'Layouts de grade para posicionamento de produtos',
    href: '/admin/builder/layouts',
    icon: LayoutGrid,
    countKey: 'layouts',
    count: null
  },
  {
    title: 'Estilos de Preco',
    description: 'Aparencia das etiquetas de preco nos encartes',
    href: '/admin/builder/price-tag-styles',
    icon: Tag,
    countKey: 'priceTagStyles',
    count: null
  },
  {
    title: 'Selos',
    description: 'Badges promocionais (Oferta, Novo, Destaque)',
    href: '/admin/builder/badge-styles',
    icon: Award,
    countKey: 'badgeStyles',
    count: null
  },
  {
    title: 'Fontes',
    description: 'Configuracoes de fontes e tipografia',
    href: '/admin/builder/font-configs',
    icon: Type,
    countKey: 'fontConfigs',
    count: null
  },
  {
    title: 'Empresas',
    description: 'Gerenciar empresas e planos dos tenants',
    href: '/admin/builder/tenants',
    icon: Building2,
    countKey: 'tenants',
    count: null
  },
  {
    title: 'Templates Canva',
    description: 'Gerenciar templates do Canva disponíveis para os clientes',
    href: '/admin/canva/templates',
    icon: Image,
    countKey: 'canvaTemplates',
    count: null
  }
])

const isLoading = ref(true)

const fetchCounts = async () => {
  isLoading.value = true
  const headers = await getApiAuthHeaders()

  const endpoints: Record<string, string> = {
    themes: '/api/admin/builder/themes',
    models: '/api/admin/builder/models',
    layouts: '/api/admin/builder/layouts',
    priceTagStyles: '/api/admin/builder/price-tag-styles',
    badgeStyles: '/api/admin/builder/badge-styles',
    fontConfigs: '/api/admin/builder/font-configs',
    tenants: '/api/admin/builder/tenants'
  }

  const results = await Promise.allSettled(
    Object.entries(endpoints).map(async ([key, url]) => {
      try {
        const data = await $fetch<any>(url, { headers })
        const list = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
        return { key, count: Array.isArray(list) ? list.length : 0 }
      } catch {
        return { key, count: null }
      }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const section = sections.value.find(s => s.countKey === result.value.key)
      if (section) section.count = result.value.count
    }
  }

  isLoading.value = false
}

onMounted(() => {
  fetchCounts()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <div class="mb-8">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar ao inicio
        </NuxtLink>
      </div>

      <div class="mb-10">
        <div class="flex items-center gap-3">
          <LayoutDashboard class="h-7 w-7 text-emerald-400" />
          <h1 class="text-2xl font-semibold tracking-tight">Administracao do Builder</h1>
        </div>
        <p class="mt-2 text-sm text-zinc-400">
          Gerencie temas, modelos, grades, estilos e empresas do builder de encartes.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="section in sections"
          :key="section.href"
          :to="section.href"
          class="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-900"
        >
          <div class="flex items-start justify-between">
            <component
              :is="section.icon"
              class="h-6 w-6 text-zinc-400 group-hover:text-emerald-400 transition-colors"
            />
            <span
              v-if="section.count !== null"
              class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
            >
              {{ section.count }}
            </span>
            <span
              v-else-if="isLoading"
              class="h-5 w-8 animate-pulse rounded-full bg-zinc-800"
            />
          </div>
          <h2 class="mt-4 text-base font-medium text-zinc-100 group-hover:text-white">
            {{ section.title }}
          </h2>
          <p class="mt-1 text-sm text-zinc-500 group-hover:text-zinc-400">
            {{ section.description }}
          </p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
