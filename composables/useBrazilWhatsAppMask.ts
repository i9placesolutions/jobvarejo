import type { Ref } from 'vue'
import { formatBrazilWhatsApp } from '~/utils/whatsapp-auth'

const countNationalDigitsBefore = (value: string, position: number): number => {
  const allDigits = value.replace(/\D/g, '')
  const digitsBeforeCursor = value.slice(0, position).replace(/\D/g, '').length
  const countryPrefixLength = allDigits.startsWith('55') && (allDigits.length === 12 || allDigits.length === 13) ? 2 : 0
  return Math.max(0, digitsBeforeCursor - Math.min(countryPrefixLength, digitsBeforeCursor))
}

const positionAfterNationalDigits = (value: string, digitCount: number): number => {
  if (digitCount <= 0) return value.startsWith('(') ? 1 : 0

  let seenDigits = 0
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index] || '')) {
      seenDigits += 1
      if (seenDigits === digitCount) {
        let cursor = index + 1
        while (cursor < value.length && !/\d/.test(value[cursor] || '')) cursor += 1
        return cursor
      }
    }
  }

  return value.length
}

/** Applies the same BR phone mask to auth forms without losing the caret position. */
export const useBrazilWhatsAppMask = (model: Ref<string>) => {
  const onInput = (event: Event): void => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return

    const rawValue = input.value
    const selectionStart = input.selectionStart ?? rawValue.length
    const selectionEnd = input.selectionEnd ?? selectionStart
    const startDigitCount = countNationalDigitsBefore(rawValue, selectionStart)
    const endDigitCount = countNationalDigitsBefore(rawValue, selectionEnd)
    const formatted = formatBrazilWhatsApp(rawValue)

    model.value = formatted
    input.value = formatted

    try {
      input.setSelectionRange(
        positionAfterNationalDigits(formatted, startDigitCount),
        positionAfterNationalDigits(formatted, endDigitCount)
      )
    } catch {
      // Some non-text input implementations do not expose a selection range.
    }
  }

  return { onInput }
}
