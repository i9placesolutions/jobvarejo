<script setup lang="ts">
import {
  ArrowDown, ArrowLeft, Ban, Bell, BellOff, Check, CheckCheck,
  Circle, Download, File as FileIcon, Image, LoaderCircle, MessageCircle, Mic, MoreHorizontal,
  Paperclip, Pin, Search, Send, Settings2, Smile, Square, Users, Video, X
} from 'lucide-vue-next'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })

type JsonRecord = Record<string, any>
type Parameter = { name: string; in: 'path' | 'query' | string; required?: boolean; schema?: JsonRecord; description?: string }
type Operation = {
  id: string; summary?: string; tags?: string[]; method: string; path: string
  bodySchema?: JsonRecord; parameters?: Parameter[]; example?: any
  adminTokenRequired?: boolean; available?: boolean; disabledReason?: string
}
type Chat = JsonRecord & { _id: string; _name: string; _lastText: string; _unread: number; _group: boolean; _archived: boolean; _pinned: boolean }
type Message = JsonRecord & { _id: string; _text: string; _fromMe: boolean; _timestamp: number }

const auth = useAuth()
const operations = ref<Operation[]>([])
const apiVersion = ref('')
const provider = ref<{ configured: boolean | null; instance?: JsonRecord; error?: string }>({ configured: null })
const statusLoaded = ref(false)
const chats = ref<Chat[]>([])
const messages = ref<Message[]>([])
const mediaDownloads = reactive<Record<string, { url?: string; busy?: boolean; error?: string }>>({})
const activeChat = ref<Chat | null>(null)
const chatOffset = ref(0)
const messageOffset = ref(0)
const chatPageSize = 50
const messagePageSize = 50
const hasMoreChats = ref(true)
const hasMoreMessages = ref(false)
const selectedFilter = ref<'all' | 'unread' | 'groups' | 'archived'>('all')
const searchText = ref('')
const searchInput = ref('')
const isLoadingChats = ref(false)
const isLoadingMessages = ref(false)
const isSending = ref(false)
const composerText = ref('')
const attachedFile = ref<File | null>(null)
const recordedAudio = ref(false)
const recording = ref(false)
const recordingError = ref('')
const replyTo = ref<Message | null>(null)
const connectionState = ref<'connecting' | 'connected' | 'reconnecting' | 'unavailable'>('connecting')
const presence = ref('')
const presenceByChat = reactive<Record<string, string>>({})
const error = ref('')
const notice = ref('')
const resourcesOpen = ref(false)
const resourceSearch = ref('')
const selectedOperationId = ref('')
const resourceBody = ref<JsonRecord>({})
const resourceSchemaVariant = ref(0)
const resourceQuery = ref<JsonRecord>({})
const resourcePath = ref<JsonRecord>({})
const resourceBusy = ref(false)
const resourceResult = ref<any>(null)
const resourceError = ref('')
const imageViewer = ref<HTMLDialogElement | null>(null)
const viewedImage = ref<{ url: string; caption: string } | null>(null)
const openImageViewer = async (url: string, caption = '') => {
  if (!url) return
  viewedImage.value = { url, caption }
  await nextTick()
  imageViewer.value?.showModal()
}
const closeImageViewer = () => { imageViewer.value?.close(); viewedImage.value = null }
const detailsOpen = ref(false)
const detailsData = ref<any>(null)
const chatMenuOpen = ref(false)
const messageMenuId = ref('')
const emojiMenuId = ref('')
const moreActionsId = ref('')
const liveEvents = ref<Array<{ id: number; at: number; type: string; payload: any }>>([])
const mobileChatOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const messageArea = ref<HTMLElement | null>(null)
const mediaRecorder = shallowRef<MediaRecorder | null>(null)
const recordingStream = shallowRef<MediaStream | null>(null)
let mediaChunks: Blob[] = []
let discardRecording = false
let recordingSession = 0
let eventSource: EventSource | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let chatController: AbortController | null = null
let messageController: AbortController | null = null
let chatRequestSequence = 0
let messageRequestSequence = 0
let previousConnectionState: typeof connectionState.value = 'connecting'
let realtimeErrors = 0

const errText = (cause: any, fallback: string) => String(cause?.data?.statusMessage || cause?.data?.message || cause?.message || fallback)
const getOperation = (id: string) => operations.value.find(operation => operation.id === id)
const safeJson = (value: unknown) => {
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return value }
  }
  return value
}
const firstValue = (source: JsonRecord, keys: string[], fallback: any = ''): any => {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}
const truthy = (value: any) => value === true || value === 1 || value === 'true' || value === '1'
const unwrapArray = (data: any, keys: string[]): any[] => {
  const value = safeJson(data)
  if (Array.isArray(value)) return value
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key]
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.items)) return value.items
  return []
}
const chatIdentity = (chat: JsonRecord) => String(firstValue(chat, ['wa_chatid', 'chatid', 'id', 'wa_id', 'jid', 'number', 'phone', 'wa_fastid']))
const failedProfileImages = reactive<Record<string, string>>({})
const getChatProfileImage = (chat: JsonRecord) => {
  const raw = String(firstValue(chat, ['imagePreview', 'image', 'profilePicUrl', 'profilePictureUrl', 'picture', 'avatar'], ''))
  try {
    return new URL(raw).protocol === 'https:' && failedProfileImages[chat._id] !== raw ? raw : ''
  } catch { return '' }
}
const onProfileImageError = (chat: JsonRecord) => { failedProfileImages[chat._id] = getChatProfileImage(chat) }
const normalizeChat = (raw: JsonRecord): Chat => {
  const id = chatIdentity(raw)
  const last = raw?.wa_lastMsg || raw?.lastMessage || raw?.last_message || raw?.wa_lastMessage || {}
  return {
    ...raw,
    _id: id,
    _name: String(firstValue(raw, ['wa_contactName', 'wa_name', 'name', 'pushName', 'notify', 'short'])) || id,
    _lastText: String(firstValue(raw, ['wa_lastMessageTextVote', 'wa_lastMsgText', 'lastMessageText', 'last_message_text', 'text', 'conversation'], firstValue(last, ['text', 'body', 'conversation'], ''))),
    _unread: Number(firstValue(raw, ['wa_unreadCount', 'wa_unread', 'unreadCount', 'unread_count', 'unread'], 0)) || 0,
    _group: truthy(firstValue(raw, ['wa_isGroup', 'isGroup', 'is_group'], false)) || id.endsWith('@g.us'),
    _archived: truthy(firstValue(raw, ['wa_archived', 'archived'], false)),
    _pinned: truthy(firstValue(raw, ['wa_isPinned', 'pinned', 'isPinned'], false))
  }
}
const messageIdentity = (message: JsonRecord) => String(firstValue(message, ['id', 'messageid', 'messageId', 'keyId', 'stanzaId', 'wa_messageid']))
const normalizeMessage = (raw: JsonRecord): Message => {
  const key = raw?.key || raw?.message?.key || {}
  const body = raw?.message?.message || raw?.message || raw?.content || raw
  const text = firstValue(raw, ['text', 'body', 'conversation', 'caption'], firstValue(body, ['conversation', 'text', 'caption'], firstValue(body?.extendedTextMessage, ['text'], '')))
  const tsRaw = firstValue(raw, ['messageTimestamp', 'timestamp', 'wa_timestamp', 'time', 't'], firstValue(key, ['messageTimestamp'], 0))
  const numericTimestamp = typeof tsRaw === 'number' || /^\d+$/.test(String(tsRaw)) ? Number(tsRaw) : NaN
  const ts = Number.isFinite(numericTimestamp) ? (numericTimestamp < 100000000000 ? numericTimestamp * 1000 : numericTimestamp) : (Date.parse(String(tsRaw)) || 0)
  return {
    ...raw,
    _id: messageIdentity(raw) || messageIdentity(key),
    _text: String(text || ''),
    _fromMe: truthy(firstValue(raw, ['fromMe', 'from_me', 'wa_fromMe'], firstValue(key, ['fromMe'], false))),
    _timestamp: ts
  }
}
const isReactionMessage = (message: Message) => /reaction/i.test(String(message.messageType || message.type || ''))
const shortMessageId = (id: unknown) => String(id || '').split(':').pop() || ''
const reactionTarget = (message: Message) => shortMessageId(message.reaction || message.content?.key?.ID || message.content?.key?.id || message.content?.reactionMessage?.key?.id)
const visibleMessages = computed(() => messages.value.filter(message => !isReactionMessage(message)))
const reactionDetails = ref<Message | null>(null)
const reactionsByMessage = computed(() => {
  const latest = new Map<string, Message>()
  for (const reaction of [...messages.value].sort((a, b) => a._timestamp - b._timestamp)) {
    if (!isReactionMessage(reaction)) continue
    const target = reactionTarget(reaction)
    if (target) latest.set(`${target}:${reaction._fromMe ? 'me' : reaction.sender || reaction.sender_pn || 'contact'}`, reaction)
  }
  const result: Record<string, Array<{ emoji: string; fromMe: boolean; name: string }>> = {}
  for (const reaction of latest.values()) {
    const emoji = String(reaction.content?.text ?? reaction._text ?? '')
    if (emoji) (result[reactionTarget(reaction)] ||= []).push({ emoji, fromMe: reaction._fromMe, name: reaction._fromMe ? 'Você' : reaction.senderName || 'Contato' })
  }
  return result
})
const getMessageReactions = (message: Message) => reactionsByMessage.value[shortMessageId(message.messageid || message._id)] || []
const goToQuotedMessage = (message: Message) => {
  const context = message.content?.contextInfo || message.contextInfo || {}
  const target = shortMessageId(message.quoted || context.stanzaID || context.stanzaId || message.replyid)
  const original = messages.value.find(item => shortMessageId(item.messageid || item._id) === target)
  const element = original ? messageArea.value?.querySelector(`[data-message-id="${CSS.escape(original._id)}"]`) : null
  if (element) { element.scrollIntoView({ behavior: 'smooth', block: 'center' }); element.animate([{ backgroundColor: '#bcebd0' }, { backgroundColor: 'transparent' }], { duration: 1200 }) }
  else notice.value = 'Carregue as mensagens anteriores para localizar a mensagem original.'
}
const getQuotedMessageText = (message: Message) => {
  const context = message.content?.contextInfo || message.contextInfo || message.message?.contextInfo || {}
  const target = shortMessageId(message.quoted || context.stanzaID || context.stanzaId || message.replyid)
  const original = target ? messages.value.find(item => shortMessageId(item.messageid || item._id) === target) : undefined
  if (original) return original._text || getMessageFallback(original)
  const quoted = context.quotedMessage || message.quotedMessage || message.replyMessage
  if (quoted) return String(quoted.conversation || quoted.text || quoted.body || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || 'Mídia')
  return target ? 'Resposta a uma mensagem anterior' : ''
}
const selectedChatOperation = (id: string) => getOperation(id)
const callOperation = async (operationId: string, body?: JsonRecord, query?: JsonRecord, pathParams?: JsonRecord, signal?: AbortSignal) => {
  const operation = selectedChatOperation(operationId)
  if (!operation) throw new Error(`A operação ${operationId} não está disponível no catálogo da UAZAPI.`)
  if (operation.available === false) throw new Error(operation.disabledReason || 'Esta operação está indisponível nesta instância.')
  return await $fetch<any>('/api/admin/whatsapp/execute', {
    method: 'POST',
    body: { operationId, ...(body ? { body } : {}), ...(query ? { query } : {}), ...(pathParams ? { pathParams } : {}) },
    signal
  })
}

