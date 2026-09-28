import { computed, ref, watch } from 'vue'

const RECENT_COLORS_STORAGE_PREFIX = 'jobvarejo:recent-colors:v1'
export const MAX_RECENT_COLORS = 16

/**
 * Normaliza apenas cores hexadecimais aceitas pelo editor.
 * Cores automáticas, transparentes e formatos CSS arbitrários ficam fora do histórico.
 */
export const normalizeRecentColor = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return `#${normalized.slice(1).split('').map(char => `${char}${char}`).join('')}`
  }
  return null
}

const getStorageKey = (userId: string): string => (
  `${RECENT_COLORS_STORAGE_PREFIX}:${encodeURIComponent(userId)}`
)

const readRecentColors = (userId: string): string[] => {
  if (!import.meta.client || !userId) return []

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const colors: string[] = []
    for (const value of parsed) {
      const color = normalizeRecentColor(value)
      if (!color || colors.includes(color)) continue
      colors.push(color)
      if (colors.length >= MAX_RECENT_COLORS) break
    }
    return colors
  } catch {
    return []
  }
}

const persistRecentColors = (userId: string, colors: string[]): void => {
  if (!import.meta.client || !userId) return

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(colors))
  } catch {
    // localStorage pode estar indisponível, bloqueado ou sem espaço.
  }
}

export const useRecentColors = () => {
  const { user } = useAuth()
  const recentColors = ref<string[]>([])
  let loadedUserId: string | null = null

  const currentUserId = computed(() => {
    const id = user.value?.id
    return id ? String(id).trim() : null
  })

  const loadForUser = (userId: string | null): void => {
    if (loadedUserId === userId) return
    loadedUserId = userId
    recentColors.value = userId ? readRecentColors(userId) : []
  }

  watch(currentUserId, loadForUser, { immediate: true })

  const addRecentColor = (value: unknown): string | null => {
    const color = normalizeRecentColor(value)
    const userId = currentUserId.value
    if (!color || !userId) return null

    // A troca de conta pode ocorrer no mesmo tick do clique; carregue a lista
    // correta antes de combinar a nova cor para não misturar usuários.
    loadForUser(userId)
    const next = [color, ...recentColors.value.filter(item => item !== color)]
      .slice(0, MAX_RECENT_COLORS)
    recentColors.value = next
    persistRecentColors(userId, next)
    return color
  }

  return {
    recentColors,
    addRecentColor,
    normalizeRecentColor
  }
}
