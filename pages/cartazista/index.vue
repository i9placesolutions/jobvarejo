<script setup lang="ts">
import { Search, Plus, ArrowUpRight, Sparkles, SlidersHorizontal } from 'lucide-vue-next'
import ArtPreview from '~/components/art-studio/ArtPreview.vue'
import CartazistaShell from '~/components/cartazista/CartazistaShell.vue'
import type { CartazistaDesign, CartazistaModel, CartazistaTemplateSummary } from '~/types/cartazista'
import { createCartazistaDocument } from '~/utils/cartazista/composition'
import { CARTAZISTA_FORMATS, CARTAZISTA_THEMES } from '~/types/cartazista'

definePageMeta({ layout: false, middleware: 'auth', ssr: false })
useHead({ title: 'Cartazes online • JobVarejo' })

const route = useRoute()
const active = computed<'catalog' | 'mine'>(() => route.query.tab === 'mine' ? 'mine' : 'catalog')
const templates = ref<CartazistaTemplateSummary[]>([])
const designs = ref<CartazistaDesign[]>([])
const search = ref('')
const category = ref('Todos')
const format = ref('all')
const loading = ref(true)
const error = ref('')
const databaseReady = ref(true)
const picked = ref<CartazistaModel | null>(null)
const previewDialog = ref<HTMLDialogElement>()

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const categories = computed(() => ['Todos', ...new Set(templates.value.map((template) => template.category))])
const visibleTemplates = computed(() => templates.value.filter((template) => {
  const matchesSearch = normalize([template.name, template.category, template.description, ...template.tags].join(' ')).includes(normalize(search.value))
  const matchesCategory = category.value === 'Todos' || template.category === category.value
  const sample = createCartazistaDocument({ modelId: template.id, formatId: 'a3' }).composition
  const matchesFormat = format.value === 'all' || (format.value === 'portrait' ? sample.width < sample.height : sample.width > sample.height)
  return matchesSearch && matchesCategory && matchesFormat
}))

const previewComposition = computed(() => picked.value ? createCartazistaDocument({ modelId: picked.value.id, formatId: 'a3', themeId: 'classic-yellow' }).composition : null)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ templates: CartazistaTemplateSummary[]; databaseReady: boolean }>('/api/cartazista/templates')
    templates.value = result.templates
    databaseReady.value = result.databaseReady
    if (active.value === 'mine') designs.value = await $fetch<CartazistaDesign[]>('/api/cartazista/designs')
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || cause?.statusMessage || 'Não foi possível carregar os modelos.'
  } finally {
    loading.value = false
  }
}

watch(active, () => { search.value = ''; category.value = 'Todos'; void load() })
onMounted(load)

const openPreview = (template: CartazistaModel) => {
  picked.value = template
  previewDialog.value?.showModal()
}

const start = () => {
  if (!picked.value) return
  previewDialog.value?.close()
  void navigateTo({ path: '/cartazista/editor/new', query: { model: picked.value.id } })
}

const newBlank = () => void navigateTo('/cartazista/editor/new')
const modelById = (id: string) => templates.value.find((template) => template.id === id) || templates.value[0]
</script>

