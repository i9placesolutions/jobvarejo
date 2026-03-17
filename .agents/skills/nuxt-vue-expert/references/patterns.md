# Padroes Vue/Nuxt Obrigatorios

## Estado global

### Padrao singleton com reactive (preferido para estado complexo)
```ts
// composables/useProject.ts
const project = reactive<Project>({ id: '', pages: [], activePageIndex: 0 })
const isSaving = ref(false)

export function useProject() {
  // ...funcoes que operam no estado
  return { project, isSaving, addPage, switchPage, saveProjectDB }
}
```

### Padrao useState (para SSR-safe)
```ts
// composables/useAuth.ts
const authState = useState<AuthState>('auth', () => ({ user: null, isAuthenticated: false }))
```

### Anti-padrao: Pinia
O projeto NAO usa Pinia. Nao instalar, nao importar.

## Composables

- Estado no escopo do modulo (fora da funcao exportada)
- Retornar refs e funcoes via objeto
- Cleanup obrigatorio em onUnmounted ou onScopeDispose
- Guardar browser-only com `import.meta.client`
- Guardar server-only com `import.meta.server`

## Pages

### Autenticadas (padrao)
```ts
definePageMeta({
  middleware: 'auth',
  layout: false,
  ssr: false // desabilita SSR para paginas protegidas
})
```

### Admin
```ts
definePageMeta({
  middleware: ['auth', 'admin'],
  layout: false,
  ssr: false
})
```

### Publicas (auth flow)
```ts
definePageMeta({
  layout: 'auth'
  // SSR habilitado por padrao
})
```

## API Calls (client)

### Padrao $fetch (unico permitido)
```ts
const data = await $fetch('/api/projects', {
  method: 'POST',
  body: { name: 'Novo Projeto' }
})
```

### Anti-padrao: axios, useFetch para mutacoes
Usar $fetch diretamente. useFetch e aceitavel para GET com cache.

## Server API Endpoints

### Padrao obrigatorio
```ts
export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `endpoint:${user.id}`, 60, 60_000)
  const body = await readBody(event)
  // ...logica
  return { data }
})
```

### Erros
```ts
throw createError({ statusCode: 404, statusMessage: 'Projeto nao encontrado' })
```

## Componentes

- Auto-registrados de components/
- Imports explicitos quando necessario para clareza
- EditorCanvas carregado via defineAsyncComponent para code-splitting
- `<ClientOnly>` para componentes browser-only

## Async Patterns

- `$fetch` para chamadas API
- `Promise.all` para carregamento paralelo
- Fire-and-forget para operacoes nao-criticas (ex: updateLastViewed)
- Soft timeouts via `withSoftTimeout()` (retorna null em vez de throw)
- Circuit breaker no useStorage para falhas Wasabi
- Retry com backoff exponencial em uploads e presigned URLs

## Comunicacao entre componentes

- Custom DOM events: `window.dispatchEvent(new CustomEvent('editor:event'))`
- SSE para realtime: `new EventSource('/api/projects/realtime?...')`
- Props e emits para pai-filho
- Composables compartilhados para estado global

## Performance Patterns

- requestIdleCallback para prefetch de canvas adjacentes
- IntersectionObserver para imagens do dashboard
- Debounce 150ms no resize
- Throttle 400ms no historico de product zone
- Transparent drag image (1x1 canvas)

## TypeScript

- Tipos em types/ (auth.ts, project.ts, product-zone.ts, folder.ts, label-template.ts)
- Zod para validacao de entrada AI
- Interfaces para contratos de dados
- Generics em composables (useProgressivePreviewLoader<T>)
