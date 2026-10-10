<script setup lang="ts">
import { ChevronRight, Menu as MenuIcon } from 'lucide-vue-next'
import { useResponsive } from '~/composables/useResponsive'

const props = withDefaults(defineProps<{
  activeNav?: 'library' | 'users' | 'voices' | 'storage' | 'whatsapp' | 'art-studio' | 'videos' | 'cartazista' | 'cartazes' | 'radio' | 'builder' | 'cards' | 'zones' | 'encartes'
  showSearch?: boolean
}>(), {
  activeNav: 'library',
  showSearch: false
})

const emit = defineEmits<{
  'update:searchQuery': [value: string]
}>()

const auth = useAuth()
const route = useRoute()
const { screenWidth } = useResponsive()
const dashMobile = computed(() => screenWidth.value < 1024)
const showMobileDrawer = ref(false)
const searchQuery = ref('')

const user = computed(() => auth.user.value)

const formatUserName = (name?: string | null) => {
  const value = String(name || '').trim()
  return value || 'Usuário'
}

watch(searchQuery, (value) => {
  emit('update:searchQuery', value)
})

const closeDrawer = () => {
  showMobileDrawer.value = false
}

watch(dashMobile, closeDrawer)
watch(() => route.path, closeDrawer)

const adminLabels: Record<string, string> = {
  users: 'Usuários e acessos', voices: 'Banco de vozes', storage: 'Arquivos', whatsapp: 'WhatsApp',
  builder: 'Modelos e configurações', themes: 'Temas', models: 'Modelos', layouts: 'Grades',
  'price-tag-styles': 'Estilos de preço', 'badge-styles': 'Selos', 'font-configs': 'Fontes',
  tenants: 'Empresas', 'card-templates': 'Modelos de produto', 'header-templates': 'Cabeçalhos',
  'footer-templates': 'Rodapés', segments: 'Segmentos',
}
const breadcrumbs = computed(() => {
  if (!route.path.startsWith('/admin/')) return []
  const parts = route.path.split('/').filter(Boolean).slice(1)
  return parts.map((part, index) => ({ label: adminLabels[part] || part, to: '/admin/' + parts.slice(0, index + 1).join('/') }))
})
</script>

