/**
 * Resolve o Frame que deve continuar dono de um objeto depois de um drop.
 * Um objeto que já pertence a um Frame continua vinculado quando é arrastado
 * para fora dele, para que o recorte do Frame continue ocultando o excedente.
 */
const normalizeFrameId = (value: unknown): string => String(value || '').trim()

export const resolveFrameParentAfterDrop = (
    currentParentFrameId: unknown,
    currentParentFrameExists: boolean,
    frameUnderObjectId: unknown
): string | undefined => {
    const currentId = normalizeFrameId(currentParentFrameId)
    const targetId = normalizeFrameId(frameUnderObjectId)

    if (currentParentFrameExists) {
        return targetId || currentId || undefined
    }

    return targetId || undefined
}
