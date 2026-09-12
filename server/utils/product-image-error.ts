/** Classifica indisponibilidade sem enviar mensagens internas ao navegador. */
export const classifyProductImageError = (error: any) => {
    const visited = new Set<unknown>();
    let current = error;
    while (current && !visited.has(current)) {
        visited.add(current);
        const code = String(current.code || current.name || '');
        const status = Number(current.statusCode || current.status || current.$metadata?.httpStatusCode);
        const message = String(current.message || '');
        if ([408, 502, 503, 504].includes(status)
            || /^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|TimeoutError|RequestTimeout|57P01|57P03|53300)$/.test(code)
            || /socket hang up|connection terminated|connection timeout|timeout exceeded when trying to connect|request socket did not establish/i.test(message)) {
            return { statusCode: 503, reason: 'service_unavailable', retryable: true,
                message: 'A conexão com o serviço de imagens falhou temporariamente. Tente novamente em alguns segundos.' };
        }
        current = current.cause;
    }
    return { statusCode: 500, reason: 'internal_error', retryable: false,
        message: 'Não foi possível processar a imagem. Tente novamente ou escolha outra imagem.' };
};
