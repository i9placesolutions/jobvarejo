import { pgQuery } from '../postgres'
import { extractStorageKeyFromRef } from '~/utils/storageRef'
import { isLegacyUserProjectKey, isUserProjectKey, isValidStoragePath, normalizeStoragePath } from '../storage-scope'

/**
 * Encartes que já estão salvos na conta do cliente (public.projects).
 *
 * Este módulo só lê projetos do próprio dono (user_id = dono da conversa,
 * is_template = false). A conversa guarda apenas IDs; toda leitura posterior
 * volta ao banco filtrando pelo dono, nunca confia no estado salvo.
 */

export type AccountProjectSummary = {
  id: string
  name: string
  updatedAt: string
  createdAt?: string
  /** Tema/categoria do modelo e das páginas, usados só para a busca. */
  themes: string[]
  pageNames: string[]
  pageCount: number
  /** Miniatura já validada como arquivo deste dono. */
  thumbnailKey?: string
}

export type AccountProjectChoice = { projectId: string; name: string; updatedAt?: string }

export type AccountProjectState = {
  /** Último encarte da conta escolhido; fica para os próximos pedidos. */
  projectId?: string
  projectName?: string
  /** Opções numeradas apresentadas na última busca. */
  choices?: AccountProjectChoice[]
  awaitingChoice?: boolean
  /** Geração assíncrona das páginas em PNG (chamada de generate/encarte). */
  job?: { token: string; projectId: string; until: string; started?: string }
  deliveredAt?: string
}

export type AccountProjectQuery = {
  terms: string[]
  latest: boolean
  dateRange?: { from: string; to: string; label: string }
}

export type AccountProjectSelection =
  | { kind: 'empty' }
  | { kind: 'direct'; project: AccountProjectSummary }
  | { kind: 'choose'; projects: AccountProjectSummary[]; unmatched: boolean; dateRelaxed: boolean }

export const MAX_ACCOUNT_PROJECT_CHOICES = 5
export const MAX_ACCOUNT_PROJECT_PAGES = 10
const LIST_LIMIT = 40

const normalize = (value: unknown): string => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

const MATERIAL = /\b(?:encartes?|tabloides?|panfletos?|folhetos?|artes?|ofertas?)\b/
const REQUEST_VERB = /\b(?:manda|mande|mandar|me manda|envia|envie|enviar|reenvia|reenvie|reenviar|quero|queria|preciso|precisava|passa|me passa|me da|cade|pega|pegar|busca|buscar|procura|procurar|acha|achar|traz|traga|tem como|consegue|abre|abrir)\b/
// Referência a algo já existente na conta: “que fiz”, “na minha conta”, “o último”, “aquele”, “de ontem”.
const EXISTING_REFERENCE = new RegExp([
  String.raw`\bque (?:eu |a gente |voce |voces )?(?:ja )?(?:fiz|fizemos|criei|criamos|montei|montamos|salvei|editei|fez|fizeram|tinha feito|deixei)\b`,
  String.raw`\b(?:esta|ta|estao|tao|ficou|ficaram|salvos?|guardados?|tenho|tem)\b.{0,12}\b(?:na|no|da|do) (?:minha |meu )?(?:conta|painel|sistema|site|editor|job varejo|jobvarejo)\b`,
  String.raw`\b(?:na|da) minha conta\b`,
  String.raw`\b(?:ultimo|ultima|ultimos|ultimas|mais recente)\b`,
  String.raw`\b(?:aquele|aquela|aqueles|aquelas)\b`,
  String.raw`\b(?:de|do|feito|fiz|criado|criei) (?:ontem|anteontem|hoje|semana passada)\b`,
  String.raw`\bja (?:feito|pronto|esta feito|ta feito)\b`,
  String.raw`\b(?:meus|minhas) (?:encartes|tabloides|panfletos|artes)\b`
].join('|'))
// Pedido para criar material novo; não é busca na conta.
const CREATE_NEW = /\b(?:faz|faca|fazer|cria|crie|criar|monta|monte|montar|gera|gere|gerar)\b.{0,24}\b(?:um|uma|novo|nova|outro|outra)\b|\b(?:novo|nova|outro|outra) (?:encarte|arte|tabloide|panfleto)\b|\b(?:quero|queria|preciso|precisava) (?:de )?(?:um|uma) (?:novo |nova )?(?:encarte|arte|tabloide|panfleto)\b/

