<script setup lang="ts">
import {videoListIssue,videoOfferFromList} from '~/shared/video-studio/list-import'
import type {VideoOffer} from '~/shared/video-studio/model'
const props=defineProps<{remaining:number}>(),emit=defineEmits<{close:[];import:[offers:VideoOffer[]]}>()
const {products,isParsing,parsingError,parseText,parseFile,processProductImage,applyImageCandidate}=useProductProcessor()
const text=ref(''),selected=ref<number[]>([]),busy=ref(''),error=ref('')
async function parse(file?:File){selected.value=[];error.value='';if(file)await parseFile(file);else await parseText(text.value);selected.value=products.value.flatMap((p,i)=>videoListIssue(p)?[]:[i]).slice(0,props.remaining)}
async function file(event:Event){const input=event.target as HTMLInputElement;if(input.files?.[0])await parse(input.files[0]);input.value=''}
async function find(index:number){busy.value='Buscando a foto de '+products.value[index]?.name;try{await processProductImage(index,{matchMode:'precise',bgPolicy:'auto'})}finally{busy.value=''}}
async function choose(index:number,candidate:any){busy.value='Preparando a foto escolhida';try{await applyImageCandidate(index,candidate,{matchMode:'precise',bgPolicy:'auto'})}finally{busy.value=''}}
async function add(){if(busy.value)return;error.value='';const offers:VideoOffer[]=[];try{for(const index of selected.value.slice(0,props.remaining)){
 const p=products.value[index]!;busy.value='Preparando '+p.name
 const offer=videoOfferFromList(p,crypto.randomUUID())
 if(!p.imageUrl)await processProductImage(index,{matchMode:'precise',bgPolicy:'auto'})
 if(p.imageUrl){const asset=await $fetch<any>('/api/videos/catalog-image',{method:'POST',body:{source:p.imageUrl,name:p.name}});offer.image=asset.id;offer.imageAspectRatio=asset.aspectRatio}
 offers.push(offer)
 }emit('import',offers)}catch(e:any){error.value=e?.data?.statusMessage||e.message}finally{busy.value=''}}
</script>
<template>
 <div class="list-overlay" @click.self="!busy&&emit('close')"><section class="list-dialog" role="dialog" aria-modal="true" aria-label="Importar lista de produtos"><header><h2>Traga sua lista de ofertas</h2><button :disabled="!!busy" @click="emit('close')">Fechar</button></header><p>Cole a lista ou envie PDF, CSV ou XLSX. A busca de fotos usa o mesmo catálogo dos encartes.</p>
 <textarea v-model="text" rows="5" maxlength="60000" placeholder="Arroz Cristal 5 kg 25,99&#10;Café Rio Verde 500 g 29,99" aria-label="Lista de produtos"/><div class="actions"><button :disabled="isParsing||!!busy||!text.trim()" @click="parse()">Ler lista</button><label>Enviar arquivo<input type="file" accept=".txt,.csv,.tsv,.xlsx,.xls,.pdf" :disabled="isParsing||!!busy" @change="file"/></label></div>
 <p v-if="isParsing||busy" role="status">{{ busy||'Lendo a lista…' }}</p><p v-if="parsingError||error" role="alert">{{ error||parsingError }}</p>
 <p v-if="products.length">Escolha até {{ remaining }} ofertas e confira os preços. Fotos incertas precisam da sua escolha.</p>
 <article v-for="(p,i) in products" :key="p.id"><label class="pick"><input v-model="selected" type="checkbox" :value="i" :disabled="!!videoListIssue(p)||!!busy||(!selected.includes(i)&&selected.length>=remaining)"/><strong>{{ p.name }}</strong><span>R$ {{ p.price||p.priceUnit }}</span></label><small v-if="videoListIssue(p)">{{ videoListIssue(p) }}</small><template v-else><div class="photo"><img v-if="p.imageUrl" :src="p.imageUrl" :alt="p.name"/><button :disabled="!!busy" @click="find(i)">{{ p.imageUrl?'Buscar outra foto':'Buscar foto' }}</button><small>{{ p.imageReviewReason||p.error }}</small></div><div v-if="p.imageCandidates?.length&&!p.imageUrl" class="candidates"><button v-for="candidate in p.imageCandidates" :key="candidate.id" :disabled="!!busy" @click="choose(i,candidate)"><img :src="candidate.previewUrl||candidate.url" :alt="candidate.title||p.name"/><span>Usar esta foto</span></button></div></template></article>
 <footer><button :disabled="!selected.length||!!busy||isParsing" @click="add">Importar selecionados e buscar fotos</button><small>Os produtos sem foto confirmada entram para revisão. A exportação exige todas as imagens.</small></footer>
 </section></div>
</template>
<style scoped>
.list-overlay{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:#071b17a8;padding:20px}.list-dialog{width:min(720px,100%);max-height:90vh;overflow:auto;background:white;padding:25px;border-radius:20px;color:#173e33}header,.actions,.pick,.photo{display:flex;align-items:center;gap:14px}header{justify-content:space-between}h2{font-size:22px}p,small{font-size:13px;line-height:1.5;margin:12px 0}textarea{width:100%;border:1px solid #bccfc4;border-radius:10px;padding:12px;margin:12px 0}button,.actions label{background:#1e5543;color:white;padding:9px 14px;border-radius:8px;font-size:13px}button:disabled{opacity:.45}.actions input{max-width:180px;font-size:11px}article{border-bottom:1px solid #dce7df;padding:16px 0}.pick strong{flex:1}.photo{margin-top:12px}.photo img{width:70px;height:80px;object-fit:contain}.candidates{display:flex;gap:10px;overflow:auto;margin:12px 0}.candidates button{background:#eef4ef;color:#173e33;min-width:100px}.candidates img{width:90px;height:100px;object-fit:contain}.candidates span{display:block;font-size:11px}footer{display:grid;gap:10px;margin-top:20px}
</style>
