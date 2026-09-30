import { expect, it } from 'vitest'
import { collectUsedLabelTemplateIds, mergeScopedLabelTemplates, loadLabelTemplateCatalogChunks } from '../../utils/editorLabelTemplateUsage'

it('loads only referenced labels, excluding unused embedded catalog and template snapshots', () => {
  expect(collectUsedLabelTemplateIds({
    __labelTemplates: [{ id: 'unused', group: { __cardLabelTemplateId: 'unused-child' } }],
    objects: [{ _zoneGlobalStyles: { splashTemplateId: ' zone ' }, _zoneTemplateSnapshotId: 'zone',
      _zoneTemplateSnapshot: { objects: [{ __cardLabelTemplateId: 'stale-inner' }] },
      objects: [{ __cardLabelTemplateId: 'card-override' }] }]
  })).toEqual(['zone', 'card-override'])
})

it('supports live Fabric groups and cyclic trees without duplicate requests', () => {
  const group: any = { __cardLabelTemplateId: 'a' }
  group.getObjects = () => [group, { _zoneTemplateSnapshotId: 'a' }]
  expect(collectUsedLabelTemplateIds(group)).toEqual(['a'])
})

it('updates requested labels and removes deleted IDs while preserving other pages and overrides', () => {
  const other = { id: 'other-page', group: { fill: 'red' } }
  const fresh = { id: 'used', group: { fill: 'blue' } }
  expect(mergeScopedLabelTemplates([
    { id: 'used', group: { fill: 'old' } },
    { id: 'deleted', group: { fill: 'old' } }, other
  ], ['used', 'deleted'], [fresh])).toEqual([other, fresh])
})

it('loads every referenced ID beyond 500 without truncation or oversized URLs', async () => {
  const ids = Array.from({ length: 650 }, (_, i) => `template-${i}-${'x'.repeat(40)}`)
  const calls: string[][] = []
  const result = await loadLabelTemplateCatalogChunks(ids, async batch => {
    calls.push(batch!)
    expect(encodeURIComponent(batch!.join(',')).length).toBeLessThanOrEqual(4000)
    return { success: true, complete: true, templates: batch!.map(id => ({ id })) }
  })
  expect(calls.flat()).toEqual(ids)
  expect(result.templates.map((t: any) => t.id)).toEqual(ids)
})

it('keeps a failed/incomplete response from invalidating local snapshots', async () => {
  await expect(loadLabelTemplateCatalogChunks(['a'], async () => ({ complete: false, templates: [] }))).rejects.toThrow('incompleta')
  expect(await loadLabelTemplateCatalogChunks(['a'], async () => ({ missingTable: true, templates: [] }))).toMatchObject({ missingTable: true })
})
