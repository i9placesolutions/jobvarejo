import { readFile } from 'node:fs/promises'

export default defineEventHandler(async () => {
  const imageRuntime = await readFile('/tmp/jobvarejo-image-runtime.json', 'utf8')
    .then(value => JSON.parse(value))
    .catch(() => null)
  return {
    ok: true,
    service: 'jobvarejo',
    imageRuntime,
    timestamp: new Date().toISOString(),
  }
})
