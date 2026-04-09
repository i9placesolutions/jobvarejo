<script setup lang="ts">
/**
 * Barra de personalizacao flutuante sobre o card do produto.
 * Aparece no hover com 4 botoes: Cor de Fundo, Opcoes de Preco, Etiqueta, Balao.
 */
const emit = defineEmits<{
  (e: 'open-color'): void
  (e: 'open-price-options'): void
  (e: 'open-price-tag'): void
  (e: 'open-bubble'): void
}>()
</script>

<template>
  <ul
    class="personalizar-bar"
    :style="{
      position: 'absolute',
      top: '4px',
      right: '4px',
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      padding: 0,
      margin: 0,
      listStyle: 'none',
      opacity: 0,
      transition: 'opacity 0.15s ease',
      pointerEvents: 'auto',
    }"
  >
    <!-- Cor de Fundo -->
    <li>
      <button
        type="button"
        title="Trocar Cor de Fundo"
        :style="{
          width: '28px', height: '28px',
          borderRadius: '6px',
          border: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }"
        @click.stop="emit('open-color')"
      >🎨</button>
    </li>

    <!-- Opcoes de Preco -->
    <li>
      <button
        type="button"
        title="Opções de Preço"
        :style="{
          width: '28px', height: '28px',
          borderRadius: '6px',
          border: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }"
        @click.stop="emit('open-price-options')"
      >💲</button>
    </li>

    <!-- Etiqueta -->
    <li>
      <button
        type="button"
        title="Etiqueta"
        :style="{
          width: '28px', height: '28px',
          borderRadius: '6px',
          border: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }"
        @click.stop="emit('open-price-tag')"
      >🏷️</button>
    </li>

    <!-- Balao de desconto -->
    <li>
      <button
        type="button"
        title="Balão de Desconto"
        :style="{
          width: '28px', height: '28px',
          borderRadius: '6px',
          border: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }"
        @click.stop="emit('open-bubble')"
      >💬</button>
    </li>
  </ul>
</template>

<style scoped>
/* Mostrar barra no hover do card pai */
:deep(.personalizar-bar) {
  opacity: 0 !important;
}
</style>
