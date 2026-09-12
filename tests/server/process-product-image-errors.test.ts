import { describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('../../server/utils/auth', () => ({ requireAuthenticatedUser: auth }));
vi.stubGlobal('defineEventHandler', (handler: any) => handler);
vi.stubGlobal('setResponseHeader', vi.fn());
vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.message || options.statusMessage), options));
const { default: handler } = await import('../../server/api/process-product-image.post');

describe('contrato HTTP das falhas de imagem', () => {
    it('propaga indisponibilidade do banco como 503 com Retry-After', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        auth.mockRejectedValueOnce(Object.assign(new Error('connection interrupted'), { code: 'ECONNRESET' }));
        await expect(handler({} as any)).rejects.toMatchObject({ statusCode: 503, data: { retryable: true, requestId: expect.any(String) } });
        expect(setResponseHeader).toHaveBeenCalledWith({}, 'Retry-After', 3);
        vi.restoreAllMocks();
    });
    it('mantém rejeição de autenticação', async () => {
        const error = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
        auth.mockRejectedValueOnce(error);
        await expect(handler({} as any)).rejects.toBe(error);
    });
});
