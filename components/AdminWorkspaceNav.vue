<script setup lang="ts">
import { Clapperboard, Grid3X3, HardDrive, LayoutTemplate, Library, LogOut, MessageCircle, Mic2, Radio, Search, SlidersHorizontal, Sparkles, Store, User, X } from 'lucide-vue-next'

const props = defineProps<{ activeNav?: string }>()
const emit = defineEmits<{ navigate: [] }>()
const auth = useAuth()
const route = useRoute()
const query = ref('')
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const canConfigure = computed(() => auth.isAdmin.value || (auth.user.value?.role === 'editor' && auth.can('encartes')))
const groups = computed(() => [
  { label: 'Área de trabalho', items: [
    { key: 'library', label: 'Biblioteca e projetos', to: '/', icon: Library, visible: true },
  ] },
  { label: 'Criar materiais', items: [
    { key: 'encartes', label: auth.user.value?.role === 'user' ? 'Edição rápida' : 'Encartes', to: auth.user.value?.role === 'user' ? '/quick-editor' : '/flyer-templates', icon: LayoutTemplate, visible: auth.can('encartes') },
    { key: 'cartazista', label: 'Cartazes', to: '/cartazista', icon: Sparkles, visible: auth.can('cartazes') },
    { key: 'videos', label: 'Vídeos', to: '/videos', icon: Clapperboard, visible: auth.can('videos') },
    { key: 'radio', label: 'Rádio Indoor', to: '/radio-indoor', icon: Radio, visible: auth.can('radio') },
    { key: 'art-studio', label: 'Estúdio de Artes', to: '/art-studio', icon: Sparkles, visible: auth.can('artes') },
  ] },
  { label: 'Administração', items: [
    { key: 'users', label: 'Usuários e acessos', to: '/admin/users', icon: User, visible: auth.isAdmin.value },
    { key: 'whatsapp', label: 'WhatsApp', to: '/admin/whatsapp', icon: MessageCircle, visible: auth.isAdmin.value },
    { key: 'voices', label: 'Banco de vozes', to: '/admin/voices', icon: Mic2, visible: auth.isSuperAdmin.value },
    { key: 'storage', label: 'Arquivos', to: '/admin/storage', icon: HardDrive, visible: auth.isSuperAdmin.value },
  ] },
  { label: 'Configurações', items: [
    { key: 'builder', label: 'Modelos e configurações', to: '/admin/builder', icon: LayoutTemplate, visible: auth.isSuperAdmin.value },
    { key: 'cards', label: 'Configuração de cards', to: '/card-configurations', icon: SlidersHorizontal, visible: canConfigure.value },
    { key: 'zones', label: 'Estrutura de zonas', to: '/zone-structures', icon: Grid3X3, visible: canConfigure.value },
  ] },
].map(group => ({ ...group, items: group.items.filter(item => item.visible) })).filter(group => group.items.length))
const activeKey = computed(() => {
  const match = groups.value.flatMap(group => group.items).find(item => item.to === '/' ? route.path === '/' : route.path === item.to || route.path.startsWith(`${item.to}/`))
  return match?.key || (props.activeNav === 'library' ? undefined : props.activeNav === 'cartazes' ? 'cartazista' : props.activeNav)
})
const filteredGroups = computed(() => groups.value.map(group => ({ ...group, items: group.items.filter(item => normalize(`${group.label} ${item.label}`).includes(normalize(query.value))) })).filter(group => group.items.length))
</script>

<template>
  <div class="workspace-nav">
    <label class="workspace-nav__search">
      <Search :size="16" aria-hidden="true" />
      <input v-model="query" type="search" placeholder="Encontrar ferramenta" aria-label="Buscar no menu" @keydown.esc="query = ''">
      <button v-if="query" type="button" aria-label="Limpar busca do menu" @click="query = ''"><X :size="15" /></button>
    </label>
    <nav aria-label="Navegação principal">
      <section v-for="group in filteredGroups" :key="group.label" class="workspace-nav__group">
        <h2>{{ group.label }}</h2>
        <NuxtLink v-for="item in group.items" :key="item.key" :to="item.to" prefetch-on="interaction" class="workspace-nav__item" :class="{ 'is-active': activeKey === item.key }" :aria-current="activeKey === item.key ? 'page' : undefined" @click="emit('navigate')">
          <component :is="item.icon" :size="17" aria-hidden="true" /><span>{{ item.label }}</span>
        </NuxtLink>
      </section>
      <p v-if="!filteredGroups.length" class="workspace-nav__empty" role="status">Nenhuma ferramenta encontrada. Tente outro nome.</p>
    </nav>
    <nav class="workspace-nav__account" aria-label="Minha conta">
      <NuxtLink to="/profile" class="workspace-nav__item" @click="emit('navigate')"><User :size="17" />Meu perfil</NuxtLink>
      <NuxtLink v-if="auth.can('loja')" to="/business-profile" class="workspace-nav__item" @click="emit('navigate')"><Store :size="17" />Minha loja</NuxtLink>
      <button type="button" class="workspace-nav__item workspace-nav__signout" @click="auth.signOut()"><LogOut :size="17" />Sair</button>
    </nav>
  </div>
</template>

<style scoped>
.workspace-nav { display: flex; flex-direction: column; min-height: 100%; padding: 16px 12px 12px; color: #355074; }
.workspace-nav__search { display: flex; align-items: center; gap: 8px; border: 1px solid #d7e4f1; border-radius: 8px; padding: 0 9px; min-height: 40px; background: #f6f8fb; color: #60758f; }
.workspace-nav__search:focus-within { outline: 2px solid #2160b4; outline-offset: 2px; }
.workspace-nav__search input { min-width: 0; width: 100%; background: transparent; border: 0; outline: none; font-size: 12px; }
.workspace-nav__search input::-webkit-search-cancel-button { display: none; }
.workspace-nav__search button { display: grid; place-items: center; min-width: 28px; min-height: 32px; }
.workspace-nav__group { margin-top: 18px; }
.workspace-nav__group h2 { margin: 0 10px 6px; font-size: 10px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #60758f; }
.workspace-nav__item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; text-align: left; text-decoration: none; font-size: 12px; font-weight: 600; line-height: 1.4; color: inherit; cursor: pointer; }
.workspace-nav__item svg { flex-shrink: 0; }
.workspace-nav__item:hover { background: #f0f5fb; }
.workspace-nav__item.is-active { background: #eaf3ff; color: #174f96; box-shadow: inset 3px 0 #2160b4; font-weight: 750; }
.workspace-nav__item:focus-visible, button:focus-visible { outline: 2px solid #2160b4; outline-offset: 2px; }
.workspace-nav__account { margin-top: auto; padding-top: 18px; }
.workspace-nav__account::before { content: ''; display: block; height: 1px; background: #e2eaf4; margin: 0 10px 8px; }
.workspace-nav__signout:hover { background: #fef2f2; color: #b91c1c; }
.workspace-nav__empty { padding: 20px 10px; font-size: 13px; line-height: 1.6; }
@media (max-width: 1023px) { .workspace-nav__item { min-height: 44px; font-size: 13px; } .workspace-nav__search input { font-size: 16px; } }
</style>