<template>
  <div :class="['admin-shell', dashMobile ? 'admin-shell--mobile' : '']">
    <a href="#admin-main-content" class="admin-shell__skip">Ir para o conteúdo</a>
    <div class="admin-shell__frame">
      <header class="admin-shell__topbar">
        <div class="admin-shell__brand">
          <button
            v-if="dashMobile"
            type="button"
            class="admin-shell__icon-btn"
            aria-label="Abrir menu"
            :aria-expanded="showMobileDrawer"
            @click="showMobileDrawer = true"
          >
            <MenuIcon class="h-5 w-5" />
          </button>
          <NuxtLink prefetch-on="interaction" to="/" class="admin-shell__brand-link" aria-label="JobVarejo, central administrativa">
            <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="176" height="56">
            <span v-if="!dashMobile" class="admin-shell__brand-copy">
              <strong>Central administrativa</strong>
              <small>Operação JobVarejo</small>
            </span>
          </NuxtLink>
        </div>

        <div v-if="!dashMobile && showSearch" class="admin-shell__search">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar projetos…"
            aria-label="Buscar projetos"
            class="admin-shell__search-input"
          >
        </div>

        <AccountSwitcher v-if="auth.isStaff.value" />
        <div v-if="user" class="admin-shell__user">
          <div class="admin-shell__avatar">
            <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.name || 'Admin'">
            <span v-else>{{ user.name?.charAt(0) || 'A' }}</span>
          </div>
          <span v-if="!dashMobile" class="admin-shell__role">{{ auth.isSuperAdmin.value ? 'Super admin' : 'Minha conta' }}</span>
          <span v-if="!dashMobile" class="admin-shell__name">{{ formatUserName(user.name) }}</span>
        </div>
      </header>

      <div class="admin-shell__layout">
        <DashboardMobileDrawer v-if="dashMobile" v-model:open="showMobileDrawer">
          <AdminWorkspaceNav :active-nav="activeNav" @navigate="closeDrawer" />
        </DashboardMobileDrawer>

        <aside v-if="!dashMobile" class="admin-shell__sidebar">
          <AdminWorkspaceNav :active-nav="activeNav" />
        </aside>

        <main id="admin-main-content" class="admin-shell__main" tabindex="-1">
          <nav v-if="breadcrumbs.length" class="admin-shell__breadcrumbs" aria-label="Caminho da página">
            <NuxtLink to="/">Início</NuxtLink>
            <template v-for="(crumb, index) in breadcrumbs" :key="crumb.to">
              <ChevronRight :size="14" aria-hidden="true" />
              <span v-if="index === breadcrumbs.length - 1" aria-current="page">{{ crumb.label }}</span>
              <NuxtLink v-else :to="crumb.to">{{ crumb.label }}</NuxtLink>
            </template>
          </nav>
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell__skip { position: absolute; top: -100px; left: 16px; z-index: 100; padding: 12px 18px; background: #173d70; color: white; border-radius: 8px; }
.admin-shell__skip:focus { top: 8px; }
.admin-shell__breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 16px clamp(12px, 2vw, 28px) 0; font-size: 12px; color: #60758f; }
.admin-shell__breadcrumbs a { color: #2160b4; text-decoration: none; }
.admin-shell__breadcrumbs a:hover { text-decoration: underline; }
.admin-shell__breadcrumbs [aria-current] { color: #172b45; font-weight: 600; }

.admin-shell {
  --jv-navy: #173d70;
  --jv-blue: #2160b4;
  --jv-sky: #eaf3ff;
  --jv-ink: #172b45;
  --jv-muted: #60758f;
  --jv-line: #d7e4f1;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  color: var(--jv-ink);
  background: #f6f8fb;
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, sans-serif;
}

.admin-shell__frame {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.admin-shell__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 60px;
  padding: env(safe-area-inset-top, 0px) clamp(12px, 1.5vw, 24px) 0;
  border-bottom: 1px solid var(--jv-line);
  background: #fff;
  z-index: 20;
}

.admin-shell__brand,
.admin-shell__user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.admin-shell__brand-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.admin-shell__brand-link img {
  height: 30px;
  width: auto;
}

.admin-shell__brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.admin-shell__brand-copy strong {
  font-size: 13px;
  color: #16375f;
}

.admin-shell__brand-copy small {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b7ea8;
}

.admin-shell__search {
  flex: 1;
  max-width: 420px;
  min-width: 0;
  margin: 0 12px;
}

.admin-shell__search-input {
  width: 100%;
  height: 40px;
  border: 1px solid #dbe7f5;
  border-radius: 12px;
  background: #fff;
  padding: 0 14px;
  font-size: 13px;
}

.admin-shell__avatar {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.admin-shell__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.admin-shell__role {
  border-radius: 999px;
  background: #edf4ff;
  color: #2160b4;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 4px 8px;
}

.admin-shell__name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #1e3a5f;
}

.admin-shell__layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.admin-shell__sidebar {
  width: clamp(208px, 17vw, 232px);
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  border-right: 1px solid rgba(148, 163, 184, 0.22);
  background: #fff;
}

.admin-shell__main {
  flex: 1;
  overflow: auto;
  min-width: 0;
  min-height: 0;
  scrollbar-width: thin;
}

.admin-shell__icon-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}

@media (max-width: 1279px) {
  .admin-shell__brand-copy { display: none; }
  .admin-shell__name { max-width: 100px; }
}

@media (max-width: 1023px) {
  .admin-shell__topbar { min-height: calc(56px + env(safe-area-inset-top, 0px)); gap: 8px; }
  .admin-shell__brand { flex: 1; gap: 4px; }
  .admin-shell__brand-link img { height: 28px; max-width: 120px; object-fit: contain; }

}

@media (max-width: 359px) {
  .admin-shell__topbar { padding-inline: 8px; gap: 4px; }
  .admin-shell__brand-link img { max-width: 96px; height: auto; }
}

@media print {
  .admin-shell,
  .admin-shell__frame,
  .admin-shell__layout,
  .admin-shell__main { width:auto; height:auto; min-height:0; overflow:visible; background:#fff; }
  .admin-shell__topbar,
  .admin-shell__sidebar { display:none !important; }
}
</style>
