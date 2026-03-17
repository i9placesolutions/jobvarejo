type ParseOptions = {
  onParseError?: (err: unknown) => void
}

type FindPreparedNonEmptyHistoryStateOptions = {
  historyStack: string[]
  startIndex: number
  direction: -1 | 1
  prepareCanvasDataForLoad: (data: any) => any
  onParseError?: (err: unknown) => void
}

export const parseHistoryStateJson = (stateStr: string, opts: ParseOptions = {}): any | null => {
  try {
    return JSON.parse(stateStr)
  } catch (err) {
    opts.onParseError?.(err)
    return null
  }
}

export const prepareHistoryStateFromString = (
  stateStr: string,
  prepareCanvasDataForLoad: (data: any) => any,
  opts: ParseOptions = {}
): any | null => {
  const parsed = parseHistoryStateJson(stateStr, opts)
  if (!parsed || typeof parsed !== 'object') return null
  return prepareCanvasDataForLoad(parsed)
}

export const findPreparedNonEmptyHistoryState = (
  opts: FindPreparedNonEmptyHistoryStateOptions
): { index: number; state: any } | null => {
  let idx = opts.startIndex
  const max = opts.historyStack.length
  while (idx >= 0 && idx < max) {
    const raw = opts.historyStack[idx]
    if (raw) {
      const parsed = parseHistoryStateJson(raw, {
        onParseError: opts.onParseError
      })
      // FIX: previously this skipped any state with 0 objects, making it
      // impossible to undo back to an intentionally empty canvas (e.g. the user
      // deleted all objects and Ctrl+Z should restore the empty state).
      // Now we accept any valid parsed state with an objects array, including empty ones.
      if (parsed && Array.isArray(parsed.objects)) {
        return {
          index: idx,
          state: opts.prepareCanvasDataForLoad(parsed)
        }
      }
    }
    idx += opts.direction
  }
  return null
}
