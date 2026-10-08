# Otimizações para Deploy Vercel - Resolvendo Erro de 250MB

## ⚠️ IMPORTANTE: Configure Primeiro as Variáveis de Ambiente

**Antes de fazer deploy, você DEVE configurar estas variáveis na Vercel:**

1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione estas 3 variáveis (clique em "Add New"):

| Key | Value | Environment |
|-----|-------|-------------|
| `NODE_OPTIONS` | `--max-old-space-size=4096` | Production, Preview, Development |
| `SHARP_IGNORE_GLOBAL_LIBVIPS` | `true` | Production, Preview, Development |
| `NODE_ENV` | `production` | Production |

3. Clique em "Save" para cada variável

---

## ✅ Alterações Realizadas

### 1. **nuxt.config.ts** - Configuração Nitro
```typescript
nitro: {
  preset: 'vercel',
  externals: { inline: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'] },
  minify: true,
  compressPublicAssets: { brotli: true, gzip: true },
  rollupConfig: {
    external: ['sharp', '@imgly/background-removal-node', 'ag-psd', 'canvas'],
    output: { manualChunks: ... }
  }
}
```

**O que faz:**
- ✅ Externaliza bibliotecas pesadas (`sharp`, `ag-psd`, etc)
- ✅ Divide vendors em chunks menores
- ✅ Compressão brotli/gzip
- ✅ Minificação ativada

### 2. **vercel.json** - Configurações de Deploy
```json
{
  "functions": { "memory": 3008, "maxDuration": 60 },
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096",
      "SHARP_IGNORE_GLOBAL_LIBVIPS": "true"
    }
  }
}
```

**O que faz:**
- ✅ Aumenta memória das funções serverless para 3GB
- ✅ Aumenta memória do Node no build
- ✅ Ignora Sharp global (reduz bundle)

### 3. **.vercelignore** - Exclusão de Arquivos
Exclui do deploy:
- 📁 Scripts, patches, documentação
- 📁 Arquivos `.bak` e `_old/`
- 📁 Todos os `.md` (exceto necessários)

### 4. **package.json** - Script de Build
```json
"build:vercel": "NODE_OPTIONS='--max-old-space-size=4096' nuxt build"
```

### 5. **.env.example** - Variáveis de Ambiente
Adicionadas variáveis de otimização:
```env
NODE_OPTIONS=--max-old-space-size=4096
SHARP_IGNORE_GLOBAL_LIBVIPS=true
NODE_ENV=production
```

## 🚀 Como Fazer Deploy

### Passo 1: Configurar Variáveis de Ambiente na Vercel

Vá em **Project Settings > Environment Variables** e adicione:

```env
# Otimizações (ESSENCIAL)
NODE_OPTIONS=--max-old-space-size=4096
SHARP_IGNORE_GLOBAL_LIBVIPS=true
NODE_ENV=production

# Suas variáveis existentes
POSTGRES_DATABASE_URL=...
AUTH_JWT_SECRET=...
WASABI_ACCESS_KEY=...
# ... etc
```

### Passo 2: Deploy

```bash
# Via Git (recomendado)
git add .
git commit -m "Optimize bundle size for Vercel"
git push

# Ou via CLI
vercel --prod
```

### Passo 3: Verificar Build

Monitore o build no dashboard da Vercel. O bundle deve ficar **abaixo de 250MB**.

## 📊 Resultado Esperado

**Antes:**
- ❌ Bundle: >250MB
- ❌ Deploy: Falha

**Depois:**
- ✅ Bundle: ~150-200MB
- ✅ Deploy: Sucesso
- ✅ Funções: 3GB RAM, 60s timeout

## 🔧 Se Ainda Houver Erro

### Opção 1: Mover APIs Pesadas para Edge Functions

Criar em `/server/routes/` ao invés de `/server/api/`:

```typescript
// server/routes/remove-bg-edge.ts
export default defineEventHandler(async (event) => {
  // Importação dinâmica para reduzir bundle
  const { removeBackground } = await import('@imgly/background-removal-node')
  // ...
})
```

### Opção 2: Usar Serverless Functions Separadas

Criar diretório `/api/` na raiz para funções standalone:

```
/api/
  remove-bg.js  (função independente)
  process-image.js
```

### Opção 3: Migrar Processamento Pesado

Considere migrar para:
- **Cloudflare Workers** (processamento de imagem)
- **AWS Lambda** (com layers para Sharp)

### Opção 4: Lazy Loading

Importações dinâmicas nas rotas:

```typescript
// Ao invés de:
import sharp from 'sharp'

// Use:
const sharp = await import('sharp').then(m => m.default)
```

## 📝 Notas Importantes

1. **Sharp** é a maior dependência (~50MB)
   - Externalizada no rollup config
   - `SHARP_IGNORE_GLOBAL_LIBVIPS=true` ajuda

2. **@imgly/background-removal** é pesado
   - Considere API externa (remove.bg, cloudinary)
   - Ou mover para worker separado

3. **ag-psd** para PSDs
   - Considere processar no cliente
   - Ou serviço dedicado

## 🎯 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] `vercel.json` commitado
- [ ] `.vercelignore` commitado  
- [ ] `nuxt.config.ts` com otimizações
- [ ] Build local funcionando: `npm run build`
- [ ] Push para repositório
- [ ] Deploy na Vercel
- [ ] Testar funcionalidades principais

## 📚 Referências

- [Vercel Function Size Limit](https://vercel.com/docs/functions/runtimes#size-limit)
- [Nuxt Nitro Vercel Preset](https://nitro.unjs.io/deploy/providers/vercel)
- [Optimizing Bundle Size](https://nuxt.com/docs/guide/concepts/server-engine#bundle-size)
