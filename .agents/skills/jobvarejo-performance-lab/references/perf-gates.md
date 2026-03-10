# Perf Gates

Ler este arquivo quando for validar uma mudanca de performance.

## Comandos do repo

### Bundle total

```bash
npm run check:bundle
```

Usa:
- [scripts/check-bundle-size.sh](/Users/rafaelmendes/Documents/jobvarejo/scripts/check-bundle-size.sh)

### Maior chunk client

```bash
npm run build
npm run check:client-chunk
```

Ou com limite customizado:

```bash
MAX_CLIENT_CHUNK_KB=500 bash scripts/check-client-chunk-size.sh
```

Usa:
- [scripts/check-client-chunk-size.sh](/Users/rafaelmendes/Documents/jobvarejo/scripts/check-client-chunk-size.sh)

### Typecheck

```bash
npm run typecheck
```

### Build final

```bash
npm run build
```

## Quality gates por tipo

### Editor

- interacao reproduzivel sem queda perceptivel de FPS
- `window.__editorPerf.snapshot` melhora ou nao piora
- nao introduzir save extra ou thumbnail extra
- undo/redo e reload continuam funcionando

### Persistencia

- nao perder draft local
- nao aumentar payload sem justificativa
- nao disparar save em loop
- thumbnail respeita os skips e intervalos existentes

### Assets e imagem

- cache hit continua funcionando
- nao aumentar chamadas externas sem necessidade
- latencia cai ou custo total diminui
- fallback continua seguro

### Bundle

- bundle total dentro do limite do script
- maior chunk dentro do limite esperado
- nenhuma dependencia pesada entrou no client sem motivo

## Relatorio minimo

Sempre reportar:
1. comando rodado
2. metrica antes
3. metrica depois
4. risco residual
