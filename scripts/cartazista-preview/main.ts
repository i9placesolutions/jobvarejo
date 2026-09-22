import { applyCartazistaTypography, CARTAZISTA_TYPE_STYLES } from '~/utils/cartazista/typography'
import { cartazistaSample } from '~/utils/cartazista/samples'
import { renderCartazistaSvg } from '~/utils/cartazista/render'
import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'
import recipes from '~/shared/video-studio/generated-flyer-recipes.json'
import { CARTAZISTA_THEMES, type CartazistaThemeId } from '~/types/cartazista'
const headers=recipes.filter(r=>r.seal).map(r=>({id:r.sourceProject,name:r.name,background:r.background?`/video-studio/templates/${r.background}`:'',seal:`/video-studio/templates/${r.seal}`,color:r.base}))
document.head.insertAdjacentHTML('beforeend',`<style>body{margin:0;background:#eceeef;color:#151515;font:15px system-ui}header{padding:28px 36px;background:white}h1{font-size:28px;margin:0}p{color:#666}section{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;padding:28px}article{background:white;box-shadow:0 2px 8px #0001}figure{margin:0;aspect-ratio:840/1190}svg{width:100%;height:100%;display:block}h2{font-size:14px;padding:14px;margin:0;border-top:1px solid #ddd}@media(max-width:700px){section{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px}}</style>`)
const root=document.querySelector('#app')!
root.innerHTML='<header><h1>Cartazes JobVarejo</h1><p>16 modelos editáveis · cabeçalhos do JobVarejo · prévia técnica local</p><label>Cabeçalho <select id="header"><option value="auto">Automático por modelo</option><option value="none">Sem cabeçalho de campanha</option></select></label> <label>Paleta <select id="palette"></select></label> <label>Letra <select id="lettering"></select></label></header><section></section>'
const headerSelect=root.querySelector<HTMLSelectElement>('#header')!
const paletteSelect=root.querySelector<HTMLSelectElement>('#palette')!
for(const header of headers) headerSelect.add(new Option(header.name,header.id))
for(const theme of CARTAZISTA_THEMES) paletteSelect.add(new Option(theme.name,theme.id))
const lettering=root.querySelector<HTMLSelectElement>('#lettering')!
for(const style of CARTAZISTA_TYPE_STYLES)lettering.add(new Option(style.label,style.id))
paletteSelect.value='classic-yellow'
lettering.addEventListener('change',render)
const grid=root.querySelector('section')!
let generation=0
function render(){
const current=++generation
grid.replaceChildren()
for(const model of CARTAZISTA_STARTER_MODELS){
  const card=document.createElement('article');card.innerHTML=`<figure aria-label="${model.name}"></figure><h2>${model.name}</h2>`;grid.append(card)
  const edit=document.createElement('a');edit.textContent='Editar este modelo';edit.style.cssText='display:block;padding:12px 14px;color:#185db2;font-weight:700';edit.href=`http://127.0.0.1:4413/cartazista/editor/new?model=${encodeURIComponent(model.id)}&theme=${encodeURIComponent(paletteSelect.value)}&header=${encodeURIComponent(headerSelect.value)}&typography=${encodeURIComponent(lettering.value)}`;card.append(edit)
  const header=headerSelect.value==='auto'?undefined:headers.find(h=>h.id===headerSelect.value)??null
  renderCartazistaSvg(applyCartazistaTypography(cartazistaSample(model.id,headers,{themeId:paletteSelect.value as CartazistaThemeId,header}),lettering.value)).then(svg=>{if(current===generation)card.querySelector('figure')!.innerHTML=svg}).catch(error=>{card.querySelector('figure')!.textContent=String(error);console.error(error)})
}
}
headerSelect.addEventListener('change',render)
paletteSelect.addEventListener('change',render)
render()
