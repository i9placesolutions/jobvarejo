# Padroes de Query

## Parametrizacao posicional
```ts
const result = await pgQuery<Project>(
  'SELECT * FROM projects WHERE user_id = $1 AND id = $2',
  [userId, projectId]
)
```

## Dynamic SET builder (PATCH endpoints)
```ts
const params: any[] = []
const updates: string[] = []
const pushParam = (value: any) => { params.push(value); return `$${params.length}` }

if (name) updates.push(`name = ${pushParam(name)}`)
if (folderIdRaw !== undefined) updates.push(`folder_id = ${pushParam(folderId)}`)

params.push(projectId, userId)
const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${params.length - 1} AND user_id = $${params.length}`
```

## JSONB handling
```ts
import { stringifyJsonbParam, parseAndStringifyJsonbParam } from '~/server/utils/jsonb'

const canvasJson = stringifyJsonbParam(canvasData)
await pgQuery('UPDATE projects SET canvas_data = $1::jsonb WHERE id = $2', [canvasJson, id])
```

## Upsert (ON CONFLICT)
```ts
await pgQuery(`
  INSERT INTO asset_names (user_id, asset_key, display_name)
  VALUES ($1, $2, $3)
  ON CONFLICT (user_id, asset_key) DO UPDATE SET display_name = EXCLUDED.display_name
`, [userId, assetKey, displayName])
```

## CTE para update condicional (projects.post.ts)
```ts
const sql = `
  WITH upd AS (
    UPDATE projects SET name = $2, canvas_data = $3::jsonb, ...
    WHERE id = $1 AND user_id = $4
      AND (name, canvas_data, ...) IS DISTINCT FROM ($2, $3::jsonb, ...)
    RETURNING *, true AS _was_mutated
  )
  SELECT * FROM upd
  UNION ALL
  SELECT *, false AS _was_mutated FROM projects WHERE id = $1 AND user_id = $4
    AND NOT EXISTS (SELECT 1 FROM upd)
`
```

## CTE recursivo para cycle detection (folders.patch.ts)
```ts
const cycleSql = `
  WITH RECURSIVE descendants AS (
    SELECT id FROM folders WHERE parent_id = $1
    UNION ALL
    SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
  )
  SELECT 1 FROM descendants WHERE id = $2 LIMIT 1
`
```

## Type casting em SQL
- `$1::jsonb` - JSONB
- `$1::uuid` - UUID
- `$1::uuid[]` - Array de UUIDs
- `$1::timestamptz` - Timestamp com timezone
- `$1::user_role` - Enum customizado

## Bulk update com array
```ts
await pgQuery(
  'UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])',
  [userId, ids]
)
```

## Missing table detection
```ts
function isMissingTableError(err: any): boolean {
  return err?.code === '42P01' // undefined_table
}
```

## Transacao
```ts
const result = await pgTx(async (client) => {
  await client.query('INSERT INTO ...', [...])
  await client.query('UPDATE ...', [...])
  return { ok: true }
})
```
Nota: `pgTx` esta definido mas nao e usado atualmente. Endpoints usam operacoes atomicas unicas.
