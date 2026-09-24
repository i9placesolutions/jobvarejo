<script setup lang="ts">
import {MOTION_PRESETS,PRODUCT_ENTRANCES,TEXT_ENTRANCES,CAMERA_MOVEMENTS,SCENE_TRANSITIONS,ATMOSPHERE_EFFECTS,SOUND_EFFECTS,PRODUCT_FINISHES,motionSettings,identifyMotionPreset,soundAsset,type VideoMotionSettings} from '~/shared/video-studio/effect-catalog'
import type {VideoDocument} from '~/shared/video-studio/model'
const doc=defineModel<VideoDocument>({required:true})
const m=computed(()=>motionSettings(doc.value.motion))
const selected=computed(()=>identifyMotionPreset(doc.value.motion,doc.value.transition))
const fields=[{key:'product',label:'Entrada dos produtos',items:PRODUCT_ENTRANCES},{key:'text',label:'Entrada dos textos',items:TEXT_ENTRANCES},{key:'price',label:'Entrada do preço',items:PRODUCT_ENTRANCES},{key:'camera',label:'Movimento da tela toda',items:CAMERA_MOVEMENTS},{key:'finish',label:'Acabamento dos produtos',items:PRODUCT_FINISHES}] as const
function apply(id:string){const p=MOTION_PRESETS.find(p=>p.id===id)!;doc.value={...doc.value,motion:{...p.motion,atmosphere:[...p.motion.atmosphere]},transition:p.transition,effects:[...new Set([...doc.value.effects,'zoom','shake'] as const)]}}
function set(key:keyof VideoMotionSettings,value:string){doc.value={...doc.value,motion:{...m.value,[key]:value}};if(key==='camera'&&value!=='none'&&!doc.value.effects.includes('shake'))doc.value.effects.push('shake')}
function atmosphere(id:VideoMotionSettings['atmosphere'][number]){const current=m.value.atmosphere;if(!current.includes(id)&&current.length>=8)return;doc.value={...doc.value,motion:{...m.value,atmosphere:current.includes(id)?current.filter(v=>v!==id):[...current,id]}}}
const value=(e:Event)=>(e.target as HTMLSelectElement).value
</script>

<template>
 <section class="motion-library" aria-label="Biblioteca de movimentos">
  <div class="motion-heading">
   <div class="motion-kicker"><span>ESTILO DO MOVIMENTO</span><em>{{ MOTION_PRESETS.length }} combinações prontas</em></div>
   <strong>Mais impacto, do seu jeito.</strong>
   <p>Escolha o ritmo do vídeo. Produto, texto, preço e som entram juntos em uma combinação pronta.</p>
  </div>
  <div class="motion-presets">
   <button v-for="p in MOTION_PRESETS" :key="p.id" type="button" :aria-pressed="selected===p.id" :class="{active:selected===p.id}" :style="{'--preset-accent':p.color}" @click="apply(p.id)">
    <span class="motion-preset-main">
     <i aria-hidden="true">{{ p.id==='storm'?'ϟ':p.id==='party'?'✦':p.id==='neon'?'◈':p.id==='flash'?'»':p.id==='focus'?'◎':'↗' }}</i>
     <span class="motion-preset-copy"><strong>{{ p.name }}</strong><small>{{ p.description }}</small></span>
     <span v-if="selected===p.id" class="motion-selected" aria-hidden="true">✓</span>
    </span>
    <span class="motion-preset-meta"><span>Produto</span><b/> <span>Texto</span><b/> <span>Preço</span><b/> <span>Som</span></span>
   </button>
  </div>
  <p class="motion-note" role="status"><span aria-hidden="true">{{ selected?'✓':'▶' }}</span>{{ selected?'Estilo aplicado. Dê o play na prévia para ver o resultado.':'Escolha um estilo para visualizar o movimento na prévia.' }}</p>
  <details><summary>Ajustar cada movimento</summary><div class="motion-fields">
   <label v-for="field in fields" :key="field.key">{{ field.label }}<select :value="m[field.key]||'clean'" @change="set(field.key,value($event))"><option v-for="item in field.items" :key="item.id" :value="item.id">{{ item.name }}</option></select></label>
   <label>Transição entre ofertas<select v-model="doc.transition"><option v-for="t in SCENE_TRANSITIONS" :key="t.id" :value="t.id">{{ t.name }}</option></select></label>
   <label>Velocidade das entradas<select :value="m.speed" @change="set('speed',value($event))"><option value="fast">Rápida · varejo</option><option value="balanced">Mais moderada</option></select></label>
  </div><p class="motion-subtitle">Elementos adicionais no fundo · até 8 ao mesmo tempo</p><div class="motion-checks"><label v-for="effect in ATMOSPHERE_EFFECTS" :key="effect.id"><input type="checkbox" :checked="m.atmosphere.includes(effect.id)" :disabled="!m.atmosphere.includes(effect.id)&&m.atmosphere.length>=8" @change="atmosphere(effect.id)"/>{{ effect.name }}</label></div></details>
  <details><summary>Escolher e ouvir os sons</summary><p class="motion-note">Os sons acompanham a entrada e o destaque do preço. O volume pode ser ajustado junto da música, abaixo.</p><div class="motion-fields"><label v-for="field in ([{key:'transitionSound',name:'Som da entrada'},{key:'accentSound',name:'Som do impacto'}] as const)" :key="field.key">{{ field.name }}<select :value="m[field.key]" @change="set(field.key,value($event))"><option v-for="sound in SOUND_EFFECTS" :key="sound.id" :value="sound.id">{{ sound.name }}</option></select><audio :key="m[field.key]" controls preload="none" :src="'/video-studio/audio/'+soundAsset(m[field.key])"/></label></div></details>
 </section>
