<script setup lang="ts">
import { Search, Plus, ArrowUpRight, Sparkles, SlidersHorizontal, Layers, Check, Printer, FileText, LayoutGrid } from 'lucide-vue-next'
import AdminWorkspaceShell from '~/components/AdminWorkspaceShell.vue'
import ArtPreview from '~/components/cartazista/CartazistaPreview.vue'
import { cartazistaSample } from '~/utils/cartazista/samples'
import type { CartazistaHeader } from '~/types/cartazista'
import CartazistaShell from '~/components/cartazista/CartazistaShell.vue'
import type { CartazistaDesign, CartazistaModel, CartazistaTemplateSummary } from '~/types/cartazista'
import { createCartazistaDocument } from '~/utils/cartazista/composition'

definePageMeta({ layout: false, middleware: 'auth', ssr: false })
useHead({ title: 'Cartazes de oferta • JobVarejo' })

const auth = useAuth()
const route = useRoute()
const active = computed<'catalog' | 'mine'>(() => route.query.tab === 'mine' ? 'mine' : 'catalog')
const templates = ref<CartazistaTemplateSummary[]>([])
const headers = ref<CartazistaHeader[]>([])
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

const previewComposition = computed(() => picked.value ? cartazistaSample(picked.value.id, headers.value) : null)
const samples = computed(() => Object.fromEntries(templates.value.map(t=>[t.id,cartazistaSample(t.id,headers.value)])))

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ templates: CartazistaTemplateSummary[]; databaseReady: boolean }>('/api/cartazista/templates')
    templates.value = result.templates
    headers.value = (await $fetch<{ headers: CartazistaHeader[] }>('/api/cartazista/headers')).headers
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

const newBlank = () => void navigateTo('/cartazista/editor/new?blank=1')
const modelById = (id: string) => templates.value.find((template) => template.id === id) || templates.value[0]
</script>

