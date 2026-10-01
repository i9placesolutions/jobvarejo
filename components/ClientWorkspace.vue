<script setup lang="ts">
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  Clock,
  CreditCard,
  Edit3,
  ExternalLink,
  FolderOpen,
  LayoutTemplate,
  Loader2,
  LogOut,
  Palette,
  Radio,
  Sparkles,
  Store,
  UserRound,
  WandSparkles,
  Zap
} from 'lucide-vue-next'
import { formatHistoryDateTime } from '~/utils/dateTimeFormat'

const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()
const businessProfile = useBusinessProfile()

const profile = ref<any>(null)
const isProfileLoading = ref(true)

const projects = ref<any[]>([])
const isProjectsLoading = ref(true)

const customerName = computed(() => {
  const name = String(profile.value?.name || auth.user.value?.name || '').trim()
  if (name) return name

  const emailName = String(auth.user.value?.email || '').split('@')[0]?.trim() || ''
  return emailName || 'por aqui'
})

const customerInitial = computed(() => customerName.value.charAt(0).toLocaleUpperCase('pt-BR') || 'J')

// Trial status
const trialDaysLeft = computed(() => {
  if (!profile.value?.trial_ends_at) return 0
  const end = new Date(profile.value.trial_ends_at).getTime()
  const now = Date.now()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
})

const isTrial = computed(() => {
  return profile.value?.subscription_status === 'trial' || trialDaysLeft.value > 0
})

const selectedModules = computed<string[]>(() => {
  const mods = profile.value?.selected_modules
  if (Array.isArray(mods) && mods.length > 0) return mods
  return ['encartes', 'cartazes', 'radio']
})

const allWorkspaces = [
  {
    id: 'encartes',
    icon: LayoutTemplate,
    eyebrow: 'Ofertas da loja',
    title: 'Encartes',
    description: 'Escolha um modelo, monte a campanha com sua lista e deixe a sua marca pronta para divulgar.',
    href: auth.user.value?.role === 'editor' ? '/flyer-templates' : '/quick-editor',
    action: 'Criar encarte',
    steps: ['Escolha o modelo', 'Inclua suas ofertas', 'Exporte e publique']
  },
  {
    id: 'cartazes',
    icon: WandSparkles,
    eyebrow: 'Ponto de venda',
    title: 'Cartazes',
    description: 'Crie cartazes de oferta para a loja, com formatos prontos para imprimir e editar.',
    href: '/cartazista',
    action: 'Criar cartaz',
    steps: ['Escolha o cartaz', 'Cole a lista de produtos', 'Revise e imprima']
  },
  {
    id: 'radio',
    icon: Radio,
    eyebrow: 'Comunicação no corredor',
    title: 'Rádio Indoor',
    description: 'Acesse a programação, as locuções e os anúncios que dão voz à sua loja.',
    href: '/radio-indoor',
    action: 'Abrir rádio indoor',
    steps: ['Organize a programação', 'Escolha a trilha', 'Leve ao ambiente da loja']
  },
  {
    id: 'videos',
    icon: Clapperboard,
    eyebrow: 'Redes, TV e telas',
    title: 'Vídeos',
    description: 'Transforme ofertas em conteúdo com movimento para Reels, Stories e telas da sua loja.',
    href: '/videos',
    action: 'Criar vídeo',
    steps: ['Defina o modelo', 'Escolha as ofertas', 'Gere o vídeo']
  },
  {
    id: 'artes',
    icon: Palette,
    eyebrow: 'Criação visual',
    title: 'Estúdio de Artes',
    description: 'Crie peças para a comunicação da loja.',
    href: '/art-studio',
    action: 'Abrir estúdio',
    steps: ['Escolha o formato', 'Monte a arte', 'Exporte']
  },
  {
    id: 'builder',
    icon: LayoutTemplate,
    eyebrow: 'Encarte estruturado',
    title: 'Builder',
    description: 'Monte e organize encartes no construtor.',
    href: '/builder',
    action: 'Abrir builder',
    steps: ['Escolha o layout', 'Adicione produtos', 'Publique']
  }
]