<template>
  <CartazistaShell :active="active">
    <main class="cartazista-catalog">
      <div v-if="error" class="cartazista-alert" role="alert">{{ error }} <button @click="load">Tentar novamente</button></div>
      <div v-if="!databaseReady" class="cartazista-alert" role="status">Os modelos iniciais estão disponíveis. A migração do catálogo persistido ainda não foi aplicada.</div>

      <section class="cartazista-hero">
        <div>
          <p class="cartazista-eyebrow"><Sparkles :size="15" /> NOVO EDITOR DO JOBVAREJO</p>
          <h1>{{ active === 'mine' ? 'Seus cartazes, sempre prontos.' : 'Cartazes de oferta em poucos cliques.' }}</h1>
          <p>{{ active === 'mine' ? 'Reabra um cartaz, troque a lista e imprima novamente.' : 'Escolha o modelo, cole a lista de produtos e gere peças prontas para a loja.' }}</p>
        </div>
        <button class="cartazista-button primary" @click="newBlank"><Plus :size="18" /> Criar do zero</button>
      </section>

      <section v-if="active === 'catalog'" class="cartazista-workflow" aria-label="Como criar um cartaz">
        <div><strong>1</strong><span><b>Escolha o modelo</b><small>Preço, clube, pack ou gôndola</small></span></div>
        <div><strong>2</strong><span><b>Cole a lista</b><small>Uma linha por produto e preço</small></span></div>
        <div><strong>3</strong><span><b>Confira e imprima</b><small>A1 a A7 e modo paisagem</small></span></div>
      </section>

      <section class="cartazista-toolbar">
        <div class="cartazista-search"><Search :size="19" /><input v-model="search" type="search" placeholder="Buscar por tipo de cartaz…" aria-label="Buscar modelos" /></div>
        <div class="cartazista-filter"><SlidersHorizontal :size="17" /><select v-model="category" aria-label="Filtrar por categoria"><option v-for="item in categories" :key="item" :value="item">{{ item }}</option></select></div>
        <div class="cartazista-format-filter"><button :class="{ selected: format === 'all' }" @click="format = 'all'">Todos</button><button :class="{ selected: format === 'portrait' }" @click="format = 'portrait'">Retrato</button><button :class="{ selected: format === 'landscape' }" @click="format = 'landscape'">Paisagem</button></div>
      </section>

      <template v-if="active === 'catalog'">
        <div class="cartazista-section-heading"><div><h2>Modelos de cartaz</h2><span>{{ visibleTemplates.length }} modelos · layout e campos editáveis</span></div><span class="cartazista-badge">A1 · A2 · A3 · A5 · A6 · A7</span></div>
        <div v-if="loading" class="cartazista-empty">Carregando modelos…</div>
        <div v-else-if="!visibleTemplates.length" class="cartazista-empty">Nenhum modelo combina com a busca. <button @click="search = ''; category = 'Todos'">Limpar filtros</button></div>
        <section v-else class="cartazista-model-grid">
          <article v-for="template in visibleTemplates" :key="template.id" class="cartazista-model-card">
            <button class="cartazista-model-preview" :aria-label="`Pré-visualizar ${template.name}`" @click="openPreview(template)"><ArtPreview :composition="createCartazistaDocument({ modelId: template.id, formatId: 'a3' }).composition" :label="template.name" /></button>
            <div class="cartazista-model-content"><div><span class="cartazista-model-category">{{ template.category }}</span><h3>{{ template.name }}</h3><p>{{ template.description }}</p></div><button class="cartazista-icon-button" :aria-label="`Usar ${template.name}`" @click="openPreview(template)"><ArrowUpRight :size="20" /></button></div>
            <div class="cartazista-tags"><span v-for="tag in template.tags.slice(0, 3)" :key="tag">#{{ tag }}</span></div>
          </article>
        </section>
      </template>

      <template v-else>
        <div class="cartazista-section-heading"><div><h2>Meus cartazes</h2><span>{{ designs.length }} trabalhos salvos</span></div><button class="cartazista-button primary" @click="newBlank"><Plus :size="17" /> Novo cartaz</button></div>
        <div v-if="loading" class="cartazista-empty">Carregando seus cartazes…</div>
        <div v-else-if="!designs.length" class="cartazista-empty">Você ainda não salvou um cartaz. Comece por um dos modelos.</div>
        <section v-else class="cartazista-model-grid">
          <article v-for="design in designs" :key="design.id" class="cartazista-model-card">
            <NuxtLink class="cartazista-model-preview" :to="`/cartazista/editor/${design.id}`"><ArtPreview :composition="design.state.composition" :label="design.name" /></NuxtLink>
            <div class="cartazista-model-content"><div><span class="cartazista-model-category">{{ modelById(design.state.modelId)?.category || 'Cartaz' }}</span><h3>{{ design.name }}</h3><p>{{ design.state.products.length }} produto(s) · {{ design.state.formatId.toUpperCase() }}</p></div><NuxtLink class="cartazista-icon-button" :to="`/cartazista/editor/${design.id}`" aria-label="Abrir cartaz"><ArrowUpRight :size="20" /></NuxtLink></div>
          </article>
        </section>
      </template>

      <dialog ref="previewDialog" class="cartazista-dialog">
        <div class="cartazista-dialog-body" v-if="picked">
          <div class="cartazista-dialog-preview"><ArtPreview v-if="previewComposition" :composition="previewComposition" :label="picked.name" /></div>
          <div class="cartazista-dialog-copy"><span class="cartazista-model-category">{{ picked.category }}</span><h2>{{ picked.name }}</h2><p>{{ picked.description }}</p><ul><li>Lista de produtos colada em bloco</li><li>Validade e limite por cliente</li><li>Temas, logo e impressão A1 a A7</li></ul><div class="cartazista-dialog-actions"><button class="cartazista-button ghost" @click="previewDialog?.close()">Voltar</button><button class="cartazista-button primary" @click="start">Usar este modelo <ArrowUpRight :size="17" /></button></div></div>
        </div>
      </dialog>
    </main>
  </CartazistaShell>