/** Pedido do encarte já feito na conta (“me manda o encarte de terça e quarta que fiz ontem”). */
export function isAccountProjectRequest(text: string): boolean {
  const normalized = normalize(text)
  if (!normalized || normalized.length > 240) return false
  if (!MATERIAL.test(normalized) || !REQUEST_VERB.test(normalized)) return false
  if (CREATE_NEW.test(normalized)) return false
  return EXISTING_REFERENCE.test(normalized)
}

/** Aceita a classificação do modelo só quando a mensagem fala de um material e não pede criação. */
export function isPlausibleAccountProjectRequest(text: string): boolean {
  const normalized = normalize(text)
  return Boolean(normalized) && normalized.length <= 240 && MATERIAL.test(normalized) && !CREATE_NEW.test(normalized)
}

const STOPWORDS = new Set(`
a o as os um uma uns umas de do da dos das e ou em no na nos nas pra pro para por com sem que se me mim meu minha meus minhas
eu voce voces ele ela a gente ja aqui la isso esse essa este esta esses essas aquele aquela aqueles aquelas tal
manda mande mandar envia envie enviar reenvia reenvie reenviar quero queria preciso precisava passa da dar cade pega pegar busca buscar procura procurar
acha achar traz traga tem como consegue abre abrir pode poderia favor pf por favor obrigado obrigada oi ola bom boa tarde noite
fiz fizemos criei criamos montei montamos salvei editei fez fizeram feito feita tinha deixei criado criada pronto pronta
esta ta estao tao ficou ficaram salvo salvos salva guardado guardados conta painel sistema site editor job varejo jobvarejo
encarte encartes tabloide tabloides panfleto panfletos folheto folhetos arte artes material
ultimo ultima ultimos ultimas recente mais anterior passado passada semana ontem anteontem hoje agora
imagem png arquivo foto versao
`.split(/\s+/).filter(Boolean))

const saoPauloDate = (date: Date): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date)
const shiftDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000)

/** Extrai termos de busca e referência de data/recência; não cria filtros que a pessoa não disse. */
export function parseAccountProjectQuery(text: string, now = new Date()): AccountProjectQuery {
  const normalized = normalize(text).replace(/\b(?:bom dia|boa tarde|boa noite)\b/g, ' ')
  const latest = /\b(?:ultimo|ultima|mais recente)\b/.test(normalized)
  let dateRange: AccountProjectQuery['dateRange']
  if (/\banteontem\b/.test(normalized)) {
    const day = saoPauloDate(shiftDays(now, -2)); dateRange = { from: day, to: day, label: 'anteontem' }
  } else if (/\bontem\b/.test(normalized)) {
    const day = saoPauloDate(shiftDays(now, -1)); dateRange = { from: day, to: day, label: 'ontem' }
  } else if (/\bhoje\b/.test(normalized)) {
    const day = saoPauloDate(now); dateRange = { from: day, to: day, label: 'hoje' }
  } else if (/\bsemana passada\b/.test(normalized)) {
    dateRange = { from: saoPauloDate(shiftDays(now, -14)), to: saoPauloDate(shiftDays(now, -7)), label: 'semana passada' }
  } else if (/\b(?:essa|esta|nessa|nesta) semana\b/.test(normalized)) {
    dateRange = { from: saoPauloDate(shiftDays(now, -6)), to: saoPauloDate(now), label: 'esta semana' }
  }
  const terms = [...new Set(normalized.split(' ').filter(word => (word.length >= 3 || /^\d+$/.test(word)) && !STOPWORDS.has(word)))].slice(0, 8)
  return { terms, latest, ...(dateRange ? { dateRange } : {}) }
}

const stem = (word: string): string => word.length > 4 ? word.replace(/(?:oes|aes|es|s)$/, '') : word
const wordMatches = (word: string, term: string): boolean =>
  word === term || stem(word) === stem(term) || (term.length >= 5 && word.startsWith(term)) || (word.length >= 5 && term.startsWith(word))

const projectWords = (project: AccountProjectSummary): string[] =>
  normalize([project.name, ...project.themes, ...project.pageNames].join(' ')).split(' ').filter(Boolean)

/** Quantos termos da busca aparecem no nome, tema ou páginas do projeto. */
export function scoreAccountProject(project: AccountProjectSummary, terms: readonly string[]): number {
  const words = projectWords(project)
  return terms.filter(term => words.some(word => wordMatches(word, term))).length
}

const inRange = (value: string | undefined, range: NonNullable<AccountProjectQuery['dateRange']>): boolean => {
  if (!value) return false
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return false
  const day = saoPauloDate(new Date(time))
  return day >= range.from && day <= range.to
}