<template>
  <AdminWorkspaceShell active-nav="cartazista">
    <CartazistaShell :active="active" :embedded="true">
      <main class="cartazista-catalog">
        <div v-if="error" class="cartazista-alert" role="alert">
          {{ error }} <button @click="load">Tentar novamente</button>
        </div>
        <div v-if="!databaseReady" class="cartazista-alert info" role="status">
          Os modelos iniciais estão disponíveis. A migração do catálogo persistido ainda não foi aplicada.
        </div>

        <!-- Hero Section com estilo refinado do painel admin -->
        <section class="cartazista-hero-card">
          <div class="cartazista-hero-bg-glow" aria-hidden="true" />
          <div class="cartazista-hero-content">
            <div class="cartazista-eyebrow">
              <Sparkles :size="14" class="text-blue-500" />
              <span>CARTAZES DE OFERTA DO JOBVAREJO</span>
            </div>
            <h1>{{ active === 'mine' ? 'Seus cartazes, sempre prontos para imprimir.' : 'Cartazes profissionais prontos para a loja.' }}</h1>
            <p>{{ active === 'mine' ? 'Reabra um cartaz salvo, atualize os preços ou produtos e imprima na hora em qualquer tamanho.' : 'Escolha o modelo de preço, cole sua lista de ofertas e imprima de A1 a A7 em folhas A4 ou no tamanho real.' }}</p>

            <div class="cartazista-hero-actions">
              <button class="cartazista-btn primary" @click="newBlank">
                <Plus :size="18" /> Criar cartaz do zero
              </button>
              <span class="cartazista-hero-pill">
                <Check :size="14" class="text-emerald-500" /> A1 a A7 · Paisagem ou Retrato
              </span>
            </div>
          </div>
        </section>

        <!-- Etapas do Workflow (visual elegante com sombras suaves) -->
        <section v-if="active === 'catalog'" class="cartazista-workflow" aria-label="Como criar um cartaz">
          <div class="cartazista-step-item">
            <div class="cartazista-step-badge">1</div>
            <div class="cartazista-step-copy">
              <b>Escolha o modelo</b>
              <small>Preço simples, atacarejo, clube ou gôndola</small>
            </div>
          </div>
          <div class="cartazista-step-item">
            <div class="cartazista-step-badge">2</div>
            <div class="cartazista-step-copy">
              <b>Cole a lista</b>
              <small>Uma linha por produto com preço e unidade</small>
            </div>
          </div>
          <div class="cartazista-step-item">
            <div class="cartazista-step-badge">3</div>
            <div class="cartazista-step-copy">
              <b>Confira e imprima</b>
              <small>PDF em folhas A4 agrupadas ou tamanho real</small>
            </div>
          </div>
        </section>

        <!-- Toolbar de Busca e Filtros estilo Admin -->
        <section class="cartazista-toolbar">
          <div class="cartazista-search">
            <Search :size="17" class="cartazista-search-icon" />
            <input v-model="search" type="search" placeholder="Buscar por tipo de cartaz ou produto…" aria-label="Buscar modelos" />
          </div>

          <div class="cartazista-filter-group">
            <div class="cartazista-filter">
              <SlidersHorizontal :size="15" class="text-slate-400" />
              <select v-model="category" aria-label="Filtrar por categoria">
                <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
              </select>
            </div>

            <div class="cartazista-format-tabs" role="group" aria-label="Filtrar por formato">
              <button :class="{ active: format === 'all' }" @click="format = 'all'">Todos</button>
              <button :class="{ active: format === 'portrait' }" @click="format = 'portrait'">Retrato</button>
              <button :class="{ active: format === 'landscape' }" @click="format = 'landscape'">Paisagem</button>
            </div>
          </div>
        </section>

        <!-- Grade de Modelos (Catálogo) -->
        <template v-if="active === 'catalog'">
          <div class="cartazista-section-heading">
            <div>
              <h2>Modelos disponíveis</h2>
              <p>{{ visibleTemplates.length }} modelos para diferentes tipos de campanha e área de loja</p>
            </div>
            <div class="cartazista-badge-capsule">
              <Printer :size="13" />
              <span>A1 · A2 · A3 · A4 · A5 · A6 · A7 · Faixas</span>
            </div>
          </div>

          <div v-if="loading" class="cartazista-empty">
            <p>Carregando modelos de cartaz…</p>
          </div>
          <div v-else-if="!visibleTemplates.length" class="cartazista-empty">
            <p>Nenhum modelo combina com os filtros aplicados.</p>
            <button class="cartazista-btn ghost" @click="search = ''; category = 'Todos'; format = 'all'">Limpar filtros</button>
          </div>
          <section v-else class="cartazista-model-grid">
            <article v-for="template in visibleTemplates" :key="template.id" class="cartazista-card">
              <button class="cartazista-card-preview" :aria-label="`Pré-visualizar ${template.name}`" @click="openPreview(template)">
                <ArtPreview :composition="samples[template.id]!" :label="template.name" />
                <div class="cartazista-card-hover-action" aria-hidden="true">
                  <span>Ver detalhes e usar</span>
                </div>
              </button>
              <div class="cartazista-card-body">
                <div class="cartazista-card-meta">
                  <span class="cartazista-card-tag">{{ template.category }}</span>
                  <button class="cartazista-card-btn" :aria-label="`Usar ${template.name}`" @click="openPreview(template)">
                    <ArrowUpRight :size="17" />
                  </button>
                </div>
                <h3>{{ template.name }}</h3>
                <p>{{ template.description }}</p>
                <div class="cartazista-card-footer-tags">
                  <span v-for="tag in template.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
                </div>
              </div>
            </article>
          </section>
        </template>

        <!-- Meus Cartazes Salvos -->
        <template v-else>
          <div class="cartazista-section-heading">
            <div>
              <h2>Meus cartazes</h2>
              <p>{{ designs.length }} trabalhos salvos nesta conta</p>
            </div>
            <button class="cartazista-btn primary" @click="newBlank">
              <Plus :size="16" /> Novo cartaz
            </button>
          </div>

          <div v-if="loading" class="cartazista-empty">
            <p>Carregando seus cartazes…</p>
          </div>
          <div v-else-if="!designs.length" class="cartazista-empty">
            <FileText :size="38" class="text-slate-300 mx-auto mb-2" />
            <p>Você ainda não tem cartazes salvos.</p>
            <small class="text-slate-400">Comece escolhendo um modelo pronto no catálogo ou crie um modelo em branco.</small>
            <div class="mt-4">
              <NuxtLink to="/cartazista" class="cartazista-btn primary">
                Explorar catálogo
              </NuxtLink>
            </div>
          </div>
          <section v-else class="cartazista-model-grid">
            <article v-for="design in designs" :key="design.id" class="cartazista-card">
              <NuxtLink class="cartazista-card-preview" :to="`/cartazista/editor/${design.id}`">
                <ArtPreview :composition="design.state.composition" :label="design.name" />
                <div class="cartazista-card-hover-action" aria-hidden="true">
                  <span>Abrir no editor</span>
                </div>
              </NuxtLink>
              <div class="cartazista-card-body">
                <div class="cartazista-card-meta">
                  <span class="cartazista-card-tag">{{ modelById(design.state.modelId)?.category || 'Cartaz' }}</span>
                  <NuxtLink class="cartazista-card-btn" :to="`/cartazista/editor/${design.id}`" aria-label="Abrir cartaz">
                    <ArrowUpRight :size="17" />
                  </NuxtLink>
                </div>
                <h3>{{ design.name }}</h3>
                <p>{{ design.state.products.length }} produto(s) · Formato {{ design.state.formatId.toUpperCase() }}</p>
              </div>
            </article>
          </section>
        </template>

        <!-- Modal de Pré-visualização do Modelo -->
        <dialog ref="previewDialog" class="cartazista-modal">
          <div v-if="picked" class="cartazista-modal-grid">
            <div class="cartazista-modal-left">
              <ArtPreview v-if="previewComposition" :composition="previewComposition" :label="picked.name" />
            </div>
            <div class="cartazista-modal-right">
              <div>
                <span class="cartazista-card-tag">{{ picked.category }}</span>
                <h2>{{ picked.name }}</h2>
                <p class="cartazista-modal-desc">{{ picked.description }}</p>
                <div class="cartazista-modal-features">
                  <div class="feature-item"><Check :size="15" class="text-emerald-500" /> Lista de produtos colada em bloco</div>
                  <div class="feature-item"><Check :size="15" class="text-emerald-500" /> Preço com centavos, unidade e limite por cliente</div>
                  <div class="feature-item"><Check :size="15" class="text-emerald-500" /> Cabeçalhos de campanha e logo da sua loja</div>
                  <div class="feature-item"><Check :size="15" class="text-emerald-500" /> Impressão direta de A1 a A7 ou folhas A4</div>
                </div>
              </div>
              <div class="cartazista-modal-actions">
                <button type="button" class="cartazista-btn ghost" @click="previewDialog?.close()">Cancelar</button>
                <button type="button" class="cartazista-btn primary" @click="start">
                  Usar este modelo <ArrowUpRight :size="17" />
                </button>
              </div>
            </div>
          </div>
        </dialog>
      </main>
    </CartazistaShell>
  </AdminWorkspaceShell>
