// Central place for font options used across the editor (canvas + panels).
// Web fonts are loaded via WebFontLoader (Google Fonts) on the client.

// Google WebFontLoader `families` format:
// - "Family"
// - "Family:400,700,900"
export const GOOGLE_WEBFONT_FAMILIES: string[] = [
  'Inter:400,500,600,700,800,900',
  'Roboto:300,400,500,700,900',
  'Montserrat:300,400,500,600,700,800,900',
  'Oswald:300,400,500,600,700',
  'Lato:300,400,700,900',
  'Playfair Display:400,500,600,700,800,900',

  // Display / promo-friendly (useful for etiquetas)
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Alfa Slab One',
  'Bowlby One SC',
  'Lilita One',
  'Abril Fatface',

  // Fun / splash
  'Bangers',
  'Luckiest Guy',
  'Pacifico',

  // Clean alternatives
  'Nunito:300,400,600,700,800,900',
  'Roboto Slab:300,400,500,700,900',
  'DM Sans:400,500,700',
  'Space Grotesk:300,400,500,600,700',
  'Fira Sans:300,400,500,700,800,900'
]

// This list is used in dropdowns/autocomplete. Include a few system fallbacks too.
export const AVAILABLE_FONT_FAMILIES: string[] = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',

  // Web fonts (must exist in GOOGLE_WEBFONT_FAMILIES above)
  'Inter',
  'Roboto',
  'Montserrat',
  'Oswald',
  'Lato',
  'Playfair Display',
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Alfa Slab One',
  'Bowlby One SC',
  'Lilita One',
  'Abril Fatface',
  'Bangers',
  'Luckiest Guy',
  'Pacifico',
  'Nunito',
  'Roboto Slab',
  'DM Sans',
  'Space Grotesk',
  'Fira Sans'
]

