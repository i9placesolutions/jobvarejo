<script setup lang="ts">
import {
  Search,
  ArrowUpRight,
  Plus,
  SlidersHorizontal,
  X,
  Layers,
  Heart,
  Sparkles
} from 'lucide-vue-next'
import ArtShell from '~/components/art-studio/ArtShell.vue'
import ArtPreview from '~/components/art-studio/ArtPreview.vue'
import {
  ART_FORMATS,
  type ArtTemplate,
  type ArtDesign
} from '~/types/art-studio'
import { artError, resizeArt } from '~/utils/art-studio/composition'
definePageMeta({ layout: false, middleware: 'auth', ssr: false })
useHead({ title: 'Estúdio de Artes • JobVarejo' })
const route = useRoute(),
  auth = useAuth()
const active = computed(() =>
  route.query.tab === 'mine'
    ? 'mine'
    : route.query.tab === 'admin' && auth.isSuperAdmin.value
      ? 'admin'
      : 'catalog'
)
const templates = ref<ArtTemplate[]>([]),
  designs = ref<ArtDesign[]>([]),
  loading = ref(true),
  error = ref(''),
  databaseReady = ref(true)
const search = ref(''),
  category = ref('Todos'),
  collection = ref(''),
  format = ref('all'),
  picked = ref<ArtTemplate | null>(null),
  dialog = ref<HTMLDialogElement>()
const chosenSizes = ref<string[]>(['1080x1350'])
const selectedSize = ref('1080x1350'),
  personalizedName = ref('')