</template>

<style scoped>
.cartazista-catalog {
  width: min(1440px, calc(100% - 48px));
  margin: 0 auto;
  padding: 32px 0 80px;
}

/* Alertas */
.cartazista-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-radius: 14px;
  margin-bottom: 24px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.cartazista-alert.info {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.cartazista-alert button {
  border: 0;
  background: transparent;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* Hero Card (padrão JobVarejo admin) */
.cartazista-hero-card {
  position: relative;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--jv-border, rgba(190, 211, 233, 0.76));
  border-radius: 24px;
  padding: 36px 40px;
  margin-bottom: 28px;
  box-shadow: 0 10px 30px rgba(26, 68, 113, 0.04);
}

.cartazista-hero-bg-glow {
  position: absolute;
  top: -50px;
  right: -50px;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%);
  pointer-events: none;
}

.cartazista-hero-content {
  position: relative;
  z-index: 1;
  max-width: 820px;
}

.cartazista-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 999px;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin-bottom: 16px;
}

.cartazista-hero-card h1 {
  font-size: clamp(26px, 3.2vw, 40px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #16375f;
  margin: 0 0 12px;
}

.cartazista-hero-card p {
  font-size: 15px;
  line-height: 1.6;
  color: #475569;
  margin: 0 0 24px;
  max-width: 700px;
}

.cartazista-hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.cartazista-hero-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

/* Workflow Steps */
.cartazista-workflow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.cartazista-step-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: #ffffff;
  border: 1px solid var(--jv-line, #d7e4f1);
  border-radius: 18px;
  box-shadow: 0 4px 14px rgba(26, 68, 113, 0.025);
}

.cartazista-step-badge {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 800;
  font-size: 15px;
  flex-shrink: 0;
  border: 1px solid #dbeafe;
}

.cartazista-step-copy b {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: #16375f;
}

.cartazista-step-copy small {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* Toolbar de Busca e Filtros */
.cartazista-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}

.cartazista-search {
  flex: 1;
  min-width: 280px;
  position: relative;
  display: flex;
  align-items: center;
}

.cartazista-search-icon {
  position: absolute;
  left: 14px;
  color: #94a3b8;
  pointer-events: none;
}

.cartazista-search input {
  width: 100%;
  height: 44px;
  padding: 0 16px 0 42px;
  border: 1px solid #dbe7f5;
  border-radius: 14px;
  background: #ffffff;
  font-size: 13px;
  color: #1e293b;
  box-shadow: 0 2px 6px rgba(26, 68, 113, 0.02);
  transition: all 0.15s ease;
  outline: none;
}

.cartazista-search input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.cartazista-filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cartazista-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #dbe7f5;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(26, 68, 113, 0.02);
}

