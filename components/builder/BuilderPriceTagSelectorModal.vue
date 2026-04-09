<script setup lang="ts">
/**
 * Modal seletor de estilo de etiqueta de preco.
 * Mostra os estilos cadastrados no admin como grade visual.
 * Baseado na documentacao QROfertas secao 18.
 */
import { X } from 'lucide-vue-next'
import type { BuilderPriceTagStyle } from '~/types/builder'

const props = defineProps<{
  currentStyleId?: string | null
}>()

const emit = defineEmits<{
  select: [styleId: string, applyAll: boolean]
  close: []
}>()

const { priceTagStyles } = useBuilderFlyer()
const applyAll = ref(false)

const selectStyle = (style: BuilderPriceTagStyle) => {
  emit('select', style.id, applyAll.value)
}
</script>

<template>
  <Teleport to="body">
    <div
      :style="{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }"
      @click.self="emit('close')"
    >
      <div
        :style="{
          background: '#fff', borderRadius: '12px',
          width: '600px', maxWidth: '95vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }"
      >
        <!-- Header -->
        <div :style="{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
          <span :style="{ fontWeight: 700, fontSize: '16px', color: '#1a1f3a' }">Escolher Etiqueta de Preco</span>
          <button
            type="button"
            :style="{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <!-- Opcoes -->
        <div :style="{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }">
          <label :style="{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer' }">
            <input v-model="applyAll" type="checkbox" />
            Aplicar em todos os produtos do encarte
          </label>
        </div>

        <!-- Grade de etiquetas -->
        <div :style="{ padding: '16px 20px', overflowY: 'auto', flex: 1 }">
          <div v-if="!priceTagStyles.length" :style="{ textAlign: 'center', color: '#999', padding: '40px 0' }">
            Nenhum estilo de etiqueta cadastrado. Acesse o painel admin para criar estilos.
          </div>

          <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }">
            <button
              v-for="style in priceTagStyles"
              :key="style.id"
              type="button"
              :style="{
                border: currentStyleId === style.id ? '3px solid #2196f3' : '2px solid #e0e0e0',
                borderRadius: '10px',
                padding: '12px',
                background: '#fafafa',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                transition: 'border-color 0.15s, transform 0.1s',
              }"
              @click="selectStyle(style)"
            >
              <!-- Preview da etiqueta -->
              <div
                :style="{
                  width: '100%',
                  height: '60px',
                  borderRadius: style.css_config?.borderRadius || '8px',
                  background: style.css_config?.bgColor || '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: style.css_config?.textColor || '#fff',
                  fontWeight: 900,
                  fontSize: '18px',
                }"
              >
                R$ 9,99
              </div>
              <!-- Nome -->
              <span :style="{ fontSize: '11px', color: '#666', textAlign: 'center', lineHeight: '1.2' }">
                {{ style.name }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
