export const RETAIL_MUSIC_DIRECTION = 'Energia alta, animado, nítido e impactante, estilo varejo brasileiro. Ritmo acelerado e alegre, clima de oferta e chamada comercial, com mixagem clara.'

export function withRetailMusicDirection(prompt) {
  return `${String(prompt || '').trim()} ${RETAIL_MUSIC_DIRECTION}`.trim()
}
