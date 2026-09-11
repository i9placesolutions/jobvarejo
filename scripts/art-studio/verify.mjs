import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import pg from 'pg'
import { unzipSync } from 'fflate'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
const origin = process.env.ART_STUDIO_TEST_URL || 'http://127.0.0.1:3119'
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
  throw new Error('Use somente servidor local.')
const db = new pg.Client({
  connectionString:
    process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL
})
const ids = { designs: [], templates: [], assets: [] }
let count = 0
function token(user) {
  const now = Math.floor(Date.now() / 1000),
    enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const head = enc({ alg: 'HS256', typ: 'JWT', iss: 'jobvarejo' }),
    body = enc({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: now,
      exp: now + 900
    }),
    msg = `${head}.${body}`
  return `${msg}.${createHmac('sha256', process.env.AUTH_JWT_SECRET).update(msg).digest('base64url')}`
}
async function call(path, who, method = 'GET', body, expected = 200) {
  const headers = {}
  if (who) headers.Authorization = `Bearer ${token(who)}`
  if (body && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json'
  const res = await fetch(origin + '/api/art-studio' + path, {
    method,
    signal: AbortSignal.timeout(90000),
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  })
  assert.equal(
    res.status,
    expected,
    `${method} ${path}: ${res.status} ${expected !== res.status ? await res.text() : ''}`
  )
  count++
  if (expected !== 200) return null
  return res.headers.get('content-type')?.includes('json')
    ? res.json()
    : Buffer.from(await res.arrayBuffer())
}
await db.connect()
try {
  const users = (
    await db.query(
      "SELECT id,email,role FROM public.profiles WHERE role IN ('super_admin','user') ORDER BY role"
    )
  ).rows
  const admin = users.find((u) => u.role === 'super_admin'),
    user = users.find((u) => u.role === 'user')
  assert.ok(
    admin && user,
    'São necessárias contas de super admin e usuário para testar isolamento.'
  )
  await call('/templates', null, 'GET', undefined, 401)
  await call('/templates?admin=1', user, 'GET', undefined, 403)
  const catalog = await call('/templates', user)
  assert.ok(catalog.databaseReady)
  assert.ok(catalog.templates.length >= 12)
  const source = catalog.templates[0].composition
  const logoResponse = await call('/brand-logo', admin)
  assert.equal(logoResponse.subarray(1, 4).toString(), 'PNG')
  await mkdir('artifacts/art-studio', {recursive:true})
  await writeFile('artifacts/art-studio/logo-original.png',logoResponse)
  await call('/brand-logo', user, 'GET', undefined, 404)
  const branded = structuredClone(source)
  branded.layers.find((l) => l.binding === 'logo').src =
    '/api/art-studio/brand-logo'
  const view = await call(
    '/image-view?source=brand&width=205&height=140&trim=true&backdrop=oval&padding=12&outline=true&outlineColor=%23ffffff&outlineWidth=4',
    admin
  )
  assert.equal(view.subarray(1, 4).toString(), 'PNG')
  await mkdir('artifacts/art-studio', { recursive: true })
  await writeFile('artifacts/art-studio/logo-contorno.png', await call('/image-view?source=brand&width=615&height=420&trim=true&backdrop=none&padding=36&outline=true&outlineColor=%23ffffff&outlineWidth=12',admin))
  const logoExport = await call('/render', admin, 'POST', {
    compositions: [branded]
  })
  assert.equal(logoExport.subarray(1, 4).toString(), 'PNG')
  const formats = [
    { width: 1080, height: 1350 },
    { width: 1080, height: 1080 },
    { width: 1080, height: 1920 },
    { width: 794, height: 1123 },
    { width: 1920, height: 1080 }
  ]
  const generated = await call('/compose', user, 'POST', {
    composition: source,
    formats
  })
  assert.equal(generated.engine, 'Pillow')
  assert.equal(generated.compositions.length, 5)
  const composed = {
    ...generated.compositions[0],
    alternates: generated.compositions.slice(1)
  }
  const docId = randomUUID()
  ids.designs.push(docId)
  const saved = await call('/designs', user, 'POST', {
    id: docId,
    name: 'Teste isolado — Estúdio',
    composition: composed
  })
  assert.equal(saved.revision, 1)
  const retried = await call('/designs', user, 'POST', {
    id: docId,
    name: 'Teste isolado — Estúdio',
    composition: composed
  })
  assert.equal(retried.id, saved.id)
  assert.equal(retried.revision, 1)
  await call(`/designs/${saved.id}`, admin, 'GET', undefined, 404)
  const changed = structuredClone(composed)
  changed.layers.find((l) => l.kind === 'text').text = 'Texto modificado'
  changed.layers.find((l) => l.kind === 'text').fill = '#ff0000'
  changed.alternates[0].layers[0].x = 212
  const update = await call(`/designs/${saved.id}`, user, 'PUT', {
    name: 'Teste editado',
    composition: changed,
    revision: 1
  })
  assert.equal(update.revision, 2)
  await call(
    `/designs/${saved.id}`,
    user,
    'PUT',
    { name: 'Conflito', composition: composed, revision: 1 },
    409
  )
  const loaded = await call(`/designs/${saved.id}`, user)
  assert.equal(loaded.composition.alternates.length, 4)
  assert.equal(loaded.composition.alternates[0].layers[0].x, 212)
  const templateBody = {
    name: 'Teste modelo isolado',
    category: 'Teste automático',
    collection: 'Validação',
    tags: ['teste'],
    composition: composed,
    published: false
  }
  await call('/templates', user, 'POST', templateBody, 403)
  const template = await call('/templates', admin, 'POST', templateBody)
  ids.templates.push(template.id)
  assert.ok(
    !(await call('/templates', user)).templates.some(
      (t) => t.id === template.id
    )
  )
  const published = await call(`/templates/${template.id}`, admin, 'PUT', {
    ...templateBody,
    published: true,
    revision: 1
  })
  assert.equal(published.revision, 2)
  assert.ok(
    (await call('/templates', user)).templates.some((t) => t.id === template.id)
  )
  await call(
    `/templates/${template.id}`,
    admin,
    'PUT',
    { ...templateBody, published: true, revision: 1 },
    409
  )
  const bad = structuredClone(source)
  bad.layers.find((l) => l.kind === 'image').src =
    'https://example.com/private.png'
  await call('/designs', user, 'POST', { name: 'bad', composition: bad }, 400)
  const png = await call('/render', user, 'POST', {
    compositions: [generated.compositions[0]]
  })
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  await mkdir('artifacts/art-studio', { recursive: true })
  await writeFile('artifacts/art-studio/python-feed.png', png)
  const zipped = await call('/render', user, 'POST', {
    compositions: generated.compositions
  })
  const files = unzipSync(zipped)
  assert.equal(Object.keys(files).length, 5)
  await writeFile('artifacts/art-studio/formatos.zip', zipped)
  for (const [i, bytes] of Object.values(files).entries()) {
    const f = formats[i]
    assert.equal(Buffer.from(bytes).readUInt32BE(16), f.width)
    assert.equal(Buffer.from(bytes).readUInt32BE(20), f.height)
  }
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'teste.png')
  const asset = await call('/assets', admin, 'POST', form)
  ids.assets.push(asset.id)
  await call(`/assets/${asset.id}`, user, 'GET', undefined, 404)
  const foreign = structuredClone(source)
  foreign.layers.find((l) => l.kind === 'image').src = asset.src
  foreign.layers.find((l) => l.kind === 'image').binding = ''
  await call(
    '/designs',
    user,
    'POST',
    { name: 'Foreign asset', composition: foreign },
    403
  )
  const updated = await call(`/templates/${template.id}`, admin, 'PUT', {
    ...templateBody,
    composition: foreign,
    published: true,
    revision: 2
  })
  const pixels = await call(`/assets/${asset.id}`, user)
  assert.equal(pixels.subarray(1, 4).toString(), 'PNG')
  await call(`/templates/${template.id}`, admin, 'PUT', {
    ...templateBody,
    composition: foreign,
    published: false,
    revision: updated.revision
  })
  await call(`/assets/${asset.id}`, user) // Preserva acesso às imagens de trabalhos já instanciados.
  const mounted = await call('/generate', admin, 'POST', {
    title: 'Sua marca em todos os formatos',
    message: 'Texto com acentuação: promoção, coração e você.',
    theme: 'Campanha',
    background: '#f4efe5',
    color: '#274f37',
    formats
  })
  assert.equal(mounted.compositions.length, 5)
  await call('/generate', user, 'POST', { title: 'não autorizado' }, 403)
  console.log(
    JSON.stringify({
      passed: count,
      formats: 5,
      checks: [
        'auth',
        'owner-isolation',
        'save-reload',
        'revision-conflict',
        'idempotent-create',
        'admin-publication',
        'asset-upload',
        'asset-scope',
        'python-compose',
        'python-render',
        'zip-dimensions',
        'python-generator'
      ]
    })
  )
} finally {
  if (ids.designs.length)
    await db.query(
      'DELETE FROM public.art_studio_designs WHERE id=ANY($1::uuid[])',
      [ids.designs]
    )
  if (ids.templates.length) {
    await db.query(
      'DELETE FROM public.art_studio_audit WHERE template_id=ANY($1::uuid[])',
      [ids.templates]
    )
    await db.query(
      'DELETE FROM public.art_studio_templates WHERE id=ANY($1::uuid[])',
      [ids.templates]
    )
  }
  if (ids.assets.length) {
    const rows = (
      await db.query(
        'DELETE FROM public.art_studio_assets WHERE id=ANY($1::uuid[]) RETURNING storage_key',
        [ids.assets]
      )
    ).rows
    const s3 = new S3Client({
      endpoint: `https://${process.env.WASABI_ENDPOINT}`,
      region: process.env.WASABI_REGION || 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.WASABI_ACCESS_KEY,
        secretAccessKey: process.env.WASABI_SECRET_KEY
      }
    })
    for (const row of rows)
      await s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.WASABI_BUCKET,
          Key: row.storage_key
        })
      )
    s3.destroy()
  }
  await db.end()
}