const categories = computed(() => [
  'Todos',
  ...new Set(templates.value.map((t) => t.category))
])
const collections = computed(() => [
  ...new Set(templates.value.map((t) => t.collection).filter(Boolean))
])
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
const visible = computed(() =>
  templates.value.filter(
    (t) =>
      (category.value === 'Todos' || t.category === category.value) &&
      (!collection.value || t.collection === collection.value) &&
      normalize(
        [t.name, t.category, t.collection, ...t.tags].join(' ')
      ).includes(normalize(search.value)) &&
      (format.value === 'all' ||
        (format.value === 'square'
          ? t.composition.width === t.composition.height
          : format.value === 'portrait'
            ? t.composition.width < t.composition.height
            : t.composition.width > t.composition.height))
  )
)
const filteredDesigns = computed(() =>
  designs.value.filter((d) =>
    normalize(d.name).includes(normalize(search.value))
  )
)
let request = 0
const load = async () => {
  const version = ++request
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{
      templates: ArtTemplate[]
      databaseReady: boolean
    }>('/api/art-studio/templates', {
      query: active.value === 'admin' ? { admin: '1' } : {}
    })
    if (version !== request) return
    templates.value = result.templates
    databaseReady.value = result.databaseReady
    if (active.value === 'mine')
      designs.value = await $fetch<ArtDesign[]>('/api/art-studio/designs')
  } catch (e) {
    if (version === request) error.value = artError(e)
  } finally {
    if (version === request) loading.value = false
  }
}
watch(active, () => {
  search.value = ''
  category.value = 'Todos'
  collection.value = ''
  void load()
})
onMounted(load)
const preview = async (template: ArtTemplate) => {
  picked.value = template
  selectedSize.value = `${template.composition.width}x${template.composition.height}`
  chosenSizes.value = [
    `${template.composition.width}x${template.composition.height}`,
    ...(template.composition.alternates || []).map(
      (p) => `${p.width}x${p.height}`
    )
  ]
  personalizedName.value = template.name
  await nextTick()
  dialog.value?.showModal()
}
const previewComposition = computed(() => {
  if (!picked.value) return null
  const [w, h] = selectedSize.value.split('x').map(Number)
  return resizeArt(picked.value.composition, w!, h!)
})
const start = () => {
  if (!picked.value) return
  dialog.value?.close()
  navigateTo({
    path: '/art-studio/editor/new',
    query: {
      template: picked.value.id,
      size: selectedSize.value,
      sizes: chosenSizes.value.join(','),
      name: personalizedName.value
    }
  })
}
</script>
<template>
  <ArtShell :active="active">
    <main class="art-catalog">
      <div v-if="error" role="alert" class="art-alert">
        {{ error }} <button @click="load">Tentar novamente</button>
      </div>
      <div v-if="!databaseReady" class="art-alert" role="status">
        Os modelos estão disponíveis para explorar. Configure o banco do Estúdio
        de Artes para salvar trabalhos e enviar imagens.
      </div>
      <section class="catalog-hero">
        <div>
          <p class="eyebrow">CRIATIVIDADE PARA O SEU NEGÓCIO</p>
          <h1>
            {{
              active === 'mine'
                ? 'Suas ideias, sempre por perto.'
                : active === 'admin'
                  ? 'Um acervo com a sua assinatura.'
                  : 'Uma boa ideia começa aqui.'
            }}
          </h1>
          <p class="hero-description">
            {{
              active === 'mine'
                ? 'Continue de onde parou. Suas artes e suas possibilidades.'
                : active === 'admin'
                  ? 'Crie, organize e publique modelos com elementos editáveis.'
                  : 'Escolha um design. Coloque a sua marca. Faça do seu jeito.'
            }}
          </p>
        </div>
        <NuxtLink
          :to="
            active === 'admin'
              ? '/art-studio/editor/new?manage=1'
              : '/art-studio/editor/new'
          "
          class="art-button primary"
          ><Plus :size="17" />{{
            active === 'admin' ? 'Criar modelo' : 'Criar do zero'
          }}</NuxtLink
        >
      </section>
      <div class="catalog-search">
        <Search :size="22" /><input
          v-model="search"
          type="search"
          :placeholder="
            active === 'mine'
              ? 'Buscar minhas artes…'
              : 'O que vamos criar hoje? Busque por tema, data ou ocasião…'
          "
          aria-label="Buscar designs"
        /><span>ENCONTRE SUA PRÓXIMA IDEIA</span>
      </div>
      <template v-if="active !== 'mine'">
        <div class="category-tabs" aria-label="Categorias">
          <button
            v-for="item in categories"
            :key="item"
            :class="{ selected: category === item }"
            :aria-pressed="category === item"
            @click="
              category = item;
              collection = ''
            "
          >
            {{ item }}
          </button>
        </div>
        <section
          v-if="!search && category === 'Todos' && active === 'catalog'"
          class="collections"
        >
          <div class="section-heading">
            <h2>Coleções para inspirar</h2>
            <span>Ideias reunidas para cada momento</span>
          </div>
          <div class="collection-grid">
            <button
              v-for="(item, i) in collections.slice(0, 4)"
              :key="item"
              :class="[
                'collection-card',
                `tone-${i}`,
                { chosen: collection === item }
              ]"
              @click="collection = collection === item ? '' : item"
            >
              <span class="collection-icon"
                ><Heart v-if="i === 0" /><Sparkles v-else-if="i === 1" /><Layers
                  v-else /></span
              ><span
                ><small>EXPLORE A COLEÇÃO</small
                ><strong>{{ item }}</strong></span
              ><ArrowUpRight :size="23" />
            </button>
          </div>
        </section>
        <div class="section-heading results-heading">
          <div>
            <h2>
              {{
                collection ||
                (active === 'admin'
                  ? 'Biblioteca de modelos'
                  : 'Encontre o seu próximo design')
              }}
            </h2>
            <span
              >{{ visible.length }} modelos · textos, cores e imagens
              editáveis</span
            >
          </div>
          <div class="format-filter">
            <button
              v-if="collection"
              class="art-button"
              @click="collection = ''"
            >
              Limpar coleção <X :size="14" /></button
            ><SlidersHorizontal :size="15" /><select
              v-model="format"
              aria-label="Filtrar formato"
            >
              <option value="all">Todos os formatos</option>
              <option value="square">Quadrado</option>
              <option value="portrait">Vertical</option>
              <option value="landscape">Horizontal</option>
            </select>
          </div>
        </div>
      </template>
      <div v-if="loading" role="status" class="art-empty">
        Carregando seus designs…
      </div>
      <div v-else-if="active === 'mine'" class="design-grid">
        <NuxtLink
          v-for="design in filteredDesigns"
          :key="design.id"
          :to="`/art-studio/editor/${design.id}`"
          class="design-card"
          ><div class="design-image">
            <ArtPreview
              :composition="design.composition"
              :label="design.name"
            /><span class="card-action"
              >Continuar editando <ArrowUpRight :size="16"
            /></span>
          </div>
          <strong>{{ design.name }}</strong
          ><small>{{
            design.updated_at
              ? new Date(design.updated_at).toLocaleDateString('pt-BR')
              : ''
          }}</small></NuxtLink
        >
        <div v-if="!filteredDesigns.length" class="art-empty">
          {{
            search
              ? 'Nenhuma arte corresponde à busca.'
              : 'Sua primeira arte começa com uma ideia. Escolha um design ou crie do zero.'
          }}
        </div>
      </div>
      <div v-else class="design-grid">
        <article v-for="item in visible" :key="item.id" class="design-card">
          <button
            class="design-image"
            :aria-label="`Visualizar ${item.name}`"
            @click="preview(item)"
          >
            <ArtPreview
              :composition="item.composition"
              :label="item.name"
            /><span class="editable-badge">{{
              item.published ? 'EDITÁVEL' : 'RASCUNHO'
            }}</span
            ><span class="card-action"
              >Personalizar design <ArrowUpRight :size="16"
            /></span>
          </button>
          <div class="card-caption">
            <div>
              <strong>{{ item.name }}</strong
              ><small>{{ item.category }}</small>
            </div>
            <NuxtLink
              v-if="active === 'admin'"
              :to="{
                path: '/art-studio/editor/new',
                query: { template: item.id, manage: '1' }
              }"
              class="manage-link"
              >Editar modelo</NuxtLink
            ><ArrowUpRight v-else :size="17" />
          </div>
        </article>
        <div v-if="!visible.length" class="art-empty">
          Nenhum design encontrado. Experimente outro tema ou categoria.
        </div>
      </div>
      <footer class="catalog-footer">
        <span>Feito para a sua marca. Criado por você.</span
        ><span>ESTÚDIO DE ARTES · JOBVAREJO</span>
      </footer>
    </main>
    <dialog
      ref="dialog"
      class="art-template-dialog"
      @click="
        (event) => {
          if (event.target === dialog) dialog?.close()
        }
      "
    >
      <div v-if="picked && previewComposition" class="template-detail">
        <div class="detail-preview">
          <ArtPreview :composition="previewComposition" :label="picked.name" />
        </div>
        <section>
          <button
            class="detail-close art-button"
            aria-label="Fechar prévia"
            @click="dialog?.close()"
          >
            <X :size="18" />
          </button>
          <p class="eyebrow">DESIGN EDITÁVEL</p>
          <h2>{{ picked.name }}</h2>
          <p>
            Troque textos, fontes, cores, imagens e logo. Cada elemento pode ser
            movido e personalizado.
          </p>
          <label
            >Nome da sua arte<input
              v-model="personalizedName"
              maxlength="150"
              class="art-input" /></label
          ><label
            >Formato<select v-model="selectedSize" class="art-input">
              <option value="1080x1350">Feed vertical · 1080 × 1350</option>
              <option value="1080x1080">Quadrado · 1080 × 1080</option>
              <option value="1080x1920">Stories · 1080 × 1920</option>
              <option value="1920x1080">Horizontal · 1920 × 1080</option>
              <option value="794x1123">A4 · 794 × 1123</option>
            </select></label
          >
          <fieldset class="format-checks">
            <legend>Formatos para criar juntos</legend>
            <label v-for="size in ART_FORMATS" :key="size.id"
              ><input
                v-model="chosenSizes"
                type="checkbox"
                :value="`${size.width}x${size.height}`"
              />{{ size.label }}</label
            >
          </fieldset>
          <button
            class="art-button primary"
            :disabled="!chosenSizes.length"
            @click="start"
          >
            Usar este design <ArrowUpRight :size="17" /></button
          ><small>Confira a composição ao mudar de formato.</small>
        </section>
      </div>
    </dialog>
  </ArtShell>
