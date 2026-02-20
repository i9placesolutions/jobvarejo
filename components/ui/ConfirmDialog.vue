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
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70"
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
            class="w-full max-w-sm bg-[#1e1e1e] border border-white/10 p-5 relative"
          >
            <!-- Close button -->
            <button
              @click="handleCancel"
              class="absolute top-4 right-4 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X class="w-3.5 h-3.5 text-zinc-500" />
            </button>

            <!-- Title -->
            <h3 class="text-sm font-semibold text-white mb-2 pr-8">{{ title }}</h3>

            <!-- Message -->
            <p class="text-[11px] text-zinc-400 mb-5">{{ message }}</p>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                @click="handleCancel"
                class="flex-1 h-8 bg-[#2c2c2c] hover:bg-[#3c3c3c] text-white rounded text-[11px] transition-colors font-medium"
              >
                {{ cancelText }}
              </button>
              <button
                @click="handleConfirm"
                :class="[
                  'flex-1 h-8 rounded text-[11px] transition-colors font-medium',
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
