<script setup lang="ts">
import {
  Clapperboard,
  Grid3X3,
  HardDrive,
  LayoutTemplate,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Mic2,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Store,
  User
} from 'lucide-vue-next'
import { useResponsive } from '~/composables/useResponsive'

const props = withDefaults(defineProps<{
  activeNav?: 'library' | 'musicgpt' | 'storage' | 'whatsapp' | 'art-studio' | 'videos' | 'cartazista' | 'cartazes' | 'radio' | 'builder' | 'cards' | 'zones' | 'encartes'
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

const handleSignOut = async () => {
  await auth.signOut()
}

const closeDrawer = () => {
  showMobileDrawer.value = false
}

watch(dashMobile, closeDrawer)
watch(() => route.path, closeDrawer)

const isActive = (key: NonNullable<typeof props.activeNav>) => {
  if (props.activeNav === key) return true
  if (key === 'musicgpt') return route.path.startsWith('/admin/musicgpt')
  if (key === 'storage') return route.path.startsWith('/admin/storage')
  if (key === 'whatsapp') return route.path.startsWith('/admin/whatsapp')
  if (key === 'videos') return route.path.startsWith('/videos')
  if (key === 'radio') return route.path.startsWith('/radio-indoor')
  if (key === 'encartes') return route.path.startsWith('/flyer-templates') || route.path.startsWith('/quick-editor')
  if (key === 'builder') return route.path.startsWith('/admin/builder')
  if (key === 'cards') return route.path.startsWith('/card-configurations')
  if (key === 'zones') return route.path.startsWith('/zone-structures')
  if (key === 'art-studio') return route.path.startsWith('/art-studio')
  if (key === 'cartazista' || key === 'cartazes') return route.path.startsWith('/cartazista')
  return route.path === '/'
}
</script>

<template>
  <div :class="['admin-shell', dashMobile ? 'admin-shell--mobile' : '']">
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
          <nav class="admin-shell__nav admin-shell__nav--drawer">
            <p class="admin-shell__section">Biblioteca</p>
            <NuxtLink prefetch-on="interaction" to="/" class="admin-shell__nav-item" :class="{ active: activeNav === 'library' && route.path === '/' }" @click="closeDrawer">
              Biblioteca e projetos
            </NuxtLink>
            <p class="admin-shell__section">Soluções</p>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('encartes')" :to="auth.user.value?.role === 'user' ? '/quick-editor' : '/flyer-templates'" class="admin-shell__nav-item" :class="{ active: isActive('encartes') }" @click="closeDrawer"><LayoutTemplate class="h-3.5 w-3.5 text-blue-600" /> {{ auth.user.value?.role === 'user' ? 'Edição rápida' : 'Encartes' }}</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('cartazes')" to="/cartazista" class="admin-shell__nav-item" :class="{ active: isActive('cartazista') }" @click="closeDrawer"><Sparkles class="h-3.5 w-3.5 text-blue-500" /> Cartazes</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('videos')" to="/videos" class="admin-shell__nav-item" :class="{ active: isActive('videos') }" @click="closeDrawer"><Clapperboard class="h-3.5 w-3.5 text-blue-600" /> Vídeos</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('radio')" to="/radio-indoor" class="admin-shell__nav-item" :class="{ active: isActive('radio') }" @click="closeDrawer"><Radio class="h-3.5 w-3.5 text-blue-600" /> Rádio Indoor</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('artes')" to="/art-studio" class="admin-shell__nav-item" :class="{ active: isActive('art-studio') }" @click="closeDrawer"><Sparkles class="h-3.5 w-3.5 text-sky-600" /> Estúdio de Artes</NuxtLink>
            <div class="admin-shell__spacer" />
            <p class="admin-shell__section">Configuração</p>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value" to="/admin/users" class="admin-shell__nav-item" @click="closeDrawer"><User class="h-3.5 w-3.5" /> Usuários e acessos</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/musicgpt" class="admin-shell__nav-item" :class="{ active: isActive('musicgpt') }" @click="closeDrawer"><Mic2 class="h-3.5 w-3.5 text-blue-600" /> MusicGPT</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value" to="/admin/whatsapp" class="admin-shell__nav-item" :class="{ active: isActive('whatsapp') }" @click="closeDrawer"><MessageCircle class="h-3.5 w-3.5 text-emerald-600" /> WhatsApp</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/storage" class="admin-shell__nav-item" :class="{ active: isActive('storage') }" @click="closeDrawer"><HardDrive class="h-3.5 w-3.5 text-slate-400" /> Storage</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value || (auth.user.value?.role === 'editor' && auth.can('encartes'))" to="/card-configurations" class="admin-shell__nav-item" :class="{ active: isActive('cards') }" @click="closeDrawer"><SlidersHorizontal class="h-3.5 w-3.5 text-blue-600" /> Configuração de cards</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value || (auth.user.value?.role === 'editor' && auth.can('encartes'))" to="/zone-structures" class="admin-shell__nav-item" :class="{ active: isActive('zones') }" @click="closeDrawer"><Grid3X3 class="h-3.5 w-3.5 text-blue-600" /> Estrutura de zonas</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/builder" class="admin-shell__nav-item" :class="{ active: isActive('builder') }" @click="closeDrawer"><LayoutTemplate class="h-3.5 w-3.5 text-blue-600" /> Configurações do builder</NuxtLink>
            <div class="admin-shell__divider" />
            <button type="button" class="admin-shell__nav-item" @click="navigateTo('/profile'); closeDrawer()"><User class="h-3.5 w-3.5" /> Meu Perfil</button>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('loja')" to="/business-profile" class="admin-shell__nav-item" @click="closeDrawer"><Store class="h-3.5 w-3.5 text-blue-500" /> Minha loja</NuxtLink>
            <button type="button" class="admin-shell__nav-item signout" @click="handleSignOut"><LogOut class="h-3.5 w-3.5" /> Sair</button>
          </nav>
        </DashboardMobileDrawer>

        <aside v-show="!dashMobile" class="admin-shell__sidebar">
          <nav class="admin-shell__nav">
            <p class="admin-shell__section">Biblioteca</p>
            <NuxtLink prefetch-on="interaction" to="/" class="admin-shell__nav-item" :class="{ active: activeNav === 'library' && route.path === '/' }">
              Biblioteca e projetos
            </NuxtLink>
            <p class="admin-shell__section">Soluções</p>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('encartes')" :to="auth.user.value?.role === 'user' ? '/quick-editor' : '/flyer-templates'" class="admin-shell__nav-item" :class="{ active: isActive('encartes') }"><LayoutTemplate class="h-4 w-4 text-blue-600" /> {{ auth.user.value?.role === 'user' ? 'Edição rápida' : 'Encartes' }}</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('cartazes')" to="/cartazista" class="admin-shell__nav-item" :class="{ active: isActive('cartazista') }"><Sparkles class="h-4 w-4 text-blue-500" /> Cartazes</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('videos')" to="/videos" class="admin-shell__nav-item" :class="{ active: isActive('videos') }"><Clapperboard class="h-4 w-4 text-blue-600" /> Vídeos</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('radio')" to="/radio-indoor" class="admin-shell__nav-item" :class="{ active: isActive('radio') }"><Radio class="h-4 w-4 text-blue-600" /> Rádio Indoor</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('artes')" to="/art-studio" class="admin-shell__nav-item" :class="{ active: isActive('art-studio') }"><Sparkles class="h-4 w-4 text-sky-600" /> Estúdio de Artes</NuxtLink>
          </nav>
          <div class="admin-shell__bottom">
            <div class="admin-shell__divider" />
            <p class="admin-shell__section">Configuração</p>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value" to="/admin/users" class="admin-shell__nav-item"><User class="h-4 w-4" /> Usuários e acessos</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/musicgpt" class="admin-shell__nav-item" :class="{ active: isActive('musicgpt') }"><Mic2 class="h-4 w-4 text-blue-600" /> MusicGPT</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value" to="/admin/whatsapp" class="admin-shell__nav-item" :class="{ active: isActive('whatsapp') }"><MessageCircle class="h-4 w-4 text-emerald-600" /> WhatsApp</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/storage" class="admin-shell__nav-item" :class="{ active: isActive('storage') }"><HardDrive class="h-4 w-4 text-slate-400" /> Storage</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value || (auth.user.value?.role === 'editor' && auth.can('encartes'))" to="/card-configurations" class="admin-shell__nav-item" :class="{ active: isActive('cards') }"><SlidersHorizontal class="h-4 w-4 text-blue-600" /> Configuração de cards</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isAdmin.value || (auth.user.value?.role === 'editor' && auth.can('encartes'))" to="/zone-structures" class="admin-shell__nav-item" :class="{ active: isActive('zones') }"><Grid3X3 class="h-4 w-4 text-blue-600" /> Estrutura de zonas</NuxtLink>
            <NuxtLink prefetch-on="interaction" v-if="auth.isSuperAdmin.value" to="/admin/builder" class="admin-shell__nav-item" :class="{ active: isActive('builder') }"><LayoutTemplate class="h-4 w-4 text-blue-600" /> Configurações do builder</NuxtLink>
            <div class="admin-shell__divider" />
            <button type="button" class="admin-shell__nav-item" @click="navigateTo('/profile')"><User class="h-4 w-4" /> Meu Perfil</button>
            <NuxtLink prefetch-on="interaction" v-if="auth.can('loja')" to="/business-profile" class="admin-shell__nav-item"><Store class="h-4 w-4 text-blue-500" /> Minha loja</NuxtLink>
            <button type="button" class="admin-shell__nav-item signout" @click="handleSignOut"><LogOut class="h-4 w-4" /> Sair</button>
          </div>
        </aside>

        <main class="admin-shell__main">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.admin-shell__nav {
  padding: 10px 10px 6px;
  flex: 0 0 auto;
}

.admin-shell__nav--drawer {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.admin-shell__bottom {
  margin-top: auto;
  flex: 0 0 auto;
  padding: 6px 10px 10px;
}

.admin-shell__section {
  margin: 12px 4px 8px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7b93b0;
}

.admin-shell__nav-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 8px;
  color: #355074;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
}

.admin-shell__nav-item svg { flex-shrink: 0; }
.admin-shell__nav-item:focus-visible,
.admin-shell__icon-btn:focus-visible { outline: 2px solid var(--jv-blue); outline-offset: 2px; }

.admin-shell__nav-item:hover,
.admin-shell__nav-item.active {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.admin-shell__nav-item.signout:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.admin-shell__divider {
  height: 1px;
  margin: 10px 4px;
  background: rgba(148, 163, 184, 0.28);
}

.admin-shell__spacer {
  flex: 1;
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
  .admin-shell__nav-item { min-height: 44px; }
}

@media (max-width: 359px) {
  .admin-shell__topbar { padding-inline: 8px; gap: 4px; }
  .admin-shell__brand-link img { max-width: 96px; height: auto; }
}

@media (max-height: 600px) and (min-width: 1024px) {
  .admin-shell__nav-item { min-height: 34px; font-size: 12px; }
  .admin-shell__section { margin-block: 8px 4px; }
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
