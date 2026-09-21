import type { VideoLabel, VideoLabelNode } from './labels'
const left = (n: VideoLabelNode) => n.x - n.width * n.sx * (n.originX === 'center' ? .5 : n.originX === 'right' ? 1 : 0)
/** Keep the registered artwork; typeset the changing price as a single compact run. */
export function priceLayout(label: VideoLabel, integer: string) {
 const value = label.nodes.find(n => n.name === 'price_value_text')
 const whole = value || label.nodes.find(n => n.name === 'price_integer_text')
 if (!whole) return undefined
 const decimal = label.nodes.find(n => n.name === 'price_decimal_text')
 const x = left(whole)
 const right = decimal ? left(decimal) + decimal.width * decimal.sx : x + whole.width * whole.sx
 const width = right - x
 const maxSize = (whole.integerSize || whole.fontSize) * whole.sy * 1.13
 // Explicit advances make one, two and three digit prices occupy the same safe slot.
 const size = Math.min(maxSize, width / (integer.length * .49 + .72))
 const wholeWidth = integer.length * size * .49
 const decimalWidth = size * .69
 const total = wholeWidth + decimalWidth + size * .025
 const baseline = whole.y + whole.height * whole.sy * .29
 return { x: x + (width - total) / 2, baseline, size, wholeWidth, decimalWidth,
  decimalX: x + (width - total) / 2 + wholeWidth + size * .025,
  fill: whole.fill, unit: label.nodes.find(n => n.name === 'price_unit_text') }
}
