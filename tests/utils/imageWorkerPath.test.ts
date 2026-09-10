import { expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveImageWorkerPath } from '../../server/utils/image-worker-path'

it('resolve os scripts na raiz e no preview sem depender de cópias em .output', () => {
  const root = mkdtempSync(join(tmpdir(), 'image-worker-test-'))
  try {
    mkdirSync(join(root, 'workers'))
    const file = join(root, 'workers', 'search.py')
    writeFileSync(file, '')
    expect(resolveImageWorkerPath('search.py', root)).toBe(file)
    expect(resolveImageWorkerPath('search.py', join(root, '.output'))).toBe(file)
    expect(() => resolveImageWorkerPath('missing.py', root)).toThrow('indisponível')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
