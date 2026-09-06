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
  <div class="min-h-screen bg-white text-gray-900">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-2 sm:px-4 min-h-14 flex items-center justify-between gap-1">
        <!-- Logo -->
        <NuxtLink to="/builder" class="inline-flex items-center gap-3 group">
          <div class="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
            <FileText class="w-4 h-4 text-emerald-600" />
          </div>
          <span class="text-sm font-bold text-gray-900 hidden sm:block">Criador de Encartes</span>
        </NuxtLink>

        <!-- Nav Items -->
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex flex-col sm:flex-row items-center gap-1 px-2 py-2 min-h-11 rounded-lg text-[10px] sm:text-sm transition-colors"
            :class="isActive(item) ? 'bg-emerald-50 text-emerald-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'"
          >
            <component :is="item.icon" class="w-4 h-4" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <!-- User / Logout -->
        <div class="flex items-center gap-3">
          <span class="text-xs text-gray-500 hidden md:block truncate max-w-[160px]">
            {{ auth.tenant.value?.name }}
          </span>
          <button
            aria-label="Sair da conta"
            @click="auth.signOut()"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
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
