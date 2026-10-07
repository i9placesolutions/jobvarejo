<script setup lang="ts">
import { ArrowLeft, ArrowUpRight, Plus, Sparkles, RefreshCw, Send, X } from 'lucide-vue-next'
import { $fetch } from 'ofetch'
import { WORK_FORMATS, parseWorkProductList, workRequestSchema, type WorkRequest, type WorkJob, type WorkFormat } from '~/shared/work-design'
import { normalizeBusinessProfile } from '~/utils/businessProfile'
definePageMeta({ middleware: 'auth', layout: false, ssr: false })
const { getApiAuthHeaders } = useApiAuth()
const session = ref<{ allowed: boolean; databaseReady: boolean; consumerConfigured: boolean } | null>(null)
const jobs = ref<Array<Omit<WorkJob, 'lease_token' | 'lease_until' | 'owner_id' | 'source_snapshot'>>>([])
const business = ref(normalizeBusinessProfile(null))
const seals = ref<Array<{ id: string; name: string; theme: string; key: string; palette: string[] }>>([])
const selectedId = ref(''), editingId = ref(''), editingRevision = ref(0)
const selected = computed(() => jobs.value.find(j => j.id === selectedId.value))
const loading = ref(true), saving = ref(false), error = ref(''), notice = ref(''), pasted = ref(''), message = ref('')
const newRequest = (): WorkRequest => ({ name: 'Nova campanha', theme: 'Semana de Ofertas', brief: '', validity: '', conditions: '',
  palette: ['#083A9D', '#FFD215'], formats: ['stories'], products: [] })
