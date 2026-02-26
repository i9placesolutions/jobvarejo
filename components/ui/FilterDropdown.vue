<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

type FilterDropdownOption = {
  value: string
  label: string
  description?: string
  group?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  label: string
  options: FilterDropdownOption[]
  minWidthClass?: string
}>(), {
  minWidthClass: 'min-w-[190px]'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const selectedOption = computed(() => {
  const selected = props.options.find((option) => option.value === props.modelValue)
  return selected || props.options[0] || null
})

const groupedOptions = computed(() => {
  const groups: Array<{ name: string; options: FilterDropdownOption[] }> = []

  for (const option of props.options) {
    const groupName = String(option.group || '').trim()
    const group = groups.find((entry) => entry.name === groupName)
    if (group) {
      group.options.push(option)
      continue
    }
    groups.push({ name: groupName, options: [option] })
  }

  return groups
})

const close = () => {
  isOpen.value = false
}

const toggle = () => {
  isOpen.value = !isOpen.value
}

const selectOption = (value: string) => {
  emit('update:modelValue', value)
  close()
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!rootRef.value || !target) return
  if (!rootRef.value.contains(target)) {
    close()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div ref="rootRef" :class="['relative', minWidthClass]">
    <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{{ label }}</p>

    <button
      type="button"
      class="h-9 w-full px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white inline-flex items-center justify-between gap-2 transition-all focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="truncate">{{ selectedOption?.label || 'Selecionar' }}</span>
      <ChevronDown class="w-3.5 h-3.5 text-zinc-400 transition-transform" :class="isOpen ? 'rotate-180 text-zinc-200' : ''" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 z-40 mt-2 w-full min-w-[280px] rounded-xl border border-white/12 bg-[#11121a] shadow-[0_22px_55px_-30px_rgba(0,0,0,0.95)]"
      role="listbox"
      :aria-label="label"
    >
      <div class="px-3 py-2 border-b border-white/8">
        <p class="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{{ label }}</p>
        <p class="text-[11px] text-zinc-400 truncate">{{ selectedOption?.description || 'Escolha uma opção de filtro.' }}</p>
      </div>

      <div class="max-h-72 overflow-y-auto p-1">
        <template
          v-for="(group, groupIndex) in groupedOptions"
          :key="`${label}-${group.name || 'geral'}-${groupIndex}`"
        >
          <p v-if="group.name" class="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {{ group.name }}
          </p>

          <button
            v-for="option in group.options"
            :key="`${label}-${option.value}`"
            type="button"
            class="w-full px-2.5 py-2 rounded-lg border border-transparent text-left transition-all flex items-start gap-2.5"
            :class="option.value === modelValue ? 'bg-violet-500/12 border-violet-400/35 text-white' : 'hover:bg-white/6 text-zinc-200'"
            @click="selectOption(option.value)"
          >
            <span class="flex-1 min-w-0">
              <span class="block text-xs font-medium truncate">{{ option.label }}</span>
              <span v-if="option.description" class="block text-[11px] leading-snug text-zinc-500">
                {{ option.description }}
              </span>
            </span>
            <Check v-if="option.value === modelValue" class="w-3.5 h-3.5 mt-0.5 text-violet-300 shrink-0" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