</template>

<style scoped>
.cartazista-catalog { width: min(1380px, calc(100% - 36px)); margin: 0 auto; padding: 52px 0 96px; }
.cartazista-alert { border: 1px solid #b9d5f8; background: #edf6ff; color: #18579e; padding: 12px 15px; border-radius: 12px; margin-bottom: 18px; font-size: 13px; }
.cartazista-alert button, .cartazista-empty button { border: 0; background: transparent; color: inherit; font-weight: 800; cursor: pointer; text-decoration: underline; }
.cartazista-hero { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 12px 0 40px; }
.cartazista-eyebrow { display: flex; align-items: center; gap: 7px; color: #1b69ca; font-size: 12px; font-weight: 900; letter-spacing: .12em; }
.cartazista-hero h1 { max-width: 700px; margin: 11px 0 12px; font-size: clamp(34px, 5vw, 68px); line-height: .98; letter-spacing: -.06em; }
.cartazista-hero p:not(.cartazista-eyebrow) { max-width: 610px; margin: 0; color: var(--cartaz-muted); font-size: 17px; line-height: 1.5; }
.cartazista-workflow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 18px; margin-bottom: 34px; border: 1px solid #d9e6f2; border-radius: 18px; background: linear-gradient(135deg,#fff,#f3f8ff); }
.cartazista-workflow > div { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cartazista-workflow strong { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; color: #fff; background: #2780e9; flex: 0 0 auto; }
.cartazista-workflow b, .cartazista-workflow small { display: block; }.cartazista-workflow b { font-size: 14px; }.cartazista-workflow small { color: var(--cartaz-muted); font-size: 12px; margin-top: 3px; }
.cartazista-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 35px; }.cartazista-search, .cartazista-filter { display: flex; align-items: center; gap: 9px; min-height: 46px; padding: 0 14px; border: 1px solid #dbe4ed; border-radius: 12px; background: #fff; color: #8290a0; }.cartazista-search { flex: 1; }.cartazista-search input, .cartazista-filter select { border: 0; outline: 0; background: transparent; color: #314255; font: inherit; font-size: 13px; width: 100%; }.cartazista-filter select { min-width: 120px; }.cartazista-format-filter { display: flex; padding: 4px; background: #eaf0f6; border-radius: 12px; gap: 2px; }.cartazista-format-filter button { border: 0; border-radius: 9px; background: transparent; color: #778697; padding: 9px 12px; font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }.cartazista-format-filter button.selected { background: #fff; color: #1c64c1; box-shadow: 0 3px 10px #153a6310; }
.cartazista-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 0 0 18px; }.cartazista-section-heading h2 { margin: 0 0 5px; font-size: 25px; letter-spacing: -.04em; }.cartazista-section-heading span { color: var(--cartaz-muted); font-size: 13px; }.cartazista-badge { align-self: center; padding: 9px 12px; color: #1d5eaf !important; background: #e8f2ff; border-radius: 999px; font-size: 11px !important; font-weight: 800; }
.cartazista-model-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }.cartazista-model-card { min-width: 0; overflow: hidden; border: 1px solid #dfe6ed; border-radius: 17px; background: #fff; box-shadow: 0 14px 35px #14304d08; transition: transform .2s ease, box-shadow .2s ease; }.cartazista-model-card:hover { transform: translateY(-3px); box-shadow: 0 18px 42px #14304d18; }.cartazista-model-preview { display: block; border: 0; width: 100%; aspect-ratio: 842 / 1191; padding: 0; background: #edf1f4; cursor: pointer; }.cartazista-model-preview :deep(.art-preview) { display: block; width: 100%; height: 100%; }.cartazista-model-content { display: flex; align-items: start; justify-content: space-between; gap: 9px; padding: 15px 15px 8px; }.cartazista-model-category { color: #2476e8; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }.cartazista-model-content h3 { margin: 6px 0 5px; font-size: 15px; line-height: 1.15; letter-spacing: -.02em; }.cartazista-model-content p { margin: 0; color: var(--cartaz-muted); font-size: 12px; line-height: 1.35; }.cartazista-icon-button { display: grid; place-items: center; width: 35px; height: 35px; flex: 0 0 auto; border: 0; border-radius: 10px; color: #1b65c3; background: #eaf3ff; cursor: pointer; }.cartazista-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 7px 15px 16px; }.cartazista-tags span { color: #7d8c9c; background: #f1f4f7; border-radius: 999px; padding: 4px 8px; font-size: 10px; }
.cartazista-empty { padding: 55px 24px; border: 1px dashed #cddae6; border-radius: 16px; text-align: center; color: var(--cartaz-muted); background: #fff; }.cartazista-dialog { width: min(900px, calc(100% - 28px)); padding: 0; border: 0; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 90px #10233e40; }.cartazista-dialog::backdrop { background: #0d1c2c80; backdrop-filter: blur(4px); }.cartazista-dialog-body { display: grid; grid-template-columns: minmax(0, .9fr) minmax(300px, 1.1fr); background: #fff; }.cartazista-dialog-preview { min-height: 440px; padding: 28px; background: #edf3f8; }.cartazista-dialog-copy { display: flex; flex-direction: column; justify-content: center; padding: 42px; }.cartazista-dialog-copy h2 { margin: 9px 0 10px; font-size: 32px; line-height: 1.05; letter-spacing: -.05em; }.cartazista-dialog-copy p { color: var(--cartaz-muted); line-height: 1.55; }.cartazista-dialog-copy ul { padding-left: 19px; color: #52657a; font-size: 14px; line-height: 1.8; }.cartazista-dialog-actions { display: flex; justify-content: end; gap: 10px; margin-top: 18px; }
@media (max-width: 1050px) { .cartazista-model-grid { grid-template-columns: repeat(3, minmax(0,1fr)); } }
@media (max-width: 760px) { .cartazista-catalog { width: min(100% - 24px, 620px); padding-top: 30px; }.cartazista-hero { align-items: start; flex-direction: column; }.cartazista-hero h1 { font-size: 42px; }.cartazista-workflow { grid-template-columns: 1fr; }.cartazista-toolbar { flex-wrap: wrap; }.cartazista-search { min-width: 100%; }.cartazista-filter { flex: 1; }.cartazista-format-filter { flex: 1; justify-content: space-between; }.cartazista-format-filter button { flex: 1; }.cartazista-model-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }.cartazista-model-content { padding: 11px; }.cartazista-model-content h3 { font-size: 13px; }.cartazista-tags { padding: 5px 11px 11px; }.cartazista-dialog-body { grid-template-columns: 1fr; }.cartazista-dialog-preview { min-height: 360px; }.cartazista-dialog-copy { padding: 25px; } }
@media (max-width: 450px) { .cartazista-model-grid { grid-template-columns: 1fr 1fr; }.cartazista-badge { display: none; } }
</style>
