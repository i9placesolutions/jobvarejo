# 🚀 DEPLOY VERCEL - CORREÇÃO ERRO 250MB

## ⚡ Quick Start

```bash
# 1. Verificar tamanho do bundle localmente
npm run check:bundle

# 2. Se estiver OK, fazer deploy
git add .
git commit -m "Optimize bundle size for Vercel"
git push
```

## ✅ O que foi feito

### Arquivos Modificados:
- ✅ `nuxt.config.ts` - Externalizou dependências pesadas
- ✅ `vercel.json` - Aumentou memória e configurou build
- ✅ `.vercelignore` - Excluiu arquivos desnecessários
- ✅ `package.json` - Adicionou script de verificação
- ✅ `.env.example` - Documentou variáveis de otimização

### Arquivos Criados:
- ✅ `scripts/check-bundle-size.sh` - Verifica tamanho antes do deploy
- ✅ `VERCEL_OPTIMIZATION.md` - Documentação completa

## 🎯 Configurar na Vercel

**Vá em: Project Settings > Environment Variables**

Adicione estas 3 variáveis:

```
NODE_OPTIONS=--max-old-space-size=4096
SHARP_IGNORE_GLOBAL_LIBVIPS=true
NODE_ENV=production
```

## 📊 Comandos Úteis

```bash
# Verificar bundle antes de deployar
npm run check:bundle

# Build com otimizações
npm run build:vercel

# Build normal
npm run build

# Deploy (após configurar variáveis)
vercel --prod
```

## 🐛 Se Ainda Houver Erro

Leia o arquivo **VERCEL_OPTIMIZATION.md** para opções avançadas:
- Edge Functions
- Lazy Loading
- Serviços externos
- Serverless Functions separadas

## 📚 Principais Otimizações Aplicadas

1. **Externalização** de libs pesadas (Sharp, ag-psd, background-removal)
2. **Code Splitting** manual de vendors
3. **Compressão** Brotli + Gzip
4. **Minificação** ativada
5. **Memória** aumentada para 3GB
6. **Exclusão** de arquivos desnecessários do deploy

---

**Tamanho esperado:** ~150-200MB (abaixo do limite de 250MB) ✅