const request = ref(newRequest())
function chooseSeal(seal: typeof seals.value[number]) {
  request.value.sealKey = seal.key; request.value.theme = seal.theme; request.value.palette = [...seal.palette]
}
const pageEstimate = computed(() => request.value.formats.map(format => ({
  label: WORK_FORMATS[format].label,
  count: request.value.productsPerPage ? Math.ceil(request.value.products.length / Math.min(format === 'stories' ? 9 : 16, request.value.productsPerPage)) : null
})))
const photoProductId = ref(''), photoQuery = ref(''), photoLoading = ref(false)
const photoCandidates = ref<Array<{ key: string; name: string }>>([])
async function searchPhotos() {
  photoLoading.value = true
  try {
    const data = await $fetch<{ images: typeof photoCandidates.value }>('/api/work-design/product-images', {
      headers: await getApiAuthHeaders(), query: { q: photoQuery.value } })
    photoCandidates.value = data.images
  } catch (e) { error.value = problem(e) } finally { photoLoading.value = false }
}
function choosePhoto(key: string) {
  const product = request.value.products.find(p => p.id === photoProductId.value)
  if (product) product.imageKey = key
  photoProductId.value = ''; idempotency = ''
}
function openPhotos(id: string, name: string) {
  photoProductId.value = id; photoQuery.value = name; photoCandidates.value = []
  if (name.trim().length > 1) searchPhotos()
}
const canQueue = computed(() => session.value?.allowed && session.value.databaseReady)
const statuses: Record<string, string> = { pending: 'Na fila', processing: 'Em criação', draft: 'Prévia disponível', completed: 'Concluído', failed: 'Precisa de atenção', cancelled: 'Cancelado' }
let poll: ReturnType<typeof setInterval> | undefined
let idempotency = ''
watch(request, () => { idempotency = '' }, { deep: true })
const problem = (e: any) => e?.data?.statusMessage || e?.message || 'Não foi possível concluir a operação.'
async function refresh() {
  if (!canQueue.value) return
  const response = await $fetch<{ jobs: typeof jobs.value }>('/api/work-design/jobs', { headers: await getApiAuthHeaders() })
  jobs.value = response.jobs
}
function reset() {
  request.value = newRequest(); editingId.value = ''; editingRevision.value = 0; idempotency = ''; selectedId.value = ''; notice.value = ''; error.value = ''
  if (seals.value[0]) chooseSeal(seals.value[0])
}
function addProduct() {
  request.value.products.push({ id: crypto.randomUUID(), name: '', price: '', unit: '' })
  idempotency = ''
}
function pasteProducts() {
  try {
    const products = parseWorkProductList(pasted.value, () => crypto.randomUUID())
    request.value.products.push(...products); pasted.value = ''; idempotency = ''
    notice.value = `${products.length} produtos acrescentados. Confira os preços e selecione as fotos.`
  } catch (e) { error.value = problem(e) }
}
function selectJob(job: typeof jobs.value[number]) { selectedId.value = job.id }
function reuse(job: typeof jobs.value[number], edit = false) {
  request.value = structuredClone(toRaw(job.request))
  if (edit) { editingId.value = job.id; editingRevision.value = job.revision }
  else {
    request.value.name = `${job.request.name.slice(0, 90)} · nova edição`
    request.value.sourceProjectId = job.result?.projectId || job.request.sourceProjectId
    editingId.value = ''; editingRevision.value = 0
  }
  idempotency = ''; notice.value = edit ? 'Altere os dados e salve uma nova revisão do pedido.' : 'Revise os produtos e a validade da nova edição.'
}
function toggleFormat(format: WorkFormat) {
  const found = request.value.formats.indexOf(format)
  if (found >= 0) request.value.formats.splice(found, 1); else request.value.formats.push(format)
  idempotency = ''
}
function addMessage() {
  if (!message.value.trim()) return
  request.value.brief = [request.value.brief, message.value.trim()].filter(Boolean).join('\n\n')
  message.value = ''; idempotency = ''; notice.value = 'Orientação adicionada ao pedido. Envie para a fila quando os dados estiverem conferidos.'
}
async function save() {
  error.value = ''; notice.value = ''
  const parsed = workRequestSchema.safeParse(request.value)
  if (!parsed.success) { error.value = parsed.error.issues.map(i => i.message).join('; '); return }
  saving.value = true
  try {
    if (editingId.value) {
      await $fetch(`/api/work-design/jobs/${editingId.value}`, { method: 'PATCH', headers: await getApiAuthHeaders(), body: { revision: editingRevision.value, request: parsed.data } })
    } else {
      if (!idempotency) idempotency = crypto.randomUUID()
      const job = await $fetch<{ id: string }>('/api/work-design/jobs', { method: 'POST', headers: await getApiAuthHeaders(), body: { idempotencyKey: idempotency, request: parsed.data } })
      selectedId.value = job.id
    }
    await refresh(); editingId.value = ''; editingRevision.value = 0
    notice.value = 'Pedido salvo na fila. O consumidor conectado poderá processar a criação.'
  } catch (e) { error.value = problem(e) } finally { saving.value = false }
}
async function cancel(job: typeof jobs.value[number]) {
  try { await $fetch(`/api/work-design/jobs/${job.id}`, { method: 'PATCH', headers: await getApiAuthHeaders(), body: { revision: job.revision, request: null } }); await refresh() }
  catch (e) { error.value = problem(e) }
}
const previewUrl = (key: string) => `/api/storage/p?key=${encodeURIComponent(key)}`
onMounted(async () => {
  try {
    session.value = await $fetch<{ allowed: boolean; databaseReady: boolean; consumerConfigured: boolean }>('/api/work-design/session', { headers: await getApiAuthHeaders() })
    if (session.value?.allowed) {
      const profile = await $fetch<{ business_profile: unknown }>('/api/profile', { headers: await getApiAuthHeaders() })
      business.value = normalizeBusinessProfile(profile.business_profile)
      const catalog = await $fetch<{ seals: typeof seals.value }>('/api/work-design/elements', { headers: await getApiAuthHeaders() })
      seals.value = catalog.seals
      if (seals.value[0]) chooseSeal(seals.value[0])
      await refresh()
      poll = setInterval(() => { if (!document.hidden) refresh().catch(e => { error.value = problem(e) }) }, 15_000)
    }
  } catch (e) { error.value = problem(e) } finally { loading.value = false }
})
onUnmounted(() => { if (poll) clearInterval(poll) })
</script>

