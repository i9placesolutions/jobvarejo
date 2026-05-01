import { describe, it, expect } from 'vitest'
import {
  getAdaptiveCoalesceDelayMs,
  shouldSkipLifecycleSave,
  shouldRunHeavySanitizeForReason,
  canAllowEmptyOverwrite,
  shouldSkipAutoSave,
  shouldSkipThumbnailForReason,
  getThumbnailMinIntervalMs,
  canGenerateThumbnailNow,
  shouldSkipByFingerprint,
  isDuplicateHistoryEntry,
  PERIODIC_SAVE_INTERVAL_MS
} from '~/utils/editorSavePolicy'

describe('getAdaptiveCoalesceDelayMs — coalesce dinamico por carga', () => {
  it('reason fora de object:* nao coalesce (retorna 0)', () => {
    expect(getAdaptiveCoalesceDelayMs('history:undo', 5000)).toBe(0)
    expect(getAdaptiveCoalesceDelayMs('lifecycle:mount', 0)).toBe(0)
    expect(getAdaptiveCoalesceDelayMs('', 999)).toBe(0)
  })

  it('escala por objectCount em 5 faixas', () => {
    expect(getAdaptiveCoalesceDelayMs('object:modified', 50)).toBe(80)
    expect(getAdaptiveCoalesceDelayMs('object:modified', 100)).toBe(150)
    expect(getAdaptiveCoalesceDelayMs('object:modified', 299)).toBe(150)
    expect(getAdaptiveCoalesceDelayMs('object:modified', 300)).toBe(280)
    expect(getAdaptiveCoalesceDelayMs('object:modified', 700)).toBe(450)
    expect(getAdaptiveCoalesceDelayMs('object:modified', 1200)).toBe(600)
    expect(getAdaptiveCoalesceDelayMs('object:added', 5000)).toBe(600)
  })
})

describe('shouldSkipLifecycleSave — janela anti-flicker apos transform', () => {
  it('bloqueia lifecycle:* dentro de 350ms apos transform', () => {
    const now = 1000
    expect(shouldSkipLifecycleSave('lifecycle:mount', 800, now)).toBe(true)
    expect(shouldSkipLifecycleSave('lifecycle:resize', 700, now)).toBe(true)
  })

  it('libera lifecycle:* apos 350ms', () => {
    const now = 1000
    expect(shouldSkipLifecycleSave('lifecycle:mount', 600, now)).toBe(false)
    expect(shouldSkipLifecycleSave('lifecycle:mount', 0, now)).toBe(false)
  })

  it('outras razoes nunca sao puladas por essa politica', () => {
    const now = 1000
    expect(shouldSkipLifecycleSave('object:modified', 999, now)).toBe(false)
    expect(shouldSkipLifecycleSave('history:undo', 999, now)).toBe(false)
  })
})

describe('shouldRunHeavySanitizeForReason — quando rodar passada pesada de sanitize', () => {
  it('retorna true para razoes que justificam sanitize completo', () => {
    expect(shouldRunHeavySanitizeForReason('post-load')).toBe(true)
    expect(shouldRunHeavySanitizeForReason('lifecycle:mount')).toBe(true)
    expect(shouldRunHeavySanitizeForReason('frame-fix')).toBe(true)
    expect(shouldRunHeavySanitizeForReason('history:redo')).toBe(true)
    expect(shouldRunHeavySanitizeForReason('post-load-cleanup')).toBe(true)
    expect(shouldRunHeavySanitizeForReason('load-from-snapshot')).toBe(true)
  })

  it('retorna false para razoes triviais (sem sanitize pesada)', () => {
    expect(shouldRunHeavySanitizeForReason('object:modified')).toBe(false)
    expect(shouldRunHeavySanitizeForReason('properties-panel')).toBe(false)
    expect(shouldRunHeavySanitizeForReason('user-typed')).toBe(false)
  })
})

describe('canAllowEmptyOverwrite — quem pode salvar canvas vazio', () => {
  it('forceEmptyOverwrite sempre passa', () => {
    expect(canAllowEmptyOverwrite({ forceEmptyOverwrite: true })).toBe(true)
    expect(canAllowEmptyOverwrite({ forceEmptyOverwrite: true, source: 'system' })).toBe(true)
  })

  it('allowEmptyOverwrite + source user passa', () => {
    expect(canAllowEmptyOverwrite({ allowEmptyOverwrite: true, source: 'user' })).toBe(true)
    expect(canAllowEmptyOverwrite({ allowEmptyOverwrite: true })).toBe(true)
  })

  it('allowEmptyOverwrite + source system NAO passa (proteje contra wipe automatico)', () => {
    expect(canAllowEmptyOverwrite({ allowEmptyOverwrite: true, source: 'system' })).toBe(false)
  })

  it('sem flags: bloqueia', () => {
    expect(canAllowEmptyOverwrite({})).toBe(false)
    expect(canAllowEmptyOverwrite({ source: 'user' })).toBe(false)
  })
})

describe('shouldSkipAutoSave — autosave nao roda em razoes barulhentas', () => {
  it('source system sempre pula', () => {
    expect(shouldSkipAutoSave('system', 'qualquer')).toBe(true)
  })

  it('razoes especificas sao puladas mesmo com source user', () => {
    expect(shouldSkipAutoSave('user', 'initial-history-capture')).toBe(true)
    expect(shouldSkipAutoSave('user', 'post-load-cleanup')).toBe(true)
    expect(shouldSkipAutoSave('user', 'lifecycle:mount')).toBe(true)
    expect(shouldSkipAutoSave('user', 'viewport:zoom')).toBe(true)
    expect(shouldSkipAutoSave('user', 'object:modified')).toBe(true)
    expect(shouldSkipAutoSave('user', 'object:added')).toBe(true)
  })

  it('razoes regulares passam', () => {
    expect(shouldSkipAutoSave('user', 'properties-panel')).toBe(false)
    expect(shouldSkipAutoSave('user', 'history:undo')).toBe(false)
  })
})

