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
  Image,
  CreditCard,
  PanelTop,
  PanelBottom,
  Target,
  HelpCircle,
  Mic2,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

// Builder não faz parte da Central JobVarejo (fluxo de modelos de encarte).
// Admins JobVarejo voltam para a Central; login do tenant builder continua válido.
const jobvarejoAuth = useAuth()
if (import.meta.client && jobvarejoAuth.isAdmin.value) {
  await navigateTo('/', { replace: true })
}

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
    description: 'Gerenciar empresas e planos dos tenants',
    href: '/admin/builder/tenants',
    icon: Building2,
    countKey: 'tenants',
    count: null
  },
  {
    title: 'Card Templates',
    description: 'Templates visuais de produto (admin cria, cliente escolhe)',
    href: '/admin/builder/card-templates',
    icon: CreditCard,
    countKey: 'cardTemplates',
    count: null
  },
  {
    title: 'Header Templates',
    description: 'Templates de cabeçalho do encarte',
    href: '/admin/builder/header-templates',
    icon: PanelTop,
    countKey: 'headerTemplates',
    count: null
  },
  {
    title: 'Footer Templates',
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
    icon: HelpCircle,
    countKey: 'qrAcademy',
    count: null
  },
  {
    title: 'MusicGPT / Banco de vozes',
    description: 'Envie amostras autorizadas e gerencie as vozes usadas nas locuções',
    href: '/admin/musicgpt',
    icon: Mic2,
    countKey: 'radioVoices',
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
    tenants: '/api/admin/builder/tenants',
    cardTemplates: '/api/admin/builder/card-templates',
    headerTemplates: '/api/admin/builder/header-templates',
    footerTemplates: '/api/admin/builder/footer-templates',
    radioVoices: '/api/admin/musicgpt/voices'
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
  <AdminWorkspaceShell>
    <div class="admin-page">
      <div class="admin-page__inner">
        <div class="mb-8 flex items-start gap-3">
          <div class="rounded-xl border border-[color:var(--jv-line)] bg-[color:var(--jv-sky)] p-2.5 text-[color:var(--jv-blue)]">
            <LayoutDashboard class="h-6 w-6" />
          </div>
          <div>
            <p class="admin-page__eyebrow">Configuração · Builder</p>
            <h1 class="admin-page__title">Temas, templates e empresas</h1>
            <p class="admin-page__lead">
              Configuração de temas, modelos, grades e empresas — mesma Central administrativa.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="section in sections"
            :key="section.href"
            :to="section.href"
            class="admin-link-card group"
          >
            <div class="flex items-start justify-between">
              <component
                :is="section.icon"
                class="h-6 w-6 text-[color:var(--jv-muted)] transition-colors group-hover:text-[color:var(--jv-blue)]"
              />
              <span
                v-if="section.count !== null"
                class="rounded-full bg-[color:var(--jv-sky)] px-2.5 py-0.5 text-xs font-bold text-[color:var(--jv-navy)]"
              >
                {{ section.count }}
              </span>
              <span
                v-else-if="isLoading"
                class="h-5 w-8 animate-pulse rounded-full bg-slate-200"
              />
            </div>
            <h2 class="admin-link-card__title">{{ section.title }}</h2>
            <p class="admin-link-card__desc">{{ section.description }}</p>
          </NuxtLink>
        </div>
      </div>
    </div>
  </AdminWorkspaceShell>
</template>
