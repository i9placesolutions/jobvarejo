import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterEach, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../../pages/radio-indoor/index.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('radio-page.ts', source, ts.ScriptTarget.Latest, true)
const names = ['loadAll', 'changeStation', 'refreshPendingRequests', 'refreshPlayerQueue']
const declarations: string[] = []
ast.forEachChild(node => {
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => names.includes(item.name.getText(ast)))) declarations.push(node.getText(ast))
})
const compiled = ts.transpile(declarations.join('\n'), { target: ts.ScriptTarget.ES2022 })
function deferred() {
  let resolve!: (value?: any) => void
  const promise = new Promise<any>(done => { resolve = done })
  return { promise, resolve }
}
function harness() {
  const context = {
    radio: {
      loadBootstrap: vi.fn().mockResolvedValue({}), loadCatalog: vi.fn().mockResolvedValue({}), loadPlayer: vi.fn().mockResolvedValue({}),
      loadRequests: vi.fn().mockResolvedValue({}), loadVoices: vi.fn().mockResolvedValue({}), loadMembers: vi.fn().mockResolvedValue({}),
      registerCache: vi.fn().mockResolvedValue(true), prefetchQueue: vi.fn().mockResolvedValue(undefined), switchStation: vi.fn().mockResolvedValue({}),
      requests: { value: [{ id: 'request', providerTaskId: 'provider', status: 'pending' }] }, catalog: { value: [] }, playerData: { value: {} },
    },
    memberForm: { stationIds: [] as string[] }, selectedStationId: { value: 'station' }, requestPlaylistId: { value: '' },
    selectedPlaylistId: { value: '' }, playlists: { value: [] }, queue: { value: [{ id: 'track' }] }, currentTrack: { value: null },
    showNotice: vi.fn(), showStationEditForm: { value: false }, audioRef: { value: { pause: vi.fn(), paused: true, play: vi.fn() } },
    progress: { value: 0 }, duration: { value: 0 }, isPlaying: { value: true }, station: { value: { name: 'Loja' } }, refreshRequest: vi.fn().mockResolvedValue({}),
  }
  const runtime = new Function(...Object.keys(context), `let pageDisposed = false, refreshingRequests = false, refreshingPlayer = false, lastScheduleSignature = ''; ${compiled}; return { ${names.join(', ')}, dispose: () => { pageDisposed = true } }`)(...Object.values(context))
  return { ...runtime, context }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('libera a reprodução sem esperar registro do cache ou downloads antecipados', async () => {
  vi.useFakeTimers()
  const h = harness(); const download = deferred(); const registration = deferred()
  h.context.radio.registerCache.mockReturnValue(registration.promise)
  h.context.radio.prefetchQueue.mockReturnValue(download.promise)
  const ready = vi.fn()
  void h.loadAll().then(ready)
  await vi.advanceTimersByTimeAsync(0)
  expect(ready).toHaveBeenCalledOnce()
  expect(h.context.currentTrack.value).toEqual({ id: 'track' })
  expect(h.context.radio.prefetchQueue).not.toHaveBeenCalled()
  registration.resolve(true); await vi.advanceTimersByTimeAsync(0)
  expect(h.context.radio.prefetchQueue).toHaveBeenCalledOnce()
  download.resolve()
})
it('troca de loja sem repetir a consulta de equipe já feita por switchStation', async () => {
  const h = harness()
  await h.changeStation()
  expect(h.context.radio.switchStation).toHaveBeenCalledWith('station')
  expect(h.context.radio.loadMembers).not.toHaveBeenCalled()
})
it('não continua o carregamento se a página sair durante o bootstrap', async () => {
  const h = harness(); const bootstrap = deferred()
  h.context.radio.loadBootstrap.mockReturnValue(bootstrap.promise)
  const pending = h.loadAll(); h.dispose(); bootstrap.resolve(); await pending
  expect(h.context.radio.loadPlayer).not.toHaveBeenCalled()
  expect(h.context.radio.prefetchQueue).not.toHaveBeenCalled()
})
it('não consulta solicitações ocultas nem inicia lotes sobrepostos', async () => {
  const visibility = { hidden: true }; vi.stubGlobal('document', visibility)
  const h = harness(); const request = deferred()
  h.context.refreshRequest.mockReturnValue(request.promise)
  await h.refreshPendingRequests()
  expect(h.context.refreshRequest).not.toHaveBeenCalled()
  visibility.hidden = false
  const first = h.refreshPendingRequests()
  await h.refreshPendingRequests()
  expect(h.context.refreshRequest).toHaveBeenCalledOnce()
  request.resolve({}); await first
  expect(h.context.radio.loadRequests).toHaveBeenCalledOnce()
})
it('recupera o polling após falha na atualização da lista sem rejeição não tratada', async () => {
  vi.stubGlobal('document', { hidden: false })
  const h = harness()
  h.context.radio.loadRequests.mockRejectedValueOnce(new Error('offline'))
  await expect(h.refreshPendingRequests()).resolves.toBeUndefined()
  await h.refreshPendingRequests()
  expect(h.context.radio.loadRequests).toHaveBeenCalledTimes(2)
})
it('mantém a programação atualizada com aba oculta e evita sobreposição de consultas lentas', async () => {
  vi.stubGlobal('document', { hidden: true })
  const h = harness(); const player = deferred(); const download = deferred()
  h.context.radio.loadPlayer.mockReturnValue(player.promise)
  h.context.radio.prefetchQueue.mockReturnValue(download.promise)
  const first = h.refreshPlayerQueue()
  await h.refreshPlayerQueue()
  expect(h.context.radio.loadPlayer).toHaveBeenCalledOnce()
  player.resolve({}); await first
  expect(h.context.radio.prefetchQueue).toHaveBeenCalledOnce()
  download.resolve()
})
