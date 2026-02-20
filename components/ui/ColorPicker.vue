<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { X, Pipette } from 'lucide-vue-next'

interface Props {
  modelValue: string
  show: boolean
  triggerElement?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), {
  triggerElement: null
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:show': [value: boolean]
}>()

const internalShow = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

// Color state
const hue = ref(0) // 0-360
const saturation = ref(0) // 0-100
const lightness = ref(0) // 0-100
const alpha = ref(100) // 0-100
const colorFormat = ref<'hex' | 'rgb' | 'hsl'>('hex')
const colorScope = ref<'page' | 'document'>('page')
const saveToDocument = ref(false)
const savedColors = ref<string[]>([])

// UI state
const isDraggingColor = ref(false)
const isDraggingHue = ref(false)
const isDraggingAlpha = ref(false)
const isEyedropperActive = ref(false)
const colorAreaRef = ref<HTMLElement | null>(null)
const hueSliderRef = ref<HTMLElement | null>(null)
const alphaSliderRef = ref<HTMLElement | null>(null)

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const rgbToHsl = (r0: number, g0: number, b0: number) => {
  const r = clamp(r0, 0, 255) / 255
  const g = clamp(g0, 0, 255) / 255
  const b = clamp(b0, 0, 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

const parseColorToHslA = (raw: string): { h: number; s: number; l: number; a: number } | null => {
  const v0 = String(raw || '').trim()
  if (!v0) return null
  const v = v0.toLowerCase()

  if (v === 'transparent') {
    // Return default black with full opacity instead of invisible
    return { h: 0, s: 0, l: 0, a: 1 }
  }

  // rgba()/rgb()
  if (v.startsWith('rgb')) {
    const m = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/)
    if (!m) return null
    const r = Number(m[1])
    const g = Number(m[2])
    const b = Number(m[3])
    const a = m[4] != null ? Number(m[4]) : 1
    if (![r, g, b, a].every(n => Number.isFinite(n))) return null
    const hsl = rgbToHsl(r, g, b)
    return { ...hsl, a: clamp(a, 0, 1) }
  }

  // hex (#RGB / #RRGGBB)
  const hex = v.startsWith('#') ? v.slice(1) : v
  const isHex = /^[0-9a-f]{3}$/.test(hex) || /^[0-9a-f]{6}$/.test(hex)
  if (!isHex) return null

  const full = hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if (![r, g, b].every(n => Number.isFinite(n))) return null
  const hsl = rgbToHsl(r, g, b)
  return { ...hsl, a: 1 }
}

// Convert HSL to hex
const hslToHex = (h: number, s: number, l: number) => {
  h = h / 360
  s = s / 100
  l = l / 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const hexToHsl = (hex: string) => {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return rgbToHsl(r, g, b)
}

// Current color in hex
const currentHex = computed(() => {
  return hslToHex(hue.value, saturation.value, lightness.value)
})

// Current color with alpha
const currentColor = computed(() => {
  if (alpha.value === 100) return currentHex.value
  const hex = currentHex.value.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha.value / 100})`
})

// Update HSL from hex value
watch(() => props.modelValue, (newValue) => {
  const parsed = parseColorToHslA(String(newValue || ''))
  if (!parsed) return
  hue.value = parsed.h
  saturation.value = parsed.s
  lightness.value = parsed.l
  // If alpha is 0 (transparent), default to 100 (opaque) for stroke colors
  // This prevents the "invisible color" problem
  const parsedAlpha = Math.round(clamp(parsed.a, 0, 1) * 100)
  alpha.value = parsedAlpha === 0 ? 100 : parsedAlpha
}, { immediate: true })

// Emit color changes
watch([hue, saturation, lightness, alpha], () => {
  // Avoid mutating parent state when the picker is closed (prevents accidental changes on selection).
  if (!props.show) return
  emit('update:modelValue', currentColor.value)
})

// Color area gradient
const colorAreaGradient = computed(() => {
  const hueColor = `hsl(${hue.value}, 100%, 50%)`
  return `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`
})

// Hue slider gradient
const hueGradient = computed(() => {
  return 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
})

// Alpha slider gradient
const alphaGradient = computed(() => {
  const solidColor = currentHex.value
  return `linear-gradient(to right, transparent, ${solidColor})`
})

// Handle color area click/drag
const handleColorAreaMouseDown = (e: MouseEvent) => {
  if (!colorAreaRef.value) return
  isDraggingColor.value = true
  updateColorFromArea(e)
}

const updateColorFromArea = (e: MouseEvent) => {
  if (!colorAreaRef.value) return
  const rect = colorAreaRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  
  // Convert HSV-like area coordinates (X=Sat, Y=Value) to HSL
  // This is a simplified mapping to match the visual area
  const hsvS = x
  const hsvV = 1 - y
  
  const l = hsvV * (1 - hsvS / 2)
  const s = (l === 0 || l === 1) ? 0 : (hsvV - l) / Math.min(l, 1 - l)

  saturation.value = Math.round(s * 100)
  lightness.value = Math.round(l * 100)
}

// Handle hue slider
const handleHueMouseDown = (e: MouseEvent) => {
  if (!hueSliderRef.value) return
  isDraggingHue.value = true
  updateHueFromSlider(e)
}

const updateHueFromSlider = (e: MouseEvent) => {
  if (!hueSliderRef.value) return
  const rect = hueSliderRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  hue.value = Math.round(x * 360)
}

// Handle alpha slider
const handleAlphaMouseDown = (e: MouseEvent) => {
  if (!alphaSliderRef.value) return
  isDraggingAlpha.value = true
  updateAlphaFromSlider(e)
}

const updateAlphaFromSlider = (e: MouseEvent) => {
  if (!alphaSliderRef.value) return
  const rect = alphaSliderRef.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  alpha.value = Math.round(x * 100)
}

// Mouse move handlers
const handleMouseMove = (e: MouseEvent) => {
  if (isDraggingColor.value) {
    updateColorFromArea(e)
  } else if (isDraggingHue.value) {
    updateHueFromSlider(e)
  } else if (isDraggingAlpha.value) {
    updateAlphaFromSlider(e)
  }
}

const handleMouseUp = () => {
  isDraggingColor.value = false
  isDraggingHue.value = false
  isDraggingAlpha.value = false
}

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// Color area selector position
// Convert HSL back to HSV for selector positioning
const hsvPosition = computed(() => {
  const l = lightness.value / 100
  const s = saturation.value / 100
  const v = l + s * Math.min(l, 1 - l)
  const sv = v === 0 ? 0 : 2 * (1 - l / v)
  return { x: sv * 100, y: (1 - v) * 100 }
})

const colorSelectorX = computed(() => `${hsvPosition.value.x}%`)
const colorSelectorY = computed(() => `${hsvPosition.value.y}%`)

// Hue selector position
const hueSelectorX = computed(() => `${(hue.value / 360) * 100}%`)

// Alpha selector position
const alphaSelectorX = computed(() => `${alpha.value}%`)

// Hex input
const hexInput = ref('')
watch(() => props.modelValue, (newValue) => {
  if (newValue.startsWith('#')) {
    hexInput.value = newValue.replace('#', '').toUpperCase()
  } else if (newValue.startsWith('rgba')) {
    const match = newValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match && match[1] && match[2] && match[3]) {
      const r = parseInt(match[1], 10).toString(16).padStart(2, '0')
      const g = parseInt(match[2], 10).toString(16).padStart(2, '0')
      const b = parseInt(match[3], 10).toString(16).padStart(2, '0')
      hexInput.value = `${r}${g}${b}`.toUpperCase()
    }
  }
}, { immediate: true })

const updateHex = () => {
  const hex = hexInput.value.replace(/[^0-9A-F]/gi, '').substring(0, 6)
  if (hex.length === 6) {
    const hsl = hexToHsl('#' + hex)
    hue.value = hsl.h
    saturation.value = hsl.s
    lightness.value = hsl.l
  }
}

// Opacity input
const opacityInput = ref('100')
watch(() => alpha.value, (val) => {
  opacityInput.value = val.toString()
})

const updateOpacity = () => {
  const val = Math.max(0, Math.min(100, parseInt(opacityInput.value) || 100))
  alpha.value = val
  opacityInput.value = val.toString()
}

// RGB inputs update
const rgbValues = computed(() => {
  const hex = currentHex.value.replace('#', '')
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  }
})

const updateFromRGB = (index: number, value: number) => {
  const clamped = Math.max(0, Math.min(255, value || 0))
  const current = rgbValues.value
  let r = current.r
  let g = current.g
  let b = current.b
  
  if (index === 0) r = clamped
  else if (index === 1) g = clamped
  else if (index === 2) b = clamped
  
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  const hsl = hexToHsl(hex)
  hue.value = hsl.h
  saturation.value = hsl.s
  lightness.value = hsl.l
}

// Eyedropper functionality
const startEyedropper = () => {
  if (!('EyeDropper' in window)) {
    alert('Eyedropper API não está disponível no seu navegador')
    return
  }
  
  isEyedropperActive.value = true
  
  const eyeDropper = new (window as any).EyeDropper()
  
  eyeDropper.open()
    .then((result: any) => {
      if (result && result.sRGBHex) {
        const hex = result.sRGBHex
        const hsl = hexToHsl(hex)
        hue.value = hsl.h
        saturation.value = hsl.s
        lightness.value = hsl.l
        hexInput.value = hex.replace('#', '').toUpperCase()
      }
      isEyedropperActive.value = false
    })
    .catch((err: any) => {
      // User cancelled or error
      isEyedropperActive.value = false
    })
}

const close = () => {
  // Emit final color value before closing
  emit('update:modelValue', currentColor.value)
  internalShow.value = false
}

// Saved colors functionality
const filteredSavedColors = computed(() => {
  if (colorScope.value === 'page') {
    // Filter colors used on current page (would need access to canvas objects)
    return savedColors.value.slice(0, 12)
  }
  return savedColors.value.slice(0, 12)
})

const handleSaveToDocument = () => {
  if (saveToDocument.value) {
    const color = currentHex.value
    if (!savedColors.value.includes(color)) {
      savedColors.value.push(color)
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('colorPicker:savedColors', JSON.stringify(savedColors.value))
      }
    }
  }
}

const selectSavedColor = (color: string) => {
  const hsl = hexToHsl(color)
  hue.value = hsl.h
  saturation.value = hsl.s
  lightness.value = hsl.l
  hexInput.value = color.replace('#', '').toUpperCase()
}

// Load saved colors from localStorage
onMounted(() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('colorPicker:savedColors')
    if (stored) {
      try {
        savedColors.value = JSON.parse(stored)
      } catch (e) {
        savedColors.value = []
      }
    }
  }
})

// Position relative to trigger element
const pickerPosition = ref({ top: 0, left: 0 })

const updatePosition = () => {
  if (props.triggerElement) {
    const rect = props.triggerElement.getBoundingClientRect()
    const pickerWidth = 280
    const pickerHeight = 480
    const padding = 8
    
    // Position to the left of the trigger element (like Figma)
    let left = rect.left - pickerWidth - padding
    let top = rect.top
    
    // If would go off screen left, position to the right instead
    if (left < padding) {
      left = rect.right + padding
    }
    
    // Adjust if would go off screen right
    if (left + pickerWidth > window.innerWidth - padding) {
      left = window.innerWidth - pickerWidth - padding
    }
    
    // Adjust if would go off screen bottom
    if (top + pickerHeight > window.innerHeight - padding) {
      top = window.innerHeight - pickerHeight - padding
    }
    
    // Ensure not off screen top
    if (top < padding) {
      top = padding
    }
    
    pickerPosition.value = { top, left }
  } else {
    // Center if no trigger element
    pickerPosition.value = {
      top: window.innerHeight / 2 - 200,
      left: window.innerWidth / 2 - 140
    }
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    // Force refresh from modelValue when opening
    const parsed = parseColorToHslA(String(props.modelValue || ''))
    if (parsed) {
      hue.value = parsed.h
      saturation.value = parsed.s
      lightness.value = parsed.l
      alpha.value = Math.round(clamp(parsed.a, 0, 1) * 100)
    }
    
    nextTick(() => {
      updatePosition()
    })
  }
})
</script>

<template>
  <teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="internalShow"
        class="fixed inset-0 z-10100"
        @click.self="close"
      >
        <div
          class="fixed bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl w-70 overflow-visible z-10101"
          :style="{ top: `${pickerPosition.top}px`, left: `${pickerPosition.left}px` }"
          @click.stop
        >
          <!-- Header -->
          <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#2a2a2a] rounded-t-xl">
            <span class="text-xs font-semibold text-white">Custom</span>
            <button
              @click="close"
              class="w-6 h-6 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all"
            >
              <X class="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          <!-- Color Picker Content -->
          <div class="p-4 space-y-3 bg-[#2a2a2a] rounded-b-xl">
            <!-- Main Color Area -->
            <div
              ref="colorAreaRef"
              class="w-full h-45 rounded-lg relative cursor-crosshair overflow-hidden"
              :style="{ background: colorAreaGradient }"
              @mousedown="handleColorAreaMouseDown"
            >
              <!-- Selector -->
              <div
                class="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                :style="{ left: colorSelectorX, top: colorSelectorY }"
              >
                <div class="w-full h-full rounded-full border border-black/30"></div>
              </div>
            </div>

            <!-- Controls Row -->
            <div class="flex items-center gap-2">
              <!-- Eyedropper -->
              <button
                @click="startEyedropper"
                class="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all shrink-0"
                title="Eyedropper"
                :class="isEyedropperActive ? 'bg-violet-500/20 border border-violet-500/30' : ''"
              >
                <Pipette class="w-4 h-4" :class="isEyedropperActive ? 'text-violet-400' : 'text-zinc-400'" />
              </button>

              <!-- Hue Slider -->
              <div
                ref="hueSliderRef"
                class="flex-1 h-6 rounded-lg relative cursor-pointer overflow-hidden border border-white/10"
                :style="{ background: hueGradient }"
                @mousedown="handleHueMouseDown"
              >
                <div
                  class="absolute top-0 w-1 h-full bg-white border-l border-r border-black/30 transform -translate-x-1/2 pointer-events-none shadow-lg z-10"
                  :style="{ left: hueSelectorX }"
                ></div>
              </div>
            </div>

            <!-- Alpha Slider -->
            <div
              ref="alphaSliderRef"
              class="w-full h-6 rounded-lg relative cursor-pointer overflow-hidden border border-white/10"
              :style="{ background: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px, ${alphaGradient}` }"
              @mousedown="handleAlphaMouseDown"
            >
              <div
                class="absolute top-0 w-1 h-full bg-white border-l border-r border-black/30 transform -translate-x-1/2 pointer-events-none shadow-lg z-10"
                :style="{ left: alphaSelectorX }"
              ></div>
            </div>

            <!-- Inputs Row -->
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Format Dropdown -->
              <select
                v-model="colorFormat"
                class="h-7 px-2 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer pr-6"
              >
                <option value="hex">Hex</option>
                <option value="rgb">RGB</option>
                <option value="hsl">HSL</option>
              </select>

              <!-- Hex Input -->
              <input
                v-if="colorFormat === 'hex'"
                v-model="hexInput"
                @blur="updateHex"
                @keyup.enter="updateHex"
                type="text"
                class="flex-1 min-w-20 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 font-mono focus:outline-none focus:border-violet-500/50"
                placeholder="1E1E1E"
                maxlength="6"
              />

              <!-- RGB Inputs -->
              <template v-else-if="colorFormat === 'rgb'">
                <input
                  type="number"
                  :value="Math.round(parseInt(currentHex.substring(1, 3), 16))"
                  @input="updateFromRGB(0, Number(($event.target as HTMLInputElement).value))"
                  @blur="updateFromRGB(0, Number(($event.target as HTMLInputElement).value))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="255"
                />
                <input
                  type="number"
                  :value="Math.round(parseInt(currentHex.substring(3, 5), 16))"
                  @input="updateFromRGB(1, Number(($event.target as HTMLInputElement).value))"
                  @blur="updateFromRGB(1, Number(($event.target as HTMLInputElement).value))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="255"
                />
                <input
                  type="number"
                  :value="Math.round(parseInt(currentHex.substring(5, 7), 16))"
                  @input="updateFromRGB(2, Number(($event.target as HTMLInputElement).value))"
                  @blur="updateFromRGB(2, Number(($event.target as HTMLInputElement).value))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="255"
                />
              </template>

              <!-- HSL Inputs -->
              <template v-else>
                <input
                  type="number"
                  :value="hue"
                  @input="hue = Math.max(0, Math.min(360, Number(($event.target as HTMLInputElement).value) || 0))"
                  @blur="hue = Math.max(0, Math.min(360, Number(($event.target as HTMLInputElement).value) || 0))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="360"
                />
                <input
                  type="number"
                  :value="saturation"
                  @input="saturation = Math.max(0, Math.min(100, Number(($event.target as HTMLInputElement).value) || 0))"
                  @blur="saturation = Math.max(0, Math.min(100, Number(($event.target as HTMLInputElement).value) || 0))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="100"
                />
                <input
                  type="number"
                  :value="lightness"
                  @input="lightness = Math.max(0, Math.min(100, Number(($event.target as HTMLInputElement).value) || 0))"
                  @blur="lightness = Math.max(0, Math.min(100, Number(($event.target as HTMLInputElement).value) || 0))"
                  class="w-14 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  min="0"
                  max="100"
                />
              </template>

              <!-- Opacity Input -->
              <div class="flex items-center gap-1">
                <input
                  v-model="opacityInput"
                  @blur="updateOpacity"
                  @keyup.enter="updateOpacity"
                  type="text"
                  class="w-12 h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 text-center focus:outline-none focus:border-violet-500/50"
                  placeholder="100"
                />
                <span class="text-xs text-zinc-400 whitespace-nowrap">%</span>
              </div>
            </div>

            <!-- Saved Colors Section -->
            <div class="pt-2 border-t border-white/5 space-y-2">
              <select 
                v-model="colorScope"
                class="w-full h-7 bg-[#1a1a1a] border border-white/10 rounded text-xs text-white px-2 focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
              >
                <option value="page">On this page</option>
                <option value="document">In document</option>
              </select>
              <div class="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="save-to-doc"
                  v-model="saveToDocument"
                  @change="handleSaveToDocument"
                  class="w-3.5 h-3.5 rounded border-white/10 bg-[#1a1a1a] text-violet-500 focus:ring-violet-500 cursor-pointer" 
                />
                <label for="save-to-doc" class="text-[10px] text-zinc-400 cursor-pointer">Save to document</label>
              </div>
              
              <!-- Saved Colors Grid -->
              <div v-if="savedColors.length > 0" class="grid grid-cols-6 gap-1.5 mt-2">
                <button
                  v-for="(color, idx) in filteredSavedColors"
                  :key="idx"
                  @click="selectSavedColor(color)"
                  class="w-6 h-6 rounded border border-zinc-400 hover:border-white hover:scale-110 transition-all relative group"
                  style="box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.2);"
                  :style="{ backgroundColor: color }"
                  :title="color"
                >
                  <!-- Inner white ring for better visibility of dark colors -->
                  <div class="absolute inset-0.5 border border-white/70 rounded pointer-events-none" style="box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);"></div>
                  <!-- Selection indicator -->
                  <div v-if="color === currentHex" class="absolute -inset-0.5 border-2 border-violet-400 rounded shadow-lg shadow-violet-500/20"></div>
                  <!-- Hover glow -->
                  <div class="absolute inset-0 rounded ring-1 ring-white/40 group-hover:ring-white/60"></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
</style>