</template>
<style scoped>
.format-checks {
  border: 0;
  padding: 0;
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.format-checks legend {
  margin-bottom: 8px;
}
.format-checks label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}
.format-checks input {
  accent-color: #315d42;
}

.art-catalog {
  max-width: 1600px;
  margin: auto;
  padding: 42px 4vw 0;
}
.catalog-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 10px 0 32px;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 2px;
  font-weight: 700;
  color: #7b896e;
  margin: 0 0 14px;
}
h1 {
  font-size: clamp(30px, 3vw, 45px);
  line-height: 1.15;
  letter-spacing: -1.7px;
  font-weight: 600;
  margin: 0;
}
.hero-description {
  color: #7d887e;
  font-size: 17px;
  margin-top: 12px;
}
.catalog-search {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1px solid #dce3d6;
  border-radius: 12px;
  padding: 18px 22px;
  color: #6a7a68;
}
.catalog-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  font-size: 16px;
  outline: none;
}
.catalog-search span {
  font-size: 9px;
  letter-spacing: 1.3px;
  color: #8b9586;
}
.category-tabs {
  display: flex;
  gap: 8px;
  overflow: auto;
  padding: 22px 0 34px;
}
.category-tabs button {
  white-space: nowrap;
  padding: 10px 19px;
  border-radius: 25px;
  border: 1px solid #dce2d7;
  color: #677863;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
}
.category-tabs button.selected {
  background: #254f39;
  color: white;
  border-color: #254f39;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin: 0 0 17px;
}
.section-heading h2 {
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.4px;
  margin: 0;
}
.section-heading span {
  font-size: 12px;
  color: #83907f;
}
.collection-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.collection-card {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 25px 20px;
  min-height: 112px;
}
.collection-card.chosen {
  border-color: #254f39;
}
.collection-card > svg {
  margin-left: auto;
  flex-shrink: 0;
}
.collection-icon {
  width: 42px;
  height: 42px;
  border: 1px solid #65795230;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.collection-card small {
  display: block;
  font-size: 8px;
  letter-spacing: 1.2px;
  margin-bottom: 7px;
}
.collection-card strong {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.1;
  display: block;
}
.tone-0 {
  background: #edf1df;
  color: #586a38;
}
.tone-1 {
  background: #f1e8ee;
  color: #83667e;
}
.tone-2 {
  background: #f8ecd7;
  color: #8c744a;
}
.tone-3 {
  background: #e7eef0;
  color: #607e86;
}
.results-heading {
  margin-top: 40px;
}
.results-heading > div > span {
  display: block;
  margin-top: 7px;
}
.format-filter {
  display: flex;
  align-items: center;
  gap: 10px;
}
.format-filter select {
  background: transparent;
  font: inherit;
  font-size: 12px;
  border: 0;
  color: #73806e;
}
.design-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 30px 24px;
}
.design-card {
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.design-image {
  display: block;
  position: relative;
  width: 100%;
  aspect-ratio: 4/5;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #203a3010;
  background: #e8ece3;
  padding: 0;
}
.design-image :deep(svg) {
  object-fit: contain;
}
.editable-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  font-size: 8px;
  letter-spacing: 1.1px;
  color: #3b5745;
  background: #ffffffde;
  padding: 6px 9px;
  border-radius: 5px;
}
.card-action {
  position: absolute;
  bottom: 14px;
  left: 14px;
  right: 14px;
  background: #ffffffee;
  border-radius: 8px;
  padding: 12px;
  color: #234333;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 0;
  transform: translateY(5px);
  transition:
    opacity 0.15s,
    transform 0.15s;
}
.design-image:hover .card-action,
.design-image:focus-visible .card-action {
  opacity: 1;
  transform: translateY(0);
}
.card-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 13px;
  gap: 8px;
}
.design-card strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
}
.design-card small {
  display: block;
  color: #87907f;
  font-size: 11px;
  margin-top: 5px;
}
.manage-link {
  font-size: 11px;
  color: #306744;
}
.catalog-footer {
  margin-top: 55px;
  padding: 24px 0;
  border-top: 1px solid #dce2d7;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #8b9586;
}
.catalog-footer span:last-child {
  font-size: 9px;
  letter-spacing: 1px;
}
.art-template-dialog {
  border: 0;
  border-radius: 20px;
  padding: 0;
  max-width: 900px;
  width: 92vw;
  background: #fff;
  color: #203c30;
  max-height: 90vh;
}
.art-template-dialog::backdrop {
  background: #17291e99;
  backdrop-filter: blur(4px);
}
.template-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.detail-preview {
  padding: 28px;
  background: #edf0e8;
  max-height: 80vh;
}
.detail-preview :deep(svg) {
  max-height: 70vh;
}
.template-detail section {
  padding: 48px 30px 30px;
  position: relative;
}
.detail-close {
  position: absolute;
  top: 12px;
  right: 12px;
}
.template-detail h2 {
  font-size: 30px;
  line-height: 1.1;
  font-weight: 600;
}
.template-detail p:not(.eyebrow) {
  font-size: 14px;
  color: #788478;
  line-height: 1.6;
  margin: 18px 0;
}
.template-detail label {
  display: block;
  font-size: 13px;
  margin: 18px 0;
}
.template-detail label input,
.template-detail label select {
  margin-top: 8px;
}
.template-detail section > button.primary {
  width: 100%;
  margin-top: 18px;
}
.template-detail small {
  display: block;
  color: #87917e;
  font-size: 11px;
  margin-top: 12px;
}
@media (min-width: 1500px) {
  .design-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
@media (max-width: 1050px) {
  .collection-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .design-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .catalog-search span {
    display: none;
  }
}
@media (max-width: 700px) {
  .art-catalog {
    padding: 26px 20px 0;
  }
  .catalog-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .design-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
  .collection-card {
    padding: 18px 12px;
    gap: 8px;
  }
  .collection-card strong {
    font-size: 13px;
  }
  .collection-icon {
    display: none;
  }
  .section-heading > span {
    display: none;
  }
  .section-heading h2 {
    font-size: 18px;
  }
  .card-action {
    display: none;
  }
  .template-detail {
    grid-template-columns: 1fr;
  }
  .detail-preview {
    max-height: 34vh;
  }
  .detail-preview :deep(svg) {
    max-height: 28vh;
  }
  .catalog-footer {
    gap: 15px;
  }
  .catalog-search input {
    font-size: 14px;
  }
  .format-filter > svg {
    display: none;
  }
}
</style>
