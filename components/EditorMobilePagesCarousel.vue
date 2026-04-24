<script setup lang="ts">
/**
 * Carousel de páginas (frames) estilo Canva para mobile.
 * Exibe as páginas lado a lado com scroll-snap horizontal.
 * - Swipe/scroll horizontal para navegar entre páginas
 * - Tap centraliza a página e ativa
 * - Long-press abre menu com Duplicar/Deletar
 * - Botão "+" adiciona nova página
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Plus, Copy, Trash2, FileText } from 'lucide-vue-next'

type Page = {
  id: string
  name?: string
  width?: number
  height?: number
  thumbnail?: string
  thumbnailUrl?: string
}

const props = defineProps<{
  pages: Page[]
  activePageId: string
}>()

const emit = defineEmits<{
  'select-page': [pageId: string]
  'add-page': []
  'duplicate-page': [pageId: string]
  'delete-page': [pageId: string]
}>()

const stripEl = ref<HTMLElement | null>(null)
const menuOpenForId = ref<string | null>(null)
const pageThumbErrors = ref<Record<string, boolean>>({})

const isUsableThumb = (url: unknown): boolean => {
  if (typeof url !== 'string') return false
  const v = url.trim().toLowerCase()
  if (!v) return false
  if (v === 'data:,' || v === 'about:blank') return false
  if (v.startsWith('blob:null') || v.startsWith('javascript:')) return false
  return true
}

const thumbSrc = (page: Page) => {
  if (pageThumbErrors.value[page.id]) return ''
  const inline = typeof page?.thumbnail === 'string' ? page.thumbnail.trim() : ''
  const stored = typeof page?.thumbnailUrl === 'string' ? page.thumbnailUrl.trim() : ''
  const src = inline || stored
  return isUsableThumb(src) ? src : ''
}

const onThumbError = (page: Page) => {
  pageThumbErrors.value[page.id] = true
}

const getInitials = (page: Page): string => {
  const name = String(page?.name || '').trim()
  if (!name) return 'P'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return words.map(w => (w[0] || '').toUpperCase()).join('') || 'P'
}

const thumbStyle = (page: Page) => {
  const w = Number(page.width) || 1080
  const h = Number(page.height) || 1080
  const ratio = Math.min(1.6, Math.max(0.55, h / w))
  const HEIGHT = 64
  const width = Math.round(HEIGHT / ratio)
  return {
    width: `${width}px`,
    height: `${HEIGHT}px`
  }
}

// ─── Long press para menu ────────────────────────────────────────────
let pressTimer: ReturnType<typeof setTimeout> | null = null
let pressMoved = false
let pressStartX = 0
let pressStartY = 0

const onPressStart = (e: TouchEvent | MouseEvent, pageId: string) => {
  pressMoved = false
  const t = 'touches' in e ? e.touches[0] : e
  pressStartX = t?.clientX ?? 0
  pressStartY = t?.clientY ?? 0
  if (pressTimer) clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    if (!pressMoved) {
      menuOpenForId.value = pageId
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as any).vibrate?.(10) } catch {}
      }
    }
  }, 450)
}

const onPressMove = (e: TouchEvent | MouseEvent) => {
  const t = 'touches' in e ? e.touches[0] : e
  const dx = Math.abs((t?.clientX ?? 0) - pressStartX)
  const dy = Math.abs((t?.clientY ?? 0) - pressStartY)
  if (dx > 8 || dy > 8) {
    pressMoved = true
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
  }
}

const onPressEnd = () => {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = null }
}

const closeMenu = () => { menuOpenForId.value = null }

// ─── Scroll para centralizar página ativa ────────────────────────────
const scrollToActive = (smooth = true) => {
  const host = stripEl.value
  if (!host) return
  const activeEl = host.querySelector<HTMLElement>(`[data-page-id="${props.activePageId}"]`)
  if (!activeEl) return
  const hostRect = host.getBoundingClientRect()
  const elRect = activeEl.getBoundingClientRect()
  const currentScroll = host.scrollLeft
  const delta = (elRect.left - hostRect.left) - (hostRect.width / 2 - elRect.width / 2)
  host.scrollTo({ left: currentScroll + delta, behavior: smooth ? 'smooth' : 'auto' })
}

watch(() => props.activePageId, async () => {
  await nextTick()
  scrollToActive(true)
})

watch(() => props.pages.length, async () => {
  await nextTick()
  scrollToActive(false)
})

onMounted(async () => {
  await nextTick()
  scrollToActive(false)
})

// ─── Detecta scroll para swipe entre páginas (sem clique) ────────────
// Quando o usuário para de scrollar, ativa a página mais próxima do centro.
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null
let isUserScrolling = false

const onScroll = () => {
  isUserScrolling = true
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    isUserScrolling = false
    snapToNearestPage()
  }, 120)
}

const snapToNearestPage = () => {
  const host = stripEl.value
  if (!host) return
  const hostCenter = host.getBoundingClientRect().left + host.clientWidth / 2
  let bestId: string | null = null
  let bestDist = Infinity
  const items = host.querySelectorAll<HTMLElement>('[data-page-id]')
  items.forEach(el => {
    const r = el.getBoundingClientRect()
    const c = r.left + r.width / 2
    const d = Math.abs(c - hostCenter)
    if (d < bestDist) {
      bestDist = d
      bestId = el.dataset.pageId || null
    }
  })
  if (bestId && bestId !== props.activePageId) {
    emit('select-page', bestId)
  }
}

const activeIndex = computed(() => {
  return props.pages.findIndex(p => p.id === props.activePageId)
})

const onTap = (pageId: string) => {
  if (menuOpenForId.value) { closeMenu(); return }
  if (pageId !== props.activePageId) emit('select-page', pageId)
}
</script>

<template>
  <div
    v-if="pages && pages.length > 0"
    class="fixed left-0 right-0 z-[9989] bg-[#18181b]/95 backdrop-blur-md border-t border-white/10"
    style="bottom: 56px;"
  >
    <!-- Contador de páginas (tipo Canva: "3 / 8") -->
    <div class="flex items-center justify-between px-3 pt-1.5 pb-0.5">
      <span class="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
        Página {{ activeIndex + 1 }} / {{ pages.length }}
      </span>
      <span class="text-[10px] text-white/30 truncate max-w-[60%]">
        {{ pages[activeIndex]?.name || '' }}
      </span>
    </div>

    <!-- Strip horizontal com scroll-snap -->
    <div
      ref="stripEl"
      class="flex items-center gap-2 px-[50%] py-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      style="scroll-behavior: smooth; -webkit-overflow-scrolling: touch;"
      @scroll.passive="onScroll"
      @click="closeMenu"
    >
      <div
        v-for="page in pages"
        :key="page.id"
        :data-page-id="page.id"
        class="relative shrink-0 snap-center"
        @touchstart.passive="onPressStart($event, page.id)"
        @touchmove.passive="onPressMove"
        @touchend="onPressEnd"
        @touchcancel="onPressEnd"
        @mousedown="onPressStart($event, page.id)"
        @mousemove="onPressMove"
        @mouseup="onPressEnd"
        @mouseleave="onPressEnd"
      >
        <button
          type="button"
          class="relative block rounded-md overflow-hidden bg-white transition-all duration-200"
          :class="page.id === activePageId
            ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-[#18181b] shadow-lg'
            : 'ring-1 ring-white/15 opacity-70 active:opacity-100'"
          :style="thumbStyle(page)"
          @click.stop="onTap(page.id)"
        >
          <img
            v-if="thumbSrc(page)"
            :src="thumbSrc(page)"
            class="w-full h-full object-contain"
            loading="lazy"
            decoding="async"
            @error="onThumbError(page)"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-zinc-800">
            <FileText class="w-3.5 h-3.5 text-zinc-500" />
            <span class="text-[8px] font-bold text-zinc-400 tracking-wide">{{ getInitials(page) }}</span>
          </div>

          <!-- Badge de número -->
          <div class="absolute bottom-0.5 left-0.5 bg-black/70 text-white text-[8px] px-1 py-px rounded font-bold leading-none">
            {{ pages.indexOf(page) + 1 }}
          </div>
        </button>

        <!-- Menu (long-press) -->
        <Transition name="menu-pop">
          <div
            v-if="menuOpenForId === page.id"
            class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#27272a] border border-white/10 shadow-2xl z-10"
            @click.stop
          >
            <button
              class="touch-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/80 hover:bg-white/10 active:bg-white/20"
              @click="emit('duplicate-page', page.id); closeMenu()"
            >
              <Copy class="w-3.5 h-3.5" />
              <span class="text-[11px] font-medium">Duplicar</span>
            </button>
            <div class="w-px h-4 bg-white/10"></div>
            <button
              v-if="pages.length > 1"
              class="touch-target flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 active:bg-red-500/20"
              @click="emit('delete-page', page.id); closeMenu()"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span class="text-[11px] font-medium">Deletar</span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Botão adicionar página -->
      <button
        type="button"
        class="shrink-0 snap-center flex flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-white/20 bg-white/5 text-white/50 active:text-white active:bg-white/10 transition-colors"
        style="width: 48px; height: 64px;"
        :title="'Adicionar página'"
        @click="emit('add-page')"
      >
        <Plus class="w-4 h-4" />
        <span class="text-[8px] font-bold uppercase tracking-wider">Nova</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Centralização do primeiro e último item via padding */
.snap-x {
  scroll-padding-inline: 50%;
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transition: all 0.15s cubic-bezier(0.32, 0.72, 0, 1);
}
.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.92);
}
</style>
