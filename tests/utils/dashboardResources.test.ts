import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDashboardResources } from '../../utils/dashboardResources'

afterEach(() => vi.useRealTimers())
const later = <T>(value: T, ms: number) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms))

describe('carregamento progressivo da biblioteca', () => {
  it('libera cards em 50 ms mesmo com perfil/pastas pendentes até 700 ms', async () => {
    vi.useFakeTimers()
    const onProjects = vi.fn(), onProfile = vi.fn(), onProjectsReady = vi.fn()
    const pending = loadDashboardResources({
      projects: later([{ id: 'project' }], 50), profile: later({ name: 'Loja' }, 400), folders: later([], 700),
      isCurrent: () => true, onProjects, onProfile, onProjectsReady,
    })
    await vi.advanceTimersByTimeAsync(49)
    expect(onProjectsReady).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onProjects).toHaveBeenCalledWith([{ id: 'project' }])
    expect(onProjectsReady).toHaveBeenCalledOnce()
    expect(onProfile).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(650)
    await pending
    expect(onProfile).toHaveBeenCalledWith({ name: 'Loja' })
  })
  it('encerra o loader quando projetos falham, sem esperar os demais', async () => {
    vi.useFakeTimers()
    const onProjects = vi.fn(), onProjectsReady = vi.fn()
    const pending = loadDashboardResources({ projects: Promise.reject(Error('network')), profile: later(null, 500), folders: later([], 500), isCurrent: () => true, onProjects, onProfile: vi.fn(), onProjectsReady })
    await vi.advanceTimersByTimeAsync(0)
    expect(onProjects).toHaveBeenCalledWith([])
    expect(onProjectsReady).toHaveBeenCalledOnce()
    await vi.runAllTimersAsync()
    await pending
  })
  it('preserva os projetos se perfil ou pastas falharem', async () => {
    const onProjects = vi.fn()
    await loadDashboardResources({ projects: Promise.resolve([1]), profile: Promise.reject(Error()), folders: Promise.reject(Error()), isCurrent: () => true, onProjects, onProfile: vi.fn(), onProjectsReady: vi.fn() })
    expect(onProjects).toHaveBeenCalledWith([1])
  })
  it('ignora respostas após descarte da página ou troca de usuário', async () => {
    const onProjects = vi.fn(), onProfile = vi.fn(), onProjectsReady = vi.fn()
    await loadDashboardResources({ projects: Promise.resolve([1]), profile: Promise.resolve({ name: 'Outra conta' }), folders: Promise.resolve([]), isCurrent: () => false, onProjects, onProfile, onProjectsReady })
    expect(onProjects).not.toHaveBeenCalled()
    expect(onProfile).not.toHaveBeenCalled()
    expect(onProjectsReady).not.toHaveBeenCalled()
  })
})