const loadCatalogAndStatus = async () => {
  error.value = ''
  const [catalogResult, statusResult] = await Promise.allSettled([
    $fetch<any>('/api/admin/whatsapp/catalog'),
    $fetch<any>('/api/admin/whatsapp/status')
  ])
  if (catalogResult.status === 'fulfilled') {
    operations.value = Array.isArray(catalogResult.value?.operations) ? catalogResult.value.operations : []
    apiVersion.value = String(catalogResult.value?.version || '')
  } else {
    error.value = errText(catalogResult.reason, 'Não foi possível carregar o catálogo UAZAPI.')
  }
  if (statusResult.status === 'fulfilled') {
    provider.value = statusResult.value || { configured: false }
    statusLoaded.value = true
    if (provider.value.error && !error.value) error.value = provider.value.error
  } else {
    provider.value = { configured: null }
    error.value ||= errText(statusResult.reason, 'Não foi possível verificar o status da instância.')
  }
}

const loadChats = async (append = false) => {
  if (!operations.value.some(operation => operation.id === 'findChats')) return
  if (isLoadingChats.value && append) return
  if (append && !hasMoreChats.value) return
  const requestId = ++chatRequestSequence
  chatController?.abort()
  chatController = new AbortController()
  const offset = append ? chatOffset.value : 0
  isLoadingChats.value = true
  if (!append) error.value = ''
  try {
    const body: JsonRecord = { limit: chatPageSize, offset, compact: true, sort: '-wa_lastMsgTimestamp' }
    const term = searchText.value.trim()
    if (term) {
      body.operator = 'OR'
      body.wa_contactName = `~${term}`
      body.wa_name = `~${term}`
      body.name = `~${term}`
      body.wa_chatid = `~${term}`
    } else {
      if (selectedFilter.value === 'groups') body.wa_isGroup = true
      if (selectedFilter.value === 'archived') body.wa_archived = true
      if (selectedFilter.value === 'all') body.wa_archived = false
    }
    const data = await callOperation('findChats', body, undefined, undefined, chatController.signal)
    if (requestId !== chatRequestSequence) return
    const rawPage: Chat[] = unwrapArray(data, ['chats', 'items', 'results']).map((chat: JsonRecord) => normalizeChat(chat)).filter((chat: Chat) => chat._id)
    const page = rawPage.filter((chat: Chat) => {
      if (selectedFilter.value === 'unread') return chat._unread > 0
      if (term && selectedFilter.value === 'groups') return chat._group
      if (term && selectedFilter.value === 'archived') return chat._archived
      if (term && selectedFilter.value === 'all') return !chat._archived
      return true
    })
    chats.value = append ? [...chats.value, ...page] : page
    chatOffset.value = offset + rawPage.length
    const totalRecords = Number(data?.pagination?.totalRecords)
    hasMoreChats.value = Number.isFinite(totalRecords) && totalRecords > 0
      ? chatOffset.value < totalRecords
      : rawPage.length >= chatPageSize
  } catch (cause: any) {
    if (cause?.name !== 'AbortError' && requestId === chatRequestSequence) error.value = errText(cause, 'Falha ao carregar conversas.')
  } finally {
    if (requestId === chatRequestSequence) isLoadingChats.value = false
  }
}

const loadMessages = async (chat: Chat, append = false, markRead = false, reconcile = false) => {
  if (!chat?._id || !operations.value.some(operation => operation.id === 'findMessages')) return
  const requestId = ++messageRequestSequence
  messageController?.abort()
  messageController = new AbortController()
  const offset = append ? messageOffset.value : 0
  const previousTop = messageArea.value?.scrollTop || 0
  const previousHeight = messageArea.value?.scrollHeight || 0
  const nearBottom = !messageArea.value || previousHeight - previousTop - messageArea.value.clientHeight < 90
  isLoadingMessages.value = true
  if (!append && !reconcile) { messages.value = []; error.value = '' }
  try {
    const data = await callOperation('findMessages', { chatid: chat._id, limit: messagePageSize, offset }, undefined, undefined, messageController.signal)
    if (requestId !== messageRequestSequence || activeChat.value?._id !== chat._id) return
    const page: Message[] = unwrapArray(data, ['messages', 'items', 'results']).map((message: JsonRecord) => normalizeMessage(message)).filter((message: Message) => message._id)
    page.sort((a: Message, b: Message) => a._timestamp - b._timestamp)
    if (append || reconcile) {
      const merged = new Map(messages.value.map(message => [message._id, message]))
      for (const message of page) merged.set(message._id, message)
      messages.value = [...merged.values()].sort((a, b) => a._timestamp - b._timestamp)
    } else messages.value = page
    const nextOffset = Number(data?.nextOffset ?? data?.pagination?.nextOffset ?? (offset + page.length))
    messageOffset.value = reconcile ? Math.max(messageOffset.value, nextOffset) : nextOffset
    await nextTick()
    if (messageArea.value && activeChat.value?._id === chat._id) {
      if (append) messageArea.value.scrollTop = previousTop + messageArea.value.scrollHeight - previousHeight
      else if (!reconcile || nearBottom) messageArea.value.scrollTop = messageArea.value.scrollHeight
    }
    hasMoreMessages.value = Boolean(data?.hasMore ?? data?.pagination?.hasMore) || page.length >= messagePageSize
    if (markRead && !append) {
      presence.value = presenceByChat[chat._id] || ''
      if (chat._unread) void callOperation('markChatRead', { number: chat._id, read: true }).then(() => loadChats()).catch(() => undefined)
    }
  } catch (cause: any) {
    if (cause?.name !== 'AbortError' && requestId === messageRequestSequence && activeChat.value?._id === chat._id) error.value = errText(cause, 'Falha ao carregar mensagens.')
  } finally {
    if (requestId === messageRequestSequence) isLoadingMessages.value = false
  }
}

const openChat = async (chat: Chat) => {
  cancelRecording()
  messageController?.abort()
  resetComposer()
  activeChat.value = chat
  messages.value = []
  replyTo.value = null
  presence.value = presenceByChat[chat._id] || ''
  mobileChatOpen.value = true
  await loadMessages(chat, false, true)
}

const notificationSoundEnabled = ref(false)
let notificationAudio: AudioContext | null = null
const notifiedMessages = new Set<string>()
let lastNotificationAt = 0
const prepareNotificationAudio = async () => {
  notificationAudio ||= new AudioContext()
  if (notificationAudio.state === 'suspended') await notificationAudio.resume()
}
const playNotificationSound = () => {
  if (!notificationSoundEnabled.value || notificationAudio?.state !== 'running') return
  const now = notificationAudio.currentTime
  for (const [offset, frequency] of [[0, 880], [0.12, 1174.66]]) {
    const oscillator = notificationAudio.createOscillator()
    const gain = notificationAudio.createGain()
    oscillator.type = 'sine'; oscillator.frequency.value = frequency!
    gain.gain.setValueAtTime(0, now + offset!)
    gain.gain.linearRampToValueAtTime(0.12, now + offset! + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset! + 0.2)
    oscillator.connect(gain); gain.connect(notificationAudio.destination)
    oscillator.start(now + offset!); oscillator.stop(now + offset! + 0.22)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
}
const toggleNotificationSound = async () => {
  try {
    if (!notificationSoundEnabled.value) await prepareNotificationAudio()
    notificationSoundEnabled.value = !notificationSoundEnabled.value
    localStorage.setItem('jobvarejo-whatsapp-notification-sound', String(notificationSoundEnabled.value))
    if (notificationSoundEnabled.value) playNotificationSound()
  } catch { notificationSoundEnabled.value = false; error.value = 'Não foi possível ativar o áudio neste navegador.' }
}
const unlockNotificationAudio = () => {
  if (notificationSoundEnabled.value) void prepareNotificationAudio().catch(() => {})
}
const notifyIncomingMessages = (eventType: string, items: any[]) => {
  if (eventType !== 'messages') return
  let incoming = false
  for (const item of items) {
    const key = item?.key || {}
    const fromMe = item?.fromMe ?? item?.from_me ?? key.fromMe
    const id = messageIdentity(item || {}) || messageIdentity(key)
    if (!id || (fromMe !== false && fromMe !== 'false' && fromMe !== 0) || /reaction|protocol/i.test(String(item?.messageType || item?.type || ''))) continue
    if (notifiedMessages.has(id)) continue
    notifiedMessages.add(id)
    if (notifiedMessages.size > 1000) notifiedMessages.delete(notifiedMessages.values().next().value!)
    const stamp = Number(item?.messageTimestamp || item?.timestamp || 0)
    const milliseconds = stamp < 100000000000 ? stamp * 1000 : stamp
    if (milliseconds && Date.now() - milliseconds > 30000) continue
    incoming = true
  }
  if (incoming && Date.now() - lastNotificationAt > 800) { lastNotificationAt = Date.now(); playNotificationSound() }
}
const scheduleReconcile = (eventData?: any) => {
  const data = safeJson(eventData)
  const rawPayload = data?.data ?? data?.payload ?? data
  const rawItems = Array.isArray(rawPayload) ? [...rawPayload] : [rawPayload]
  if (rawPayload && !Array.isArray(rawPayload)) {
    for (const key of ['event', 'message', 'chat', 'presence', 'data']) {
      const nested = rawPayload[key]
      if (nested && typeof nested === 'object') rawItems.push(...(Array.isArray(nested) ? nested : [nested]))
    }
  }
  const eventTypeValue = firstValue(data || {}, ['EventType', 'eventType'], firstValue(rawPayload || {}, ['EventType', 'eventType'], typeof data?.event === 'string' ? data.event : 'Evento WhatsApp'))
  const eventType = String(typeof eventTypeValue === 'string' ? eventTypeValue : 'Evento WhatsApp').toLowerCase()
  liveEvents.value = [{ id: Date.now() + Math.random(), at: Date.now(), type: eventType, payload: data } as any, ...liveEvents.value].slice(0, 100)
  notifyIncomingMessages(eventType, rawItems)
  let jid = ''
  for (const item of rawItems) {
    const maybePresence = item?.presence
    const presenceValue = String(firstValue(item || {}, ['presence', 'state', 'status'], firstValue(maybePresence || {}, ['state', 'status', 'lastKnownPresence'], maybePresence || '')))
    const itemJid = String(firstValue(item || {}, ['chatid', 'chatId', 'wa_chatid', 'remoteJid', 'jid', 'number', 'id'], ''))
    if (!jid) jid = itemJid
    if (itemJid && /typing|recording|available|composing|paused|online|offline/i.test(presenceValue)) {
      jid = itemJid
      presenceByChat[itemJid] = /recording/i.test(presenceValue) ? 'gravando áudio…' : /typing|composing/i.test(presenceValue) ? 'digitando…' : /online|available/i.test(presenceValue) ? 'online' : ''
      if (activeChat.value?._id === itemJid) presence.value = presenceByChat[itemJid]
    }
  }
  if (refreshTimer) return
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void loadChats()
    const active = activeChat.value
    if (active && (!jid || jid === active._id || /message|chat|presence|receipt|read|update/.test(eventType))) void loadMessages(active, false, false, true)
  }, 500)
}

