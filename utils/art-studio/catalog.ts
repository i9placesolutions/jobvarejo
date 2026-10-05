import type { ArtComposition, ArtLayer } from '~/types/art-studio'

const baseLayer = (
  id: string,
  kind: ArtLayer['kind'],
  x: number,
  y: number,
  width: number,
  height: number,
  fill = '#245547'
): ArtLayer => ({
  id,
  kind,
  name: id,
  x,
  y,
  width,
  height,
  rotation: 0,
  fill,
  opacity: 1,
  locked: false,
  visible: true
})

/** Explicit editable generation base, independent of persisted catalog entries. */
export const ART_GENERATION_BASE_COMPOSITION: ArtComposition = {
  version: 1,
  width: 1080,
  height: 1350,
  background: '#e7eee8',
  layers: [
    {
      ...baseLayer('Círculo decorativo', 'shape', 650, -100, 600, 600),
      shape: 'ellipse',
      opacity: 0.12
    },
    {
      ...baseLayer('Linha decorativa', 'shape', 80, 300, 85, 10),
      shape: 'rect'
    },
    {
      ...baseLayer('Selo', 'icon', 770, 180, 200, 200),
      icon: 'star',
      rotation: -12
    },
    {
      ...baseLayer('Tema', 'text', 80, 95, 710, 100),
      text: 'CONHEÇA NOSSA LOJA',
      fontFamily: 'Barlow',
      fontSize: 28,
      fontWeight: 600,
      align: 'left'
    },
    {
      ...baseLayer('Título', 'text', 80, 390, 910, 470),
      text: 'PERTO\nDE VOCÊ.\nTODO DIA.',
      fontFamily: 'Barlow Condensed',
      fontSize: 112,
      fontWeight: 800,
      align: 'left'
    },
    {
      ...baseLayer('Mensagem', 'text', 85, 890, 760, 130),
      text: 'Qualidade e cuidado em cada detalhe.',
      fontFamily: 'Barlow',
      fontSize: 38,
      fontWeight: 400,
      align: 'left'
    },
    {
      ...baseLayer('Nome da empresa', 'text', 85, 1170, 560, 65),
      text: 'Sua empresa',
      fontFamily: 'Barlow',
      fontSize: 30,
      fontWeight: 600,
      align: 'left',
      binding: 'companyName'
    },
    {
      ...baseLayer('Instagram', 'text', 85, 1235, 570, 55),
      text: '@suaempresa',
      fontFamily: 'Barlow',
      fontSize: 24,
      fontWeight: 400,
      align: 'left',
      binding: 'instagram'
    },
    {
      ...baseLayer('Logo', 'image', 785, 1150, 205, 140),
      src: '',
      fit: 'contain',
      binding: 'logo'
    }
  ]
}
