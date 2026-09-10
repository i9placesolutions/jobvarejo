<script setup lang="ts">
import { computed } from 'vue'
import { QUICK_LOGO_BACKDROP_OPTIONS, normalizeQuickLogoBackdropMode } from '~/utils/quickLogoBackdrop'

const props = defineProps<{ logo: Record<string, any> }>()
const emit = defineEmits<{
    (event: 'update-property', property: string, value: any): void
    (event: 'close'): void
}>()
const backdropMode = computed(() => normalizeQuickLogoBackdropMode(props.logo.quickLogoBackdropMode))
const stickerEnabled = computed(() => props.logo.__stickerOutlineEnabled === true)
const stickerWidth = computed(() => Number(props.logo.__stickerOutlineWidth) || 4)
const stickerColor = computed(() => /^#[\da-f]{6}$/i.test(props.logo.__stickerOutlineColor || '') ? props.logo.__stickerOutlineColor : '#ffffff')
</script>

<template>
    <section class="quick-logo-actions" aria-label="Opções da logo" @pointerdown.stop @click.stop @keydown.stop>
        <header>
            <div><strong>Logo da loja</strong><p>Personalize o fundo e o contorno da sua logo.</p></div>
            <button type="button" class="close" aria-label="Fechar opções da logo" @click="emit('close')">×</button>
        </header>
        <fieldset>
            <legend>Fundo / container</legend>
            <div class="backdrop-options">
                <button v-for="option in QUICK_LOGO_BACKDROP_OPTIONS" :key="option.id" type="button"
                    :aria-pressed="backdropMode === option.id"
                    @click="emit('update-property', 'quickLogoBackdropMode', option.id)">
                    <span class="shape" :class="option.id" aria-hidden="true"></span>{{ option.label }}
                </button>
            </div>
        </fieldset>
        <div class="sticker-toggle">
            <span>Contorno</span>
            <button type="button" role="switch" :aria-checked="stickerEnabled" aria-label="Contorno"
                @click="emit('update-property', 'stickerOutlineEnabled', !stickerEnabled)">{{ stickerEnabled ? 'Ativado' : 'Desativado' }}</button>
        </div>
        <div v-if="stickerEnabled" class="sticker-options">
            <label>Cor<input type="color" :value="stickerColor" @input="emit('update-property', 'stickerOutlineColor', ($event.target as HTMLInputElement).value)" /></label>
            <label>Espessura (px)<input type="number" min="1" max="40" :value="stickerWidth"
                @change="emit('update-property', 'stickerOutlineWidth', Math.min(40, Math.max(1, Number(($event.target as HTMLInputElement).value) || 4)))" /></label>
        </div>
    </section>
</template>

<style scoped>
.quick-logo-actions { position:relative; width:300px; min-height:0; max-height:100%; overflow:auto; padding:12px; border:1px solid #7951b4; border-radius:16px; background:#19191f; color:#f4f4f5; box-shadow:none; font-size:13px; }
header { display:flex; align-items:flex-start; gap:8px; justify-content:space-between; }
strong { font-size:15px; }
p { margin:5px 0 16px; font-size:12px; line-height:1.4; color:#b4b4c0; }
button, input { font:inherit; }
button { cursor:pointer; min-height:44px; border:1px solid #45414f; border-radius:9px; background:#27252e; color:inherit; }
button:hover { border-color:#b49ae2; }
button:focus-visible, input:focus-visible { outline:2px solid #c4b5fd; outline-offset:2px; }
.close { min-width:44px; flex-shrink:0; font-size:24px; background:transparent; border:0; }
fieldset { border:0; padding:0; margin:0; min-width:0; }
legend { margin-bottom:10px; font-weight:600; }
.backdrop-options { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
.backdrop-options button { display:flex; flex-direction:column; align-items:center; gap:8px; padding:10px 3px; font-size:11px; }
button[aria-pressed=true], button[aria-checked=true] { background:#49306b; border-color:#b795ed; color:#f3e8ff; }
.shape { display:block; width:26px; height:20px; background:#fff; border:1px solid #ddd; }
.shape.none { background:transparent; border-style:dashed; }
.shape.round { width:20px; border-radius:50%; }
.shape.oval { border-radius:50%; }
.sticker-toggle { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; padding-top:12px; border-top:1px solid #39343f; }
.sticker-toggle button { padding:0 12px; }
.sticker-options { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
label { display:flex; flex-direction:column; gap:6px; color:#d4d4dc; font-size:12px; }
input { width:100%; min-height:44px; border:1px solid #55505f; border-radius:8px; padding:6px; background:#27252e; color:#fff; }
@media (max-width: 767px) {
    .quick-logo-actions { padding:8px 12px; }
    p { display:none; }
    header { align-items:center; }
    .backdrop-options button { flex-direction:row; justify-content:center; padding:5px 3px; gap:4px; }
    .sticker-toggle { margin-top:6px; padding-top:6px; }
    .sticker-options { margin-top:6px; }
}
</style>
