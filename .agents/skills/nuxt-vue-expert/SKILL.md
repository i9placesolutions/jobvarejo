---
name: nuxt-vue-expert
description: "Especialista em Nuxt 4, Vue 3, Nitro e Composition API para o projeto JobVarejo. Use quando Codex precisar criar ou modificar pages, composables, middleware, server/api endpoints, layouts, auto-imports, runtime config, SSR/CSR, rotas, code-splitting, ou resolver problemas de hidratacao, build e deploy do framework."
---

# Nuxt Vue Expert

## Objetivo

Operar sobre a camada de framework do JobVarejo: Nuxt 4.2 + Vue 3.5 + Nitro (node-server) + Tailwind CSS 4.
Preservar os padroes ja estabelecidos no repo antes de introduzir novas abordagens.

## Inicio rapido

1. Ler `nuxt.config.ts` e o arquivo alvo.
2. Consultar [references/architecture.md](references/architecture.md) para entender a estrutura geral.
3. Consultar [references/patterns.md](references/patterns.md) para padroes de codigo obrigatorios.
4. Consultar [references/repo-map.md](references/repo-map.md) para localizar arquivos por area.

## Regras de operacao

- O projeto usa Nuxt 4.2 com Vue 3.5 Composition API exclusivamente. Nao usar Options API.
- Nao existe Pinia. Estado global e gerenciado por composables singleton com `reactive()`/`ref()` no escopo do modulo ou `useState()` para SSR-safe.
- Nao existem modulos Nuxt (`@nuxtjs/*`). Tailwind usa plugin Vite direto. Auth e custom.
- Nao existem plugins Nuxt. Todo bootstrap e feito via composables e auto-imports.
- Paginas autenticadas usam `ssr: false` via `definePageMeta`. Apenas paginas de auth e legais usam SSR.
- O editor (`/editor/[id]`) e carregado via `defineAsyncComponent` dentro de `<ClientOnly>`.
- Chamadas de API usam exclusivamente `$fetch` (nao axios, nao useFetch para mutacoes).
- Code-splitting manual via `manualChunks` no Vite config. Respeitar a separacao existente.
- Nitro usa preset `node-server` com pacotes pesados externalizados (sharp, onnxruntime, canvas, etc).
- Runtime config separa chaves privadas (server-only) e publicas (client). Nunca expor secrets no public.

## Trilhas de uso

### Criar ou modificar page

1. Definir `definePageMeta({ middleware, layout, ssr })`.
2. Para paginas autenticadas: `ssr: false`, `layout: false`, `middleware: 'auth'`.
3. Para admin: `middleware: ['auth', 'admin']`.
4. Usar `navigateTo()` para redirecionamentos programaticos.
5. Usar `NuxtLink` para navegacao declarativa.

### Criar ou modificar composable

1. Estado global: `ref()` ou `reactive()` no escopo do modulo (fora da funcao).
2. Para SSR-safe: usar `useState('chave')`.
3. Retornar funcoes e refs via objeto no `return` do composable.
4. Limpar side-effects em `onUnmounted` ou `onScopeDispose`.
5. Guardar codigo browser-only com `import.meta.client`.

### Criar ou modificar server/api endpoint

1. Usar `defineEventHandler(async (event) => { ... })`.
2. Autenticar com `requireAuthenticatedUser(event)` ou `requireAdminUser(event)`.
3. Rate limit com `enforceRateLimit(event, key, limit, windowMs)`.
4. Queries via `pgQuery`, `pgOneOrNull`, `pgTx` (nao ORM).
5. Retornar objetos diretamente (Nitro serializa).
6. Erros com `createError({ statusCode, statusMessage })`.

### Resolver problemas de build/deploy

1. Verificar `nuxt.config.ts` (externals, manualChunks, routeRules).
2. Verificar `vercel.json` para limites de deploy.
3. Pacotes pesados devem estar em `nitro.externals.inline` ou `rollupConfig.external`.
4. Chunks client tem limite controlado por scripts em `scripts/`.

## Entregas obrigatorias

### Para mudancas de codigo

1. Arquivo e linha afetados
2. Padrao do repo seguido
3. Impacto em SSR/CSR
4. Impacto em code-splitting
5. Como validar (dev server, build, navegacao)

### Para analise sem codigo

1. Diagnostico do problema
2. Componentes/composables afetados
3. Padrao correto do repo
4. Acao recomendada

## Referencias

- [references/architecture.md](references/architecture.md): estrutura Nuxt, Nitro, config e deploy.
- [references/patterns.md](references/patterns.md): padroes de Vue/Nuxt obrigatorios no projeto.
- [references/repo-map.md](references/repo-map.md): mapa de arquivos por area funcional.

## Criterio de conclusao

Finalizar somente quando ficar claro:
- qual padrao do repo foi seguido
- se ha impacto em SSR, CSR ou hidratacao
- se o code-splitting foi preservado
- como validar a mudanca
