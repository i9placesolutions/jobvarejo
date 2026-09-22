<script setup lang="ts">
import { type ArtLayer } from '~/types/art-studio'
import { CARTAZISTA_LETTERING_FONTS, CARTAZISTA_OTHER_FONTS, CARTAZISTA_TYPE_STYLES } from '~/utils/cartazista/typography'
defineProps<{layer?:ArtLayer}>()
const changeFont=(event:Event)=>{const family=(event.target as HTMLSelectElement).value;const font=CARTAZISTA_LETTERING_FONTS.find(f=>f.family===family);emit('patch',{fontFamily:family,fontWeight:font?.weight||400})}
const emit=defineEmits<{typography:[string];add:['text'|'rect'|'ellipse'];image:[File];patch:[Partial<ArtLayer>];duplicate:[];remove:[];order:[-1|1]}>()
const pickImage=(event:Event)=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(file)emit('image',file);input.value=''}
</script>
<template>
  <section class="poster-layer-tools">
    <label>Letra do cartaz inteiro<select value="" @change="emit('typography',($event.target as HTMLSelectElement).value);($event.target as HTMLSelectElement).value=''"><option value="" disabled>Escolher estilo…</option><option v-for="style in CARTAZISTA_TYPE_STYLES" :key="style.id" :value="style.id">{{ style.label }}</option></select></label><p>Aplica aos textos do modelo. Textos extras e camadas bloqueadas são preservados.</p><h3>Adicionar elementos</h3>
    <div class="actions"><button @click="emit('add','text')">+ Texto</button><button @click="emit('add','rect')">+ Retângulo</button><button @click="emit('add','ellipse')">+ Círculo</button></div>
    <label class="file">+ Imagem PNG, JPG ou WebP<input type="file" accept="image/png,image/jpeg,image/webp" @change="pickImage" /></label>
    <template v-if="layer">
      <h3>{{ layer.name }}</h3>
      <p v-if="layer.locked">Desbloqueie a camada para editar sua posição.</p>
      <fieldset :disabled="layer.locked">
        <div class="coordinates"><label v-for="field in ['x','y','width','height','rotation','opacity'] as const" :key="field">{{ {x:'X',y:'Y',width:'Largura',height:'Altura',rotation:'Rotação',opacity:'Opacidade'}[field] }}<input type="number" :step="field==='opacity'?.1:1" :min="field==='opacity'?0:['width','height'].includes(field)?1:undefined" :max="field==='opacity'?1:undefined" :value="Math.round(layer[field]*100)/100" @change="emit('patch',{[field]:Number(($event.target as HTMLInputElement).value)})" /></label></div>
        <template v-if="layer.kind==='text'"><label>Fonte<select :value="layer.fontFamily" @change="changeFont"><optgroup label="Lettering e feitas à mão"><option v-for="font in CARTAZISTA_LETTERING_FONTS" :key="font.family" :value="font.family">{{ font.label }}</option></optgroup><optgroup label="Outras fontes"><option v-for="font in CARTAZISTA_OTHER_FONTS" :key="font">{{ font }}</option></optgroup></select></label><label>Alinhamento<select :value="layer.align||'left'" @change="emit('patch',{align:($event.target as HTMLSelectElement).value as ArtLayer['align']})"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label></template>
        <div class="actions"><button @click="emit('order',1)">Para frente</button><button @click="emit('order',-1)">Para trás</button><button @click="emit('duplicate')">Duplicar</button><button @click="emit('remove')">Remover</button></div>
      </fieldset>
    </template>
  </section>
</template>
<style scoped>
.poster-layer-tools{padding:18px;color:#43576c;font-size:12px;border-top:1px solid #e1e7ed}h3{font-size:12px;margin:0 0 12px}.actions{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}button,.file{border:1px solid #cbd6e3;background:#f8fafc;border-radius:7px;padding:8px;color:#25466a;cursor:pointer}button:hover{background:#e8f2ff}label{display:block;margin:7px 0}.coordinates{display:grid;grid-template-columns:1fr 1fr;gap:8px}input,select{width:100%;padding:7px;border:1px solid #ced8e3;border-radius:6px;margin-top:4px}.file input{display:block;font-size:11px}fieldset{border:0;padding:0;min-width:0}fieldset:disabled{opacity:.5}
</style>
