<script setup lang="ts">
import { resolveComponent } from 'vue'
import {
  LayoutDashboard,
  Palette,
  Monitor,
  LayoutGrid,
  Tag,
  Award,
  Type,
  Building2,
  Image,
  CreditCard,
  PanelTop,
  PanelBottom,
  Target,
  HelpCircle,
  Mic2,
  Search,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

useHead({ title: 'Modelos e configurações | JobVarejo' })

const { getApiAuthHeaders } = useApiAuth()
const sectionLinkComponent = resolveComponent('NuxtLink')

type SectionItem = {
  title: string
  description: string
  href: string
  icon: any
  countKey: string
  count: number | null
  available?: boolean
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
    title: 'Estilos de Preço',
    description: 'Aparência das etiquetas de preço nos encartes',
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
    description: 'Configurações de fontes e tipografia',
    href: '/admin/builder/font-configs',
    icon: Type,
    countKey: 'fontConfigs',
    count: null
  },
  {
    title: 'Empresas',
    description: 'Gerenciar empresas e seus planos',
    href: '/admin/builder/tenants',
    icon: Building2,
    countKey: 'tenants',
    count: null
  },
  {
    title: 'Modelos de produto',
    description: 'Aparência dos cards de produto disponíveis aos clientes',
    href: '/admin/builder/card-templates',
    icon: CreditCard,
    countKey: 'cardTemplates',
    count: null
  },
  {
    title: 'Cabeçalhos',
    description: 'Templates de cabeçalho do encarte',
    href: '/admin/builder/header-templates',
    icon: PanelTop,
    countKey: 'headerTemplates',
    count: null
  },
  {
    title: 'Rodapés',
    description: 'Templates de rodapé do encarte',
    href: '/admin/builder/footer-templates',
    icon: PanelBottom,
    countKey: 'footerTemplates',
    count: null
  },
  {
    title: 'Templates Canva',
    description: 'Gerenciar templates do Canva disponíveis para os clientes',
    href: '/admin/canva/templates',
    available: false,
    icon: Image,
    countKey: 'canvaTemplates',
    count: null
  },
  {
    title: 'Segmentos',
    description: 'Segmentos de mercado para recomendação de temas',
    href: '/admin/builder/segments',
    icon: Target,
    countKey: 'segments',
    count: null
  },
  {
    title: 'QR Academy',
    description: 'Central de ajuda e tutoriais internos do QROfertas',
    href: '/admin/builder/qr-academy',
    available: false,
    icon: HelpCircle,
    countKey: 'qrAcademy',
    count: null
  },
  {
    title: 'Banco de vozes',
    description: 'Envie amostras autorizadas e gerencie as vozes usadas nas locuções',
    href: '/admin/voices',
    icon: Mic2,
    countKey: 'radioVoices',
    count: null
  }
])

const search = ref('')
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const groups = [
  { title: 'Aparência dos encartes', description: 'Defina o visual e a organização das ofertas.', keys: ['themes', 'models', 'layouts', 'priceTagStyles', 'badgeStyles', 'fontConfigs'] },
  { title: 'Elementos reutilizáveis', description: 'Prepare os componentes usados na criação.', keys: ['cardTemplates', 'headerTemplates', 'footerTemplates'] },
  { title: 'Operação e conteúdo', description: 'Gerencie empresas, segmentos e vozes.', keys: ['tenants', 'segments', 'radioVoices'] },
  { title: 'Em preparação', description: 'Estas áreas ainda não estão disponíveis.', keys: ['canvaTemplates', 'qrAcademy'] }
]
const filteredGroups = computed(() => groups.map(group => ({
  ...group,
  items: sections.value.filter(section => group.keys.includes(section.countKey) && normalize(`${section.title} ${section.description}`).includes(normalize(search.value.trim())))
})).filter(group => group.items.length))
const resultCount = computed(() => filteredGroups.value.reduce((count, group) => count + group.items.length, 0))
const isLoading = ref(true)
const countError = ref(false)