const connectRealtime = () => {
  if (typeof EventSource === 'undefined') { connectionState.value = 'unavailable'; return }
  eventSource?.close()
  connectionState.value = 'connecting'
  eventSource = new EventSource('/api/admin/whatsapp/realtime')
  eventSource.addEventListener('connected', () => {
    const wasDisconnected = previousConnectionState !== 'connected'
    realtimeErrors = 0
    connectionState.value = 'connected'
    previousConnectionState = 'connected'
    if (wasDisconnected) scheduleReconcile()
  })
  eventSource.addEventListener('whatsapp', (event: MessageEvent) => {
    try { scheduleReconcile(JSON.parse(event.data)) } catch { scheduleReconcile({ raw: event.data }) }
  })
  eventSource.addEventListener('unavailable', (event: MessageEvent) => {
    connectionState.value = 'unavailable'
    previousConnectionState = connectionState.value
    try { error.value = String(JSON.parse(event.data)?.message || 'Tempo real da UAZAPI indisponível.') } catch { error.value = 'Tempo real da UAZAPI indisponível.' }
  })
  eventSource.onerror = () => {
    realtimeErrors += 1
    if (connectionState.value !== 'unavailable') connectionState.value = realtimeErrors >= 3 ? 'unavailable' : 'reconnecting'
    previousConnectionState = connectionState.value
  }
}

const onSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchText.value = searchInput.value; void loadChats() }, 300)
}
const selectFilter = (filter: typeof selectedFilter.value) => { selectedFilter.value = filter; void loadChats() }
const formatTime = (value: number) => {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  return date.toDateString() === now.toDateString() ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
const getChatStatus = (chat: Chat) => String(firstValue(chat, ['wa_status', 'status', 'presence'], ''))
const getMessageStatus = (message: Message) => String(firstValue(message, ['wa_deliveryStatus', 'wa_messageStatus', 'ackName', 'wa_ackName', 'status', 'ack', 'messageStatus'], ''))
const getMessageKind = (message: Message) => {
  const content = message?.message?.message || message?.message || message
  if (content?.imageMessage || content?.stickerMessage || message?.imageMessage || message?.stickerMessage) return 'image'
  if (content?.videoMessage || content?.ptvMessage || message?.videoMessage || message?.ptvMessage) return 'video'
  if (content?.audioMessage || content?.pttMessage || message?.audioMessage || message?.pttMessage) return 'audio'
  if (content?.documentMessage || message?.documentMessage) return 'document'
  return String(firstValue(message, ['wa_messageType', 'type', 'messageType', 'mediaType'], firstValue(content || {}, ['type'], ''))).toLowerCase()
}
const getMessageMediaUrl = (message: Message) => {
  if (mediaDownloads[message._id]?.url) return mediaDownloads[message._id]!.url!
  const raw = String(firstValue(message, ['fileURL', 'fileUrl', 'wa_fileURL', 'wa_mediaUrl', 'mediaUrl', 'url'], firstValue(message?.media || {}, ['fileURL', 'fileUrl', 'url', 'mediaUrl'], '')))
  try { return new URL(raw).protocol === 'https:' ? raw : '' } catch { return '' }
}
const loadMessageMedia = async (message: Message) => {
  if (mediaDownloads[message._id]?.busy) return
  mediaDownloads[message._id] = { busy: true }
  try {
    const data = await callOperation('downloadMessage', { id: message._id, return_link: true, generate_mp3: true, transcribe: false })
    const url = String(data?.fileURL || data?.url || '')
    if (!url || new URL(url).protocol !== 'https:') throw new Error('A UAZAPI não retornou uma mídia disponível.')
    mediaDownloads[message._id] = { url }
  } catch (cause: any) { mediaDownloads[message._id] = { error: errText(cause, 'Não foi possível carregar a mídia.') } }
}
const getMessageFallback = (message: Message) => {
  if (message._text) return message._text
  const kind = getMessageKind(message)
  if (/image|sticker|photo/.test(kind)) return 'Imagem recebida'
  if (/video|ptv/.test(kind)) return 'Vídeo recebido'
  if (/audio|ptt|voice/.test(kind)) return 'Áudio recebido'
  if (/document|file/.test(kind)) return String(firstValue(message, ['fileName', 'filename', 'docName'], 'Documento recebido'))
  if (/location/.test(kind)) return 'Localização compartilhada'
  if (/contact|vcard/.test(kind)) return 'Contato compartilhado'
  if (/call/.test(kind)) return 'Chamada do WhatsApp'
  if (/poll|list|button|interactive/.test(kind)) return 'Mensagem interativa'
  if (/event/.test(kind)) return 'Evento do WhatsApp'
  if (/reaction/.test(kind)) return 'Reação recebida'
  return 'Mensagem do WhatsApp'
}
const getMessageDelivery = (message: Message) => {
  const status = getMessageStatus(message).toLowerCase()
  if (/fail|error|reject/.test(status)) return 'failed'
  if (/pending|queue|sending|processing/.test(status)) return 'pending'
  if (/read|played|seen|ack.?[34]/.test(status) || status === '3' || status === '4') return 'read'
  if (/deliver|ack.?2/.test(status) || status === '2') return 'delivered'
  if (/sent|server|ack.?1/.test(status) || status === '1') return 'sent'
  return 'unknown'
}
const toggleMoreActions = (message: Message) => {
  messageMenuId.value = message._id
  moreActionsId.value = moreActionsId.value === message._id ? '' : message._id
}
const closeMoreActions = (message: Message) => { if (moreActionsId.value === message._id) moreActionsId.value = ''; emojiMenuId.value = '' }
const updateChatAction = async (operationId: string, body: JsonRecord, confirmation?: string) => {
  if (!activeChat.value) return
  if (confirmation && !window.confirm(confirmation)) return
  error.value = ''; notice.value = ''; chatMenuOpen.value = false
  try {
    await callOperation(operationId, body)
    notice.value = 'Ação aplicada.'
    await loadChats()
    const refreshed = chats.value.find(chat => chat._id === activeChat.value?._id)
    if (refreshed) activeChat.value = refreshed
    if (operationId === 'getChatDetails') return
  } catch (cause: any) { error.value = errText(cause, 'Não foi possível aplicar esta ação.') }
}
const toggleArchive = () => updateChatAction('archiveChat', { number: activeChat.value?._id, archive: !activeChat.value?._archived })
const togglePinChat = () => updateChatAction('pinChat', { number: activeChat.value?._id, pin: !activeChat.value?._pinned })
const toggleMuteChat = () => updateChatAction('muteChat', {
  number: activeChat.value?._id,
  muteEndTime: Number(firstValue(activeChat.value || {}, ['wa_muteEndTime'], 0)) !== 0 ? 0 : 8
})
const markChatRead = (read: boolean) => updateChatAction('markChatRead', { number: activeChat.value?._id, read })
const blockChat = () => updateChatAction('blockChat', { number: activeChat.value?._id, block: !truthy(firstValue(activeChat.value || {}, ['wa_isBlocked', 'isBlocked'], false)) }, 'Confirma bloquear ou desbloquear este contato?')
const requestHistory = async () => {
  if (!activeChat.value || !window.confirm('Solicitar ao celular conectado até 50 mensagens anteriores? A operação é assíncrona; a recuperação depende do histórico disponível no dispositivo e a UAZAPI retém mensagens recebidas por até 7 dias.')) return
  try {
    await callOperation('requestHistorySync', { number: activeChat.value._id, mode: 'history', count: 50 })
    notice.value = 'Recuperação solicitada. As mensagens aparecerão conforme o celular sincronizar o histórico.'
    const chat = activeChat.value
    void loadChats()
    if (chat) setTimeout(() => { if (activeChat.value?._id === chat._id) void loadMessages(chat) }, 800)
  } catch (cause: any) { error.value = errText(cause, 'Não foi possível solicitar a recuperação do histórico.') }
}
const showChatDetails = async () => {
  if (!activeChat.value) return
  try { detailsData.value = await callOperation('getChatDetails', { number: activeChat.value._id, preview: true }); detailsOpen.value = true }
  catch (cause: any) { error.value = errText(cause, 'Não foi possível carregar os detalhes do chat.') }
}

const resetComposer = () => { composerText.value = ''; attachedFile.value = null; recordedAudio.value = false; replyTo.value = null; if (fileInput.value) fileInput.value.value = '' }
const readFileAsDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'))
  reader.readAsDataURL(file)
})
const onFileSelected = (event: Event) => { attachedFile.value = (event.target as HTMLInputElement).files?.[0] || null }
const inferMediaType = (file: File) => file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document'
const sendMessage = async () => {
  if (!activeChat.value || isSending.value || (!composerText.value.trim() && !attachedFile.value)) return
  const chatId = activeChat.value._id
  const messageText = composerText.value.trim()
  const fileToSend = attachedFile.value
  const replyid = replyTo.value?._id
  const isPtt = recordedAudio.value
  isSending.value = true; error.value = ''; notice.value = ''
  try {
    if (fileToSend) {
      const file = fileToSend
      const base64 = await readFileAsDataUrl(file)
      await callOperation('sendMedia', {
        number: chatId, type: isPtt ? 'ptt' : inferMediaType(file), file: base64,
        text: messageText || undefined, docName: file.name || undefined,
        mimetype: file.type || undefined, replyid
      })
    } else {
      await callOperation('sendText', { number: chatId, text: messageText, replyid, readchat: true })
    }
    if (activeChat.value?._id === chatId && composerText.value.trim() === messageText && attachedFile.value === fileToSend && replyTo.value?._id === replyid) resetComposer()
    await Promise.all([activeChat.value?._id === chatId ? loadMessages(activeChat.value) : Promise.resolve(), loadChats()])
  } catch (cause: any) { error.value = errText(cause, 'A mensagem não foi enviada.') }
  finally { isSending.value = false }
}
const startRecording = async () => {
  recordingError.value = ''
  const session = ++recordingSession
  const recordingChatId = activeChat.value?._id
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Este navegador não oferece gravação de áudio.')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (session !== recordingSession || !recordingChatId || activeChat.value?._id !== recordingChatId) {
      stream.getTracks().forEach(track => track.stop())
      return
    }
    recordingStream.value = stream
    discardRecording = false
    const recorder = new MediaRecorder(stream)
    mediaChunks = []
    recorder.ondataavailable = event => { if (event.data.size) mediaChunks.push(event.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop())
      recordingStream.value = null
      recording.value = false
      if (discardRecording || session !== recordingSession || activeChat.value?._id !== recordingChatId) { mediaChunks = []; return }
      const blob = new Blob(mediaChunks, { type: recorder.mimeType || 'audio/webm' })
      const file = new window.File([blob], `audio-${Date.now()}.webm`, { type: blob.type })
      attachedFile.value = file
      recordedAudio.value = true
    }
    mediaRecorder.value = recorder
    recorder.start()
    recording.value = true
  } catch (cause: any) { recordingError.value = errText(cause, 'Não foi possível iniciar a gravação.') }
}
const stopRecording = () => { if (recording.value && mediaRecorder.value?.state === 'recording') mediaRecorder.value.stop() }
const cancelRecording = () => {
  recordingSession += 1
  discardRecording = true
  if (mediaRecorder.value?.state === 'recording') mediaRecorder.value.stop()
  recordingStream.value?.getTracks().forEach(track => track.stop())
  recordingStream.value = null
  recording.value = false
}
const messageAction = async (operationId: string, body: JsonRecord, confirmation?: string) => {
  if (confirmation && !window.confirm(confirmation)) return
  error.value = ''; messageMenuId.value = ''; emojiMenuId.value = ''
  try {
    const result: any = await callOperation(operationId, body)
    if (operationId === 'downloadMessage') {
      const url = String(firstValue(result || {}, ['fileURL', 'url', 'downloadUrl'], ''))
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
      else { resourceResult.value = result; resourcesOpen.value = true; notice.value = 'Resposta de download disponível no painel Recursos.' }
    } else {
      await loadMessages(activeChat.value!)
    }
  } catch (cause: any) { error.value = errText(cause, 'Não foi possível aplicar a ação à mensagem.') }
}
const reactWith = (message: Message, emoji: string) => messageAction('reactToMessage', { id: message._id, text: emoji })
const editMessage = async (message: Message) => {
  const value = window.prompt('Novo texto da mensagem', message._text)
  if (value === null || !value.trim()) return
  await messageAction('editMessage', { id: message._id, text: value.trim() })
}
const deleteMessage = (message: Message) => messageAction('deleteMessage', { id: message._id }, 'Apagar esta mensagem para todos? Esta ação não pode ser desfeita.')
const toggleMessagePin = (message: Message) => messageAction('pinMessage', { id: message._id, pin: !truthy(firstValue(message, ['isPinned', 'pinned'], false)), duration: 7 })
const downloadMessage = (message: Message) => messageAction('downloadMessage', { id: message._id, return_link: true })

