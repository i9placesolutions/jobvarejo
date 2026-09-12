import { afterEach, expect, it, vi } from 'vitest'
import { createEditorThumbnailQueue } from '../../utils/editorThumbnailQueue'
afterEach(() => vi.useRealTimers())

it('atualiza páginas independentes sem descartar a segunda por intervalo', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000)
  const apply = vi.fn()
  const queue = createEditorThumbnailQueue<string>(async (_id, data) => data, apply)
  queue.schedule('page2', 'produtos2', 10000)
  await vi.advanceTimersByTimeAsync(1)
  queue.schedule('page3', 'produtos3', 10000)
  await vi.advanceTimersByTimeAsync(1)
  expect(apply).toHaveBeenCalledWith('page3', 'produtos3', 'produtos3')
  queue.dispose()
})

it('atualiza ao fim do intervalo usando o último conteúdo, mesmo sem outra edição', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000)
  const apply = vi.fn()
  const queue = createEditorThumbnailQueue<string>(async (_id, data) => data, apply)
  queue.schedule('page3', 'fundo', 10000)
  await vi.advanceTimersByTimeAsync(1)
  queue.schedule('page3', 'primeiro produto', 10000)
  queue.schedule('page3', 'todos os produtos', 10000)
  await vi.advanceTimersByTimeAsync(10000)
  expect(apply).toHaveBeenLastCalledWith('page3', 'todos os produtos', 'todos os produtos')
  expect(apply).toHaveBeenCalledTimes(2)
  queue.dispose()
})

it('descarta render antigo concluído depois de uma nova edição', async () => {
  vi.useFakeTimers(); vi.setSystemTime(100000)
  let resolve!: (value: string) => void
  const apply = vi.fn()
  const queue = createEditorThumbnailQueue<string>(async (_id, data) => data === 'antigo' ? new Promise<string>(r => { resolve = r }) : data, apply)
  queue.schedule('page', 'antigo', 100)
  await vi.advanceTimersByTimeAsync(1)
  queue.schedule('page', 'novo', 100)
  resolve('antigo')
  await vi.advanceTimersByTimeAsync(101)
  expect(apply).toHaveBeenCalledExactlyOnceWith('page', 'novo', 'novo')
  queue.dispose()
})

it('não publica uma miniatura após encerrar o editor', async () => {
  vi.useFakeTimers()
  const apply = vi.fn()
  const queue = createEditorThumbnailQueue<string>(async (_id, data) => data, apply)
  queue.schedule('page', 'imagem', 100)
  queue.dispose()
  await vi.runAllTimersAsync()
  expect(apply).not.toHaveBeenCalled()
})
