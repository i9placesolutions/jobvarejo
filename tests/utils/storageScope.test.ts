import { describe, expect, it } from 'vitest'
import {
  isLegacyProjectPageKey,
  isLegacyUserProjectKey,
  isStorageKeyAllowedForUser,
  isUserProjectKey
} from '../../server/utils/storage-scope'

describe('escopo das chaves de armazenamento', () => {
  const ownerId = 'eb847e8e-7c19-4bee-8042-376528ce6192'
  const otherId = 'a17dfe10-8f34-419b-a3ce-322cf3b01f34'
  const projectId = '3332dded-8ac7-4ade-b4df-2369caaa378c'
  const pageId = '0f5e503f-5dbe-407c-8f46-8351a77a2e26'

  it('aceita a chave atual e a chave legada do próprio usuário', () => {
    const current = `projects/${ownerId}/project/page.json`
    const legacy = `${ownerId}/${projectId}/pages/${pageId}/selo.json.gz`
    expect(isUserProjectKey(current, ownerId)).toBe(true)
    expect(isLegacyUserProjectKey(legacy, ownerId)).toBe(true)
    expect(isStorageKeyAllowedForUser(current, ownerId)).toBe(true)
    expect(isStorageKeyAllowedForUser(legacy, ownerId)).toBe(true)
  })

  it('não permite chave legada de outro usuário', () => {
    const foreign = `${otherId}/${projectId}/pages/${pageId}/selo.json.gz`
    expect(isLegacyUserProjectKey(foreign, ownerId)).toBe(false)
    expect(isStorageKeyAllowedForUser(foreign, ownerId)).toBe(false)
  })

  it('rejeita formato legado fora da estrutura de páginas do projeto', () => {
    const malformed = `${ownerId}/arquivo-solto.json.gz`
    expect(isLegacyProjectPageKey(malformed)).toBe(false)
    expect(isLegacyUserProjectKey(malformed, ownerId)).toBe(false)
    expect(isStorageKeyAllowedForUser(malformed, ownerId)).toBe(false)
  })
})
