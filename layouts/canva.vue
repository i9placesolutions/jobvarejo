<script setup lang="ts">
import { Palette, LogOut, User, LayoutGrid, Package, Image } from 'lucide-vue-next'

const auth = useBuilderAuth()
const route = useRoute()

const navItems = [
  { to: '/canva', label: 'Templates', icon: LayoutGrid, exact: true },
  { to: '/canva/meus-designs', label: 'Meus Designs', icon: Image },
  { to: '/canva/products', label: 'Produtos', icon: Package },
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
        <NuxtLink to="/canva" class="inline-flex items-center gap-3 group">
          <div class="w-8 h-8 bg-violet-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-violet-500/30 group-hover:bg-violet-500/30 transition-colors">
            <Palette class="w-4 h-4 text-violet-400" />
          </div>
          <span class="text-sm font-bold text-white hidden sm:block">Canva Templates</span>
        </NuxtLink>

        <!-- Nav Items -->
        <nav class="flex items-center gap-1">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="isActive(item) ? 'bg-violet-500/15 text-violet-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'"
          >
            <component :is="item.icon" class="w-4 h-4" />
            <span class="hidden sm:inline">{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <!-- User / Logout -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/builder"
            class="text-xs text-emerald-400 hover:text-emerald-300 hidden md:block"
          >
            Ir para Builder
          </NuxtLink>
          <ClientOnly>
            <span class="text-xs text-zinc-500 hidden md:block truncate max-w-[160px]">
              {{ auth.tenant.value?.name }}
            </span>
          </ClientOnly>
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
