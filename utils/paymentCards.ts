/**
 * Biblioteca de bandeiras/cartoes herdada do Varejoon.
 *
 * Os PNGs ficam em `public/cartoes/cartao-N.png`.  O identificador e salvo no
 * perfil (e nao a URL) para que o mesmo cadastro possa ser reutilizado em
 * todos os encartes e para que a origem do asset possa mudar sem migrar os
 * projetos ja existentes.
 */

export const BUSINESS_PAYMENT_CARD_NAMES: Record<string, string> = {
  'cartao-1': 'Viver+',
  'cartao-2': 'Verocard',
  'cartao-3': 'Credishop',
  'cartao-4': 'Ellomais',
  'cartao-5': 'Portal da Drogaria',
  'cartao-6': 'e-Pharma',
  'cartao-7': 'e-Pharma',
  'cartao-8': 'Accredito',
  'cartao-9': 'Pluxee',
  'cartao-10': 'Liderzan',
  'cartao-11': 'Simcred',
  'cartao-12': 'União Supermercado',
  'cartao-13': 'Supermercado Teka',
  'cartao-14': 'Vegas Benefícios',
  'cartao-15': 'Vidalink',
  'cartao-16': 'Funcional Health',
  'cartao-17': 'Golden Farma',
  'cartao-18': 'Vólus Alimentação',
  'cartao-19': 'Caju',
  'cartao-20': 'Mais Vô',
  'cartao-21': 'Redefort',
  'cartao-22': 'Maranhão Livre da Fome',
  'cartao-23': 'BN Card',
  'cartao-24': 'Tá Pago',
  'cartao-25': 'Face Card',
  'cartao-26': 'UtilCard',
  'cartao-27': 'Senff',
  'cartao-28': 'Face Card Alimentação',
  'cartao-29': 'BanriCard',
  'cartao-30': 'Mercearia Mendes',
  'cartao-31': 'Banrisul',
  'cartao-32': 'Up Brasil',
  'cartao-33': 'Cartão Alimentação Varginha',
  'cartao-34': 'Onecard',
  'cartao-35': 'Boa Esperança / UZE',
  'cartao-36': 'Syspro Card',
  'cartao-37': 'Avancard',
  'cartao-38': 'UtilCard',
  'cartao-39': 'Rogério Supermercado',
  'cartao-40': 'Farmalima / Supcard',
  'cartao-41': 'Rom Card',
  'cartao-42': 'Real Card',
  'cartao-43': 'Ticket Restaurante',
  'cartao-44': 'Rede Grande Sul',
  'cartao-45': 'Topcard',
  'cartao-46': 'Policard',
  'cartao-47': 'Le Card',
  'cartao-48': 'Comprocard',
  'cartao-49': 'Cabal',
  'cartao-50': 'Banescard',
  'cartao-51': 'Algorix',
  'cartao-52': 'Banri Compras',
  'cartao-53': 'Auxílio Brasil',
  'cartao-54': 'Famillycard',
  'cartao-55': 'BigCard',
  'cartao-56': 'Verocheque',
  'cartao-57': 'Alelo',
  'cartao-58': 'Banese Card',
  'cartao-59': 'BrasilCard',
  'cartao-60': 'Alelo Alimentação',
  'cartao-61': 'Alelo Refeição',
  'cartao-62': 'Boleto Bancário',
  'cartao-63': 'Ticket Alimentação',
  'cartao-64': 'Ben Visa',
  'cartao-65': 'Sitpass',
  'cartao-66': 'Credsystem',
  'cartao-67': 'Mães de Goiás',
  'cartao-68': 'Sodexo Alimentação',
  'cartao-69': 'Sodexo Refeição',
  'cartao-70': 'VR Refeição',
  'cartao-71': 'VR Alimentação',
  'cartao-72': 'Sorocred',
  'cartao-73': 'Sodexo',
  'cartao-74': 'Mais!',
  'cartao-75': 'Hiper',
  'cartao-76': 'Cielo',
  'cartao-77': 'Diners Club',
  'cartao-78': 'Cartão Débito',
  'cartao-79': 'American Express',
  'cartao-80': 'Hipercard',
  'cartao-81': 'MasterCard',
  'cartao-82': 'Visa',
  'cartao-83': 'Cartão de Crédito',
  'cartao-84': 'Elo',
  'cartao-85': 'Cheque',
  'cartao-86': 'Pix',
  'cartao-87': 'Dinheiro',
  'cartao-88': 'Sodexo Gift',
  'cartao-89': 'Cartão Vermelho',
  'cartao-90': 'Cartão Azul',
  'cartao-91': 'Crediário Próprio',
  'cartao-92': 'G Card',
}

export const BUSINESS_PAYMENT_CARD_IDS = Object.keys(BUSINESS_PAYMENT_CARD_NAMES)

export const BUSINESS_PAYMENT_CARD_OPTIONS = BUSINESS_PAYMENT_CARD_IDS.map(id => ({
  id,
  label: BUSINESS_PAYMENT_CARD_NAMES[id] || id,
  imageUrl: `/cartoes/${id}.png`,
}))

export const getBusinessPaymentCardName = (id: unknown): string => {
  const key = String(id || '').trim()
  return BUSINESS_PAYMENT_CARD_NAMES[key] || key
}

export const isBusinessPaymentCardId = (id: unknown): boolean =>
  /^cartao-[1-9]\d*$/.test(String(id || '').trim()) && BUSINESS_PAYMENT_CARD_IDS.includes(String(id || '').trim())
