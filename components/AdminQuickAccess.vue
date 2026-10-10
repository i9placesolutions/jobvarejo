<script setup lang="ts">
import { ArrowUpRight, HardDrive, LayoutTemplate, MessageCircle, Mic2, Users } from 'lucide-vue-next'

const auth = useAuth()
const shortcuts = computed(() => [
  { to: '/admin/users', title: 'Usuários e acessos', description: 'Contas e permissões', icon: Users, visible: auth.isAdmin.value },
  { to: '/admin/whatsapp', title: 'WhatsApp', description: 'Conversas e atendimento', icon: MessageCircle, visible: auth.isAdmin.value },
  { to: '/admin/voices', title: 'Banco de vozes', description: 'Locuções com ElevenLabs', icon: Mic2, visible: auth.isSuperAdmin.value },
  { to: '/admin/builder', title: 'Modelos e configurações', description: 'Temas, grades e empresas', icon: LayoutTemplate, visible: auth.isSuperAdmin.value },
  { to: '/admin/storage', title: 'Arquivos', description: 'Organização do armazenamento', icon: HardDrive, visible: auth.isSuperAdmin.value }
].filter(item => item.visible))
</script>

<template>
  <section class="admin-shortcuts" aria-labelledby="admin-shortcuts-title">
    <div class="admin-shortcuts__heading">
      <h2 id="admin-shortcuts-title">Administração</h2>
      <p>Acesso direto às ferramentas da operação</p>
    </div>
    <nav class="admin-shortcuts__grid" aria-label="Atalhos administrativos">
      <NuxtLink v-for="item in shortcuts" :key="item.to" :to="item.to" prefetch-on="interaction" class="admin-shortcuts__item">
        <component :is="item.icon" :size="19" class="admin-shortcuts__icon" />
        <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
        <ArrowUpRight :size="15" class="admin-shortcuts__arrow" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </section>
</template>

<style scoped>
.admin-shortcuts { margin: 4px 28px 12px; flex-shrink: 0; }
.admin-shortcuts__heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; margin-bottom: 12px; }
.admin-shortcuts__heading h2 { font-size: 14px; font-weight: 750; color: var(--jv-navy); }
.admin-shortcuts__heading p { font-size: 12px; color: var(--jv-muted); }
.admin-shortcuts__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.admin-shortcuts__item { display: flex; align-items: center; gap: 10px; min-height: 76px; padding: 14px; border: 1px solid var(--jv-line); border-radius: 12px; background: white; text-decoration: none; transition: border-color .15s, background-color .15s; }
.admin-shortcuts__item:hover { background: var(--jv-sky); border-color: #8fb8e6; }
.admin-shortcuts__item:focus-visible { outline: 2px solid var(--jv-blue); outline-offset: 3px; }
.admin-shortcuts__item span { min-width: 0; }
.admin-shortcuts__item strong { display: block; font-size: 12px; color: var(--jv-navy); }
.admin-shortcuts__item small { display: block; margin-top: 4px; font-size: 11px; line-height: 1.5; color: var(--jv-muted); }
.admin-shortcuts__icon { color: var(--jv-blue); flex-shrink: 0; }
.admin-shortcuts__arrow { margin-left: auto; flex-shrink: 0; color: var(--jv-muted); }
@media (max-width: 1023px) { .admin-shortcuts { margin: 4px 16px 12px; } }
@media (max-width: 479px) { .admin-shortcuts__grid { grid-template-columns: 1fr; } .admin-shortcuts__item { min-height: 64px; padding: 10px 12px; } }
</style>
