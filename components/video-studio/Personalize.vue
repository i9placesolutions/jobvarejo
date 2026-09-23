<script setup lang="ts">
import {VIDEO_BACKGROUNDS,backgroundAsset} from '~/shared/video-studio/backgrounds'
import {VIDEO_COLOR_PALETTES,VIDEO_TEXT_COLORS} from '~/shared/video-studio/personalization'
import {SCENE_TRANSITIONS,SOUND_EFFECTS,motionSettings,soundAsset,type VideoMotionSettings} from '~/shared/video-studio/effect-catalog'
import {newVideoFromTemplate} from '~/shared/video-studio/templates'
import {flyerRecipe} from '~/shared/video-studio/flyer-recipes'
import {VIDEO_EFFECTS,type VideoDocument} from '~/shared/video-studio/model'

const doc=defineModel<VideoDocument>({required:true})
const supportsCatalog=computed(()=>!!flyerRecipe(doc.value.theme)||(doc.value.theme==='impact'&&doc.value.layoutVersion===2))
const motion=computed(()=>motionSettings(doc.value.motion))
const selectedPalette=computed(()=>{
 if(VIDEO_TEXT_COLORS.some(field=>doc.value.appearance?.[field.key]))return ''
 return VIDEO_COLOR_PALETTES.find(palette=>doc.value.appearance?.textColor===palette.textColor&&doc.value.appearance?.accent===palette.accent)?.id||''
})
const activeAdjustments=computed(()=>VIDEO_TEXT_COLORS.filter(field=>!!doc.value.appearance?.[field.key]).length)
const colorOf=(key:typeof VIDEO_TEXT_COLORS[number]['key'])=>doc.value.appearance?.[key]||doc.value.appearance?.textColor||'#ffffff'
function choosePalette(palette:typeof VIDEO_COLOR_PALETTES[number]){doc.value.appearance=palette.id==='original'?undefined:{textColor:palette.textColor,accent:palette.accent}}
function setTextColor(key:typeof VIDEO_TEXT_COLORS[number]['key'],event:Event){doc.value.appearance={...doc.value.appearance,[key]:(event.target as HTMLInputElement).value}}
function resetTextColor(key:typeof VIDEO_TEXT_COLORS[number]['key']){doc.value.appearance={...doc.value.appearance,[key]:undefined}}
function setSound(key:'transitionSound'|'accentSound',event:Event){doc.value.motion={...motion.value,[key]:(event.target as HTMLSelectElement).value as VideoMotionSettings['transitionSound']}}
function restore(){const original=newVideoFromTemplate(doc.value.theme);doc.value={...doc.value,appearance:undefined,background:undefined,motion:original.motion,effects:original.effects,intensity:original.intensity,transition:original.transition,audio:{...doc.value.audio,music:original.audio.music,musicVolume:original.audio.musicVolume,effectsVolume:original.audio.effectsVolume,sounds:original.audio.sounds}}}
</script>

