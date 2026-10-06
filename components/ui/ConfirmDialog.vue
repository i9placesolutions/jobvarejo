<script setup lang="ts">
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  variant: 'danger'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30"
        @click.self="handleCancel"
      >
        <transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="show"
            class="w-full min-w-0 max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white border border-slate-200 rounded-xl p-4 sm:p-5 relative shadow-xl"
          >
            <!-- Close button -->
            <button
              @click="handleCancel"
              type="button"
              aria-label="Fechar confirmação"
              class="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X class="w-3.5 h-3.5 text-slate-400" />
            </button>

            <!-- Title -->
            <h3 class="wrap-anywhere text-sm font-semibold text-slate-800 mb-2 pr-8">{{ title }}</h3>

            <!-- Message -->
            <p class="wrap-anywhere text-xs text-slate-500 mb-5">{{ message }}</p>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2">
              <button
                @click="handleCancel"
                class="min-w-0 flex-1 min-h-10 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-colors font-medium"
              >
                {{ cancelText }}
              </button>
              <button
                @click="handleConfirm"
                :class="[
                  'min-w-0 flex-1 min-h-10 px-3 py-2 rounded text-xs transition-colors font-medium',
                  variant === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' :
                  variant === 'warning' ? 'bg-yellow-600 hover:bg-yellow-500 text-white' :
                  'bg-violet-600 hover:bg-violet-500 text-white'
                ]"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
/* Editor-style modal - no glass effect */
</style>
