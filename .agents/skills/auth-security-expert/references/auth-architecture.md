# Arquitetura de Autenticacao

## JWT/HMAC Token (server/utils/session-token.ts)

### Formato
`base64url(header).base64url(payload).hmac-sha256-signature`

### Header
```json
{ "alg": "HS256", "typ": "JWT", "iss": "jobvarejo" }
```

### Payload
```ts
interface SessionTokenPayload {
  sub: string    // userId
  email: string
  role: string   // 'super_admin' | 'admin' | 'user'
  iat: number    // issued at (epoch)
  exp: number    // expires at (epoch)
}
```

### Config
- Secret: `AUTH_JWT_SECRET` (obrigatorio, 500 se ausente)
- TTL: `AUTH_TOKEN_TTL_SECONDS` (default 604800 = 7 dias, max 30 dias)

### Funcoes
```ts
createSessionToken({ userId, email, role }) -> { token, expiresIn, payload }
verifySessionToken(token) -> SessionTokenPayload | null
createPasswordResetToken() -> string (32-byte hex)
hashOpaqueToken(token) -> string (SHA-256 hex)
```

### Verificacao
- Split em 3 partes
- Recomputa HMAC
- `timingSafeEqual` para comparacao (previne timing attack)
- Valida header (alg, typ, iss)
- Valida exp

## Cookies

| Cookie | httpOnly | SameSite | Secure | Path | MaxAge | Proposito |
|--------|----------|----------|--------|------|--------|-----------|
| `access-token` | true* | lax | prod only | / | 7d | JWT token |
| `sb-access-token` | true* | lax | prod only | / | 7d | Legacy compat |
| `authenticated` | false | lax | prod only | / | 7d | Flag cliente |

*Exceto `reset-password.post.ts` que seta httpOnly: false (bug conhecido)

## Token Extraction (server/utils/auth.ts)

`getBearerToken(event)`:
1. `Authorization: Bearer <token>` header
2. Cookie `access-token`
3. Cookie `sb-access-token`
4. Cookie `sb_access_token` (underscore variant)

## Auth Guards

```ts
requireAuthenticatedUser(event)  // 401 se invalido. Retorna AuthenticatedUser
requireAdminUser(event)          // 403 se nao admin. Retorna { user, role }
```

Usado em 50+ endpoints (projects, folders, storage, etc).

## Profile Cache (server/utils/auth.ts)

- `Map<userId, { id, email, role, name, avatar_url, expiresAt }>`
- TTL: 5 minutos
- Hit em toda request autenticada
- Limitacao: per-process (nao compartilhado entre instancias)

## Password Hashing (server/utils/password.ts)

- Algoritmo: Node.js `crypto.scrypt`
- Derived key: 64 bytes
- Salt: 16 bytes random (hex)
- Formato: `scrypt$<salt_hex>$<key_hex>`
- Verificacao: `timingSafeEqual`
- Minimo: 8 caracteres

## RBAC

### Roles
- `super_admin`: primeiro usuario registrado
- `admin`: atribuido manualmente
- `user`: todos demais

### Enforcement
- Server: `requireAuthenticatedUser` (qualquer role), `requireAdminUser` (admin/super_admin)
- Client: `useAuth().isAdmin`, `useAuth().isSuperAdmin`, `useAuth().hasRole(role)`
- Storage: `isStorageKeyAllowedForUser(key, userId)` para resource-level

## Arquivos

| Arquivo | Funcao |
|---------|--------|
| `server/api/auth/login.post.ts` | Login |
| `server/api/auth/register.post.ts` | Registro |
| `server/api/auth/logout.post.ts` | Logout |
| `server/api/auth/session.get.ts` | Validacao de sessao |
| `server/api/auth/forgot-password.post.ts` | Solicitar reset |
| `server/api/auth/reset-password.post.ts` | Executar reset |
| `server/api/auth/first-user.get.ts` | Deteccao primeiro usuario |
| `server/utils/session-token.ts` | JWT/HMAC |
| `server/utils/auth.ts` | Guards + cache |
| `server/utils/auth-db.ts` | Operacoes DB auth |
| `server/utils/password.ts` | Scrypt hashing |
| `server/utils/rate-limit.ts` | Rate limiting |
| `server/utils/redis.ts` | Redis client |
| `server/utils/email.ts` | SMTP nodemailer |
| `server/utils/url-safety.ts` | SSRF protection |
| `server/utils/storage-scope.ts` | Autorizacao storage |
| `middleware/auth.ts` | Protecao client |
| `middleware/admin.ts` | Protecao admin client |
| `composables/useAuth.ts` | Estado auth client |
| `composables/useApiAuth.ts` | Headers SSR |
| `types/auth.ts` | Tipos |
