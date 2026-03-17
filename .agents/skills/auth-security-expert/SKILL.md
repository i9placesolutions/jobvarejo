---
name: auth-security-expert
description: "Especialista em autenticacao e seguranca do JobVarejo. Use quando Codex precisar criar ou modificar JWT/HMAC tokens, login/register/reset-password, scrypt password hashing, rate limiting (Redis + memory), middleware de rota, RBAC, cookies, SMTP email, SSRF protection, CORS/COOP/COEP headers, ou resolver problemas de autenticacao, autorizacao e seguranca."
---

# Auth Security Expert

## Objetivo

Operar sobre a camada de autenticacao e seguranca do JobVarejo: JWT customizado + scrypt + rate limiting.
Preservar os padroes de seguranca ja estabelecidos e nao introduzir vulnerabilidades.

## Inicio rapido

1. Ler o arquivo alvo e [references/auth-architecture.md](references/auth-architecture.md).
2. Classificar o pedido:
   - Auth flow: ler [references/auth-flow.md](references/auth-flow.md).
   - Seguranca: ler [references/security-checklist.md](references/security-checklist.md).
   - Rate limiting: ler [references/rate-limiting.md](references/rate-limiting.md).
3. Validar seguranca antes de qualquer mudanca.

## Regras de operacao

- JWT e HMAC-SHA256 customizado (nao usar jsonwebtoken/jose). Implementado em `session-token.ts`.
- Secret obrigatorio: `AUTH_JWT_SECRET`. Nunca hardcodar. Nunca expor.
- Password hashing: scrypt nativo do Node.js. 64 bytes derived key, 16 bytes salt. Nao mudar para bcrypt.
- Comparacoes de token/hash SEMPRE com `timingSafeEqual`. Nunca `===`.
- Rate limiting em TODOS endpoints auth. Redis primary, in-memory fallback.
- Cookies: `access-token` (httpOnly, lax, secure em prod), `authenticated` (non-httpOnly, flag client).
- Nao existe token revocation server-side. Logout so limpa cookies. Token vale ate expirar (7d).
- Profile cache in-memory com TTL 5min. Mudancas de role levam ate 5min para propagar.
- SSRF protection obrigatoria para URLs externas via `assertSafeExternalHttpUrl`.
- Path traversal bloqueado em storage via `isValidStoragePath`.

## Conhecimento de vulnerabilidades existentes

1. `reset-password.post.ts` seta `access-token` com `httpOnly: false` (inconsistente com login/register).
2. Nao existe CSP headers.
3. Nao existe CSRF token explicito (SameSite: lax fornece protecao parcial).
4. Token nunca e invalidado server-side (sem revocation list).
5. Debug reset URL vaza no response em dev (aceito para desenvolvimento).

## Trilhas de uso

### Modificar auth flow

1. Consultar [references/auth-flow.md](references/auth-flow.md) para o fluxo completo.
2. Manter `timingSafeEqual` em toda comparacao sensivel.
3. Rate limit em todo endpoint publico (por IP).
4. Timing-safe response: mesmo tempo/mensagem para email existente e inexistente.
5. Cookies: httpOnly para token, non-httpOnly para flag de presenca.

### Adicionar endpoint protegido

1. `const user = await requireAuthenticatedUser(event)` no inicio.
2. `await enforceRateLimit(event, 'nome:' + user.id, limit, 60_000)`.
3. Para admin: `const { user, role } = await requireAdminUser(event)`.
4. Scoping de recursos: `isUserProjectKey(key, user.id)` ou `isStorageKeyAllowedForUser(key, user.id)`.

### Modificar rate limiting

1. Redis + in-memory fallback. Nunca so Redis (pode cair).
2. In-memory: max 5000 buckets, FIFO eviction, prune a cada 30s.
3. Headers obrigatorios: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
4. 429 com `Retry-After` header.

### Auditar seguranca

1. Verificar [references/security-checklist.md](references/security-checklist.md).
2. Todo input externo validado (URL, path, body).
3. Nenhum secret em runtime config publico.
4. Nenhum endpoint admin sem `requireAdminUser`.

## Entregas obrigatorias

### Para mudancas de codigo

1. Impacto em autenticacao/autorizacao
2. Rate limiting aplicado
3. Validacao de input
4. Timing safety preservada
5. Como validar (login, register, session, rate limit)

### Para auditoria de seguranca

1. Vulnerabilidade encontrada
2. Severidade (critica/alta/media/baixa)
3. Arquivo e linha afetados
4. Correcao recomendada
5. Risco residual

## Referencias

- [references/auth-architecture.md](references/auth-architecture.md): JWT, cookies, roles, cache.
- [references/auth-flow.md](references/auth-flow.md): fluxos de login, register, reset.
- [references/security-checklist.md](references/security-checklist.md): checklist de seguranca.
- [references/rate-limiting.md](references/rate-limiting.md): rate limiting Redis + memory.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- se a mudanca preserva seguranca
- se rate limiting esta aplicado
- se timing safety esta preservada
- se nenhum secret foi exposto
- como validar o fluxo completo
