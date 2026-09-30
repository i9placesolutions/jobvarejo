import { afterEach, expect, it, vi } from 'vitest'
import { runPageEnhancementBatch } from '../../utils/pageEnhancementBatch'

afterEach(() => vi.useRealTimers())

it('processa seis páginas em três etapas com no máximo duas chamadas simultâneas', async () => {
  vi.useFakeTimers()
  const started = Date.now()
  const pages = ['a', 'b', 'c', 'd', 'e', 'f']
  const calls: string[] = []
  let active = 0, peak = 0
  const task = runPageEnhancementBatch(pages, async page => {
    calls.push(page); active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 180_000))
    active--
  })
  expect(calls).toEqual(['a', 'b'])
  await vi.runAllTimersAsync(); await task
  expect(calls).toEqual(pages)
  expect(peak).toBe(2)
  expect(Date.now() - started).toBe(540_000)
})

it('a pausa não inicia novas páginas e aguarda as duas já enviadas', async () => {
  let pause = false
  const releases: (() => void)[] = []
  const calls: number[] = []
  const task = runPageEnhancementBatch([1, 2, 3, 4], async page => {
    calls.push(page)
    await new Promise<void>(resolve => releases.push(resolve))
  }, () => pause)
  pause = true
  releases.forEach(resolve => resolve())
  await task
  expect(calls).toEqual([1, 2])
})

it('uma falha interrompe novos envios sem abandonar a outra página em andamento', async () => {
  const error = new Error('resultado incerto')
  let fail!: (error: Error) => void, finish!: () => void, settled = false
  const calls: number[] = []
  const task = runPageEnhancementBatch([1, 2, 3, 4], page => {
    calls.push(page)
    return page === 1 ? new Promise((_resolve, reject) => { fail = reject }) : new Promise<void>(resolve => { finish = resolve })
  })
  const result = task.catch(reason => { settled = true; return reason })
  fail(error)
  await Promise.resolve(); await Promise.resolve()
  expect(settled).toBe(false)
  finish()
  expect(await result).toBe(error)
  expect(calls).toEqual([1, 2])
})

it('conclusões fora de ordem liberam a próxima página sem repetir pedidos', async () => {
  const releases = new Map<number, () => void>()
  const calls: number[] = []
  const task = runPageEnhancementBatch([1, 2, 3], async page => {
    calls.push(page)
    await new Promise<void>(resolve => releases.set(page, resolve))
  })
  releases.get(2)!()
  await Promise.resolve(); await Promise.resolve()
  expect(calls).toEqual([1, 2, 3])
  releases.get(3)!(); releases.get(1)!()
  await task
  expect(calls).toEqual([1, 2, 3])
})

it('não envia nada quando a janela já foi encerrada', async () => {
  const run = vi.fn()
  await runPageEnhancementBatch([1, 2], run, () => true)
  expect(run).not.toHaveBeenCalled()
})
