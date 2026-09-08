type FrameLike = {
    _customId?: unknown
    isFrame?: unknown
    clipContent?: unknown
    templateCompositionManaged?: unknown
    quickSeedId?: unknown
}

type ObjectLike = {
    parentFrameId?: unknown
    isFrame?: unknown
    isSmartObject?: unknown
    isProductCard?: unknown
    excludeFromExport?: unknown
    templateCompositionManaged?: unknown
    quickSeedId?: unknown
}

const normalizeId = (value: unknown): string => String(value || '').trim()

/**
 * A composição de um modelo é uma prancheta fechada: seus elementos podem
 * ultrapassar visualmente a borda enquanto são editados, mas nunca devem
 * perder o recorte do Frame por isso.
 */
export const shouldPreserveTemplateFrameClip = (frame: FrameLike | null | undefined): boolean => (
    !!frame?.isFrame &&
    frame?.clipContent !== false &&
    frame?.templateCompositionManaged === true
)

/**
 * Recupera o vínculo de um elemento decorativo de modelo que foi salvo sem
 * parentFrameId. O seed impede que uma composição seja ligada a outro modelo
 * quando mais de um Frame estiver presente no mesmo canvas.
 *
 * Retorna null quando o objeto já tem um Frame válido, não é conteúdo de
 * modelo, é um card de produto, ou a associação seria ambígua.
 */
export const resolveTemplateCompositionFrameBinding = (
    object: ObjectLike | null | undefined,
    frames: FrameLike[]
): string | null => {
    if (
        !object ||
        object.isFrame ||
        object.isSmartObject ||
        object.isProductCard ||
        object.excludeFromExport ||
        object.templateCompositionManaged !== true
    ) {
        return null
    }

    const validFrames = frames.filter((frame) => normalizeId(frame?._customId))
    const currentParentFrameId = normalizeId(object.parentFrameId)
    if (currentParentFrameId && validFrames.some((frame) => normalizeId(frame._customId) === currentParentFrameId)) {
        return null
    }

    const templateFrames = validFrames.filter(shouldPreserveTemplateFrameClip)
    if (!templateFrames.length) return null

    const objectSeedId = normalizeId(object.quickSeedId)
    if (objectSeedId) {
        const seedMatches = templateFrames.filter((frame) => normalizeId(frame.quickSeedId) === objectSeedId)
        return seedMatches.length === 1 ? normalizeId(seedMatches[0]!._customId) : null
    }

    return templateFrames.length === 1 ? normalizeId(templateFrames[0]!._customId) : null
}
