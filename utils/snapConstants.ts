/**
 * Constantes de snap visual / smart guides do editor.
 *
 * Cobertura: tests/utils/snapConstants.test.ts
 */

/**
 * Cor das guias de snap (magenta brilhante para destaque visual).
 */
export const GUIDE_COLOR = '#ff2fb3'

/**
 * Largura da stroke das guias em pixels (constante, nao escala com zoom).
 */
export const GUIDE_STROKE_WIDTH = 2

/**
 * Distancia maxima (em pixels) para "atrair" um objeto a uma guia.
 * Acima dessa distancia, o snap nao acontece.
 */
export const SNAP_RANGE_PX = 12

/**
 * Histerese do snap: ao soltar de uma guia, exige que o objeto se mova
 * SNAP_RANGE_PX * factor para "soltar" do snap. Evita que o cursor
 * fique vibrando entre snap e nao-snap.
 *
 * Valor 1.6 = soltar exige se mover 60% mais longe do que o range
 * que originou o snap.
 */
export const SNAP_HYSTERESIS_HOLD_FACTOR = 1.6

/**
 * Histerese reduzida (1.08) para rect/image — esses tipos sao mais
 * "macios" no snap (usuario costuma querer reposicionar mais facilmente).
 */
export const SNAP_HYSTERESIS_HOLD_FACTOR_RECT_IMAGE = 1.08

/**
 * Movimento minimo (em pixels) para sair do snap atual quando
 * arrastado. Abaixo disso, mantem o snap.
 */
export const SNAP_MOVE_EPSILON_PX = 1.8

/**
 * Movimento minimo (em pixels) para sair do snap em rect/image.
 * Maior que o default — 9px — porque rect/image costumam ser
 * arrastados em movimentos mais amplos.
 */
export const SNAP_MOVE_EPSILON_PX_RECT_IMAGE = 9

/**
 * Range factor para rect/image: range_efetivo = SNAP_RANGE_PX *
 * SNAP_RANGE_FACTOR_RECT_IMAGE. Reduz o range default (0.28 ≈ 1/3.5)
 * para evitar snap "fantasma" em rect/image que sao tipicamente
 * grandes e costumam ter cantos fora do alvo desejado.
 */
export const SNAP_RANGE_FACTOR_RECT_IMAGE = 0.28

/**
 * Velocidade limite (px) acima da qual o snap e suprimido. Movimentos
 * rapidos sao geralmente reposicionamentos amplos onde o snap atrapalha.
 */
export const SNAP_FAST_MOVE_SUPPRESSION_PX = 7

/**
 * Velocidade limite para rect/image (9px) — maior que o default porque
 * rect/image mais "macios" no snap geral.
 */
export const SNAP_FAST_MOVE_SUPPRESSION_PX_RECT_IMAGE = 9

/**
 * Cor das guias do usuario (manuais, criadas via toolbar — distinta das
 * smart guides automaticas que usam GUIDE_COLOR magenta). Azul claro
 * (#38bdf8) para diferenciar visualmente.
 */
export const USER_GUIDE_COLOR = '#38bdf8'

/**
 * Comprimento (em pixels world) das guias do usuario. Sao linhas
 * "infinitas" praticas — 100k px e' suficiente para qualquer canvas
 * realista, evita stress numerico de Infinity.
 */
export const USER_GUIDE_EXTENT = 100_000