<template>
  <main class="work-page">
    <header class="work-header">
      <NuxtLink to="/quick-editor" class="back"><ArrowLeft :size="18" /> Encartes</NuxtLink>
      <span class="pilot">EXPERIMENTAL</span>
      <div><p class="eyebrow">Criação assistida</p><h1>Encartes com IA <Sparkles :size="25" /></h1>
        <p>Seu tema, a identidade da sua loja e uma composição criada para as suas ofertas.</p></div>
      <button type="button" class="light-button" @click="reset"><Plus :size="16" /> Novo pedido</button>
    </header>
    <p v-if="loading" class="callout" role="status">Carregando sua área de criação…</p>
    <p v-else-if="!session?.allowed" class="callout">Esta área está em teste e ainda não foi liberada para sua conta.</p>
    <template v-else>
      <p v-if="!session.databaseReady" class="callout">A área está preparada. A fila ainda aguarda ativação no banco.</p>
      <p v-else-if="!session.consumerConfigured" class="callout">A fila está disponível. Configure e conecte o consumidor Work para processar os pedidos.</p>
      <p class="batch-note">Criação por lotes. Os resultados ficam salvos como novos projetos, com textos e preços editáveis.</p>
      <div class="workspace">
        <section class="brief-panel">
          <div class="section-title"><span>01</span><h2>{{ editingId ? 'Revisar pedido' : 'Prepare sua campanha' }}</h2></div>
          <label>Nome da campanha<input v-model="request.name" maxlength="110" /></label>
          <div class="field-label">Escolha o selo da campanha</div>
          <div class="seal-options"><button v-for="seal in seals" :key="seal.id" type="button" :class="{ chosen: request.sealKey === seal.key }" :aria-pressed="request.sealKey === seal.key" @click="chooseSeal(seal)"><img :src="previewUrl(seal.key)" :alt="seal.name" /><span>{{ seal.theme }}</span></button></div>
          <p class="empty-copy">O selo define o tema. Fundo, cabeçalho, etiquetas e disposição dos produtos serão compostos para este pedido, com a logo e os dados do cadastro.</p>
          <label>Validade das ofertas<input v-model="request.validity" placeholder="07 de outubro" maxlength="200" /></label>
          <label>Condições<textarea v-model="request.conditions" rows="2" placeholder="Informações fornecidas pela loja" maxlength="400" /></label>
          <div class="field-label">Formatos</div><div class="formats"><button v-for="(size, id) in WORK_FORMATS" :key="id" type="button" :class="{ chosen: request.formats.includes(id) }" @click="toggleFormat(id)">{{ size.label }}</button></div>
          <label>Produtos por página<select v-model="request.productsPerPage"><option :value="undefined">A IA decide a distribuição</option><option v-for="count in 16" :key="count" :value="count">{{ count }} {{ count === 1 ? 'produto' : 'produtos' }}</option></select></label>
          <p class="pagination-copy">{{ pageEstimate.map(p => p.count === null ? `${p.label}: páginas conforme a composição` : `${p.label}: ${p.count} página(s)`).join(' · ') }}. Story comporta até 9 produtos por página.</p>
          <details><summary>Ajustar cores da campanha</summary><div class="colors"><label v-for="(_, index) in request.palette" :key="index">Cor {{ index + 1 }}<input v-model="request.palette[index]" type="color" /></label></div></details>
          <div class="store-context"><strong>{{ business.companyName || 'Dados da loja' }}</strong><p v-for="address in business.addresses" :key="address.id">{{ address.label ? address.label + ' — ' : '' }}{{ address.value }}</p>
            <p v-for="contact in business.whatsappNumbers" :key="contact.id">{{ contact.value }}</p><NuxtLink to="/business-profile">Atualizar cadastro <ArrowUpRight :size="12" /></NuxtLink></div>
          <div class="section-title"><span>02</span><h2>Produtos conferidos</h2><button type="button" class="text-button" @click="addProduct"><Plus :size="15" /> Adicionar</button></div>
          <label>Colar lista<textarea v-model="pasted" rows="3" placeholder="COXÃO MOLE – 48,99&#10;ALMÔNDEGA BOVINA – 28,99" /></label>
          <button type="button" class="light-button" :disabled="!pasted.trim()" @click="pasteProducts">Acrescentar à lista</button>
          <div v-for="(product, index) in request.products" :key="product.id" class="product-row">
            <span>{{ String(index + 1).padStart(2, '0') }}</span><label>Produto<input v-model="product.name" maxlength="180" /></label><label>Preço<input v-model="product.price" inputmode="decimal" placeholder="48,99" /></label>
            <button type="button" :aria-label="'Remover produto ' + (index + 1)" class="remove" @click="request.products.splice(index, 1); idempotency = ''"><X :size="17" /></button>
            <div class="photo-field"><button type="button" class="text-button" @click="openPhotos(product.id, product.name)">{{ product.imageKey ? 'Trocar foto confirmada' : 'Escolher foto do produto' }}</button></div>
            <img v-if="product.imageKey" class="product-preview" :src="previewUrl(product.imageKey)" :alt="product.name" />
          </div>
          <p v-if="!request.products.length" class="empty-copy">Cole a lista ou acrescente seus produtos. A foto deve ser conferida antes da montagem.</p>
          <div class="section-title"><span>03</span><h2>Oriente a criação</h2></div>
          <label>Como você quer o encarte?<textarea v-model="request.brief" rows="4" maxlength="6000" placeholder="Cabeçalho elaborado, selo 3D em destaque, dois endereços bem distribuídos…" /></label>
          <p class="empty-copy">A IA consulta as referências internas e escolhe elementos que combinem com a campanha. Quando precisar criar uma peça nova, ela será salva na biblioteca para reutilização.</p>
          <div class="message"><input v-model="message" placeholder="Acrescente uma orientação visual" @keydown.enter.prevent="addMessage" /><button type="button" aria-label="Adicionar orientação" @click="addMessage"><Send :size="17" /></button></div>
          <small>As orientações acompanham o pedido. Para mudar produto, preço ou foto, use a lista acima.</small>
          <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="notice" role="status">{{ notice }}</p>
          <button type="button" class="primary-button" :disabled="!canQueue || saving" @click="save"><Sparkles :size="17" /> {{ saving ? 'Salvando…' : editingId ? 'Salvar revisão na fila' : 'Enviar para criação' }}</button>
        </section>
        <aside class="results-panel">
          <div class="section-title"><h2>Pedidos e versões</h2><button type="button" aria-label="Atualizar pedidos" class="text-button" @click="refresh().catch(e => error = problem(e))"><RefreshCw :size="16" /></button></div>
          <p v-if="!jobs.length" class="empty-copy">Suas campanhas aparecerão aqui. Você poderá conferir, abrir o projeto e reutilizar a lista.</p>
          <button v-for="job in jobs" :key="job.id" type="button" class="job" :class="{ selected: selectedId === job.id }" @click="selectJob(job)"><strong>{{ job.request.name }}</strong><span>{{ statuses[job.status] }} · revisão {{ job.revision }}</span><small>{{ job.request.products.length }} produtos · {{ job.request.formats.map(f => WORK_FORMATS[f].label).join(', ') }}</small></button>
          <section v-if="selected" class="selected-job"><h3>{{ selected.request.theme }}</h3><p v-if="selected.error" class="error">{{ selected.error }}</p>
            <div class="job-actions"><button type="button" class="light-button" @click="reuse(selected)">Reutilizar</button><button v-if="['pending','processing','draft','failed'].includes(selected.status)" type="button" class="light-button" @click="reuse(selected, true)">Revisar pedido</button><button v-if="['pending','processing','draft','failed'].includes(selected.status)" type="button" class="text-button" @click="cancel(selected)">Cancelar</button></div>
            <template v-if="selected.result"><div v-for="page in selected.result.pages" :key="page.id" class="art-preview"><img :src="previewUrl(page.previewKey)" :alt="'Prévia ' + WORK_FORMATS[page.format].label" /><span>{{ WORK_FORMATS[page.format].label }}</span></div>
              <NuxtLink :to="'/editor/' + selected.result.projectId" class="primary-button">Abrir projeto editável <ArrowUpRight :size="17" /></NuxtLink><small>O piloto abre no editor completo. A edição rápida depende de validação adicional de compatibilidade.</small></template>
          </section>
        </aside>
      </div>
    </template>
    <div v-if="photoProductId" class="photo-modal" role="dialog" aria-modal="true" aria-labelledby="photo-title" @click.self="photoProductId = ''">
      <section><div class="section-title"><h2 id="photo-title">Confira a foto do produto</h2><button type="button" aria-label="Fechar seleção" @click="photoProductId = ''"><X :size="20" /></button></div>
        <div class="message"><input v-model="photoQuery" aria-label="Buscar foto por nome" @keydown.enter.prevent="searchPhotos" /><button type="button" aria-label="Buscar fotos" @click="searchPhotos"><RefreshCw :size="17" /></button></div>
        <p v-if="photoLoading" class="empty-copy">Buscando na biblioteca…</p><p v-else-if="!photoCandidates.length" class="empty-copy">Nenhuma foto encontrada. Ajuste o nome da busca ou cadastre a imagem na biblioteca de produtos.</p>
        <div class="photo-options"><button v-for="candidate in photoCandidates" :key="candidate.key" type="button" @click="choosePhoto(candidate.key)"><img :src="previewUrl(candidate.key)" :alt="candidate.name" /><span>{{ candidate.name }}</span></button></div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.seal-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin:12px 0}.seal-options button{border:2px solid #dce5f2;border-radius:14px;padding:12px;background:#f4f7fd;text-align:center;transition:border-color .15s}.seal-options .chosen{border-color:#234ee2;background:#eef3ff}.seal-options img{width:100%;height:110px;object-fit:contain}.seal-options span{display:block;font-size:12px;font-weight:700;margin-top:8px}.seal-options button:focus-visible{outline:2px solid #234ee2;outline-offset:3px}select{background:#f9fbfe;border:1px solid #dbe3ef;border-radius:10px;padding:11px;color:#183553;font-size:13px}.pagination-copy{font-size:11px;color:#6b7b94;margin:0 0 18px}details{margin-bottom:18px}summary{font-size:12px;color:#50627e;cursor:pointer;margin-bottom:12px}
.work-page{min-height:100vh;background:#f2f5fa;color:#172c4d;font-family:'Plus Jakarta Sans',sans-serif;padding:32px clamp(16px,4vw,64px)}
.work-header{max-width:1450px;margin:auto;display:flex;align-items:center;gap:18px;flex-wrap:wrap}.back{display:flex;align-items:center;gap:8px;color:#315075;text-decoration:none}.pilot{font-size:10px;letter-spacing:.12em;font-weight:800;background:#ffdf56;padding:6px 10px;border-radius:8px}.work-header>div{flex:1;min-width:270px}.eyebrow{font-size:11px;text-transform:uppercase;color:#5576a5;letter-spacing:.16em;margin:0}.work-header h1{display:flex;align-items:center;gap:12px;font-size:34px;font-weight:800;letter-spacing:-.04em;margin:5px 0}.work-header p:last-child{color:#6b7b94;font-size:13px}.batch-note,.callout{max-width:1450px;margin:22px auto;font-size:13px;color:#5a6f8f}.callout{padding:16px 20px;border:1px solid #f1d479;background:#fff9dc;border-radius:14px}.workspace{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:24px;max-width:1450px;margin:auto;align-items:start}.brief-panel,.results-panel{background:#fff;border:1px solid #dce4ef;border-radius:24px;padding:26px;box-shadow:0 12px 32px #233c6110}.section-title{display:flex;align-items:center;gap:10px;margin:10px 0 18px}.section-title h2{font-size:17px;letter-spacing:-.025em;font-weight:800;flex:1}.section-title>span{font-size:11px;font-weight:800;color:#305cd8;background:#edf2ff;border-radius:9px;padding:8px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:700;color:#50627e;margin-bottom:14px}input:not([type=color]),textarea{width:100%;background:#f9fbfe;border:1px solid #dbe3ef;border-radius:10px;padding:11px;color:#183553;font-size:13px;font-weight:500}input:focus,textarea:focus{outline:2px solid #98b5ff;outline-offset:1px}textarea{resize:vertical}.field-label{font-size:12px;font-weight:700;color:#50627e}.formats{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 20px}.formats button{font-size:12px;border:1px solid #d7e1ee;padding:9px 15px;border-radius:10px}.formats .chosen{background:#183e9a;border-color:#183e9a;color:#fff}.colors{display:flex;gap:20px}.colors input{height:32px;width:64px;cursor:pointer}.store-context{padding:17px;background:#f0f5ff;border-radius:13px;margin-bottom:24px;font-size:12px}.store-context p{margin:7px 0;color:#536c8b}.store-context a{display:flex;gap:6px;align-items:center;color:#315cb1;margin-top:10px}.primary-button,.light-button,.text-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;font-size:12px;font-weight:700;border-radius:11px;text-decoration:none}.primary-button{background:#234ee2;color:#fff;padding:13px 20px;width:100%;margin-top:20px}.light-button{background:#eef3fb;color:#35577d;padding:10px 14px}.text-button{color:#355eb5;padding:6px}button:disabled{opacity:.5;cursor:default}.product-row{display:grid;grid-template-columns:24px minmax(0,1fr) 100px 26px;gap:10px;align-items:center;padding:15px 0;border-bottom:1px solid #e7edf5}.product-row>span{font-size:11px;font-weight:800;color:#90a2b9}.product-row label{margin-bottom:0}.product-row .photo-field{grid-column:2/4;font-size:10px;font-weight:500}.product-preview{grid-column:2;max-height:65px;max-width:100px;object-fit:contain}.remove{color:#96a5ba}.message{display:flex;gap:8px}.message button{background:#edf2ff;color:#234ee2;width:42px;border-radius:10px}small,.empty-copy{display:block;color:#7b8ba1;font-size:11px;line-height:1.6;margin-top:10px}.empty-copy{padding:15px 0}.job{width:100%;display:flex;text-align:left;flex-direction:column;gap:6px;border:1px solid #dce5f2;border-radius:13px;padding:17px;margin:10px 0;background:#fbfcfe}.job.selected{background:#edf3ff;border-color:#86a5f2}.job strong{font-size:14px}.job span{font-size:11px;color:#486795}.job small{margin:0}.selected-job{margin-top:24px;padding-top:18px;border-top:1px solid #dce5f2}.selected-job h3{font-size:17px;font-weight:800}.job-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.art-preview{position:relative;margin:18px 0;border-radius:14px;overflow:hidden;background:#e9eff9}.art-preview img{max-height:640px;width:100%;object-fit:contain}.art-preview span{position:absolute;left:12px;top:12px;padding:6px 9px;background:white;border-radius:8px;font-size:11px}.error{color:#a32137;background:#fff0f3;padding:12px;border-radius:10px;font-size:12px}.notice{color:#1b7067;background:#ecfaf6;padding:12px;border-radius:10px;font-size:12px}@media(max-width:950px){.workspace{grid-template-columns:1fr}.results-panel{order:-1}.work-header h1{font-size:28px}}@media(max-width:500px){.brief-panel,.results-panel{padding:18px}.two-col{grid-template-columns:1fr}.product-row{grid-template-columns:20px minmax(0,1fr) 80px 20px}.work-page{padding:20px 12px}}
</style>
<style scoped>
.photo-modal{position:fixed;inset:0;z-index:80;background:#10213c99;display:grid;place-items:center;padding:20px}.photo-modal>section{background:#fff;border-radius:22px;padding:24px;width:min(780px,100%);max-height:85vh;overflow:auto}.photo-options{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:20px}.photo-options button{border:1px solid #dce5f2;border-radius:12px;padding:14px;text-align:center;font-size:11px;color:#4a607c}.photo-options img{width:100%;height:125px;object-fit:contain;margin-bottom:10px}.product-row .photo-field{grid-column:2/4}
</style>