const filteredOperations = computed(() => {
  const search = resourceSearch.value.trim().toLowerCase()
  if (!search) return operations.value
  return operations.value.filter(operation => `${operation.id} ${operation.summary || ''} ${(operation.tags || []).join(' ')} ${operation.path}`.toLowerCase().includes(search))
})
const groupedOperations = computed(() => filteredOperations.value.reduce<Record<string, Operation[]>>((groups, operation) => {
  const key = operation.tags?.[0] || 'Outros'
  ;(groups[key] ||= []).push(operation)
  return groups
}, {}))
const selectedOperation = computed(() => operations.value.find(operation => operation.id === selectedOperationId.value) || null)
const selectedParameters = computed(() => selectedOperation.value?.parameters || [])
const bodySchemaAlternatives = computed(() => selectedOperation.value?.bodySchema?.oneOf || selectedOperation.value?.bodySchema?.anyOf || [])
const selectedBodySchema = computed(() => {
  const schema = selectedOperation.value?.bodySchema
  const alternatives = schema?.oneOf || schema?.anyOf
  return alternatives?.[resourceSchemaVariant.value] || schema
})
const bodyProperties = computed(() => selectedBodySchema.value?.properties || {})
const isDestructiveOperation = (operation: Operation) => /delete|remove|block|disconnect|reset|clear|leave|unfollow|revoke|restart|rotate|updateWebhook|updateGlobalWebhook|updateProxyConfig|updateChatwootConfig|transferNewsletterOwnership/i.test(`${operation.id} ${operation.method}`)
const chooseOperation = (operation: Operation) => {
  selectedOperationId.value = operation.id
  resourceSchemaVariant.value = 0
  resourceBody.value = { ...(operation.example && typeof operation.example === 'object' ? operation.example : {}) }
  resourceQuery.value = {}
  resourcePath.value = {}
  resourceResult.value = null
  resourceError.value = ''
}
const parseResourceValue = (raw: string, schema?: JsonRecord) => {
  if (schema?.type === 'integer' || schema?.type === 'number') return raw === '' ? undefined : Number(raw)
  if (schema?.type === 'boolean') return raw === '' ? undefined : raw === 'true'
  if (schema?.type === 'array' || schema?.type === 'object' || (!schema?.type && (schema?.properties || schema?.items || schema?.oneOf || schema?.anyOf))) {
    if (!raw.trim()) return undefined
    try { return JSON.parse(raw) } catch { return raw }
  }
  return raw === '' ? undefined : raw
}
const setSchemaValue = (target: JsonRecord, key: string, raw: string, schema?: JsonRecord) => {
  const value = parseResourceValue(raw, schema)
  if (value === undefined) { delete target[key]; return }
  target[key] = value
}
const schemaInputValue = (value: any, schema?: JsonRecord) => {
  if (value === undefined || value === null) return ''
  if (schema?.type === 'object' || schema?.type === 'array' || (!schema?.type && (schema?.properties || schema?.items || schema?.oneOf || schema?.anyOf))) return JSON.stringify(value)
  return String(value)
}
const isJsonSchema = (schema: JsonRecord) => ['object', 'array'].includes(schema?.type) || (!schema?.type && Boolean(schema?.properties || schema?.items || schema?.oneOf || schema?.anyOf))
const runResourceOperation = async () => {
  const operation = selectedOperation.value
  if (!operation || resourceBusy.value) return
  if (isDestructiveOperation(operation)) {
    const warning = /Webhook/i.test(operation.id)
      ? 'Esta operação atualizará o webhook da instância e pode afetar fluxos n8n existentes. Confirma continuar?'
      : `Executar “${operation.summary || operation.id}”? Esta ação pode alterar ou remover dados no WhatsApp.`
    if (!window.confirm(warning)) return
  }
  resourceBusy.value = true; resourceError.value = ''; resourceResult.value = null
  try {
    resourceResult.value = await callOperation(operation.id,
      Object.keys(resourceBody.value).length ? resourceBody.value : undefined,
      Object.keys(resourceQuery.value).length ? resourceQuery.value : undefined,
      Object.keys(resourcePath.value).length ? resourcePath.value : undefined)
  } catch (cause: any) { resourceError.value = errText(cause, 'A operação falhou.') }
  finally { resourceBusy.value = false }
}
const loadOlderMessages = () => { if (activeChat.value) void loadMessages(activeChat.value, true) }
const loadMoreChats = () => { void loadChats(true) }
const clearNotices = () => { error.value = ''; notice.value = '' }

onMounted(async () => {
  try { notificationSoundEnabled.value = localStorage.getItem('jobvarejo-whatsapp-notification-sound') === 'true' } catch {}
  window.addEventListener('pointerdown', unlockNotificationAudio)
  window.addEventListener('keydown', unlockNotificationAudio)
  await loadCatalogAndStatus()
  if (operations.value.some(operation => operation.id === 'findChats')) await loadChats()
  connectRealtime()
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockNotificationAudio)
  window.removeEventListener('keydown', unlockNotificationAudio)
  void notificationAudio?.close().catch(() => {})
  eventSource?.close()
  if (refreshTimer) clearTimeout(refreshTimer)
  if (searchTimer) clearTimeout(searchTimer)
  chatController?.abort()
  messageController?.abort()
  if (mediaRecorder.value?.state === 'recording') mediaRecorder.value.stop()
})
</script>

