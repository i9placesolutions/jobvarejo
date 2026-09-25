import { describe, expect, it } from 'vitest'
import { latestReadyEnhancements } from '../../utils/pageEnhancementResults'

describe('saved enhancement results', () => {
  it('shows completed images across generation filters, once per page and in project order', () => {
    const pages = [{id:'a'}, {id:'b'}, {id:'c'}]
    const receipts = [
      {id:'b-old',pageId:'b',status:'completed',resultUrl:'/old',createdAt:'2026-09-24T10:00:00Z'},
      {id:'a-ready',pageId:'a',status:'completed',resultUrl:'/a',createdAt:'2026-09-24T11:00:00Z'},
      {id:'b-new',pageId:'b',status:'completed',resultUrl:'/new',createdAt:'2026-09-24T12:00:00Z'},
      {id:'c-pending',pageId:'c',status:'uncertain',createdAt:'2026-09-24T13:00:00Z'},
      {id:'removed',pageId:'deleted',status:'completed',resultUrl:'/gone',createdAt:'2026-09-24T14:00:00Z'},
    ]
    expect(latestReadyEnhancements(pages,receipts).map(r=>r.id)).toEqual(['a-ready','b-new'])
    expect(receipts[0]!.id).toBe('b-old')
  })
  it('does not invent an image when the receipt has no result URL', () => {
    expect(latestReadyEnhancements([{id:'a'}],[{id:'a',pageId:'a',status:'completed',createdAt:'2026-09-24'}])).toEqual([])
  })
})
