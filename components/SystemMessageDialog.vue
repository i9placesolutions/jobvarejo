<script setup lang="ts">
import { systemMessage, closeSystemMessage } from '~/utils/systemMessages'
const dialog = ref<HTMLDialogElement | null>(null)
watch(systemMessage, async (value) => {
  await nextTick()
  if (value && !dialog.value?.open) dialog.value?.showModal()
  if (!value && dialog.value?.open) dialog.value.close()
}, { flush: 'post' })
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="system-message" aria-labelledby="system-message-title" aria-describedby="system-message-body" @cancel.prevent="closeSystemMessage(false)">
      <template v-if="systemMessage">
        <h2 id="system-message-title">{{ systemMessage.confirm ? 'Confirmar ação' : 'Aviso' }}</h2>
        <p id="system-message-body">{{ systemMessage.message }}</p>
        <footer>
          <button v-if="systemMessage.confirm" type="button" autofocus @click="closeSystemMessage(false)">Cancelar</button>
          <button type="button" class="primary" @click="closeSystemMessage(true)">{{ systemMessage.confirm ? 'Continuar' : 'Entendi' }}</button>
        </footer>
      </template>
    </dialog>
  </Teleport>
</template>
<style scoped>
.system-message { margin:auto; width:min(480px,calc(100vw - 32px)); max-height:80dvh; padding:24px; border:1px solid #41414b; border-radius:18px; background:#22232a; color:#f4f4f5; box-shadow:0 24px 80px #0008; }
.system-message::backdrop { background:#0008; }
h2 { font-size:18px; font-weight:650; margin:0 0 14px; }
p { white-space:pre-wrap; overflow-wrap:anywhere; font-size:14px; line-height:1.6; color:#d4d4d8; }
footer { display:flex; justify-content:flex-end; gap:10px; margin-top:24px; }
button { min-height:44px; padding:0 18px; border-radius:9px; background:#383941; font-size:14px; font-weight:600; }
.primary { background:#7c3aed; color:white; }
button:focus-visible { outline:2px solid #c4b5fd; outline-offset:3px; }
</style>