<template>
  <AdminWorkspaceShell active-nav="whatsapp">
    <main class="wa-page">
      <header class="wa-topbar">
        <div class="wa-brand"><div class="wa-brand-icon"><MessageCircle :size="19" /></div><div><strong>WhatsApp</strong><small>Central de conversas</small></div></div>
        <div class="wa-topbar-status"><span :class="['wa-status-dot', `is-${connectionState}`]" />{{ connectionState === 'connected' ? 'Tempo real conectado' : connectionState === 'reconnecting' ? 'Reconectando…' : connectionState === 'unavailable' ? 'Tempo real indisponível' : 'Conectando…' }}<span v-if="apiVersion" class="wa-version">Catálogo {{ apiVersion }}</span></div>
        <button class="wa-icon-button" :aria-label="notificationSoundEnabled ? 'Silenciar notificações' : 'Ativar som de notificações'" :title="notificationSoundEnabled ? 'Silenciar notificações' : 'Ativar som de notificações'" :aria-pressed="notificationSoundEnabled" @click="toggleNotificationSound"><Bell v-if="notificationSoundEnabled" :size="18" /><BellOff v-else :size="18" /></button>
        <button class="wa-icon-button" title="Recursos da UAZAPI" aria-label="Abrir recursos da UAZAPI" @click="resourcesOpen = true"><Settings2 :size="18" /></button>
      </header>

      <div v-if="error || notice || recordingError" class="wa-alerts">
        <div v-if="error" class="wa-alert wa-alert-error"><X :size="16" /><span>{{ error }}</span><button @click="clearNotices"><X :size="15" /></button></div>
        <div v-if="notice" class="wa-alert wa-alert-success"><Check :size="16" /><span>{{ notice }}</span><button @click="clearNotices"><X :size="15" /></button></div>
        <div v-if="recordingError" class="wa-alert wa-alert-error"><Mic :size="16" /><span>{{ recordingError }}</span><button @click="recordingError = ''"><X :size="15" /></button></div>
      </div>

      <div v-if="statusLoaded && provider.configured === false" class="wa-setup"><div><strong>Instância UAZAPI não configurada</strong><span>{{ provider.error || 'Configure a instância no servidor para carregar conversas.' }}</span></div><button @click="loadCatalogAndStatus">Tentar novamente</button></div>
      <section class="wa-workspace" :class="{ 'mobile-chat-open': mobileChatOpen }">
        <aside class="wa-chat-sidebar">
          <div class="wa-sidebar-heading"><div><h1>Conversas</h1><span>{{ chats.length }} carregadas</span></div><button class="wa-icon-button" title="Atualizar conversas" @click="loadChats()"><LoaderCircle v-if="isLoadingChats" class="wa-spin" :size="18" /><ArrowDown v-else :size="17" /></button></div>
          <label class="wa-search"><Search :size="16" /><input v-model="searchInput" type="search" placeholder="Pesquisar conversas" @input="onSearchInput"><kbd>⌘ K</kbd></label>
          <nav class="wa-filters" aria-label="Filtros de conversa">
            <button v-for="filter in ([['all','Todas'],['unread','Não lidas'],['groups','Grupos'],['archived','Arquivadas']] as const)" :key="filter[0]" :class="{ active: selectedFilter === filter[0] }" @click="selectFilter(filter[0])">{{ filter[1] }}</button>
          </nav>
          <div class="wa-chat-list" @scroll="($event.target as HTMLElement).scrollTop + ($event.target as HTMLElement).clientHeight >= ($event.target as HTMLElement).scrollHeight - 60 && hasMoreChats && !isLoadingChats ? loadMoreChats() : undefined">
            <button v-for="chat in chats" :key="chat._id" class="wa-chat-row" :class="{ active: activeChat?._id === chat._id }" @click="openChat(chat)">
              <div class="wa-avatar" :class="{ 'wa-avatar-group': chat._group }"><img v-if="getChatProfileImage(chat)" :src="getChatProfileImage(chat)" :alt="`Foto de ${chat._name}`" loading="lazy" referrerpolicy="no-referrer" @error="onProfileImageError(chat)"><Users v-else-if="chat._group" :size="20" /><span v-else>{{ chat._name.slice(0, 1).toUpperCase() }}</span></div>
              <div class="wa-chat-copy"><div class="wa-chat-line"><strong>{{ chat._name }}</strong><time>{{ formatTime(Number(firstValue(chat, ['wa_lastMsgTimestamp', 'lastMessageTimestamp', 'timestamp'], 0)) * (Number(firstValue(chat, ['wa_lastMsgTimestamp', 'lastMessageTimestamp', 'timestamp'], 0)) < 100000000000 ? 1000 : 1)) }}</time></div><div class="wa-chat-line wa-chat-preview"><span><Pin v-if="chat._pinned" :size="12" class="wa-muted-icon" /><span v-if="chat._archived" class="wa-mini-label">Arquivada</span>{{ chat._lastText || getChatStatus(chat) || chat._id }}</span><span v-if="chat._unread" class="wa-unread-badge">{{ chat._unread > 99 ? '99+' : chat._unread }}</span></div></div>
            </button>
            <div v-if="isLoadingChats && !chats.length" class="wa-empty"><LoaderCircle class="wa-spin" :size="22" />Carregando conversas…</div>
            <div v-else-if="!chats.length" class="wa-empty"><MessageCircle :size="23" />{{ provider.configured ? 'Nenhuma conversa neste filtro.' : 'Aguardando configuração da instância.' }}</div>
            <button v-if="hasMoreChats" class="wa-load-more" :disabled="isLoadingChats" @click="loadMoreChats">{{ isLoadingChats ? 'Carregando…' : 'Carregar mais conversas' }}</button>
          </div>
          <div class="wa-sidebar-footer"><span :class="['wa-live-led', { 'is-offline': connectionState !== 'connected' }]" />{{ connectionState === 'connected' ? 'Atualização ao vivo ativa' : connectionState === 'unavailable' ? 'Tempo real indisponível' : 'Reconectando tempo real…' }}</div>
        </aside>

        <section class="wa-conversation">
          <template v-if="activeChat">
            <header class="wa-conversation-header">
              <button class="wa-icon-button wa-back-mobile" aria-label="Voltar às conversas" @click="mobileChatOpen = false"><ArrowLeft :size="18" /></button>
              <div class="wa-avatar wa-header-avatar" :class="{ 'wa-avatar-group': activeChat._group }"><img v-if="getChatProfileImage(activeChat)" :src="getChatProfileImage(activeChat)" :alt="`Foto de ${activeChat._name}`" referrerpolicy="no-referrer" @error="onProfileImageError(activeChat)"><Users v-else-if="activeChat._group" :size="20" /><span v-else>{{ activeChat._name.slice(0, 1).toUpperCase() }}</span></div>
              <div class="wa-contact-title"><strong>{{ activeChat._name }}</strong><span>{{ presence || (activeChat._group ? 'Grupo' : (firstValue(activeChat, ['wa_chatid', 'chatid', 'id'], 'WhatsApp')) ) }}</span></div>
              <div class="wa-header-actions"><button class="wa-icon-button" title="Detalhes do chat" @click="showChatDetails"><Search :size="18" /></button><button class="wa-icon-button" title="Mais ações" @click="chatMenuOpen = !chatMenuOpen"><MoreHorizontal :size="19" /></button>
                <div v-if="chatMenuOpen" class="wa-popover wa-chat-menu">
                  <button @click="showChatDetails(); chatMenuOpen = false">Detalhes do contato</button>
                  <button @click="requestHistory(); chatMenuOpen = false">Recuperar histórico do celular</button>
                  <button @click="togglePinChat">{{ activeChat._pinned ? 'Desafixar chat' : 'Fixar chat' }}</button>
                  <button @click="toggleArchive">{{ activeChat._archived ? 'Desarquivar chat' : 'Arquivar chat' }}</button>
                  <button @click="toggleMuteChat"><BellOff :size="15" /> {{ Number(firstValue(activeChat, ['wa_muteEndTime'], 0)) !== 0 ? 'Ativar notificações' : 'Silenciar por 8 horas' }}</button>
                  <button @click="markChatRead(false)"><Circle :size="15" /> Marcar como não lido</button>
                  <button class="danger" @click="blockChat"><Ban :size="15" /> {{ truthy(firstValue(activeChat, ['wa_isBlocked','isBlocked'], false)) ? 'Desbloquear contato' : 'Bloquear contato' }}</button>
                </div>
              </div>
            </header>

            <div class="wa-history-notice">A UAZAPI mantém mensagens recebidas por até 7 dias. A recuperação adicional depende do histórico disponível no celular conectado.</div>
            <div class="wa-message-area" ref="messageArea" @click="moreActionsId = ''; emojiMenuId = ''" @scroll="($event.target as HTMLElement).scrollTop < 60 && hasMoreMessages && !isLoadingMessages ? loadOlderMessages() : undefined">
              <div class="wa-message-bg" />
              <button v-if="hasMoreMessages" class="wa-history-button" :disabled="isLoadingMessages" @click="loadOlderMessages">{{ isLoadingMessages ? 'Carregando…' : 'Carregar mensagens anteriores' }}</button>
              <div v-if="!messages.length && isLoadingMessages" class="wa-empty wa-message-empty"><LoaderCircle class="wa-spin" :size="22" />Carregando mensagens…</div>
              <div v-else-if="!messages.length" class="wa-empty wa-message-empty"><MessageCircle :size="24" />Nenhuma mensagem encontrada neste chat.</div>
              <div v-for="message in visibleMessages" :key="message._id" class="wa-message-line" :class="message._fromMe ? 'from-me' : 'from-them'">
                  <article class="wa-bubble" :data-message-id="message._id" tabindex="0" @mouseenter="messageMenuId = message._id" @focusin="messageMenuId = message._id" @click="messageMenuId = message._id" @mouseleave="messageMenuId === message._id && !moreActionsId && (emojiMenuId !== message._id) ? messageMenuId = '' : undefined">
                  <button v-if="getQuotedMessageText(message)" class="wa-quoted" aria-label="Ir à mensagem respondida" @click.stop="goToQuotedMessage(message)"><strong>Em resposta a</strong><span>{{ getQuotedMessageText(message) }}</span></button>
                  <button v-if="getMessageMediaUrl(message) && /image|sticker|photo/.test(getMessageKind(message))" type="button" class="wa-image-preview" aria-label="Ampliar imagem" @click.stop="openImageViewer(getMessageMediaUrl(message), message._text || '')"><img :src="getMessageMediaUrl(message)" alt="Imagem recebida" loading="lazy"></button>
                  <video v-else-if="getMessageMediaUrl(message) && /video|ptv/.test(getMessageKind(message))" class="wa-video-preview" :src="getMessageMediaUrl(message)" controls preload="metadata" />
                  <audio v-else-if="getMessageMediaUrl(message) && /audio|ptt|voice/.test(getMessageKind(message))" class="wa-audio-preview" :src="getMessageMediaUrl(message)" controls preload="metadata" />
                  <a v-else-if="getMessageMediaUrl(message)" :href="getMessageMediaUrl(message)" target="_blank" rel="noopener noreferrer" class="wa-media-link"><FileIcon :size="18" />{{ getMessageFallback(message) }}</a>
                  <button v-if="!getMessageMediaUrl(message) && /image|sticker|photo|video|ptv|audio|ptt|voice|document|file/.test(getMessageKind(message))" class="wa-media-load" :disabled="mediaDownloads[message._id]?.busy" @click="loadMessageMedia(message)"><LoaderCircle v-if="mediaDownloads[message._id]?.busy" :size="18" class="wa-spin" /><Download v-else :size="18" />{{ mediaDownloads[message._id]?.busy ? 'Carregando mídia…' : 'Carregar mídia' }}</button>
                  <small v-if="mediaDownloads[message._id]?.error" class="wa-media-error">{{ mediaDownloads[message._id]?.error }}</small>
                  <p v-if="message._text || !getMessageMediaUrl(message)">{{ getMessageFallback(message) }}</p>
                  <div v-if="getMessageReactions(message).length" class="wa-message-reactions" aria-label="Reações nesta mensagem"><button v-for="(reaction, index) in getMessageReactions(message)" :key="index" :aria-label="`Ver reação ${reaction.emoji}`" @click.stop="reactionDetails = message">{{ reaction.emoji }}</button></div>
                  <div class="wa-message-meta"><time>{{ formatTime(message._timestamp) }}</time><span v-if="message._fromMe" class="wa-message-checks" :class="`delivery-${getMessageDelivery(message)}`"><LoaderCircle v-if="getMessageDelivery(message) === 'pending'" :size="13" /><X v-else-if="getMessageDelivery(message) === 'failed'" :size="13" /><Check v-else-if="getMessageDelivery(message) === 'sent'" :size="13" /><CheckCheck v-else-if="getMessageDelivery(message) === 'delivered' || getMessageDelivery(message) === 'read'" :size="14" /><span v-else>status n/d</span></span></div>
                  <button class="wa-touch-message-trigger" aria-label="Abrir ações da mensagem" :aria-expanded="moreActionsId === message._id" @click.stop="toggleMoreActions(message)"><MoreHorizontal :size="15" /></button>
                  <div v-if="moreActionsId === message._id" class="wa-popover wa-message-menu" @click.stop @keydown.esc.stop="closeMoreActions(message)">
                    <button @click="replyTo = message; closeMoreActions(message)">Responder</button>
                    <button @click="emojiMenuId = emojiMenuId === message._id ? '' : message._id">Reagir</button>
                    <div v-if="emojiMenuId === message._id" class="wa-inline-emoji-picker"><button v-for="emoji in ['👍','❤️','😂','😮','😢','🙏']" :key="emoji" @click="reactWith(message, emoji); closeMoreActions(message)">{{ emoji }}</button></div>
                    <button v-if="/image|sticker|photo|video|ptv|audio|ptt|voice|document|file/.test(getMessageKind(message))" @click="downloadMessage(message)"><Download :size="14" />Baixar mídia</button>
                    <button v-if="message._fromMe" @click="editMessage(message)">Editar mensagem</button>
                    <button @click="toggleMessagePin(message)"><Pin :size="14" />Fixar mensagem</button>
                    <button class="danger" @click="deleteMessage(message)">Apagar para todos</button>
                  </div>
                </article>
              </div>
            </div>

            <form class="wa-composer" @submit.prevent="sendMessage">
              <div v-if="replyTo" class="wa-reply-preview"><div><strong>Respondendo</strong><span>{{ replyTo._text || 'Mídia' }}</span></div><button type="button" aria-label="Cancelar resposta" @click="replyTo = null"><X :size="16" /></button></div>
              <div v-if="attachedFile" class="wa-attachment-preview"><FileIcon :size="15" /><span>{{ attachedFile.name }}</span><button type="button" @click="attachedFile = null; recordedAudio = false"><X :size="15" /></button></div>
              <div class="wa-composer-row">
                <button type="button" class="wa-composer-icon" title="Anexar arquivo" @click="fileInput?.click()"><Paperclip :size="19" /></button><input ref="fileInput" class="wa-hidden" type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" @change="onFileSelected">
                <button type="button" class="wa-composer-icon" :title="recording ? 'Parar gravação' : 'Gravar áudio'" @click="recording ? stopRecording() : startRecording()"><Square v-if="recording" :size="18" class="wa-recording" /><Mic v-else :size="19" /></button>
                <textarea v-model="composerText" rows="1" :placeholder="recording ? 'Gravando áudio…' : 'Digite uma mensagem'" :disabled="recording" @keydown.enter.exact.prevent="sendMessage" />
                <button type="submit" class="wa-send-button" :disabled="isSending || (!composerText.trim() && !attachedFile)"><LoaderCircle v-if="isSending" class="wa-spin" :size="18" /><Send v-else :size="18" /></button>
              </div>
              <small class="wa-composer-hint">As mensagens são enviadas pela instância conectada.</small>
            </form>
          </template>
          <div v-else class="wa-no-chat"><div class="wa-no-chat-art"><MessageCircle :size="44" /></div><h2>Seu WhatsApp, conectado ao JobVarejo</h2><p>Selecione uma conversa para ver mensagens, responder e gerenciar o contato.</p><div><span class="wa-live-led" />{{ connectionState === 'connected' ? 'Conectado em tempo real' : 'Aguardando conexão em tempo real' }}</div></div>
        </section>
      </section>
    </main>

    <div v-if="reactionDetails" class="wa-modal-backdrop" @click.self="reactionDetails = null">
      <section class="wa-modal wa-reaction-details" role="dialog" aria-label="Reações da mensagem" @keydown.esc="reactionDetails = null">
        <header><h2>Reações</h2><button class="wa-icon-button" aria-label="Fechar reações" @click="reactionDetails = null"><X :size="18" /></button></header>
        <button v-for="(reaction, index) in getMessageReactions(reactionDetails)" :key="index" class="wa-reaction-person" :disabled="!reaction.fromMe" @click="reactWith(reactionDetails, ''); reactionDetails = null"><span class="wa-reaction-emoji">{{ reaction.emoji }}</span><span><strong>{{ reaction.name }}</strong><small v-if="reaction.fromMe">Clique para remover sua reação</small></span></button>
      </section>
    </div>

    <dialog ref="imageViewer" class="wa-image-viewer" aria-label="Visualização de imagem" @cancel.prevent="closeImageViewer" @click.self="closeImageViewer" @close="viewedImage = null">
      <template v-if="viewedImage">
        <button type="button" class="wa-image-viewer-close" aria-label="Fechar imagem" autofocus @click="closeImageViewer"><X :size="24" /></button>
        <figure><img :src="viewedImage.url" alt="Imagem ampliada"><figcaption v-if="viewedImage.caption">{{ viewedImage.caption }}</figcaption></figure>
      </template>
    </dialog>

    <div v-if="detailsOpen" class="wa-modal-backdrop" @click.self="detailsOpen = false">
      <section class="wa-modal"><header><div><h2>Detalhes do chat</h2><span>{{ activeChat?._name }}</span></div><button class="wa-icon-button" @click="detailsOpen = false"><X :size="18" /></button></header><pre>{{ JSON.stringify(detailsData, null, 2) }}</pre></section>
    </div>

    <div v-if="resourcesOpen" class="wa-resource-backdrop" @click.self="resourcesOpen = false">
      <aside class="wa-resource-panel">
        <header class="wa-resource-header"><div><span>INTEGRAÇÃO UAZAPI</span><h2>Recursos</h2><p>{{ operations.length }} operações no catálogo · catálogo {{ apiVersion || '—' }}</p><small>Histórico recebido: até 7 dias. A chamada de voz inicia/reproduz áudio e não é uma conversa bidirecional.</small></div><button class="wa-icon-button" aria-label="Fechar recursos" @click="resourcesOpen = false"><X :size="19" /></button></header>
        <details class="wa-live-events"><summary>Eventos ao vivo <span>{{ liveEvents.length }} / 100</span></summary><div v-if="!liveEvents.length" class="wa-events-empty">Nenhum evento recebido nesta sessão.</div><details v-for="event in liveEvents" :key="event.id" class="wa-event-entry"><summary><time>{{ new Date(event.at).toLocaleTimeString('pt-BR') }}</time><strong>{{ event.type }}</strong></summary><pre>{{ JSON.stringify(event.payload, null, 2) }}</pre></details></details>
        <label class="wa-resource-search"><Search :size="16" /><input v-model="resourceSearch" placeholder="Buscar operação, grupo ou endpoint"></label>
        <div class="wa-resource-layout">
          <nav class="wa-resource-list">
            <section v-for="(items, tag) in groupedOperations" :key="tag"><h3>{{ tag }}</h3><button v-for="operation in items" :key="operation.id" :class="{ active: selectedOperationId === operation.id, disabled: operation.available === false }" @click="chooseOperation(operation)"><span>{{ operation.summary || operation.id }}</span><small>{{ operation.method }} {{ operation.path }}</small><em v-if="operation.available === false">Indisponível</em><em v-else-if="operation.adminTokenRequired">Admin UAZAPI</em></button></section>
          </nav>
          <section class="wa-resource-detail">
            <template v-if="selectedOperation">
              <div class="wa-operation-heading"><div><span class="wa-method" :class="`method-${selectedOperation.method.toLowerCase()}`">{{ selectedOperation.method }}</span><strong>{{ selectedOperation.summary || selectedOperation.id }}</strong></div><code>{{ selectedOperation.path }}</code><p>{{ selectedOperation.id }}<span v-if="selectedOperation.disabledReason"> · {{ selectedOperation.disabledReason }}</span></p></div>
              <div v-if="selectedParameters.length" class="wa-schema-block"><h3>Parâmetros</h3><label v-for="parameter in selectedParameters" :key="`${parameter.in}:${parameter.name}`">{{ parameter.name }} <small>{{ parameter.in }}<b v-if="parameter.required"> · obrigatório</b></small><input :value="schemaInputValue((parameter.in === 'path' ? resourcePath : resourceQuery)[parameter.name], parameter.schema)" :placeholder="parameter.schema?.example === undefined ? '' : String(parameter.schema.example)" @input="setSchemaValue(parameter.in === 'path' ? resourcePath : resourceQuery, parameter.name, ($event.target as HTMLInputElement).value, parameter.schema)"></label></div>
              <div v-if="bodySchemaAlternatives.length" class="wa-schema-block"><h3>Formato do corpo</h3><select :value="resourceSchemaVariant" @change="resourceSchemaVariant = Number(($event.target as HTMLSelectElement).value)"><option v-for="(variant, index) in bodySchemaAlternatives" :key="index" :value="index">{{ variant.title || variant.description || `Opção ${index + 1}` }}</option></select></div>
              <div v-if="Object.keys(bodyProperties).length" class="wa-schema-block"><h3>Corpo</h3><label v-for="(schema, key) in bodyProperties" :key="String(key)">{{ key }} <small>{{ schema.type || 'valor' }}<b v-if="selectedBodySchema?.required?.includes(key)"> · obrigatório</b></small><select v-if="schema.enum" :value="schemaInputValue(resourceBody[key], schema)" @change="setSchemaValue(resourceBody, String(key), ($event.target as HTMLSelectElement).value, schema)"><option value="">Selecione…</option><option v-for="option in schema.enum" :key="String(option)" :value="String(option)">{{ option }}</option></select><select v-else-if="schema.type === 'boolean'" :value="schemaInputValue(resourceBody[key], schema)" @change="setSchemaValue(resourceBody, String(key), ($event.target as HTMLSelectElement).value, schema)"><option value="">Não definido</option><option value="true">true</option><option value="false">false</option></select><textarea v-else-if="isJsonSchema(schema)" :value="schemaInputValue(resourceBody[key], schema)" rows="3" :placeholder="schema.example ? JSON.stringify(schema.example) : schema.description" @input="setSchemaValue(resourceBody, String(key), ($event.target as HTMLTextAreaElement).value, schema)"/><input v-else :type="schema.type === 'integer' || schema.type === 'number' ? 'number' : 'text'" :value="schemaInputValue(resourceBody[key], schema)" :placeholder="schema.example !== undefined ? String(schema.example) : schema.description || ''" @input="setSchemaValue(resourceBody, String(key), ($event.target as HTMLInputElement).value, schema)"></label></div>
              <div class="wa-resource-run"><button class="wa-run-button" :disabled="resourceBusy || selectedOperation.available === false" @click="runResourceOperation"><LoaderCircle v-if="resourceBusy" class="wa-spin" :size="16" />{{ resourceBusy ? 'Executando…' : 'Executar operação' }}</button><span v-if="selectedOperation.available === false">{{ selectedOperation.disabledReason || 'Indisponível nesta instância' }}</span><span v-else-if="selectedOperation.adminTokenRequired">Requer autorização administrativa da UAZAPI.</span></div>
              <div v-if="resourceError" class="wa-resource-error">{{ resourceError }}</div><div v-if="resourceResult !== null" class="wa-resource-result"><div><strong>Resposta da API</strong><button @click="resourceResult = null">Limpar</button></div><pre>{{ JSON.stringify(resourceResult, null, 2) }}</pre></div>
            </template>
            <div v-else class="wa-resource-placeholder"><Settings2 :size="30" /><strong>Selecione um recurso</strong><span>As operações seguem o catálogo da instância UAZAPI conectada.</span></div>
          </section>
        </div>
      </aside>
    </div>
  </AdminWorkspaceShell>
