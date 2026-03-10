# Canva Scope

Ler este arquivo quando o pedido mencionar Canva, apps do Canva, exportacao, importacao, brand templates, autofill ou integracao com o produto.

## Escolha a superficie certa

### Canva Dev MCP

Usar quando o agente precisar de contexto e exemplos oficiais para construir algo no ecossistema Canva.

Bom para:
- Apps SDK
- App UI Kit
- exemplos e guidelines
- Connect APIs

Configuracao oficial:
- `npx -y @canva/cli@latest mcp`

Referencia:
- https://www.canva.dev/docs/connect/mcp-server/

### Canva Apps SDK

Usar quando a funcionalidade roda dentro do editor Canva.

Bom para:
- Design Editor intent
- Data Connector
- Content Publisher
- UI com App UI Kit
- exportacao disparada pelo app

Referencias:
- https://www.canva.dev/docs/apps/
- https://www.canva.dev/docs/apps/intents/design-editor/
- https://www.canva.dev/docs/apps/app-ui-kit/
- https://www.canva.dev/docs/apps/exporting-designs/

### Canva Connect APIs

Usar quando o produto do usuario precisa criar, sincronizar, importar, exportar ou automatizar recursos do Canva via REST API.

Bom para:
- upload de assets
- criacao e exportacao de designs
- importacao de arquivos externos para Canva
- comments e workflows de colaboracao
- resize
- autofill com brand templates

Referencias:
- https://www.canva.dev/docs/connect/
- https://www.canva.dev/docs/connect/api-reference/design-imports/
- https://www.canva.dev/docs/connect/api-reference/exports/
- https://www.canva.dev/docs/connect/api-reference/autofills/

### Zapier Canva MCP

Usar apenas quando a necessidade for operacional, com automacoes prontas e sem querer modelar toda a integracao manualmente.

Referencia:
- https://www.canva.dev/docs/connect/zapier-mcp/

## Regras de escolha

- Se a UX acontece dentro do Canva, escolher Apps SDK.
- Se a UX acontece no produto do usuario, escolher Connect APIs.
- Se a necessidade for ajuda de desenvolvimento e nao funcionalidade para o usuario final, escolher Canva Dev MCP.
- Se o time quer automacao pronta e tolera limitacoes da plataforma intermediaria, considerar Zapier.

## Fatos uteis confirmados em 10 de marco de 2026

- O Canva Dev MCP server oficial usa `@canva/cli`.
- O Canva CLI documenta Node.js `v18.20.4` ou `v20.17.0` e npm `v9` ou `v10`.
- O Connect API publica um OpenAPI em `https://www.canva.dev/sources/connect/api/latest/api.yml`.
- APIs marcadas como preview podem quebrar sem nova versao e nao sao recomendadas para producao publica.
- A documentacao de Autofill informa que IDs de brand templates migraram em setembro de 2025; integracoes que persistem IDs antigos precisam tratar essa transicao.

## Limitacoes importantes

### Export em Apps SDK

- URLs de export retornadas pelo app expiram em 60 minutos.
- Apps publicos apenas de exportacao nao sao aceitos; o export precisa fazer parte de um fluxo maior ou migrar para outro intent recomendado.

### Autofill

- Exige atuacao em nome de um usuario membro de uma organizacao Canva Enterprise.
- Depende de brand template configurado com campos preenchiveis.

### Connect APIs

- Integracoes publicas passam por review.
- Integracoes privadas ficam restritas ao time em Canva Enterprise.

## Padrões de implementacao

### Se o pedido for "colocar Canva dentro do meu app"

Priorizar Connect APIs.
Entregar:
1. OAuth e escopos
2. API client ou geracao de tipos a partir do OpenAPI
3. rotas backend necessarias
4. jobs assincronos para import/export/autofill
5. polling ou webhook quando aplicavel

### Se o pedido for "criar funcionalidade dentro do editor Canva"

Priorizar Apps SDK.
Entregar:
1. intent correta
2. componentes App UI Kit
3. escopos do app
4. fluxo de erro e loading
5. requisitos de review do marketplace, quando houver

## Exemplos de requests que devem disparar esta skill

- "Quero exportar um design do Canva para PDF e enviar para meu backend."
- "Preciso importar arquivos do meu sistema para o Canva."
- "Quero um app do Canva que manipule a selecao atual."
- "Quero usar brand templates com autofill."
- "Preciso escolher entre Connect APIs e Apps SDK."
