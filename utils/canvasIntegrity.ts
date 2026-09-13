/**
 * Identifica o shell criado pela edição rápida quando a validade é aplicada
 * antes do canvas completo terminar de carregar. Ele não representa uma
 * página de encarte utilizável e nunca deve substituir uma composição já
 * persistida.
 */
export const isValidityOnlyCanvas = (data: unknown): boolean => {
    const objects = (data as any)?.objects
    return Array.isArray(objects) && objects.length > 0 && objects.every((object: any) => (
        object?.quickDataField === 'validity' || object?.name === 'validity-backdrop'
    ))
}
