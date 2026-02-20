# Páginas de Autenticação - Studio PRO

## 📋 Visão Geral

Sistema completo de autenticação com design **Glassmorphism** seguindo os princípios do frontend design system.

## 🎨 Design System Aplicado

### Cores
- **Primary**: Violeta/Roxo (hsl(262.1 83.3% 57.8%)) - mantido do tema existente
- **60-30-10 Rule**: Aplicada em todos os cards
- Suporte completo a **Dark Mode**

### Glassmorphism
- Semi-transparent background (`bg-card/60`)
- Backdrop blur (`backdrop-blur-xl`)
- Subtle border para definição
- Sombras com hierarchy (shadow-2xl)

### Animações
- **Entry animation**: 0.5s ease-out (cardEntry)
- **Hover effects**: -translate-y-0.5 (elevação)
- **Active states**: translate-y-0 (feedback tátil)
- **Loading states**: Opacity e disabled

### UX Psychology
- ✅ **Hick's Law**: Forms simples, sem overload de opções
- ✅ **Fitts' Law**: Botões grandes (48px altura), fácil clique
- ✅ **Von Restorff**: CTAs destacados com cor primary
- ✅ **Trust signals**: Badges de segurança, indicadores visuais
- ✅ **Feedback imediato**: Loading states, error/success messages

## 📄 Páginas Criadas

### 1. Login (`/auth/login`)
- Campos: email, password
- Toggle visibilidade de senha
- Links: "Esqueceu sua senha?", "Criar conta"
- Social login (Google, GitHub) - placeholder
- Trust badges: "Conexão segura", "Dados protegidos"

### 2. Register (`/auth/register`)
- Campos: name, email, password, confirm password
- **Password strength indicator** (5 níveis com visual)
- Toggle visibilidade em ambos os campos de senha
- Checkbox de Termos de Uso e Política de Privacidade
- Social login (Google, GitHub) - placeholder
- Trust badges: "Gratuito para começar", "Sem cartão de crédito"

### 3. Forgot Password (`/auth/forgot-password`)
- Campo: email
- Tips section com instruções
- Success message animado
- Link para voltar ao login
- Help text com contato de suporte

### 4. Reset Password (`/auth/reset-password`)
- Campos: password, confirm password
- **Password strength indicator** (5 níveis)
- **Password match indicator** (visual em tempo real)
- Auto-redirect para login após sucesso (2s)
- Link para voltar ao login

### 5. Auth Layout (`/layouts/auth.vue`)
- Header com logo
- Background com gradientes radiais animados
- Grid pattern decorativo
- **Ambient light effect** que segue o mouse
- Footer com links (Termos, Privacidade, Suporte)
- Suporte a dark/light mode

## 🚀 Como Usar

### Acessar as páginas
```
/auth/login           - Login
/auth/register        - Criar conta
/auth/forgot-password - Recuperar senha
/auth/reset-password  - Redefinir senha (via email)
```

### Configuração do Auth local (PostgreSQL)

O sistema está configurado para autenticação local com PostgreSQL. Certifique-se de que as variáveis de ambiente estão definidas no `.env`:

```env
POSTGRES_DATABASE_URL=postgresql://postgres:senha@host:5432/postgres?sslmode=disable
AUTH_JWT_SECRET=um_segredo_longo_e_aleatorio
AUTH_TOKEN_TTL_SECONDS=604800
AUTH_RESET_TOKEN_TTL_MINUTES=60

# Necessario para link correto no e-mail de recuperacao
APP_BASE_URL=https://seu-dominio.com

# SMTP (necessario em producao para envio do reset)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# Branding opcional do e-mail
# Se EMAIL_LOGO_URL ficar vazio e APP_BASE_URL estiver definido,
# a logo usada no template sera: ${APP_BASE_URL}/logo.png
EMAIL_BRAND_NAME=Job Varejo
EMAIL_LOGO_URL=
EMAIL_SUPPORT_EMAIL=
EMAIL_SIGNATURE_NAME=
```

Observações importantes:

- Para a lista completa de variáveis suportadas, use o arquivo [.env.example](.env.example) como referência.

### Configuração completa (quando usar uploads/IA)

Além do auth local acima, algumas rotas do backend usam variáveis **server-only** (NÃO use prefixo `NUXT_PUBLIC_` para segredos):

```env
# Wasabi S3 (server only)
WASABI_ENDPOINT=s3.wasabisys.com
WASABI_REGION=us-east-1
WASABI_BUCKET=jobvarejo
WASABI_ACCESS_KEY=
WASABI_SECRET_KEY=

# OpenAI / Serper (server only)
NUXT_OPENAI_API_KEY=
NUXT_SERPER_API_KEY=
```

### Composables usados

```typescript
import { useAuth } from '~/composables/useAuth'
import { useApiAuth } from '~/composables/useApiAuth'

const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()

// Login
await auth.signIn(email, password)

// Register
await auth.signUp(email, password, name)

// Forgot Password
await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email } })

// Reset Password
await $fetch('/api/auth/reset-password', { method: 'POST', body: { token, password } })
```

## 🎯 Princípios de Design Aplicados

### Visual
- ✅ Glassmorphism consistente
- ✅ Animações suaves e performáticas (GPU)
- ✅ Hierarquia visual clara
- ✅ Espaçamento generoso (whitespace = luxo)
- ✅ Contrast ratios WCAG compliant

### Interação
- ✅ Micro-interações em hover/focus
- ✅ Loading states em todos os botões
- ✅ Error handling com mensagens claras
- ✅ Success feedback visual
- ✅ Password visibility toggles

### Acessibilidade
- ✅ Labels em todos os inputs
- ✅ Aria attributes implícitos via HTML semântico
- ✅ Focus visible em elementos interativos
- ✅ Keyboard navigation support
- ✅ Touch targets de 44px+ (mobile)

## 📦 Estrutura de Arquivos

```
├── layouts/
│   └── auth.vue                 # Layout compartilhado
├── pages/
│   └── auth/
│       ├── login.vue           # Página de login
│       ├── register.vue        # Página de registro
│       ├── forgot-password.vue # Recuperação de senha
│       └── reset-password.vue  # Redefinição de senha
└── composables/
    ├── useAuth.ts              # Estado de auth + login/logout/session
    └── useApiAuth.ts           # Header Authorization para APIs
```

## 🔧 Próximos Passos (Opcional)

### Funcionalidades para implementar:

1. **Social Login**
   - Configurar OAuth provider externo
   - Google, GitHub, etc.

2. **Email Templates**
   - Personalizar template HTML/texto do endpoint de reset
   - Configurar provedor SMTP/transacional (Resend, SES, etc)

3. **Rate Limiting**
   - Limitar tentativas de login
   - Prevenir brute force

4. **Session Management**
   - Middleware de autenticação
   - Redirect baseado em auth state

5. **Additional Pages**
   - `/auth/verify-email` - Verificação de email
   - `/auth/magic-link` - Login sem senha

## 🎨 Customização

### Cores

Edite `assets/css/main.css` para modificar as cores:

```css
--color-primary: hsl(262.1 83.3% 57.8%); /* Violeta */
```

### Animações

Duração e easing podem ser ajustados em cada página:

```css
animation: cardEntry 0.5s ease-out;
```

### Glass Effect

Ajuste a opacidade do glass no CSS:

```css
.glass-card {
  @apply bg-card/60 backdrop-blur-xl; /* Ajuste 60 para mais/menos opaco */
}
```

---

**Criado seguindo o Frontend Design System** 🚀