<template>
 <div class="personalize">
  <section class="personalize-section" aria-labelledby="video-campaign-title">
   <div class="section-head"><span class="section-number">01</span><div><h3 id="video-campaign-title">Mensagem da campanha</h3><p>Um título curto fica mais legível na abertura e nas ofertas.</p></div></div>
   <label class="campaign-field"><span>Texto da campanha</span><input v-model="doc.campaign" maxlength="65" placeholder="Ex.: Ofertas da semana"/><small>Ao trocar o título, o selo do modelo passa a mostrar esse texto na prévia.</small></label>
  </section>

  <section class="personalize-section" aria-labelledby="video-background-title">
   <div class="section-head"><span class="section-number">02</span><div><h3 id="video-background-title">Fundo do vídeo</h3><p>Troque o cenário sem alterar produtos, logo ou preços.</p></div></div>
   <div class="backgrounds" role="group" aria-label="Escolha do fundo">
    <button type="button" class="background-choice" :class="{selected:!doc.background}" :aria-pressed="!doc.background" @click="doc.background=undefined"><span class="background-sample original"><span aria-hidden="true">↺</span><small>Arte do modelo</small></span><strong>Original</strong><span class="choice-check" aria-hidden="true">✓</span></button>
    <button v-for="bg in VIDEO_BACKGROUNDS" :key="bg.id" type="button" class="background-choice" :class="{selected:doc.background===bg.id}" :aria-pressed="doc.background===bg.id" @click="doc.background=bg.id"><img class="background-sample" :src="'/video-studio/templates/'+backgroundAsset(bg.id,'horizontal')" alt="" loading="lazy"/><strong>{{ bg.name }}</strong><span class="choice-check" aria-hidden="true">✓</span></button>
   </div>
  </section>

  <section class="personalize-section" aria-labelledby="video-colors-title">
   <div class="section-head"><span class="section-number">03</span><div><h3 id="video-colors-title">Cores dos textos</h3><p>Escolha uma paleta para o vídeo ou refine cada texto.</p></div></div>
   <div class="palettes" role="group" aria-label="Paletas de cores">
    <button v-for="palette in VIDEO_COLOR_PALETTES" :key="palette.id" type="button" class="palette-choice" :class="{selected:selectedPalette===palette.id}" :aria-pressed="selectedPalette===palette.id" @click="choosePalette(palette)"><span class="palette-preview" :style="{background:palette.id==='original'?'linear-gradient(135deg,#f3f5f9,#dbe3ed)':palette.textColor,borderColor:palette.accent||'#aeb5c8'}" aria-hidden="true"/><strong>{{ palette.name }}</strong></button>
   </div>
   <details class="personalize-details"><summary><span>Cor de cada texto <small v-if="activeAdjustments">{{ activeAdjustments }} ajustada{{ activeAdjustments>1?'s':'' }}</small></span><span aria-hidden="true">⌄</span></summary><p class="details-help">Cada ajuste afeta somente o texto indicado. A logo e a etiqueta mantêm suas cores.</p><div class="color-list"><div v-for="field in VIDEO_TEXT_COLORS" :key="field.key" class="color-row"><label :for="'video-color-'+field.key">{{ field.label }}</label><div class="color-actions"><input :id="'video-color-'+field.key" type="color" :aria-label="'Cor de '+field.label" :value="colorOf(field.key)" @input="setTextColor(field.key,$event)"/><span>{{ colorOf(field.key).toUpperCase() }}</span><button type="button" :aria-label="'Restaurar cor de '+field.label" :disabled="!doc.appearance?.[field.key]" @click="resetTextColor(field.key)">↺</button></div></div></div></details>
  </section>

  <section class="personalize-section" aria-labelledby="video-motion-title">
   <div class="section-head"><span class="section-number">04</span><div><h3 id="video-motion-title">Movimento e transições</h3><p>Escolha o ritmo entre uma oferta e outra. Confira o resultado na prévia.</p></div></div>
   <div class="transitions" role="group" aria-label="Transição entre ofertas"><button v-for="t in (supportsCatalog?SCENE_TRANSITIONS:SCENE_TRANSITIONS.slice(0,4))" :key="t.id" type="button" :aria-pressed="doc.transition===t.id" :class="{selected:doc.transition===t.id}" @click="doc.transition=t.id">{{ t.name }}</button></div>
   <VideoStudioEffectsLibrary v-if="supportsCatalog" v-model="doc"/>
   <div v-else class="sound-settings"><div v-for="field in ([{key:'transitionSound',name:'Som da transição'},{key:'accentSound',name:'Som do destaque'}] as const)" :key="field.key" class="sound-setting"><label>{{ field.name }}<select :value="motion[field.key]" @change="setSound(field.key,$event)"><option v-for="sound in SOUND_EFFECTS" :key="sound.id" :value="sound.id">{{ sound.name }}</option></select></label><audio controls preload="none" :src="'/video-studio/audio/'+soundAsset(motion[field.key])"/></div></div>
   <details class="personalize-details"><summary><span>Brilhos, partículas e intensidade</span><span aria-hidden="true">⌄</span></summary><div class="effects"><label v-for="effect in VIDEO_EFFECTS" :key="effect.id"><input v-model="doc.effects" type="checkbox" :value="effect.id"/>{{ effect.name }}</label></div><label class="intensity-field">Intensidade<select v-model.number="doc.intensity"><option :value=".25">Suave</option><option :value=".55">Equilibrada</option><option :value=".85">Impactante</option></select></label></details>
  </section>

  <button type="button" class="reset" @click="restore">↺ <span>Restaurar visual e efeitos do modelo</span></button>
 </div>
</template>

