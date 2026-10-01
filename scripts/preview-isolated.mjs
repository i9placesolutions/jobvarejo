// Um snapshot completo por processo evita HTML antigo com chunks de um build novo.
import { cp, mkdtemp, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const args = process.argv.slice(2)
const option = name => {
  const index = args.indexOf(name)
  return args.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1) || (index >= 0 ? args[index + 1] : undefined)
}
const port = option('--port') || option('-p') || process.env.NITRO_PORT || process.env.PORT || '3000'
const host = option('--host') || process.env.NITRO_HOST || process.env.HOST || '0.0.0.0'
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Porta de preview inválida.')
try { process.loadEnvFile(resolve(root, '.env')) } catch (error) { if (error.code !== 'ENOENT') throw error }
await access(resolve(root, '.output/server/index.mjs'))
const snapshot = await mkdtemp(join(tmpdir(), 'jobvarejo-preview-'))
let child
try {
  await cp(resolve(root, '.output'), snapshot, { recursive: true, dereference: true })
  console.log(`Preview isolado em http://${host}:${port} — snapshot ${snapshot}`)
  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: snapshot, stdio: 'inherit',
    env: { ...process.env, PORT: port, NITRO_PORT: port, HOST: host, NITRO_HOST: host }
  })
  const onInterrupt = () => child.kill('SIGINT')
  const onTerminate = () => child.kill('SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  const exitCode = await new Promise((resolveExit, reject) => {
    child.once('error', reject)
    child.once('exit', code => resolveExit(code ?? 0))
  })
  process.removeListener('SIGINT', onInterrupt)
  process.removeListener('SIGTERM', onTerminate)
  process.exitCode = exitCode
} finally {
  // Somente a cópia temporária criada por este processo; nunca .output do usuário.
  await rm(snapshot, { recursive: true, force: true })
}
