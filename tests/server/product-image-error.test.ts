import { describe, expect, it } from 'vitest';
import { classifyProductImageError } from '../../server/utils/product-image-error';

describe('falhas no processamento de imagem', () => {
    it.each([
        { code: 'ECONNRESET' },
        { message: 'socket hang up' },
        { message: 'the request socket did not establish a connection within 15000 ms' },
        { message: 'Connection terminated unexpectedly' },
        { cause: { code: 'ETIMEDOUT' } },
        { $metadata: { httpStatusCode: 503 } }
    ])('permite retentativa de conexão interrompida: %j', error => {
        expect(classifyProductImageError(error)).toMatchObject({ statusCode: 503, retryable: true });
    });
    it('não repete defeitos de programação nem expõe detalhes internos', () => {
        const result = classifyProductImageError(new TypeError('private internal path'));
        expect(result).toMatchObject({ statusCode: 500, retryable: false });
        expect(JSON.stringify(result)).not.toContain('private internal path');
    });
    it('tolera causas circulares', () => {
        const error: any = new Error('unknown');
        error.cause = error;
        expect(classifyProductImageError(error).statusCode).toBe(500);
    });
});