describe('shouldSkipThumbnailForReason — thumbnail compartilha algumas regras de autosave', () => {
  it('source system pula thumbnail', () => {
    expect(shouldSkipThumbnailForReason('system', 'object:modified')).toBe(true)
  })

  it('lifecycle/viewport/initial pulam', () => {
    expect(shouldSkipThumbnailForReason('user', 'lifecycle:mount')).toBe(true)
    expect(shouldSkipThumbnailForReason('user', 'viewport:pan')).toBe(true)
    expect(shouldSkipThumbnailForReason('user', 'initial-history-capture')).toBe(true)
    expect(shouldSkipThumbnailForReason('user', 'post-load-cleanup')).toBe(true)
  })

  it('object:* PASSA para thumbnail (diferente do autosave)', () => {
    // object:modified é razao tipica de gerar thumbnail novo, embora nao
    // dispare autosave. Garante que esse comportamento divergente eh mantido.
    expect(shouldSkipThumbnailForReason('user', 'object:modified')).toBe(false)
    expect(shouldSkipThumbnailForReason('user', 'object:added')).toBe(false)
  })
})

describe('getThumbnailMinIntervalMs — janela maior para object:modified', () => {
  it('object:modified usa 8s para evitar regerar thumb a cada arraste', () => {
    expect(getThumbnailMinIntervalMs('object:modified')).toBe(8000)
    expect(getThumbnailMinIntervalMs('object:modified(zone)')).toBe(8000)
  })

  it('outras razoes usam 3s', () => {
    expect(getThumbnailMinIntervalMs('object:added')).toBe(3000)
    expect(getThumbnailMinIntervalMs('user-typed')).toBe(3000)
    expect(getThumbnailMinIntervalMs('history:undo')).toBe(3000)
  })
})

describe('canGenerateThumbnailNow — gate combinado (skip + interval)', () => {
  it('respeita skip primeiro', () => {
    expect(canGenerateThumbnailNow({
      source: 'system',
      reason: 'object:modified',
      lastThumbnailAt: 0,
      now: 1_000_000
    })).toBe(false)
  })

  it('libera quando intervalo passou', () => {
    expect(canGenerateThumbnailNow({
      source: 'user',
      reason: 'object:modified',
      lastThumbnailAt: 0,
      now: 9000
    })).toBe(true)
  })

  it('bloqueia quando intervalo nao passou', () => {
    expect(canGenerateThumbnailNow({
      source: 'user',
      reason: 'object:modified',
      lastThumbnailAt: 5000,
      now: 9000
    })).toBe(false) // 4s < 8s
  })

  it('aceita razoes com intervalo curto (3s)', () => {
    expect(canGenerateThumbnailNow({
      source: 'user',
      reason: 'object:added',
      lastThumbnailAt: 0,
      now: 3500
    })).toBe(true)
    expect(canGenerateThumbnailNow({
      source: 'user',
      reason: 'object:added',
      lastThumbnailAt: 0,
      now: 2999
    })).toBe(false)
  })
})

describe('shouldSkipByFingerprint — proteje contra save redundante', () => {
  it('default skipIfUnchanged=true: pula quando fingerprints batem', () => {
    expect(shouldSkipByFingerprint({
      lastSavedFingerprint: 'abc',
      currentFingerprint: 'abc'
    })).toBe(true)
  })

  it('nao pula quando fingerprints diferem', () => {
    expect(shouldSkipByFingerprint({
      lastSavedFingerprint: 'abc',
      currentFingerprint: 'xyz'
    })).toBe(false)
  })

  it('skipIfUnchanged=false desabilita o gate', () => {
    expect(shouldSkipByFingerprint({
      skipIfUnchanged: false,
      lastSavedFingerprint: 'abc',
      currentFingerprint: 'abc'
    })).toBe(false)
  })

  it('lastSavedFingerprint null/undefined nunca bate', () => {
    expect(shouldSkipByFingerprint({
      lastSavedFingerprint: null,
      currentFingerprint: 'abc'
    })).toBe(false)
    expect(shouldSkipByFingerprint({
      lastSavedFingerprint: undefined,
      currentFingerprint: 'abc'
    })).toBe(false)
  })
})

describe('isDuplicateHistoryEntry', () => {
  it('comparacao estrita ===', () => {
    expect(isDuplicateHistoryEntry('a', 'a')).toBe(true)
    expect(isDuplicateHistoryEntry('a', 'b')).toBe(false)
    expect(isDuplicateHistoryEntry(undefined, 'a')).toBe(false)
  })
})

describe('PERIODIC_SAVE_INTERVAL_MS', () => {
  it('= 90 segundos (balanco perda-vs-custo)', () => {
    expect(PERIODIC_SAVE_INTERVAL_MS).toBe(90_000)
    expect(PERIODIC_SAVE_INTERVAL_MS).toBeGreaterThan(0)
  })

  it('e numero finito (passavel para setInterval)', () => {
    expect(typeof PERIODIC_SAVE_INTERVAL_MS).toBe('number')
    expect(Number.isFinite(PERIODIC_SAVE_INTERVAL_MS)).toBe(true)
  })
})
