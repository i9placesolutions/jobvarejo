import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmInSystem, alertInSystem, closeSystemMessage, systemMessage } from '../../utils/systemMessages'
afterEach(() => { while (systemMessage.value) closeSystemMessage(false); vi.unstubAllGlobals() })
describe('Mensagens dentro do sistema', () => {
  it('aguarda confirmação sem executar ação automaticamente', async () => {
    vi.stubGlobal('window', {})
    const result = confirmInSystem('Excluir?')
    expect(systemMessage.value?.message).toBe('Excluir?')
    closeSystemMessage(false)
    expect(await result).toBe(false)
  })
  it('mantém avisos simultâneos na ordem sem perder confirmações', async () => {
    vi.stubGlobal('window', {})
    const first = confirmInSystem('Primeiro')
    const second = alertInSystem('Segundo')
    closeSystemMessage(true)
    expect(await first).toBe(true)
    expect(systemMessage.value?.message).toBe('Segundo')
    expect(systemMessage.value?.confirm).toBe(false)
    closeSystemMessage(true)
    expect(await second).toBe(true)
    expect(systemMessage.value).toBeNull()
  })
})