</template>

<style scoped>
.wa-page{position:relative;height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;background:#f4f7f6;color:#19312e;font-family:Inter,'Plus Jakarta Sans',sans-serif}
.wa-topbar{height:66px;flex:none;display:flex;align-items:center;gap:18px;padding:0 22px;background:#fff;border-bottom:1px solid #e4ebea}
.wa-brand{display:flex;align-items:center;gap:11px;min-width:220px}.wa-brand-icon{width:37px;height:37px;border-radius:12px;background:#e7f7ef;color:#00a86b;display:grid;place-items:center}.wa-brand strong,.wa-brand small{display:block}.wa-brand strong{font-size:14px}.wa-brand small{margin-top:2px;color:#81908f;font-size:10px}
.wa-topbar-status{margin-left:auto;display:flex;align-items:center;gap:8px;color:#778583;font-size:11px}.wa-status-dot{width:8px;height:8px;border-radius:50%;background:#d49c22}.wa-status-dot.is-connected{background:#10b981;box-shadow:0 0 0 3px #dcf5eb}.wa-status-dot.is-reconnecting{background:#e3a328;animation:wa-pulse 1.5s infinite}.wa-status-dot.is-unavailable{background:#de6b62}.wa-version{padding-left:12px;border-left:1px solid #e3e8e7;font-size:10px}
.wa-icon-button{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:#617171;cursor:pointer}.wa-icon-button:hover{background:#eef3f2;color:#1f3433}.wa-alerts{position:absolute;z-index:10;top:74px;left:50%;transform:translateX(-50%);width:min(700px,calc(100% - 24px));display:grid;gap:6px}.wa-alert{min-height:39px;display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:10px;box-shadow:0 6px 20px #17323015;font-size:12px}.wa-alert span{flex:1}.wa-alert button{border:0;background:none;color:inherit;cursor:pointer}.wa-alert-error{background:#fff0ef;color:#b34038;border:1px solid #ffd7d3}.wa-alert-success{background:#e9f8ef;color:#168052;border:1px solid #ccefd9}
.wa-setup{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 18px 0;padding:12px 15px;background:#fff8e8;border:1px solid #f1dfa9;border-radius:12px;color:#6d5618}.wa-setup strong,.wa-setup span{display:block}.wa-setup strong{font-size:12px}.wa-setup span{margin-top:2px;font-size:11px}.wa-setup button{padding:7px 10px;background:#fff;border:1px solid #e9d28d;border-radius:8px;color:#755d17;font-size:11px;cursor:pointer}
.wa-workspace{min-height:0;flex:1;display:grid;grid-template-columns:340px minmax(0,1fr);margin:16px;border:1px solid #e0e9e7;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 8px 25px #102e2a08}.wa-chat-sidebar{min-height:0;display:flex;flex-direction:column;border-right:1px solid #e4ebea;background:#fff}.wa-sidebar-heading{height:70px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 17px}.wa-sidebar-heading h1{margin:0;font-size:19px;letter-spacing:-.035em}.wa-sidebar-heading span{display:block;margin-top:3px;font-size:10px;color:#9aa6a4}
.wa-search{height:37px;margin:0 13px 10px;padding:0 10px;display:flex;align-items:center;gap:8px;background:#f2f6f5;border:1px solid transparent;border-radius:8px;color:#8c9997}.wa-search:focus-within{border-color:#b6e7d0;background:#fff}.wa-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#213432;font-size:11px}.wa-search kbd{padding:2px 4px;border:1px solid #dbe3e1;border-radius:4px;color:#97a2a0;font-size:9px}.wa-filters{display:flex;gap:3px;padding:0 12px 11px;border-bottom:1px solid #edf1f0}.wa-filters button{padding:7px 9px;border:0;border-radius:7px;background:transparent;color:#788582;font-size:10px;white-space:nowrap;cursor:pointer}.wa-filters button.active{background:#e7f7ef;color:#078a58;font-weight:700}
.wa-chat-list{min-height:0;flex:1;overflow-y:auto}.wa-chat-row{width:100%;min-height:68px;display:flex;align-items:center;gap:11px;padding:9px 13px;border:0;border-bottom:1px solid #f0f3f2;background:#fff;text-align:left;cursor:pointer}.wa-chat-row:hover{background:#f8fbfa}.wa-chat-row.active{background:#eaf7f1}.wa-avatar{width:43px;height:43px;flex:none;display:grid;place-items:center;border-radius:50%;background:#edf3f1;color:#748582;font-size:15px;font-weight:700}.wa-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}.wa-avatar-group{background:#e3f4ec;color:#3c9973}.wa-chat-copy{min-width:0;flex:1}.wa-chat-line{display:flex;align-items:center;justify-content:space-between;gap:8px}.wa-chat-line strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#203331;font-size:11px;font-weight:700}.wa-chat-line time{flex:none;color:#9aa6a4;font-size:9px}.wa-chat-preview{margin-top:5px;color:#879390;font-size:10px}.wa-chat-preview>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px}.wa-muted-icon{flex:none;color:#98a6a3}.wa-mini-label{padding:1px 4px;border-radius:4px;background:#f0f2f1;color:#798581;font-size:8px}.wa-unread-badge{min-width:17px;height:17px;display:grid;place-items:center;padding:0 4px;border-radius:9px;background:#14ae72;color:#fff;font-size:9px;font-weight:700}.wa-empty{min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#9aa7a4;font-size:11px;text-align:center}.wa-load-more{width:100%;padding:12px;border:0;background:#fff;color:#16875b;font-size:10px;cursor:pointer}.wa-sidebar-footer{height:36px;flex:none;display:flex;align-items:center;gap:7px;padding:0 14px;border-top:1px solid #edf1f0;color:#9aa6a4;font-size:9px}.wa-live-led{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px #e1f7ec}
.wa-live-led.is-offline{background:#c7cecb;box-shadow:0 0 0 3px #eef1ef}
.wa-conversation{min-width:0;min-height:0;display:flex;flex-direction:column;background:#f6f8f6}.wa-conversation-header{height:64px;flex:none;display:flex;align-items:center;gap:11px;padding:0 18px;border-bottom:1px solid #e6ecea;background:#fff}.wa-header-avatar{width:39px;height:39px;font-size:14px}.wa-contact-title{min-width:0;flex:1}.wa-contact-title strong,.wa-contact-title span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-contact-title strong{font-size:12px}.wa-contact-title span{margin-top:3px;color:#94a09e;font-size:9px}.wa-header-actions{position:relative;display:flex;gap:2px}.wa-back-mobile{display:none}.wa-history-notice{flex:none;padding:7px 14px;background:#fff8e8;color:#947b38;text-align:center;font-size:9px}
.wa-message-area{position:relative;min-height:0;flex:1;overflow:auto;padding:20px clamp(12px,4vw,55px) 24px;scrollbar-width:thin;scrollbar-color:#ccd8d4 transparent}.wa-message-bg{position:fixed;inset:0;pointer-events:none;opacity:.12;background-image:radial-gradient(#88a99b .65px,transparent .65px);background-size:18px 18px}.wa-message-line{position:relative;display:flex;margin:7px 0}.wa-message-line.from-me{justify-content:flex-end}.wa-bubble{position:relative;max-width:min(76%,620px);min-width:95px;padding:9px 10px 6px;border:1px solid #e7ece9;border-radius:10px;background:#fff;box-shadow:0 1px 1px #1d332b08}.from-me .wa-bubble{border-color:#d1efdc;background:#e5f8ec;border-top-right-radius:3px}.from-them .wa-bubble{border-top-left-radius:3px}.wa-bubble p{margin:0;color:#273735;font-size:12px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.wa-message-meta{display:flex;justify-content:flex-end;align-items:center;gap:4px;margin-top:3px;color:#96a29f;font-size:8px}.wa-message-checks{display:flex;color:#9aa6a3}.wa-message-checks .is-read{color:#34a8cd}.wa-quoted{margin:0 0 7px;padding:6px 8px;border-left:3px solid #21ad76;border-radius:4px;background:#f3f7f5;color:#71807c;font-size:10px}.wa-media-load{display:flex;align-items:center;gap:8px;margin:4px 0 8px;padding:9px 12px;border:1px solid #b7dfcd;border-radius:8px;background:#f2fbf6;color:#078c5c;cursor:pointer;font-size:11px}.wa-media-load:disabled{opacity:.6;cursor:wait}.wa-media-error{display:block;color:#b4443d;font-size:10px;max-width:260px}.wa-media-link{display:flex;align-items:center;gap:8px;margin-bottom:5px;color:#078c5c;font-size:11px;text-decoration:none}.wa-history-button{position:relative;z-index:1;display:block;margin:0 auto 14px;padding:7px 12px;border:1px solid #e1eae6;border-radius:20px;background:#fff;color:#71817c;font-size:9px;cursor:pointer}.wa-message-empty{position:relative;z-index:1;min-height:220px}
.wa-message-actions{position:absolute;z-index:4;top:-27px;right:5px;display:flex;gap:2px;padding:3px;border:1px solid #e8eeeb;border-radius:8px;background:#fff;box-shadow:0 4px 12px #24393210}.from-them .wa-message-actions{right:auto;left:5px}.wa-message-actions>button,.wa-popover button{display:flex;align-items:center;gap:7px;padding:5px 6px;border:0;border-radius:5px;background:transparent;color:#657470;font-size:10px;white-space:nowrap;cursor:pointer}.wa-message-actions>button:hover,.wa-popover button:hover{background:#eff5f2;color:#087f55}.wa-popover{position:absolute;z-index:8;display:flex;padding:5px;border:1px solid #e5ece8;border-radius:9px;background:#fff;box-shadow:0 8px 25px #132e281c}.wa-emoji-picker{right:0;top:-38px}.wa-emoji-picker button{font-size:17px}.wa-message-menu{top:auto;bottom:30px;right:0;display:flex;min-width:150px;flex-direction:column}.wa-message-actions:hover .wa-message-menu,.wa-message-actions:focus-within .wa-message-menu{display:flex}.wa-message-menu button{padding:7px 9px;text-align:left}.wa-popover button.danger{color:#c44c45}.wa-chat-menu{top:40px;right:0;min-width:190px;flex-direction:column}.wa-chat-menu button{padding:8px 10px;text-align:left}
.wa-composer{position:relative;flex:none;padding:10px 16px 8px;border-top:1px solid #e4ebe8;background:#fff}.wa-composer-row{display:flex;align-items:flex-end;gap:7px;padding:5px 7px;border:1px solid #e2ebe7;border-radius:12px;background:#f8faf9}.wa-composer-icon{width:32px;height:34px;flex:none;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#82918c;cursor:pointer}.wa-composer textarea{min-height:34px;max-height:120px;flex:1;resize:vertical;padding:8px 3px;border:0;outline:0;background:transparent;color:#263a35;font:inherit;font-size:12px}.wa-send-button{width:34px;height:34px;flex:none;display:grid;place-items:center;border:0;border-radius:10px;background:#0aaf72;color:#fff;cursor:pointer}.wa-send-button:disabled{background:#c6d5ce;cursor:default}.wa-composer-hint{display:block;margin:5px 0 0 4px;color:#a2adaa;font-size:8px}.wa-hidden{display:none}.wa-reply-preview,.wa-attachment-preview{display:flex;align-items:center;gap:9px;margin:0 0 7px;padding:7px 10px;border-left:3px solid #0bb074;border-radius:5px;background:#f2f7f4;color:#6e7d78;font-size:10px}.wa-reply-preview>div{min-width:0;flex:1}.wa-reply-preview strong,.wa-reply-preview span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-reply-preview strong{color:#098a5a}.wa-reply-preview button,.wa-attachment-preview button{border:0;background:transparent;color:#81908b;cursor:pointer}.wa-attachment-preview span{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wa-recording{color:#e7524b;animation:wa-pulse .7s infinite}.wa-no-chat{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;padding:35px;text-align:center}.wa-no-chat-art{width:88px;height:88px;display:grid;place-items:center;border-radius:50%;background:#e6f7ee;color:#08a86b}.wa-no-chat h2{margin:22px 0 8px;color:#223835;font-size:20px;letter-spacing:-.04em}.wa-no-chat p{max-width:350px;margin:0;color:#8c9995;font-size:12px;line-height:1.6}.wa-no-chat>div:last-child{display:flex;align-items:center;gap:8px;margin-top:22px;color:#72827b;font-size:10px}
.wa-modal-backdrop,.wa-resource-backdrop{position:fixed;z-index:100;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:#12292366;backdrop-filter:blur(2px)}.wa-modal{width:min(640px,100%);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 18px 65px #10292135}.wa-modal header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #edf1ef}.wa-modal h2{margin:0;font-size:15px}.wa-modal header span{color:#84908c;font-size:10px}.wa-modal pre,.wa-resource-result pre{overflow:auto;margin:0;padding:15px;background:#f6f8f7;color:#41504c;font:11px/1.55 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.wa-resource-backdrop{justify-content:flex-end;padding:0}.wa-resource-panel{width:min(1050px,100%);height:100%;display:flex;flex-direction:column;background:#f8faf9;box-shadow:-15px 0 50px #0c2b211a}.wa-resource-header{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 24px 17px;border-bottom:1px solid #e4ece8;background:#fff}.wa-resource-header span{color:#11a46b;font-size:9px;font-weight:800;letter-spacing:.13em}.wa-resource-header h2{margin:5px 0 2px;font-size:20px;letter-spacing:-.04em}.wa-resource-header p,.wa-resource-header small{display:block;margin:0;color:#899590;font-size:10px}.wa-resource-header small{margin-top:5px;max-width:650px;color:#9b8655;font-size:9px}.wa-resource-search{height:38px;flex:none;display:flex;align-items:center;gap:8px;margin:13px 17px;padding:0 10px;border:1px solid #e1e9e5;border-radius:8px;background:#fff;color:#92a09a}.wa-resource-search input{flex:1;border:0;outline:0;background:transparent;font-size:11px}.wa-resource-layout{min-height:0;flex:1;display:grid;grid-template-columns:310px minmax(0,1fr);overflow:hidden}.wa-resource-list{min-height:0;overflow:auto;padding:0 10px 20px 17px;border-right:1px solid #e4ece8;background:#fff}.wa-resource-list h3{margin:12px 0 5px;color:#92a09a;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.wa-resource-list section button{position:relative;width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:3px;margin:2px 0;padding:8px 9px;border:0;border-radius:7px;background:transparent;text-align:left;cursor:pointer}.wa-resource-list section button:hover,.wa-resource-list section button.active{background:#edf7f2}.wa-resource-list section button>span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#34443e;font-size:10px;font-weight:650}.wa-resource-list section button small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1aaa6;font:9px ui-monospace,monospace}.wa-resource-list section button em{position:absolute;top:7px;right:7px;color:#c1852a;font-size:8px;font-style:normal}.wa-resource-list section button.disabled>span{color:#a6aeaa}.wa-resource-detail{min-height:0;overflow:auto;padding:18px 20px 30px}.wa-operation-heading{padding-bottom:12px;border-bottom:1px solid #e5ece8}.wa-operation-heading>div{display:flex;align-items:center;gap:8px}.wa-operation-heading strong{font-size:14px}.wa-operation-heading code{display:block;margin-top:8px;color:#438d70;font:10px ui-monospace,monospace}.wa-operation-heading p{margin:5px 0 0;color:#99a39f;font-size:9px}.wa-method{padding:4px 6px;border-radius:4px;background:#e9f1ed;color:#58806d;font:800 8px ui-monospace,monospace}.method-post{background:#e6f5ec;color:#128352}.method-delete{background:#ffebea;color:#b84d45}.method-patch,.method-put{background:#fff4df;color:#a67925}
.wa-schema-block{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:13px 0;border-bottom:1px solid #e9efec}.wa-schema-block h3{grid-column:1/-1;margin:0;color:#41514b;font-size:10px}.wa-schema-block label{min-width:0;display:flex;flex-direction:column;gap:4px;color:#45534f;font-size:9px;font-weight:700}.wa-schema-block label small{color:#a0aaa6;font-size:8px;font-weight:400}.wa-schema-block label small b{color:#b0782c;font-weight:600}.wa-schema-block input,.wa-schema-block select,.wa-schema-block textarea{width:100%;min-height:32px;padding:6px 8px;border:1px solid #e0e8e4;border-radius:6px;outline:none;background:#fff;color:#34443e;font:10px ui-monospace,monospace}.wa-schema-block textarea{resize:vertical}.wa-resource-run{display:flex;align-items:center;gap:10px;padding:14px 0}.wa-run-button{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 13px;border:0;border-radius:7px;background:#0aa96d;color:#fff;font-size:10px;font-weight:700;cursor:pointer}.wa-run-button:disabled{background:#b7c7c0;cursor:default}.wa-resource-run span{color:#9c8a67;font-size:9px}.wa-resource-error{margin-bottom:11px;padding:9px;border:1px solid #ffd6d2;border-radius:7px;background:#fff0ef;color:#b4443d;font-size:10px}.wa-resource-result{overflow:hidden;border:1px solid #e1e9e5;border-radius:8px;background:#fff}.wa-resource-result>div{display:flex;justify-content:space-between;padding:9px 11px;color:#465650;font-size:10px}.wa-resource-result button{border:0;background:none;color:#16865c;font-size:9px;cursor:pointer}.wa-resource-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#a2ada8;text-align:center}.wa-resource-placeholder strong{color:#5f7068;font-size:12px}.wa-resource-placeholder span{max-width:240px;font-size:10px;line-height:1.5}.wa-spin{animation:wa-spin .9s linear infinite}@keyframes wa-spin{to{transform:rotate(360deg)}}@keyframes wa-pulse{50%{opacity:.38}}
.wa-image-preview{padding:0;border:0;background:transparent;cursor:zoom-in;display:block;max-width:min(330px,70vw);margin-bottom:5px;border-radius:7px;overflow:hidden}.wa-image-preview img{display:block;max-width:100%;max-height:280px;object-fit:cover}.wa-video-preview{width:min(350px,70vw);max-height:280px;display:block;margin-bottom:5px;border-radius:7px}.wa-audio-preview{width:min(330px,70vw);height:38px;display:block;margin:2px 0 5px}.wa-message-checks.delivery-read{color:#34a8cd}.wa-message-checks.delivery-failed{color:#d34d46}.wa-message-checks.delivery-unknown{font-size:7px}.wa-touch-message-trigger{position:absolute;right:4px;bottom:2px;width:26px;height:23px;display:grid;place-items:center;border:0;border-radius:6px;background:#ffffffc9;color:#77857e;cursor:pointer;opacity:0}.wa-bubble:hover .wa-touch-message-trigger,.wa-bubble:focus-within .wa-touch-message-trigger{opacity:1}.wa-message-meta{padding-right:25px}.wa-inline-emoji-picker{display:flex;flex-wrap:wrap;max-width:180px}.wa-inline-emoji-picker button{font-size:18px;padding:5px}
.wa-live-events{flex:none;max-height:38vh;overflow:auto;margin:0 17px 10px;border:1px solid #e2eae6;border-radius:8px;background:#fff}.wa-live-events>summary{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;padding:9px 11px;background:#f2f7f4;color:#456057;font-size:10px;font-weight:700;cursor:pointer;list-style:none}.wa-live-events>summary span{color:#8c9a94;font-size:9px;font-weight:500}.wa-events-empty{padding:12px;color:#95a19b;font-size:10px}.wa-event-entry{border-top:1px solid #eff2f0}.wa-event-entry>summary{display:flex;gap:9px;padding:7px 10px;color:#6a7872;font-size:9px;cursor:pointer;list-style:none}.wa-event-entry time{color:#9aa6a1}.wa-event-entry strong{color:#328262;text-transform:lowercase}.wa-event-entry pre{max-height:240px;overflow:auto;padding:10px;background:#f8faf9;color:#65736d;font:9px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
@media(max-width:900px){.wa-workspace{grid-template-columns:300px minmax(0,1fr);margin:10px}.wa-brand{min-width:160px}.wa-resource-layout{grid-template-columns:260px minmax(0,1fr)}}
@media(max-width:680px){.wa-touch-message-trigger{opacity:1}.wa-page{height:100%}.wa-topbar{height:56px;padding:0 12px;gap:8px}.wa-brand{min-width:0;flex:1}.wa-brand-icon{width:32px;height:32px}.wa-brand strong{font-size:12px}.wa-brand small{font-size:9px}.wa-topbar-status{margin:0;font-size:9px}.wa-version{display:none}.wa-workspace{position:relative;display:block;margin:0;border:0;border-radius:0;box-shadow:none}.wa-chat-sidebar,.wa-conversation{position:absolute;inset:0}.wa-chat-sidebar{border:0}.wa-conversation{display:none}.wa-workspace.mobile-chat-open .wa-chat-sidebar{display:none}.wa-workspace.mobile-chat-open .wa-conversation{display:flex}.wa-back-mobile{display:grid}.wa-sidebar-heading{height:62px}.wa-chat-row{min-height:72px}.wa-message-area{padding:14px 10px 18px}.wa-bubble{max-width:86%}.wa-composer{padding:8px}.wa-composer-hint{display:none}.wa-touch-message-trigger{position:absolute;right:4px;bottom:2px;width:26px;height:23px;display:grid;place-items:center;border:0;border-radius:6px;background:#ffffffc9;color:#77857e}.wa-resource-panel{width:100%}.wa-resource-layout{grid-template-columns:130px minmax(0,1fr)}.wa-resource-list{padding:0 5px 15px}.wa-resource-list section button{padding:7px 5px}.wa-resource-list section button>span{font-size:9px}.wa-resource-list section button small{display:none}.wa-resource-list section button em{position:static}.wa-resource-detail{padding:13px 10px}.wa-schema-block{grid-template-columns:1fr}.wa-resource-header{padding:15px}.wa-schema-block h3{grid-column:1}.wa-setup{margin:8px;align-items:flex-start}.wa-setup button{flex:none}.wa-alerts{top:60px}.wa-live-events{margin:0 8px 8px}}
.wa-image-viewer{position:fixed;inset:0;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:64px 20px 24px;border:0;background:rgba(15,23,28,.96);color:#fff;box-sizing:border-box}.wa-image-viewer::backdrop{background:#0f171c}.wa-image-viewer[open]{display:flex;align-items:center;justify-content:center}.wa-image-viewer figure{margin:0;max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:16px;pointer-events:none}.wa-image-viewer figure img{min-height:0;max-width:100%;max-height:calc(100dvh - 150px);object-fit:contain;pointer-events:auto}.wa-image-viewer figcaption{max-width:800px;max-height:60px;overflow:auto;font-size:14px;text-align:center;white-space:pre-wrap;pointer-events:auto}.wa-image-viewer-close{position:absolute;top:16px;right:20px;width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:#ffffff18;color:#fff;cursor:pointer}
.from-them .wa-message-menu{left:0;right:auto}.wa-message-menu{max-width:calc(100vw - 32px)}.wa-message-reactions{display:flex;gap:3px;margin-top:7px;width:fit-content;padding:3px 7px;border:1px solid #cce3d6;border-radius:14px;background:#fff;box-shadow:0 1px 3px #18382a12;font-size:16px;line-height:22px}
.wa-quoted strong{display:block;margin-bottom:3px;color:#13805b;font-size:10px}.wa-quoted span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap}
.wa-message-reactions button{border:0;background:transparent;padding:0 2px;font-size:16px;cursor:pointer}.wa-reaction-details{width:min(400px,100%)}.wa-reaction-person{display:flex;align-items:center;gap:14px;padding:16px 20px;border:0;border-bottom:1px solid #edf1ef;background:#fff;text-align:left;cursor:pointer;color:#203331}.wa-reaction-person:disabled{opacity:1;cursor:default}.wa-reaction-person small{display:block;margin-top:4px;color:#84908c;font-size:11px}.wa-reaction-emoji{font-size:26px}
.wa-quoted{display:block;width:100%;border:0;border-left:3px solid #21ad76;text-align:left;cursor:pointer}

/* A conversa cabe na área disponível dentro da Central administrativa. */
.wa-topbar { height: 56px; padding-inline: 16px; gap: 12px; }
.wa-workspace { grid-template-columns: clamp(250px, 24vw, 310px) minmax(0, 1fr); margin: 12px; border-radius: 12px; box-shadow: none; }
.wa-icon-button { flex-shrink: 0; }
.wa-setup { flex-wrap: wrap; }
.wa-setup > div { min-width: 0; overflow-wrap: anywhere; }
.wa-modal { max-height: calc(100dvh - 32px); }
.wa-resource-detail { min-width: 0; }
.wa-operation-heading { overflow-wrap: anywhere; }
@media (max-width: 1023px) {
  .wa-brand { min-width: 0; }
  .wa-workspace { grid-template-columns: 270px minmax(0, 1fr); }
  .wa-version { display: none; }
  .wa-search input, .wa-composer textarea, .wa-resource-search input,
  .wa-schema-block input, .wa-schema-block select, .wa-schema-block textarea { font-size: 16px; }
  .wa-icon-button { width: 40px; height: 40px; }
}
@media (max-width: 680px) {
  .wa-topbar { height: auto; min-height: 52px; padding: 6px 8px; gap: 4px; flex-wrap: wrap; }
  .wa-topbar-status { max-width: 100%; flex-wrap: wrap; }
  .wa-workspace { margin: 0; border: 0; border-radius: 0; }
  .wa-alerts { top: 58px; }
  .wa-resource-header { padding: 12px; }
  .wa-schema-block { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 359px) {
  .wa-topbar-status { order: 1; width: 100%; justify-content: flex-end; }
}
@media (max-height: 500px) {
  .wa-sidebar-heading { height: 48px; }
  .wa-conversation-header { height: 48px; }
  .wa-resource-header { max-height: 30dvh; overflow-y: auto; flex-shrink: 0; }
  .wa-topbar { height: auto; min-height: 44px; padding-block: 4px; }
  .wa-workspace { margin: 4px; }
  .wa-history-notice { padding-block: 4px; }
  .wa-message-area { padding: 6px 10px; }
  .wa-composer { padding: 4px 8px; }
  .wa-composer textarea { height: 36px; min-height: 36px; max-height: 60px; padding-block: 4px; }
  .wa-composer-hint { display: none; }
}
</style>
