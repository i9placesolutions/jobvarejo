type TemplateWithId = { id: string }

const hash = (value: string): number => {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

/** Varies the first themes shown to each company without reshuffling on every render. */
export const orderFlyerTemplatesForCompany = <T extends TemplateWithId>(
  templates: readonly T[],
  companyId: string
): T[] => {
  const seed = String(companyId || '').trim()
  if (!seed) return [...templates]
  return [...templates].sort((left, right) => {
    const leftRank = hash(`${seed}:${left.id}`)
    const rightRank = hash(`${seed}:${right.id}`)
    return leftRank - rightRank || left.id.localeCompare(right.id)
  })
}
