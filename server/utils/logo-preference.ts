import { pgOneOrNull } from './postgres'
import { normalizeLogoPreference } from '../../utils/logoPreference'
export const readLogoPreference = async (userId: string) => {
  const row = await pgOneOrNull<{ preference: unknown }>(
    `SELECT business_profile->'logoPreference' AS preference FROM public.profiles WHERE id=$1`, [userId])
  return normalizeLogoPreference(row?.preference)
}
