<script setup lang="ts">
import { FileText, LogOut, User, LayoutGrid, Package } from 'lucide-vue-next'

const auth = useBuilderAuth()
const route = useRoute()

const navItems = [
  { to: '/builder', label: 'Encartes', icon: LayoutGrid, exact: true },
  { to: '/builder/products', label: 'Produtos', icon: Package },
  { to: '/builder/profile', label: 'Minha Empresa', icon: User },
]

const isActive = (item: typeof navItems[0]) => {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-white">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 border-b border-white/5 bg-[#0f0f0f]/90 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/builder" class="inline-flex items-center gap-3 group">
          <div class="w-8 h-8 bg-emerald-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">
            <FileText class="w-4 h-4 text-emerald-400" />
          </div>
          <span class="text-sm font-bold text-white hidden sm:block">Criador de Encartes</span>
        </NuxtLink>

        <!-- Nav Items -->
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="isActive(item) ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'"
          >
            <component :is="item.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <!-- User / Logout -->
        <div class="flex items-center gap-3">
          <span class="text-xs text-zinc-500 hidden md:block truncate max-w-[160px]">
            {{ auth.tenant.value?.name }}
          </span>
          <button
            @click="auth.signOut()"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut class="w-4 h-4" />
            <span class="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Page Content -->
    <main>
      <slot />
    </main>
  </div>
</template>