/** Escolhe direto quando um único projeto é claro; senão devolve opções numeradas. */
export function selectAccountProjects(projects: readonly AccountProjectSummary[], query: AccountProjectQuery): AccountProjectSelection {
  if (!projects.length) return { kind: 'empty' }
  const byRecent = [...projects].sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
  const dated = query.dateRange ? byRecent.filter(project => inRange(project.updatedAt, query.dateRange!) || inRange(project.createdAt, query.dateRange!)) : byRecent
  const dateRelaxed = Boolean(query.dateRange && !dated.length)
  const pool = dated.length ? dated : byRecent
  if (query.terms.length) {
    const scored = pool.map(project => ({ project, score: scoreAccountProject(project, query.terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || (Date.parse(b.project.updatedAt) || 0) - (Date.parse(a.project.updatedAt) || 0))
    if (!scored.length) {
      // Data dita mas sem nome correspondente: mostra os do período; senão, os mais recentes.
      return { kind: 'choose', projects: pool.slice(0, MAX_ACCOUNT_PROJECT_CHOICES), unmatched: true, dateRelaxed }
    }
    const top = scored[0]!.score
    const best = scored.filter(item => item.score === top)
    if (best.length === 1 && (top === query.terms.length || scored.length === 1)) return { kind: 'direct', project: best[0]!.project }
    if (best.length > 1 && query.latest) return { kind: 'direct', project: best[0]!.project }
    const options = (best.length > 1 ? best : scored).slice(0, MAX_ACCOUNT_PROJECT_CHOICES).map(item => item.project)
    return options.length === 1 ? { kind: 'direct', project: options[0]! } : { kind: 'choose', projects: options, unmatched: false, dateRelaxed }
  }
  if (query.latest || pool.length === 1) return { kind: 'direct', project: pool[0]! }
  return { kind: 'choose', projects: pool.slice(0, MAX_ACCOUNT_PROJECT_CHOICES), unmatched: false, dateRelaxed }
}

const ORDINALS: Record<string, number> = { primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3, quarto: 4, quarta: 4, quinto: 5, quinta: 5 }

/**
 * Resposta à lista numerada: “2”, “o segundo”, “opção 3” ou o nome de uma única opção.
 * Retorna o índice (1..n) ou undefined quando a mensagem não escolhe uma opção.
 */
export function accountProjectChoiceNumber(text: string, choices: readonly AccountProjectChoice[]): number | undefined {
  const normalized = normalize(text)
  if (!normalized || normalized.length > 80) return undefined
  const numeric = normalized.match(/^(?:(?:quero|manda|mande|envia|envie|pode ser|e)\s+)?(?:(?:o|a)\s+)?(?:(?:opcao|numero|n|encarte|esse|este)\s+)?(\d{1,2})(?:\s*o)?$/)
  if (numeric) {
    const number = Number(numeric[1])
    return number >= 1 && number <= choices.length ? number : undefined
  }
  const ordinal = normalized.match(/^(?:(?:quero|manda|mande|envia|envie|pode ser|e)\s+)?(?:(?:o|a)\s+)?(primeir[oa]|segund[oa]|terceir[oa]|quart[oa]|quint[oa])(?:\s+(?:opcao|encarte|ai|mesmo))?$/)
  if (ordinal) {
    const number = ORDINALS[ordinal[1]!]
    return number && number <= choices.length ? number : undefined
  }
  // Nome citado que identifica uma única opção apresentada.
  const terms = parseAccountProjectQuery(text).terms
  if (!terms.length) return undefined
  const matches = choices.flatMap((choice, index) => scoreAccountProject({ id: choice.projectId, name: choice.name, updatedAt: '', themes: [], pageNames: [], pageCount: 0 }, terms) > 0 ? [index + 1] : [])
  return matches.length === 1 ? matches[0] : undefined
}

export const formatAccountProjectDate = (value?: string): string => {
  const time = Date.parse(String(value || ''))
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(time))
}

/** Chave de storage de uma referência salva no projeto (chave crua, /api/storage/p?key=, URL do Wasabi). */
export function storageKeyFromRef(raw: unknown, opts: { bucket?: string; endpoint?: string } = {}): string | null {
  const value = String(raw ?? '').trim()
  if (!value || value.startsWith('data:')) return null
  const extracted = extractStorageKeyFromRef(value, opts)
  if (extracted) return normalizeStoragePath(extracted)
  if (/[?&]key=/.test(value)) {
    try {
      const key = new URL(value, 'http://local').searchParams.get('key')
      return key ? normalizeStoragePath(key) : null
    } catch { return null }
  }
  if (/^[a-z0-9-]+\//i.test(value.replace(/^\/+/, '')) && !/^[a-z]+:/i.test(value)) return normalizeStoragePath(value)
  return null
}

/** Miniatura só é aceita quando pertence à pasta de projetos deste dono. */
export function ownedThumbnailKey(ownerId: string, refs: readonly unknown[], opts: { bucket?: string; endpoint?: string } = {}): string | undefined {
  for (const ref of refs) {
    const key = storageKeyFromRef(ref, opts)
    if (!key || !isValidStoragePath(key) || !/\.(?:png|jpe?g|webp)$/i.test(key)) continue
    if (isUserProjectKey(key, ownerId) || isLegacyUserProjectKey(key, ownerId) || key.startsWith(`whatsapp-creation/${ownerId}/`)) return key
  }
  return undefined
}

const runtimeStorageOptions = (): { bucket?: string; endpoint?: string } => {
  try {
    const config = useRuntimeConfig()
    return { bucket: String(config.wasabiBucket || ''), endpoint: String(config.wasabiEndpoint || '') }
  } catch {
    return {}
  }
}

/** Encartes da própria conta, mais recentes primeiro. Nunca lê modelos nem projetos de outra conta. */
export async function listAccountProjects(ownerId: string): Promise<AccountProjectSummary[]> {
  const rows = (await pgQuery<any>(`
    select project.id, project.name, project.created_at, project.updated_at, project.preview_url,
      project.template_config ->> 'category' as category,
      project.template_config ->> 'subcategory' as subcategory,
      project.template_config ->> 'theme' as theme,
      project.template_config ->> 'themeName' as theme_name,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', page.value ->> 'name',
          'theme', coalesce(page.value ->> 'templateThemeName', page.value ->> 'templateThemeId'),
          'model', page.value ->> 'templateModelName',
          'thumbnail', coalesce(page.value ->> 'thumbnailUrl', page.value ->> 'thumbnail_url')
        ) order by page.ordinality), '[]'::jsonb)
        from jsonb_array_elements(case
          when jsonb_typeof(project.canvas_data) = 'array' then project.canvas_data
          when jsonb_typeof(project.canvas_data -> 'pages') = 'array' then project.canvas_data -> 'pages'
          else '[]'::jsonb end) with ordinality as page(value, ordinality)
      ) as pages
    from public.projects project
    where project.user_id = $1 and coalesce(project.is_template, false) = false
    order by project.updated_at desc nulls last
    limit ${LIST_LIMIT}`, [ownerId])).rows
  const opts = runtimeStorageOptions()
  return rows.map(row => {
    const pages: any[] = Array.isArray(row.pages) ? row.pages : []
    const thumbnailKey = ownedThumbnailKey(ownerId, [pages[0]?.thumbnail, row.preview_url], opts)
    return {
      id: String(row.id),
      name: String(row.name || 'Encarte sem nome').slice(0, 120),
      updatedAt: new Date(row.updated_at || row.created_at || 0).toISOString(),
      ...(row.created_at ? { createdAt: new Date(row.created_at).toISOString() } : {}),
      themes: [row.category, row.subcategory, row.theme, row.theme_name, ...pages.flatMap(page => [page?.theme, page?.model])]
        .map(value => String(value || '').trim()).filter(Boolean).slice(0, 20),
      pageNames: pages.map(page => String(page?.name || '').trim()).filter(Boolean).slice(0, 20),
      pageCount: pages.length,
      ...(thumbnailKey ? { thumbnailKey } : {})
    }
  })
}

/** Confirma que o projeto continua sendo um encarte desta conta. */
export async function findOwnedAccountProject(ownerId: string, projectId: string): Promise<{ id: string; name: string } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(projectId || ''))) return null
  const row = (await pgQuery<any>(`select id, name from public.projects
    where id = $1 and user_id = $2 and coalesce(is_template, false) = false limit 1`, [projectId, ownerId])).rows[0]
  return row ? { id: String(row.id), name: String(row.name || 'Encarte') } : null
}

/** Prefixo exclusivo dos PNGs entregues de um encarte da conta. */
export const accountProjectArtifactPrefix = (ownerId: string, projectId: string): string =>
  `whatsapp-creation/${ownerId}/account-projects/${projectId}/`
