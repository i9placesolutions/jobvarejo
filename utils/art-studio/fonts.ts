import type { ArtComposition } from '~/types/art-studio'
const loaded = new Map<string, Promise<void>>()
export const loadArtFonts = async (doc: ArtComposition) => {
  const requests = doc.layers
    .filter((l) => l.kind === 'text')
    .map((l) => ({
      family: l.fontFamily || 'Barlow',
      weight: l.fontWeight || 400
    }))
  await Promise.all(
    requests.map(({ family, weight }) => {
      const key = `${family}:${weight}`
      if (!loaded.has(key)) {
        const familyFiles: Record<string, string> = {
          Barlow: 'Barlow',
          'Barlow Condensed': 'BarlowCondensed',
          Anton: 'Anton',
          Oswald: 'Oswald'
        }
        const suffix: Record<number, string> = {
          400: 'Regular',
          600: 'SemiBold',
          700: 'Bold',
          800: 'ExtraBold'
        }
        const special: Record<string,string> = {'Patua One':'PatuaOne-Regular.ttf','Consumidor Referencia':'ConsumidorReferencia-Regular.ttf','Russo One':'RussoOne-Regular.ttf','Roboto Slab':'RobotoSlab[wght].ttf',Audiowide:'Audiowide-Regular.ttf','Bebas Neue':'BebasNeue-Regular.ttf',Caveat:'Caveat[wght].ttf'}
        const file = special[family] || (family === 'Oswald'
            ? 'Oswald[wght].ttf'
            : `${familyFiles[family] || 'Barlow'}-${family === 'Anton' ? 'Regular' : suffix[weight] || 'Regular'}.ttf`)
        const task = (async () => {
          const face = new FontFace(
            `Art ${family}`,
            `url("/art-studio/fonts/${encodeURIComponent(file)}")`,
            { weight: family === 'Oswald' ? '200 700' : String(weight) }
          )
          await face.load()
          document.fonts.add(face)
        })()
        loaded.set(key, task)
        task.catch(() => loaded.delete(key))
      }
      return loaded.get(key)
    })
  )
}
