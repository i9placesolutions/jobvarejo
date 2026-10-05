import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { normalizeWhatsAppVoice } from '../../server/utils/whatsapp-admin-audio'
const execute = promisify(execFile)
beforeEach(() => vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options)))
afterEach(() => vi.unstubAllGlobals())
it('leaves ordinary files and remote URLs unchanged', async () => {
  const body = { type: 'ptt', file: 'https://example.com/voice.ogg' }
  expect(await normalizeWhatsAppVoice(body)).toBe(body)
})
it('converts a real MediaRecorder-compatible WebM into OGG/Opus without sending', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'whatsapp-audio-test-'))
  try {
    const source = join(folder, 'recording.webm')
    await execute('ffmpeg', ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.3', '-c:a', 'libopus', source], { timeout: 10_000 })
    const original = { type: 'ptt', file: `data:audio/webm;codecs=opus;base64,${(await readFile(source)).toString('base64')}` }
    const result = await normalizeWhatsAppVoice(original)
    expect(result.mimetype).toBe('audio/ogg')
    expect(Buffer.from(result.file.split(',')[1], 'base64').subarray(0, 4).toString()).toBe('OggS')
    expect(original.file).toContain('audio/webm')
  } finally { await rm(folder, { recursive: true, force: true }) }
}, 20_000)