const workspaces = computed(() => {
  return allWorkspaces.filter(ws => {
    // Check if permission allowed
    if (!auth.can(ws.id as any)) return false
    // If user has selected_modules defined, prioritize those (or show videos/artes/builder if explicitly permitted)
    if (['encartes', 'cartazes', 'radio'].includes(ws.id)) {
      return selectedModules.value.includes(ws.id)
    }
    return true
  })
})

const loadProfile = async () => {
  isProfileLoading.value = true
  try {
    profile.value = await businessProfile.load()
  } catch (err) {
    console.warn('Erro ao obter perfil no ClientWorkspace:', err)
  } finally {
    isProfileLoading.value = false
  }
}

const loadRecentProjects = async () => {
  isProjectsLoading.value = true
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any[]>('/api/projects', {
      headers,
      query: { summary: 'dashboard', limit: '8' }
    })
    projects.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('Erro ao carregar projetos recentes:', err)
  } finally {
    isProjectsLoading.value = false
  }
}

const handleSignOut = async () => {
  await auth.signOut()
}

onMounted(() => {
  void loadProfile()
  void loadRecentProjects()
})
</script>

<template>
  <div class="client-workspace">
    <a class="client-workspace__skip" href="#escolher-ferramenta">Pular para as ferramentas</a>

    <header class="client-workspace__header">
      <div class="client-workspace__header-inner">
        <NuxtLink to="/" class="client-workspace__brand" aria-label="JobVarejo, início">
          <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="176" height="56">
        </NuxtLink>

        <div class="client-workspace__account">
          <AccountSwitcher v-if="auth.isStaff.value" />
          <NuxtLink to="/plans" class="client-workspace__plans-badge">
            <Sparkles :size="14" />
            <span>Planos & Teste</span>
          </NuxtLink>

          <NuxtLink v-if="auth.can('loja')" to="/business-profile" class="client-workspace__store-link">
            <Store :size="16" />
            <span>Minha loja</span>
          </NuxtLink>

          <details class="client-workspace__account-menu">
            <summary aria-label="Abrir menu da conta">
              <span class="client-workspace__avatar">
                <img
                  v-if="auth.user.value?.avatar_url"
                  :src="auth.user.value.avatar_url"
                  :alt="auth.user.value.name || 'Avatar da conta'"
                >
                <span v-else>{{ customerInitial }}</span>
              </span>
              <span class="client-workspace__account-copy">
                <strong>{{ customerName }}</strong>
                <small>Minha conta</small>
              </span>
              <ChevronDown :size="16" aria-hidden="true" />
            </summary>

            <div class="client-workspace__account-popover">
              <NuxtLink to="/profile" class="client-workspace__account-action">
                <UserRound :size="16" />
                Meu perfil
              </NuxtLink>
              <NuxtLink to="/plans" class="client-workspace__account-action">
                <CreditCard :size="16" />
                Planos & Pagamento
              </NuxtLink>
              <NuxtLink v-if="auth.can('loja')" to="/business-profile" class="client-workspace__account-action">
                <Store :size="16" />
                Dados da loja
              </NuxtLink>
              <button type="button" class="client-workspace__account-action is-danger" @click="handleSignOut">
                <LogOut :size="16" />
                Sair
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>

    <main class="client-workspace__main">
      <!-- Trial Free Period Banner -->
      <section v-if="isTrial" class="client-workspace__trial-banner" aria-label="Período de teste">
        <div class="client-workspace__trial-content">
          <div class="client-workspace__trial-badge">
            <Clock :size="13" />
            <span>15 Dias Grátis Ativos</span>
          </div>
          <h2>
            Você tem <strong>{{ trialDaysLeft }} {{ trialDaysLeft === 1 ? 'dia' : 'dias' }}</strong> restantes no seu teste grátis!
          </h2>
          <p>
            Aproveite todas as ferramentas liberadas da sua loja. Você pode mudar de plano ou assinar a qualquer momento.
          </p>
        </div>

        <div class="client-workspace__trial-actions">
          <NuxtLink to="/plans" class="client-workspace__trial-btn">
            Ver Planos & Pagamento
            <ArrowRight :size="15" />
          </NuxtLink>
        </div>
      </section>

      <section class="client-workspace__hero" aria-labelledby="client-workspace-title">
        <div class="client-workspace__hero-copy">
          <p class="client-workspace__eyebrow"><Sparkles :size="15" /> Seu espaço de criação</p>
          <h1 id="client-workspace-title">Olá, {{ customerName }}.<br>O que vamos criar hoje?</h1>
          <p>
            Escolha uma ferramenta para começar. Cada caminho já leva você direto ao que precisa, sem ter que procurar entre configurações.
          </p>
        </div>

        <aside class="client-workspace__flow-card" aria-label="Como começar">
          <span>Começo simples</span>
          <strong>Uma escolha agora.<br>Seu material pronto depois.</strong>
          <ul>
            <li><Check :size="15" /> Selecione a solução</li>
            <li><Check :size="15" /> Use o fluxo guiado</li>
            <li><Check :size="15" /> Compartilhe com sua loja</li>
          </ul>
        </aside>
      </section>

      <section id="escolher-ferramenta" class="client-workspace__tools" aria-labelledby="tools-title">
        <div class="client-workspace__section-heading">
          <div>
            <span>Escolha por onde começar</span>
            <h2 id="tools-title">Sua comunicação, em um só lugar.</h2>
          </div>
          <p>Escolha uma área disponível para criar e gerenciar materiais.</p>
        </div>

        <div class="client-workspace__grid">
          <article
            v-for="workspace in workspaces"
            :key="workspace.id"
            :class="['client-workspace__tool', `client-workspace__tool--${workspace.id}`]"
          >
            <NuxtLink :to="workspace.href" class="client-workspace__tool-link">
              <div class="client-workspace__tool-topline">
                <span class="client-workspace__tool-icon"><component :is="workspace.icon" :size="24" /></span>
                <ArrowRight class="client-workspace__tool-arrow" :size="19" aria-hidden="true" />
              </div>

              <p class="client-workspace__tool-eyebrow">{{ workspace.eyebrow }}</p>
              <h3>{{ workspace.title }}</h3>
              <p class="client-workspace__tool-description">{{ workspace.description }}</p>

              <ol class="client-workspace__tool-steps" :aria-label="`Etapas para ${workspace.title}`">
                <li v-for="(step, index) in workspace.steps" :key="step">
                  <span>{{ index + 1 }}</span>
                  {{ step }}
                </li>
              </ol>

              <span class="client-workspace__tool-action">
                {{ workspace.action }}
                <ArrowRight :size="16" aria-hidden="true" />
              </span>
            </NuxtLink>
          </article>
        </div>
      </section>

      <!-- Meus Encartes e Modelos Editados -->
      <section v-if="auth.can('encartes')" class="client-workspace__recent-projects" aria-labelledby="recent-title">
        <div class="client-workspace__recent-heading">
          <div>
            <span class="client-workspace__recent-eyebrow">Histórico da loja</span>
            <h2 id="recent-title">Meus encartes e modelos editados</h2>
          </div>
          <NuxtLink to="/quick-editor" class="client-workspace__recent-all">
            <span>Novo encarte</span>
            <ArrowRight :size="15" />
          </NuxtLink>
        </div>

        <div v-if="isProjectsLoading" class="client-workspace__projects-loading">
          <Loader2 class="animate-spin" :size="24" />
          <span>Carregando seus materiais recentes...</span>
        </div>

        <div v-else-if="projects.length === 0" class="client-workspace__projects-empty">
          <div class="client-workspace__projects-empty-icon">
            <LayoutTemplate :size="28" />
          </div>
          <h3>Você ainda não editou nenhum encarte</h3>
          <p>Escolha um dos modelos profissionais disponíveis para começar a criar as ofertas da sua loja.</p>
          <NuxtLink to="/quick-editor" class="client-workspace__projects-empty-btn">
            Criar meu primeiro encarte
            <ArrowRight :size="15" />
          </NuxtLink>
        </div>

        <div v-else class="client-workspace__projects-grid">
          <div
            v-for="item in projects"
            :key="item.id"
            class="client-workspace__project-card"
          >
            <div class="client-workspace__project-thumb">
              <img
                v-if="item.preview_url"
                :src="item.preview_url"
                :alt="item.name || 'Encarte'"
                loading="lazy"
              />
              <div v-else class="client-workspace__project-thumb-placeholder">
                <LayoutTemplate :size="32" />
              </div>
            </div>

            <div class="client-workspace__project-info">
              <h4 :title="item.name || 'Sem título'">{{ item.name || 'Encarte sem título' }}</h4>
              <p v-if="item.updated_at">
                Editado {{ formatHistoryDateTime(item.updated_at) }}
              </p>
            </div>

            <div class="client-workspace__project-actions">
              <NuxtLink
                :to="`/editor/${item.id}?quick=1`"
                class="client-workspace__project-edit-btn"
              >
                <Edit3 :size="14" />
                Continuar Editando
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <section v-if="auth.can('loja')" class="client-workspace__help" aria-label="Ajuda para começar">
        <div class="client-workspace__help-icon"><Store :size="19" /></div>
        <div>
          <strong>Quer que tudo saia com a cara da sua loja?</strong>
          <p>Cadastre ou revise logo, contatos e identidade antes de criar a próxima campanha.</p>
        </div>
        <NuxtLink to="/business-profile" class="client-workspace__help-link">
          Ajustar minha loja <ArrowRight :size="16" />
        </NuxtLink>
      </section>
    </main>
  </div>
