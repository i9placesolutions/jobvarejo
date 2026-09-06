<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { cn } from '../../lib/utils'

interface Props {
  modelValue: boolean
  title?: string
  width?: string
  fullscreen?: boolean
  sidePanel?: boolean
  contentClass?: string
  headerClass?: string
  titleClass?: string
  closeClass?: string
  beforeClose?: () => boolean | Promise<boolean>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '',
  width: '440px',
  fullscreen: false,
  sidePanel: false,
  contentClass: '',
  headerClass: '',
  titleClass: '',
  closeClass: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const close = async () => {
  if (props.beforeClose) {
    try {
      const allowed = await props.beforeClose()
      if (allowed === false) return
    } catch {
      // A close guard failure must not discard the dialog contents.
      return
    }
  }
  emit('update:modelValue', false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-9999 flex"
        :class="sidePanel ? 'items-stretch justify-start p-0 bg-black/20' : 'items-center justify-center bg-black/80 backdrop-blur-sm ' + (fullscreen ? 'p-0' : 'p-4')"
        @click.self="close"
      >
        <div
          class="bg-zinc-900 border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative z-10000 pointer-events-auto"
          :class="sidePanel ? 'rounded-none h-screen max-h-none border-y-0 border-l-0 border-r-white/15' : (fullscreen ? 'rounded-none w-screen h-screen' : 'rounded-2xl')"
          :style="sidePanel ? { width: width, maxWidth: '100%' } : (fullscreen ? {} : { width: width, maxWidth: '100%', maxHeight: 'calc(100vh - 2rem)' })"
        >
          <!-- Header -->
          <div :class="['flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/50', headerClass]">
            <h3 :class="['text-sm font-bold text-white uppercase tracking-widest', titleClass]">{{ title }}</h3>
            <button type="button" @click="close" :class="['p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors', closeClass]">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Content -->
          <div class="text-zinc-300" :class="sidePanel ? 'flex-1 min-h-0 overflow-y-auto p-4' : (fullscreen ? 'flex-1 overflow-hidden flex items-center justify-center p-4' : 'flex-1 overflow-y-auto p-6')">
            <div :class="contentClass">
              <slot />
            </div>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-4 border-t border-white/5 bg-zinc-900/50 flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.animate-in {
  animation-fill-mode: forwards;
}
</style>
