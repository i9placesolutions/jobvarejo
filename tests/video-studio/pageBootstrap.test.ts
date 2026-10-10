import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Executa o hook real da página sem montar Remotion nem abrir conexões externas.
const source = readFileSync(new URL('../../pages/videos/index.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
const ast = ts.createSourceFile('video-page.ts', source, ts.ScriptTarget.Latest, true)
let hook = ''
ast.forEachChild(node => {
  if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'onMounted') hook = node.expression.arguments[0]!.getText(ast)
})
const compiled = ts.transpile(`const bootstrap = ${hook}`, { target: ts.ScriptTarget.ES2022 })

function harness(selected = '') {
  const context = {
    auth: { isAuthenticated: { value: true }, user: { value: { id: 'user' } as object | null }, getSession: vi.fn() },
    route: { query: { project: selected } }, refreshLibrary: vi.fn().mockResolvedValue(undefined), openVideo: vi.fn().mockResolvedValue(undefined),
    navigateTo: vi.fn(), sayError: vi.fn(), loading: { value: true }, view: { value: 'editor' },
    refreshHealth: vi.fn(), projectId: { value: 'project' }, liveJobs: { value: false }, activeJobs: { value: [] }, refreshJobs: vi.fn().mockResolvedValue(undefined),
  }
  const runtime = new Function(...Object.keys(context), `let poll; let pageDisposed = false; ${compiled}; return { bootstrap, dispose: () => { pageDisposed = true }, timer: () => poll }`)(...Object.values(context))
  return { context, ...runtime }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('entrada e polling da área de vídeos', () => {
  it('abre link direto sem reconsultar sessão ou baixar a biblioteca', async () => {
    vi.useFakeTimers()
    const h = harness('video-id')
    await h.bootstrap()
    expect(h.context.auth.getSession).not.toHaveBeenCalled()
    expect(h.context.refreshLibrary).not.toHaveBeenCalled()
    expect(h.context.openVideo).toHaveBeenCalledWith('video-id')
  })
  it('carrega a biblioteca na entrada sem projeto', async () => {
    vi.useFakeTimers()
    const h = harness()
    await h.bootstrap()
    expect(h.context.refreshLibrary).toHaveBeenCalledOnce()
    expect(h.context.openVideo).not.toHaveBeenCalled()
  })
  it('restaura sessão ausente e recusa sessão inválida antes dos dados', async () => {
    const h = harness()
    h.context.auth.isAuthenticated.value = false
    h.context.auth.user.value = null
    h.context.auth.getSession.mockResolvedValue(null)
    await h.bootstrap()
    expect(h.context.auth.getSession).toHaveBeenCalledOnce()
    expect(h.context.navigateTo).toHaveBeenCalledWith('/auth/login', { replace: true })
    expect(h.context.refreshLibrary).not.toHaveBeenCalled()
    expect(h.timer()).toBeUndefined()
  })
  it('não deixa timer ativo se a página sair durante o carregamento', async () => {
    vi.useFakeTimers()
    const h = harness()
    let finish!: () => void
    h.context.refreshLibrary.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const pending = h.bootstrap()
    h.dispose()
    finish()
    await pending
    expect(h.timer()).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('suspende polling oculto e retoma ao voltar: 20 chamadas por minuto passam a zero em segundo plano', async () => {
    vi.useFakeTimers()
    const visibility = { hidden: true }
    vi.stubGlobal('document', visibility)
    const h = harness()
    await h.bootstrap()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.context.refreshHealth).not.toHaveBeenCalled()
    expect(h.context.refreshJobs).not.toHaveBeenCalled()
    visibility.hidden = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(h.context.refreshHealth).toHaveBeenCalledTimes(10)
    expect(h.context.refreshJobs).toHaveBeenCalledTimes(10)
  })
})
