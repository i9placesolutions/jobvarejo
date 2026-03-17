# Fluxos de Autenticacao

## Login (POST /api/auth/login)

1. Rate limit: 30/60s por IP
2. `normalizeEmail(email)` -> lowercase
3. `ensureAuthColumns()` -> garante colunas auth existem
4. `getProfileByEmail(email)` -> busca perfil
5. `verifyPassword(password, storedHash)` -> scrypt + timingSafeEqual
6. `createSessionToken({ userId, email, role })` -> JWT
7. Set cookies: access-token (httpOnly), sb-access-token (httpOnly), authenticated (non-httpOnly)
8. `updateLastLoginAt(userId)` -> fire-and-forget
9. Retorna user data + token

## Register (POST /api/auth/register)

1. Rate limit: 20/60s por IP
2. Valida: name (2-120), email, password (min 8)
3. Check email duplicado -> 409
4. `countProfiles()` == 0? -> role `super_admin`, senao `user`
5. `hashPassword(password)` -> scrypt
6. `createProfileWithPassword(data)` -> INSERT
7. Se `auto_login: true`: set cookies (atualmente client envia false)
8. Retorna user data

## Logout (POST /api/auth/logout)

1. Rate limit: 120/60s por IP
2. Limpa cookies: access-token, sb-access-token, authenticated (maxAge: 0)
3. Nota: token continua valido ate expirar (nao existe revocation)

## Session (GET /api/auth/session)

1. `requireAuthenticatedUser(event)` -> verifica JWT + carrega perfil (cache 5min)
2. Rate limit: 300/60s por userId
3. Retorna: { id, email, name, avatar_url, role }

## Forgot Password (POST /api/auth/forgot-password)

1. Rate limit: 15/60s por IP
2. `createPasswordResetToken()` -> 32-byte hex random
3. `hashOpaqueToken(token)` -> SHA-256 (para armazenamento)
4. `setResetTokenForEmail(email, hash, expiresAt)` -> UPDATE profiles
5. Expiracao: AUTH_RESET_TOKEN_TTL_MINUTES (default 60, max 1440)
6. `sendPasswordResetEmail({ to, resetUrl, ttlMinutes })`
7. **Timing-safe**: mesma resposta para email existente e inexistente
8. Dev sem SMTP: loga URL no console + retorna `debugResetUrl`
9. Prod sem SMTP: 503

## Reset Password (POST /api/auth/reset-password)

1. Rate limit: 20/60s por IP
2. `hashOpaqueToken(token)` -> SHA-256
3. `getProfileByResetTokenHash(hash)` -> busca perfil
4. Valida `reset_token_expires_at > now()`
5. `hashPassword(newPassword)` -> scrypt
6. `updatePasswordForUser(userId, hash)` -> UPDATE
7. Auto-login: set cookies
8. **BUG**: access-token setado com httpOnly: false

## First User (GET /api/auth/first-user)

1. Rate limit: 120/60s por IP
2. `countProfiles()` -> total
3. Retorna `{ isFirstUser: boolean, totalUsers: number }`

## Client Auth State (composables/useAuth.ts)

- `useState('auth')` -> SSR-safe
- `isAuthFlagSet()` -> le `document.cookie` para flag `authenticated`
- `getSession()` -> verifica flag, chama GET /api/auth/session
- `signIn(email, password)` -> POST /api/auth/login
- `signUp(email, password, name)` -> POST /api/auth/register
- `signOut()` -> POST /api/auth/logout, limpa estado, navega para /auth/login

## Middleware Client

### auth.ts
- Rotas publicas: /auth/login, /auth/register, /auth/forgot-password, /auth/reset-password
- SSR: skip (return early)
- Client: check isAuthenticated, getSession(), redirect /auth/login

### admin.ts
- SSR: skip
- Client: check authenticated + isAdmin, redirect /auth/login ou /
