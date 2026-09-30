<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { Loader2, ImageOff, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{ src: string; label: string; recommended?: boolean; sourceLabel?: string }>()
const emit = defineEmits<{ select: [] }>()
const status = ref<'loading' | 'ready' | 'error'>('loading')
const attempt = ref(0)
let timeout: ReturnType<typeof setTimeout> | undefined
const clearTimeoutHandle = () => { if (timeout) clearTimeout(timeout); timeout = undefined }
const failed = () => { clearTimeoutHandle(); status.value = 'error' }
const start = () => {
    clearTimeoutHandle()
    status.value = props.src ? 'loading' : 'error'
    attempt.value += 1
    if (props.src) timeout = setTimeout(failed, 30_000)
}
watch(() => props.src, start, { immediate: true })
onBeforeUnmount(clearTimeoutHandle)
const loaded = (event: Event) => {
    const image = event.target as HTMLImageElement
    // O proxy pode devolver um pixel transparente para um arquivo ausente.
    if (image.naturalWidth <= 1 || image.naturalHeight <= 1) { failed(); return }
    clearTimeoutHandle()
    status.value = 'ready'
}
const activate = () => {
    if (status.value === 'error') start()
    else if (status.value === 'ready') emit('select')
}
</script>

<template>
    <button type="button" :title="label" :aria-busy="status === 'loading'" :aria-disabled="status === 'loading'" @click="activate">
        <div class="relative aspect-4/3 bg-zinc-900/60">
            <img
                v-if="src" :key="attempt" :src="src" :alt="label"
                class="h-full w-full object-contain p-2" :class="status === 'ready' ? '' : 'opacity-0'"
                loading="eager" decoding="async" @load="loaded" @error="failed"
            />
            <div v-if="status === 'loading'" role="status" class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-[10px] text-zinc-400">
                <Loader2 class="h-4 w-4 animate-spin" />
                <span>Carregando imagem…</span>
            </div>
            <div v-else-if="status === 'error'" class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-[10px] text-zinc-400">
                <ImageOff class="h-5 w-5" />
                <span>Não foi possível carregar</span>
                <span class="inline-flex items-center gap-1 text-emerald-300"><RefreshCw class="h-3 w-3" /> Tentar novamente</span>
            </div>
            <div v-else-if="recommended" class="absolute left-1.5 top-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">Recomendada</div>
            <div v-if="status === 'ready' && sourceLabel" class="absolute right-1.5 top-1.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">{{ sourceLabel }}</div>
        </div>
    </button>
</template>
