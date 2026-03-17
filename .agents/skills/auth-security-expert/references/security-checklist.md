# Checklist de Seguranca

## Autenticacao

- [ ] JWT secret configurado e forte (AUTH_JWT_SECRET)
- [ ] Token TTL adequado (default 7d, max 30d)
- [ ] Comparacoes com timingSafeEqual
- [ ] Cookies httpOnly para access-token
- [ ] Cookies secure em producao
- [ ] SameSite: lax
- [ ] Password minimo 8 chars
- [ ] Scrypt com 64-byte key e 16-byte salt
- [ ] Reset token e SHA-256 hash no DB (nunca raw)
- [ ] Reset token expira (default 60min)
- [ ] Timing-safe response no forgot-password

## Autorizacao

- [ ] requireAuthenticatedUser em todo endpoint protegido
- [ ] requireAdminUser em endpoints admin
- [ ] Storage scoped por userId (isUserProjectKey)
- [ ] Path traversal bloqueado (isValidStoragePath)
- [ ] SSRF protection em URLs externas (assertSafeExternalHttpUrl)

## Rate Limiting

- [ ] Todos endpoints auth tem rate limit por IP
- [ ] Endpoints de dados tem rate limit por userId
- [ ] Redis primary com in-memory fallback
- [ ] Headers de rate limit na resposta
- [ ] 429 com Retry-After header

## Headers de seguranca

- [ ] Cross-Origin-Opener-Policy: same-origin-allow-popups
- [ ] Cross-Origin-Embedder-Policy: credentialless
- [ ] Content-Security-Policy: **NAO CONFIGURADO** (gap)
- [ ] CORS: default same-origin (storage proxy tem allow-origin: *)

## Vulnerabilidades conhecidas

### 1. httpOnly false no reset-password (MEDIA)
**Arquivo**: `server/api/auth/reset-password.post.ts`
- access-token cookie setado com httpOnly: false
- Permite leitura do JWT via JavaScript
- **Correcao**: setar httpOnly: true igual ao login

### 2. Sem CSP headers (MEDIA)
- Nao existe Content-Security-Policy
- Reduz protecao contra XSS
- **Correcao**: adicionar CSP via routeRules ou middleware

### 3. Sem CSRF token (BAIXA)
- SameSite: lax fornece protecao parcial
- POST requests de outros sites sao bloqueados
- GET requests podem ser abusados em cenarios especificos

### 4. Token sem revocation (BAIXA)
- Logout limpa cookies mas token continua valido
- TTL de 7 dias e longo para token sem revocation
- **Mitigacao**: encurtar TTL ou implementar blacklist

### 5. Profile cache lag (BAIXA)
- Mudancas de role levam ate 5min para propagar
- Admin revogado pode continuar acessando por 5min
- **Mitigacao**: invalidar cache em operacoes criticas

### 6. Debug URLs em dev (ACEITO)
- Reset URL logada no console e retornada no response em dev
- Aceito pois so ocorre sem SMTP configurado
- Nunca exposto em producao

## SSRF Protection (server/utils/url-safety.ts)

`assertSafeExternalHttpUrl(raw, opts)`:
- Apenas http/https
- Max 2048 chars
- Bloqueia:
  - localhost, 127.0.0.1
  - 10.x, 172.16-31.x, 192.168.x
  - IPv6 loopback (::1)
  - Link-local (fe80::)
  - Unique local (fc/fd)
  - .local, .localhost, .internal
  - ::ffff: mapped IPv4

## Email (server/utils/email.ts)

- Nodemailer SMTP
- Config: SMTP_HOST, SMTP_PORT (587), SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
- Transporter singleton cacheado
- Dev sem SMTP: console.warn + response com debugResetUrl
- Prod sem SMTP: 503
