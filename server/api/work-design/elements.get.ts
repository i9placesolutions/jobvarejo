import { requireWorkPilot } from '../../utils/work-design/access'
import { workSeals } from '../../utils/work-design/elements'

export default defineEventHandler(async event => {
  const user = await requireWorkPilot(event)
  return { seals: (await workSeals(user.id)).map(({ id, name, theme, key, palette, formats }) => ({ id, name, theme, key, palette, formats })) }
})
