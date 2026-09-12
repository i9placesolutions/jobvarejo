export type QuickGridPreset = 'model' | '2' | '3'
export const quickGridRows = (count: number, preset: QuickGridPreset): number[] => {
  const total = Math.max(0, Math.floor(count))
  if (preset === 'model' && total === 7) return [2, 2, 3]
  const columns = preset === '3' || (preset === 'model' && total === 9) ? 3 : 2
  const rows: number[] = []
  for (let remaining = total; remaining > 0; remaining -= columns) rows.push(Math.min(columns, remaining))
  return rows
}