const fetchCounts = async () => {
  isLoading.value = true
  countError.value = false
  try {
    const headers = await getApiAuthHeaders()

    const { counts } = await $fetch<{ counts: Record<string, number | null> }>('/api/admin/builder/counts', { headers })
    for (const section of sections.value) {
      if (section.available === false) continue
      section.count = counts[section.countKey] ?? null
    }
    countError.value = sections.value.some(section => section.available !== false && section.count === null)
  } catch {
    countError.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchCounts()
})
</script>

<template>
  <AdminWorkspaceShell active-nav="builder">
    <div class="admin-page">
      <div class="admin-page__inner">
        <div class="mb-8 flex items-start gap-3">
          <div class="rounded-xl border border-[color:var(--jv-line)] bg-[color:var(--jv-sky)] p-2.5 text-[color:var(--jv-blue)]">
            <LayoutDashboard class="h-6 w-6" />
          </div>
          <div>
            <p class="admin-page__eyebrow">Configuração · Builder</p>
            <h1 class="admin-page__title">Modelos e configurações</h1>
            <p class="admin-page__lead">
              Encontre os recursos para preparar encartes e gerenciar a operação.
            </p>
          </div>
        </div>

        <div class="mb-6 flex flex-wrap items-center gap-3">
          <label class="relative min-w-0 flex-1 basis-64">
            <span class="sr-only">Buscar configurações</span>
            <Search class="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input v-model="search" type="search" class="admin-input !pl-10" placeholder="Buscar temas, vozes, empresas…" />
          </label>
          <button type="button" class="admin-btn admin-btn--secondary" :disabled="isLoading" @click="fetchCounts">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" /> {{ isLoading ? 'Atualizando…' : 'Atualizar totais' }}
          </button>
        </div>
        <p v-if="countError" role="status" class="admin-alert admin-alert--warning mb-5">Alguns totais não puderam ser carregados. Você pode abrir as configurações ou tentar atualizar novamente.</p>
        <p v-if="search.trim()" role="status" class="mb-4 text-sm text-[color:var(--jv-muted)]">{{ resultCount }} resultado(s) para “{{ search.trim() }}”</p>
        <div v-if="!resultCount" class="admin-card admin-card--pad text-center">
          <p>Nenhuma configuração encontrada.</p>
          <button type="button" class="admin-btn admin-btn--secondary mt-3" @click="search = ''">Limpar busca</button>
        </div>
        <section v-for="group in filteredGroups" :key="group.title" class="mb-8">
          <h2 class="text-base font-bold text-[color:var(--jv-navy)]">{{ group.title }}</h2>
          <p class="mb-4 mt-1 text-sm text-[color:var(--jv-muted)]">{{ group.description }}</p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <component
            v-for="section in group.items"
            :key="section.href"
            :is="section.available === false ? 'div' : sectionLinkComponent"
            :prefetch-on="section.available === false ? undefined : 'interaction'"
            :to="section.available === false ? undefined : section.href"
            class="admin-link-card group"
            :class="{ 'admin-link-card--pending': section.available === false }"
            :aria-disabled="section.available === false ? 'true' : undefined"
          >
            <div class="flex items-start justify-between">
              <component
                :is="section.icon"
                class="h-6 w-6 text-[color:var(--jv-muted)] transition-colors group-hover:text-[color:var(--jv-blue)]"
              />
              <span v-if="section.available === false" class="admin-badge admin-badge--info">Em preparação</span>
              <span
                v-else-if="section.count !== null"
                class="rounded-full bg-[color:var(--jv-sky)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--jv-navy)]"
              >
                {{ section.count }}
              </span>
              <span
                v-else-if="isLoading"
                class="h-5 w-8 animate-pulse rounded-full bg-slate-200"
              />
            </div>
            <h3 class="admin-link-card__title">{{ section.title }}</h3>
            <p class="admin-link-card__desc">{{ section.description }}</p>
            <span v-if="section.available !== false" class="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--jv-blue)]">Gerenciar <ArrowUpRight class="h-3.5 w-3.5" /></span>
          </component>
          </div>
        </section>
      </div>
    </div>
  </AdminWorkspaceShell>
</template>
