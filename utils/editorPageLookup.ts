const normalizePageId = (value: any): string => String(value || '').trim()

export const findPageIndexById = (
  pages: any[],
  pageId: string,
  activePageIndex?: number
): number => {
  const targetId = normalizePageId(pageId)
  if (!targetId || !Array.isArray(pages) || pages.length === 0) return -1

  if (Number.isFinite(activePageIndex as number)) {
    const idx = Number(activePageIndex)
    if (idx >= 0 && idx < pages.length) {
      const activeId = normalizePageId(pages[idx]?.id)
      if (activeId && activeId === targetId) return idx
    }
  }

  return pages.findIndex((p: any) => normalizePageId(p?.id) === targetId)
}