</template>

<style scoped>
.client-workspace {
  --workspace-ink: #172b45;
  --workspace-muted: #60758f;
  --workspace-blue: #2160b4;
  --workspace-line: #dbe5f0;
  min-height: 100dvh;
  overflow: hidden;
  color: var(--workspace-ink);
  background:
    radial-gradient(circle at 13% -7%, rgba(75, 139, 221, .17), transparent 28rem),
    radial-gradient(circle at 96% 29%, rgba(83, 170, 139, .11), transparent 22rem),
    #f6f8fb;
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, sans-serif;
}

.client-workspace__skip {
  position: fixed;
  z-index: 30;
  top: 12px;
  left: 50%;
  padding: 10px 16px;
  color: #fff;
  background: #173d70;
  border-radius: 999px;
  transform: translate(-50%, -180%);
  transition: transform .18s ease;
}

.client-workspace__skip:focus {
  transform: translate(-50%, 0);
}

.client-workspace__header {
  position: relative;
  z-index: 10;
  border-bottom: 1px solid rgba(208, 221, 236, .85);
  background: rgba(255, 255, 255, .79);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.client-workspace__header-inner,
.client-workspace__main {
  width: min(1180px, calc(100% - 48px));
  margin: 0 auto;
}

.client-workspace__header-inner {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.client-workspace__brand {
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
}

.client-workspace__brand img {
  display: block;
  width: 166px;
  height: auto;
}

.client-workspace__account {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-workspace__store-link,
.client-workspace__account-menu summary {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--workspace-line);
  border-radius: 12px;
  color: #4c6580;
  background: rgba(255, 255, 255, .8);
  font-size: 12px;
  font-weight: 700;
  transition: border-color .18s ease, color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.client-workspace__store-link {
  padding: 0 14px;
}

.client-workspace__store-link:hover,
.client-workspace__account-menu summary:hover,
.client-workspace__account-menu[open] summary {
  color: var(--workspace-blue);
  border-color: #a6c5ec;
  box-shadow: 0 10px 22px rgba(35, 82, 136, .08);
}

.client-workspace__account-menu {
  position: relative;
}

.client-workspace__account-menu summary {
  padding: 4px 10px 4px 5px;
  cursor: pointer;
  list-style: none;
}

.client-workspace__account-menu summary::-webkit-details-marker {
  display: none;
}

.client-workspace__account-menu summary > svg {
  color: #8194ab;
  transition: transform .18s ease;
}

.client-workspace__account-menu[open] summary > svg {
  transform: rotate(180deg);
}

.client-workspace__avatar {
  display: grid;
  width: 33px;
  height: 33px;
  place-items: center;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(135deg, #286bc3, #173d70);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
}

.client-workspace__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.client-workspace__account-copy {
  display: grid;
  gap: 1px;
  text-align: left;
}

.client-workspace__account-copy strong {
  max-width: 126px;
  overflow: hidden;
  color: #24405c;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.client-workspace__account-copy small {
  color: #7c90a7;
  font-size: 10px;
  font-weight: 500;
}

.client-workspace__account-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 9px);
  right: 0;
  display: grid;
  min-width: 196px;
  padding: 7px;
  border: 1px solid var(--workspace-line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 22px 44px rgba(24, 53, 86, .16);
}

.client-workspace__account-action {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  color: #4d637b;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.client-workspace__account-action:hover {
  color: var(--workspace-blue);
  background: #edf5ff;
}

.client-workspace__account-action.is-danger:hover {
  color: #b23e44;
  background: #fff1f1;
}

.client-workspace__main {
  padding: 68px 0 56px;
}

.client-workspace__hero {
  display: grid;
  grid-template-columns: minmax(0, 1.32fr) minmax(275px, .68fr);
  align-items: end;
  gap: clamp(34px, 7vw, 106px);
  padding-bottom: 58px;
}

.client-workspace__eyebrow,
.client-workspace__section-heading > div > span,
.client-workspace__tool-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--workspace-blue);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.client-workspace__hero h1 {
  max-width: 725px;
  margin: 17px 0 19px;
  color: #17375f;
  font-size: clamp(38px, 5vw, 66px);
  font-weight: 700;
  letter-spacing: -.068em;
  line-height: .99;
}

.client-workspace__hero-copy > p:last-child {
  max-width: 595px;
  margin: 0;
  color: var(--workspace-muted);
  font-size: 15px;
  line-height: 1.82;
}

.client-workspace__flow-card {
  position: relative;
  overflow: hidden;
  padding: 27px 29px;
  color: #eff6ff;
  background: linear-gradient(145deg, #18467e, #17355f);
  border-radius: 20px;
  box-shadow: 0 20px 45px rgba(23, 61, 112, .2);
}

.client-workspace__flow-card::after {
  position: absolute;
  width: 152px;
  height: 152px;
  right: -64px;
  bottom: -77px;
  border: 24px solid rgba(170, 209, 255, .13);
  border-radius: 50%;
  content: '';
}

.client-workspace__flow-card > span,
.client-workspace__flow-card li {
  position: relative;
  z-index: 1;
  color: #c8dcf4;
  font-size: 10px;
}

.client-workspace__flow-card > span {
  display: block;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.client-workspace__flow-card strong {
  position: relative;
  z-index: 1;
  display: block;
  margin: 13px 0 19px;
  color: #fff;
  font-size: 21px;
  letter-spacing: -.042em;
  line-height: 1.18;
}

.client-workspace__flow-card ul {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.client-workspace__flow-card li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.client-workspace__flow-card li svg {
  color: #9fd6c3;
}

.client-workspace__tools {
  padding: 45px 0 52px;
  border-top: 1px solid var(--workspace-line);
}

.client-workspace__section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 34px;
  margin-bottom: 33px;
}

.client-workspace__section-heading h2 {
  margin: 11px 0 0;
  color: #1b3759;
  font-size: clamp(26px, 3.15vw, 40px);
  font-weight: 700;
  letter-spacing: -.055em;
  line-height: 1.04;
}

.client-workspace__section-heading > p {
  max-width: 318px;
  margin: 0 0 3px;
  color: var(--workspace-muted);
  font-size: 12px;
  line-height: 1.75;
}

.client-workspace__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 17px;
}

.client-workspace__tool {
  --tool-accent: #2160b4;
  --tool-soft: #eaf2ff;
  --tool-edge: #bcd5f5;
  min-width: 0;
}

.client-workspace__tool--cartazes {
  --tool-accent: #b5602f;
  --tool-soft: #fff0e8;
  --tool-edge: #f1cdb8;
}

.client-workspace__tool--videos {
  --tool-accent: #5f5aa7;
  --tool-soft: #efeffc;
  --tool-edge: #d0cdf0;
}

.client-workspace__tool--radio {
  --tool-accent: #307e62;
  --tool-soft: #e8f5ee;
  --tool-edge: #b8dfcf;
}

.client-workspace__tool-link {
  position: relative;
  display: flex;
  min-height: 326px;
  flex-direction: column;
  overflow: hidden;
  padding: 25px;
  color: inherit;
  border: 1px solid var(--workspace-line);
  border-radius: 19px;
  background: rgba(255, 255, 255, .9);
  box-shadow: 0 14px 34px rgba(30, 66, 108, .055);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.client-workspace__tool-link::after {
  position: absolute;
  width: 155px;
  height: 155px;
  right: -79px;
  top: -79px;
  border: 29px solid var(--tool-soft);
  border-radius: 50%;
  content: '';
  transition: transform .28s ease;
}

.client-workspace__tool-link:hover {
  border-color: var(--tool-edge);
  box-shadow: 0 23px 48px rgba(30, 66, 108, .12);
  transform: translateY(-4px);
}

.client-workspace__tool-link:hover::after {
  transform: scale(1.12) translate(-8px, 8px);
}

.client-workspace__tool-topline {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.client-workspace__tool-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--tool-accent);
  background: var(--tool-soft);
  border-radius: 14px;
}

.client-workspace__tool-arrow {
  color: #9cafc3;
  transition: color .18s ease, transform .18s ease;
}

.client-workspace__tool-link:hover .client-workspace__tool-arrow {
  color: var(--tool-accent);
  transform: translate(3px, -3px);
}

.client-workspace__tool-eyebrow {
  margin: 28px 0 7px;
  color: var(--tool-accent);
  font-size: 9px;
}

.client-workspace__tool h3 {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #1d3858;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -.053em;
  line-height: 1.08;
}

.client-workspace__tool-description {
  position: relative;
  z-index: 1;
  max-width: 405px;
  margin: 10px 0 0;
  color: var(--workspace-muted);
  font-size: 11px;
  line-height: 1.75;
}

.client-workspace__tool-steps {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 22px 0 0;
  padding: 0;
  list-style: none;
}

.client-workspace__tool-steps li {
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  gap: 5px;
  padding: 0 8px 0 5px;
  color: #54708c;
  background: #f5f8fc;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 600;
}

.client-workspace__tool-steps span {
  display: grid;
  width: 16px;
  height: 16px;
  place-items: center;
  color: var(--tool-accent);
  background: var(--tool-soft);
  border-radius: 50%;
  font-size: 8px;
  font-weight: 800;
}

.client-workspace__tool-action {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 7px;
  margin-top: auto;
  padding-top: 21px;
  color: var(--tool-accent);
  font-size: 11px;
  font-weight: 800;
}

.client-workspace__tool-action svg {
  transition: transform .18s ease;
}

.client-workspace__tool-link:hover .client-workspace__tool-action svg {
  transform: translateX(4px);
}

.client-workspace__help {
  display: flex;
  min-height: 92px;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  border: 1px solid #d8e6f4;
  border-radius: 17px;
  background: linear-gradient(100deg, #eff6ff, #f8fbff);
}

.client-workspace__help-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  color: #2362b1;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 18px rgba(35, 86, 140, .09);
}

.client-workspace__help strong {
  display: block;
  color: #1f426c;
  font-size: 13px;
}

.client-workspace__help p {
  margin: 5px 0 0;
  color: var(--workspace-muted);
  font-size: 11px;
  line-height: 1.5;
}

.client-workspace__help-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 0 13px;
  color: #fff;
  background: #2160b4;
  border-radius: 10px;
  box-shadow: 0 10px 22px rgba(33, 96, 180, .22);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
}

.client-workspace__help-link:hover {
  background: #174d96;
  box-shadow: 0 14px 28px rgba(33, 96, 180, .28);
  transform: translateY(-1px);
}

.client-workspace :is(a, button, summary):focus-visible {
  outline: 3px solid rgba(33, 96, 180, .35);
  outline-offset: 3px;
}

@media (max-width: 760px) {
  .client-workspace__header-inner,
  .client-workspace__main {
    width: min(100% - 30px, 620px);
  }

  .client-workspace__header-inner {
    min-height: 72px;
  }

  .client-workspace__brand img {
    width: 141px;
  }

  .client-workspace__store-link {
    width: 42px;
    justify-content: center;
    padding: 0;
  }

  .client-workspace__store-link span,
  .client-workspace__account-copy,
  .client-workspace__account-menu summary > svg {
    display: none;
  }

  .client-workspace__account-menu summary {
    width: 43px;
    justify-content: center;
    padding: 4px;
  }

  .client-workspace__main {
    padding: 42px 0 36px;
  }

  .client-workspace__hero {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-bottom: 44px;
  }

  .client-workspace__hero h1 {
    margin-top: 14px;
    font-size: clamp(38px, 11vw, 56px);
  }

  .client-workspace__hero-copy > p:last-child {
    font-size: 13px;
  }

  .client-workspace__flow-card {
    padding: 22px;
  }

  .client-workspace__section-heading {
    display: block;
    margin-bottom: 25px;
  }

  .client-workspace__section-heading > p {
    max-width: 430px;
    margin-top: 14px;
    font-size: 12px;
  }

  .client-workspace__grid {
    grid-template-columns: 1fr;
  }

  .client-workspace__tool-link {
    min-height: 290px;
  }

  .client-workspace__help {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .client-workspace__help-link {
    width: 100%;
    justify-content: center;
    margin: 4px 0 0;
  }
}

@media (max-width: 410px) {
  .client-workspace__header-inner,
  .client-workspace__main {
    width: calc(100% - 24px);
  }

  .client-workspace__account {
    gap: 6px;
  }

  .client-workspace__brand img {
    width: 129px;
  }

  .client-workspace__tool-link {
    padding: 21px;
  }

  .client-workspace__tool-steps {
    gap: 5px;
  }
}

/* Plans Badge in Header */
.client-workspace__plans-badge {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  transition: all .18s ease;
}

.client-workspace__plans-badge:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  transform: translateY(-1px);
}

/* Trial Banner */
.client-workspace__trial-banner {
  margin-bottom: 32px;
  padding: 24px 28px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1e3a8a, #2563eb 50%, #4f46e5);
  color: #fff;
  box-shadow: 0 12px 28px rgba(37, 99, 235, .2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (min-width: 768px) {
  .client-workspace__trial-banner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.client-workspace__trial-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .2);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: 8px;
}

.client-workspace__trial-content h2 {
  font-size: 19px;
  font-weight: 800;
  margin-bottom: 4px;
  letter-spacing: -.02em;
}

.client-workspace__trial-content p {
  font-size: 13px;
  color: #dbeafe;
  max-width: 600px;
  line-height: 1.45;
}

.client-workspace__trial-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  background: #fff;
  color: #1e3a8a;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(0, 0, 0, .12);
  transition: all .18s ease;
}

.client-workspace__trial-btn:hover {
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(0, 0, 0, .16);
}

/* Recent Projects / Encartes */
.client-workspace__recent-projects {
  margin-top: 48px;
  margin-bottom: 48px;
}

.client-workspace__recent-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.client-workspace__recent-eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #64748b;
  margin-bottom: 2px;
}

.client-workspace__recent-heading h2 {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -.02em;
}

.client-workspace__recent-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: var(--workspace-blue);
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  transition: all .18s ease;
}

