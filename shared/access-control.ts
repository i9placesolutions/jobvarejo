export const ACCESS_AREAS = [
  { id: 'encartes', label: 'Encartes e edição rápida' },
  { id: 'videos', label: 'Vídeos' },
  { id: 'cartazes', label: 'Cartazes' },
  { id: 'artes', label: 'Estúdio de Artes' },
  { id: 'radio', label: 'Rádio Indoor' },
  { id: 'builder', label: 'Builder' },
  { id: 'loja', label: 'Dados da loja' }
] as const

export type AccessArea = typeof ACCESS_AREAS[number]['id']
export type AccessAction = 'view' | 'create' | 'edit' | 'delete'
export type EditorPermissions = Partial<Record<AccessArea, Partial<Record<AccessAction, boolean>>>>

export const ACCESS_ACTIONS: { id: AccessAction; label: string }[] = [
  { id: 'view', label: 'Ver' },
  { id: 'create', label: 'Criar' },
  { id: 'edit', label: 'Editar' },
  { id: 'delete', label: 'Excluir' }
]
export const ACCESS_AREA_ACTIONS: Record<AccessArea, AccessAction[]> = {
  encartes: ['view', 'create', 'edit', 'delete'],
  videos: ['view', 'create', 'edit', 'delete'],
  cartazes: ['view', 'create', 'edit', 'delete'],
  artes: ['view', 'create', 'edit', 'delete'],
  radio: ['view', 'create', 'edit', 'delete'],
  builder: ['view', 'create', 'edit', 'delete'],
  loja: ['view', 'edit']
}

const AREA_IDS = new Set<AccessArea>(ACCESS_AREAS.map(area => area.id))
const ACTION_IDS = new Set<AccessAction>(ACCESS_ACTIONS.map(action => action.id))

export function normalizeEditorPermissions(value: unknown): EditorPermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const normalized: EditorPermissions = {}
  for (const [area, actions] of Object.entries(value)) {
    if (!AREA_IDS.has(area as AccessArea) || !actions || typeof actions !== 'object' || Array.isArray(actions)) continue
    const selected: Partial<Record<AccessAction, boolean>> = {}
    for (const [action, enabled] of Object.entries(actions)) {
      if (ACTION_IDS.has(action as AccessAction) && ACCESS_AREA_ACTIONS[area as AccessArea].includes(action as AccessAction) && enabled === true) selected[action as AccessAction] = true
    }
    if (selected.create || selected.edit || selected.delete) selected.view = true
    if (Object.keys(selected).length) normalized[area as AccessArea] = selected
  }
  return normalized
}

export function hasEditorPermission(permissions: EditorPermissions, area: AccessArea, action: AccessAction): boolean {
  return permissions[area]?.[action] === true
}
