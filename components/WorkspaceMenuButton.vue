<script setup lang="ts">
import { Menu } from 'lucide-vue-next'

const auth = useAuth()
withDefaults(defineProps<{ theme?: 'dark' | 'light' }>(), { theme: 'dark' })
const links = [
  { to: '/', label: 'Central administrativa' },
  { to: '/flyer-templates', label: 'Encartes' },
  { to: '/quick-editor', label: 'Edição rápida' },
  { to: '/card-configurations', label: 'Configuração de cards' },
  { to: '/zone-structures', label: 'Estrutura de zonas' },
  { to: '/art-studio', label: 'Estúdio de Artes' },
  { to: '/cartazista', label: 'Cartazes' },
  { to: '/videos', label: 'Vídeos' },
  { to: '/radio-indoor', label: 'Rádio Indoor' }
]
</script>

<template>
  <details class="workspace-menu" :class="{ 'workspace-menu--light': theme === 'light' }">
    <summary title="Abrir menu do JobVarejo" aria-label="Abrir menu do JobVarejo">
      <Menu :size="16" aria-hidden="true" />
    </summary>
    <nav aria-label="Áreas do JobVarejo" class="workspace-menu__panel">
      <p>JobVarejo</p>
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
      <NuxtLink v-if="auth.isSuperAdmin.value" to="/admin/builder">Configurações do builder</NuxtLink>
    </nav>
  </details>
</template>

<style scoped>
.workspace-menu { position:relative; flex:0 0 auto; z-index:200; }
.workspace-menu summary { display:grid; width:27px; height:27px; place-items:center; border-radius:7px; color:#d5e8ff; cursor:pointer; list-style:none; }
.workspace-menu summary::-webkit-details-marker { display:none; }
.workspace-menu summary:hover,.workspace-menu[open] summary { background:rgba(255,255,255,.16); color:#fff; }
.workspace-menu--light summary { color:#2160b4; }
.workspace-menu--light summary:hover,.workspace-menu--light[open] summary { background:#eaf3ff; color:#173d70; }
.workspace-menu__panel { position:absolute; top:calc(100% + 8px); left:0; display:grid; gap:2px; width:min(250px,calc(100vw - 32px)); padding:10px; border:1px solid #d7e4f1; border-radius:14px; background:#fff; box-shadow:0 18px 48px rgba(23,61,112,.22); }
.workspace-menu__panel p { margin:2px 8px 6px; color:#60758f; font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
.workspace-menu__panel a { padding:9px 10px; border-radius:9px; color:#173d70; font-size:12px; font-weight:650; text-decoration:none; }
.workspace-menu__panel a:hover,.workspace-menu__panel a.router-link-active { background:#eaf3ff; color:#2160b4; }
</style>
