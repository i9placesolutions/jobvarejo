type AppendHistoryEntryOptions = {
  historyStack: string[]
  historyIndex: number
  entry: string
  maxEntries?: number
  isDuplicateEntry?: (currentEntry: string | undefined, nextEntry: string) => boolean
}

type AppendHistoryEntryResult = {
  didAppend: boolean
  historyStack: string[]
  historyIndex: number
}

export const appendHistoryEntry = (
  opts: AppendHistoryEntryOptions
): AppendHistoryEntryResult => {
  const maxEntries = Math.max(1, Number(opts.maxEntries || 50))
  const stack = Array.isArray(opts.historyStack) ? opts.historyStack : []
  const rawIndex = Number.isFinite(opts.historyIndex) ? Number(opts.historyIndex) : -1
  const currentIndex = (
    rawIndex >= 0 && rawIndex < stack.length
      ? rawIndex
      : (stack.length ? stack.length - 1 : -1)
  )
  const currentEntry = (
    currentIndex >= 0 && currentIndex < stack.length
      ? stack[currentIndex]
      : stack[stack.length - 1]
  )

  const isDuplicate = opts.isDuplicateEntry
    ? opts.isDuplicateEntry(currentEntry, opts.entry)
    : currentEntry === opts.entry
  if (isDuplicate) {
    return {
      didAppend: false,
      historyStack: stack,
      historyIndex: currentIndex
    }
  }

  let nextStack = stack
  if (currentIndex >= 0 && currentIndex < stack.length - 1) {
    nextStack = stack.slice(0, currentIndex + 1)
  } else if (currentIndex < 0 && stack.length > 0) {
    nextStack = stack.slice()
  }

  nextStack = [...nextStack, opts.entry]
  let nextIndex = nextStack.length - 1

  if (nextStack.length > maxEntries) {
    const excess = nextStack.length - maxEntries
    nextStack = nextStack.slice(excess)
    nextIndex = Math.max(0, nextIndex - excess)
  }

  return {
    didAppend: true,
    historyStack: nextStack,
    historyIndex: nextIndex
  }
}
