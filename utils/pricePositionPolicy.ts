/**
 * A posição externa da etiqueta só deve ser preservada quando houve uma
 * transformação explícita do bloco pelo usuário. Projetos antigos gravavam
 * apenas `__manualPricePosition`; esse booleano também era marcado por
 * relayouts automáticos e fazia a etiqueta reaparecer fora do centro.
 */
export const MANUAL_PRICE_POSITION_SOURCE = 'user-transform'

export const isExplicitManualPricePosition = (object: any): boolean => (
  !!object &&
  object.__manualPricePosition === true &&
  object.__manualPricePositionSource === MANUAL_PRICE_POSITION_SOURCE
)

export const markExplicitManualPricePosition = (object: any): void => {
  if (!object) return
  object.__manualPricePosition = true
  object.__manualPricePositionSource = MANUAL_PRICE_POSITION_SOURCE
}

export const clearManualPricePosition = (object: any): void => {
  if (!object) return
  delete object.__manualPricePosition
  delete object.__manualPricePositionSource
}