</template>

<style scoped>
.motion-library{container-type:inline-size;margin:20px 0;border:1px solid #dce5ef;border-radius:20px;padding:22px;background:linear-gradient(180deg,#fff 0%,#fbfcff 100%);box-shadow:0 10px 30px rgba(35,54,87,.06);color:#263959}
.motion-heading{margin-bottom:18px}.motion-kicker{display:flex;align-items:center;justify-content:space-between;gap:10px}.motion-kicker>span{font-size:10px;letter-spacing:1.6px;color:#6556aa;font-weight:800}.motion-kicker em{padding:5px 8px;border:1px solid #e1def3;border-radius:999px;background:#f7f5ff;color:#7065ad;font-size:9px;font-style:normal;font-weight:750;white-space:nowrap}.motion-heading>strong{display:block;max-width:390px;margin-top:9px;color:#213656;font-size:24px;line-height:1.15;letter-spacing:-.025em}.motion-heading p{max-width:470px;margin:9px 0 0;color:#687a72;font-size:12px;line-height:1.55}
.motion-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.motion-presets button{position:relative;min-width:0;border:1px solid #dfe8e3;border-radius:14px;background:#fff;text-align:left;padding:11px;cursor:pointer;color:#263959;box-shadow:0 3px 10px rgba(26,55,45,.035);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease,background .18s ease}.motion-presets button:hover{transform:translateY(-2px);border-color:#b8c7be;box-shadow:0 9px 22px rgba(26,55,45,.09)}.motion-presets button.active{border-color:#7568bf;background:linear-gradient(145deg,#fbfaff 0%,#f4f1ff 100%);box-shadow:0 0 0 1px #7568bf,0 10px 24px rgba(84,69,160,.12)}
.motion-preset-main{display:grid;grid-template-columns:54px minmax(0,1fr) 22px;align-items:center;gap:11px}.motion-presets i{display:grid;place-items:center;width:54px;height:54px;border-radius:13px;background:radial-gradient(circle at 30% 25%,#315b45 0%,#173a2a 44%,#0e271c 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 7px 16px rgba(9,43,28,.16);color:var(--preset-accent);font-size:29px;font-style:normal;line-height:1;text-shadow:0 0 14px var(--preset-accent)}.motion-preset-copy{min-width:0}.motion-presets strong{display:block;color:#273b60;font-size:13px;line-height:1.25}.motion-presets small{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;margin-top:4px;color:#6d7e75;font-size:10.5px;line-height:1.38}.motion-selected{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#6558b2;color:#fff;font-size:12px;font-weight:800;box-shadow:0 4px 10px rgba(101,88,178,.28)}
.motion-preset-meta{display:flex;align-items:center;gap:5px;margin-top:10px;padding-top:8px;border-top:1px solid #edf1ef;color:#829087;font-size:8px;font-weight:700;letter-spacing:.02em}.motion-preset-meta b{width:3px;height:3px;border-radius:50%;background:#cad4ce}
.motion-note{display:flex;align-items:center;gap:7px;margin:13px 0 0;padding:9px 11px;border:1px solid #e4e8f1;border-radius:10px;background:#f8f9fc;color:#66768a;font-size:10.5px;line-height:1.4}.motion-note>span{display:grid;place-items:center;flex:none;width:19px;height:19px;border-radius:6px;background:#edeafa;color:#6556aa;font-size:10px;font-weight:800}
.motion-library details{border:1px solid #e3e9f0;border-radius:12px;padding:0 12px;margin-top:10px;background:#fff}.motion-library summary{display:flex;align-items:center;min-height:43px;cursor:pointer;color:#344969;font-weight:700;font-size:12px}.motion-library details[open]{padding-bottom:13px}.motion-library details[open] summary{border-bottom:1px solid #edf1f5}.motion-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.motion-fields label{display:flex;flex-direction:column;gap:7px;color:#40536f;font-size:11px;font-weight:650}.motion-fields select{width:100%;border:1px solid #d5dfea;border-radius:9px;background:#fff;padding:9px 8px;font:inherit;color:#263959}.motion-fields audio{width:100%;height:34px}.motion-checks{display:grid;grid-template-columns:1fr 1fr;gap:9px;font-size:11px}.motion-checks label{display:flex;gap:7px;align-items:center;color:#53677f}.motion-subtitle{color:#344969;font-size:11px;font-weight:750;margin:17px 0 10px}.motion-library input{accent-color:#6556aa}
@container (max-width:440px){.motion-library{padding:16px}.motion-kicker{align-items:flex-start;flex-direction:column}.motion-heading>strong{font-size:21px}.motion-presets{grid-template-columns:1fr}.motion-fields{grid-template-columns:1fr}.motion-preset-main{grid-template-columns:50px minmax(0,1fr) 22px}.motion-presets i{width:50px;height:50px}.motion-checks{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.motion-presets button{transition:none}}
</style>
