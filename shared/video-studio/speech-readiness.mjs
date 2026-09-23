export function speechReadinessIssue(scripts) {
  for (const script of scripts) {
    const text = script.text || ''
    if (/\d/u.test(text)) return 'Há números em nomes ou siglas no roteiro. Escreva como devem ser falados ou adicione uma pronúncia antes de gerar a locução.'
    if (/[/%&+@#<>$]/u.test(text)) return 'Há símbolos que podem ser pronunciados de forma errada. Escreva essas expressões por extenso antes de gerar a locução.'
    if (/\b(?:kg|ml|pct|pcte|und|unid|cx|dz)\b/iu.test(text)) return 'Há uma unidade abreviada no roteiro. Escreva a unidade por extenso antes de gerar a locução.'
  }
  return null
}