<style scoped>
.personalize{display:grid;gap:14px;color:#263959}
.personalize *{box-sizing:border-box}
.personalize-section{min-width:0;border:1px solid #dde5f1;border-radius:18px;background:#fff;padding:20px;box-shadow:0 7px 24px #1f3d6310}
.section-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}
.section-number{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#edeafa;color:#5f54a7;font-size:11px;font-weight:800;letter-spacing:.04em}
.section-head h3{margin:0!important;color:#233657;font-size:17px!important;line-height:1.2}
.section-head p,.details-help{margin:5px 0 0;color:#657791;font-size:12px;line-height:1.5}
.campaign-field{display:grid;gap:8px;color:#314563;font-size:12px;font-weight:700}
.campaign-field input,.sound-setting select,.intensity-field select{width:100%;min-height:44px;border:1px solid #cfdbeb;border-radius:10px;background:#fff;color:#243a58;padding:10px 12px;font:inherit;font-size:14px}
.campaign-field small{font-size:11px;line-height:1.5;font-weight:400;color:#657791}
.backgrounds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.personalize button{font:inherit;cursor:pointer}
.background-choice{position:relative;display:grid;gap:8px;min-width:0;text-align:left;padding:7px 7px 10px;border:1px solid #dbe4ef;border-radius:12px;background:#fff;color:#2d4261;transition:border-color .18s,box-shadow .18s,transform .18s}
.background-choice:hover,.palette-choice:hover,.transitions button:hover{border-color:#8e83cf;transform:translateY(-1px)}
.background-choice.selected,.palette-choice.selected,.transitions button.selected{border-color:#6d5fc0;background:#f6f4ff;box-shadow:0 0 0 1px #6d5fc0}
.background-sample{display:block;width:100%;height:78px;object-fit:cover;border-radius:7px}
.background-sample.original{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(135deg,#edf0f9,#dfe7f4);color:#6155ab}
.background-sample.original>span{font-size:24px;line-height:1}.background-sample.original small{font-size:10px;font-weight:650}
.background-choice strong{padding:0 4px;font-size:12px;line-height:1.35}
.choice-check{position:absolute;top:11px;right:11px;width:21px;height:21px;display:grid;place-items:center;border-radius:50%;background:#6559b2;color:#fff;font-size:12px;opacity:0}
.background-choice.selected .choice-check{opacity:1}
.palettes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.palette-choice{display:flex;align-items:center;gap:9px;min-height:46px;padding:8px;border:1px solid #dbe4ef;border-radius:10px;background:#fff;color:#2d4261;text-align:left;transition:border-color .18s,box-shadow .18s,transform .18s}
.palette-preview{flex:none;width:26px;height:26px;border:3px solid;border-radius:8px;box-shadow:inset 0 0 0 1px #0001}
.palette-choice strong{font-size:11px;line-height:1.25}
.personalize-details{border-top:1px solid #e4eaf3;margin-top:17px;padding-top:14px}
.personalize-details summary{display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;list-style:none;color:#344969;font-size:12px;font-weight:750}
.personalize-details summary::-webkit-details-marker{display:none}
.personalize-details summary small{padding:3px 6px;margin-left:5px;border-radius:999px;background:#ebe8fa;color:#6559b2;font-size:10px}
.personalize-details[open] summary>span:last-child{transform:rotate(180deg)}
.details-help{margin:11px 0}
.color-list{display:grid;gap:4px;margin-top:12px}
.color-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:41px;border-bottom:1px solid #eef1f6;color:#344969;font-size:11px;font-weight:650}
.color-row:last-child{border-bottom:0}
.color-actions{display:flex;align-items:center;gap:6px}
.color-actions input{width:30px;height:30px;border:1px solid #d9e1ee;border-radius:7px;padding:2px;background:white;cursor:pointer}
.color-actions>span{min-width:57px;color:#6b7890;font-size:10px;font-variant-numeric:tabular-nums}
.color-actions button{width:27px;height:27px;border:1px solid #dce4ef;border-radius:7px;background:#fff;color:#6559b2}
.color-actions button:disabled{opacity:.35;cursor:default}
.transitions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.transitions button{min-height:40px;padding:8px 10px;border:1px solid #dbe4ef;border-radius:10px;background:#fff;color:#344969;text-align:left;font-size:11px;font-weight:700;transition:border-color .18s,box-shadow .18s,transform .18s}
.sound-settings{display:grid;gap:13px;margin-top:15px}
.sound-setting label{display:grid;gap:7px;color:#344969;font-size:12px;font-weight:700}
.sound-setting audio{display:block;width:100%;height:34px;margin-top:7px}
.effects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}
.effects label{display:flex;align-items:center;gap:7px;color:#344969;font-size:11px}
.effects input{accent-color:#6559b2}
.intensity-field{display:grid;gap:7px;margin-top:17px;color:#344969;font-size:12px;font-weight:700}
.reset{min-height:42px;border:1px solid #d9d5ef;border-radius:10px;background:#f7f5ff;color:#5f54a7;font-size:12px;font-weight:750!important}
.reset:hover{background:#eeebfa}
.personalize :is(button,input,select,summary):focus-visible{outline:3px solid #9285d0;outline-offset:2px}
@media(max-width:420px){.personalize-section{padding:16px}.background-sample{height:66px}.effects{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.personalize button{transition:none}}
</style>
