/** Same raster treatment in HTML previews and html2canvas exports. */
export const useLogoImageSource = () => {
  const { preference } = useLogoPreference()
  return (source: string | null | undefined) => {
    if (!source || !preference.value || source.startsWith('blob:') || source.startsWith('data:')) return source || undefined
    return `/api/profile/logo-image?${new URLSearchParams({ source, style: JSON.stringify(preference.value) })}`
  }
}
