import { cpSync, mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSync } from 'esbuild'
import { expect, it } from 'vitest'

it('o código copiado pelo Dockerfile do worker resolve todos os imports da composição e engine', () => {
  const target = mkdtempSync(join(tmpdir(), 'video-worker-package-'))
  try {
    const dockerfile = readFileSync('workers/video-studio/Dockerfile', 'utf8')
    for (const line of dockerfile.split('\n').filter(line => line.startsWith('COPY '))) {
      const parts = line.split(/\s+/).slice(1)
      const destination = parts.pop()!
      if (!destination.startsWith('./')) continue
      for (const source of parts) {
        // package*.json é tratado abaixo; fontes/mídia não participam do import smoke.
        if (source.includes('*') || source.startsWith('public/')) continue
        const to = join(target, destination, parts.length > 1 ? basename(source) : '')
        mkdirSync(dirname(to), { recursive: true })
        cpSync(source, to, { recursive: true, filter: path => !path.split('/').some(part => ['node_modules', '__pycache__'].includes(part)) })
      }
    }
    cpSync('workers/video-studio/package.json', join(target, 'package.json'))
    const result = buildSync({
      absWorkingDir: target,
      entryPoints: ['shared/video-studio/composition.ts', 'workers/video-studio/engine.mjs'],
      outdir: join(target, 'check'), bundle: true, write: false, packages: 'external',
      platform: 'node', format: 'esm', logLevel: 'silent'
    })
    expect(result.outputFiles).toHaveLength(2)

  } finally { rmSync(target, { recursive: true, force: true }) }
}, 40000)