.client-workspace__recent-all:hover {
  border-color: var(--workspace-blue);
  background: #f8fafc;
}

.client-workspace__projects-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  background: #fff;
  border-radius: 16px;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.client-workspace__projects-empty {
  padding: 44px 24px;
  background: #fff;
  border-radius: 20px;
  border: 1px dashed #cbd5e1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.client-workspace__projects-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.client-workspace__projects-empty h3 {
  font-size: 16px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 4px;
}

.client-workspace__projects-empty p {
  font-size: 13px;
  color: #64748b;
  max-width: 460px;
  line-height: 1.45;
  margin-bottom: 18px;
}

.client-workspace__projects-empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 10px;
  background: var(--workspace-blue);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  transition: all .18s ease;
}

.client-workspace__projects-empty-btn:hover {
  background: #174d96;
}

.client-workspace__projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 18px;
}

.client-workspace__project-card {
  background: #fff;
  border-radius: 18px;
  border: 1px solid #e2e8f0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: all .18s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .03);
}

.client-workspace__project-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 12px 24px rgba(37, 99, 235, .08);
  transform: translateY(-2px);
}

.client-workspace__project-thumb {
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1px solid #f1f5f9;
}

.client-workspace__project-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.client-workspace__project-thumb-placeholder {
  color: #94a3b8;
}

.client-workspace__project-info {
  padding: 12px 4px 8px;
  flex: 1;
}

.client-workspace__project-info h4 {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.client-workspace__project-info p {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.client-workspace__project-actions {
  margin-top: 6px;
}

.client-workspace__project-edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  transition: all .18s ease;
}

.client-workspace__project-edit-btn:hover {
  background: #dbeafe;
  color: #1e40af;
}

@media (prefers-reduced-motion: reduce) {
  .client-workspace *,
  .client-workspace *::after {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