.cartazista-filter select {
  border: 0;
  outline: 0;
  background: transparent;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cartazista-format-tabs {
  display: flex;
  padding: 4px;
  background: rgba(235, 243, 252, 0.8);
  border: 1px solid #dbe7f5;
  border-radius: 14px;
  gap: 3px;
}

.cartazista-format-tabs button {
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cartazista-format-tabs button.active {
  background: #ffffff;
  color: #1d4ed8;
  box-shadow: 0 2px 8px rgba(29, 78, 216, 0.1);
}

/* Headings e Badges */
.cartazista-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 0 0 20px;
}

.cartazista-section-heading h2 {
  font-size: 20px;
  font-weight: 800;
  color: #16375f;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}

.cartazista-section-heading p {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.cartazista-badge-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
}

/* Grid de Modelos & Cards */
.cartazista-model-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

.cartazista-card {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(26, 68, 113, 0.04);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease;
}

.cartazista-card:hover {
  transform: translateY(-4px);
  border-color: #93c5fd;
  box-shadow: 0 16px 36px rgba(29, 78, 216, 0.1);
}

.cartazista-card-preview {
  position: relative;
  display: block;
  border: 0;
  width: 100%;
  aspect-ratio: 842 / 1191;
  padding: 0;
  background: #f1f5f9;
  cursor: pointer;
  overflow: hidden;
}

.cartazista-card-preview :deep(.art-preview) {
  display: block;
  width: 100%;
  height: 100%;
}

.cartazista-card-hover-action {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.cartazista-card-preview:hover .cartazista-card-hover-action {
  opacity: 1;
}

.cartazista-card-hover-action span {
  padding: 8px 16px;
  background: #ffffff;
  color: #0f172a;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

.cartazista-card-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.cartazista-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cartazista-card-tag {
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.cartazista-card-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 0;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.cartazista-card-btn:hover {
  background: #2563eb;
  color: #ffffff;
}

.cartazista-card-body h3 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 700;
  color: #16375f;
  line-height: 1.25;
}

.cartazista-card-body p {
  margin: 0 0 12px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.45;
  flex: 1;
}

.cartazista-card-footer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: auto;
}

.cartazista-card-footer-tags span {
  font-size: 10px;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 500;
}

/* Empty State */
.cartazista-empty {
  padding: 64px 24px;
  border: 2px dashed #cbd5e1;
  border-radius: 20px;
  text-align: center;
  background: #ffffff;
  color: #64748b;
}

.cartazista-empty p {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 12px;
}

/* Modal Dialog */
.cartazista-modal {
  width: min(940px, calc(100% - 32px));
  padding: 0;
  border: 0;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
}

.cartazista-modal::backdrop {
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
}

.cartazista-modal-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr);
  background: #ffffff;
}

.cartazista-modal-left {
  padding: 28px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e2e8f0;
}

.cartazista-modal-right {
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
}

.cartazista-modal-right h2 {
  font-size: 26px;
  font-weight: 800;
  color: #16375f;
  margin: 10px 0 8px;
  line-height: 1.15;
}

.cartazista-modal-desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.55;
  margin: 0 0 20px;
}

.cartazista-modal-features {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.cartazista-modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid #f1f5f9;
}

/* Botões Globais desta página */
.cartazista-btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.15s ease;
}

.cartazista-btn.primary {
  color: white;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
}

.cartazista-btn.primary:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35);
  transform: translateY(-1px);
}

.cartazista-btn.ghost {
  color: #475569;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}

.cartazista-btn.ghost:hover {
  background: #f8fafc;
  color: #0f172a;
}

/* Responsividade */
@media (max-width: 1180px) {
  .cartazista-model-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .cartazista-catalog {
    width: min(100% - 32px, 640px);
    padding: 24px 0 60px;
  }
  .cartazista-hero-card {
    padding: 24px 20px;
  }
  .cartazista-workflow {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .cartazista-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .cartazista-filter-group {
    flex-direction: column;
    align-items: stretch;
  }
  .cartazista-format-tabs {
    justify-content: space-between;
  }
  .cartazista-format-tabs button {
    flex: 1;
  }
  .cartazista-model-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .cartazista-modal-grid {
    grid-template-columns: 1fr;
  }
  .cartazista-modal-left {
    min-height: 280px;
  }
  .cartazista-modal-right {
    padding: 24px;
  }
}

@media (max-width: 480px) {
  .cartazista-model-grid {
    grid-template-columns: 1fr;
  }
}
</style>
