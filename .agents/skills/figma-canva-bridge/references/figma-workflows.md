# Figma Workflows

Ler este arquivo quando o pedido envolver Figma como fonte primaria de design, contexto visual ou design system.

## Escolha da superficie correta

### Figma MCP

Usar para:
- interpretar um frame ou node a partir de uma URL
- extrair contexto de layout, componentes e variaveis
- orientar implementacao de UI no stack do repo
- aproveitar Code Connect quando ja existir mapeamento entre design e codigo

### Figma REST API

Usar para:
- automacoes backend
- exportacao de imagens por node
- leitura previsivel de arquivos e nodes
- sincronizacao de variaveis
- integracoes com CI ou pipelines

## Dados minimos para comecar

- URL completa do Figma ou `file_key` + `node-id`
- objetivo do usuario: copiar a tela, extrair tokens, revisar, refatorar ou gerar assets
- framework alvo do repo
- componentes ja existentes que devem ser reutilizados

## Workflow design-to-code

1. Isolar o frame ou node alvo.
2. Listar hierarquia visual: pagina, frame, secoes, componentes, variantes e assets.
3. Extrair o que realmente vira contrato de implementacao:
   - espacamentos
   - tipografia
   - cores
   - radius
   - bordas e sombras
   - estados
   - comportamento responsivo
4. Mapear cada bloco para componentes existentes do repo antes de propor novos.
5. Traduzir o layout para a linguagem do projeto; nao colar literalmente o codigo pseudo-React retornado pelo MCP.
6. Validar com checklist de estados e edge cases.

## O que sempre extrair do Figma

- estrutura de informacao
- componentes reutilizaveis
- variacoes de estado
- tokens ou variaveis vinculadas
- interacoes relevantes
- assets raster ou vetoriais necessarios
- inconsistencias entre design system e tela

## Endpoints REST mais uteis

Confirmados na documentacao oficial do Figma em 10 de marco de 2026:

- `GET /v1/files/:key`
  - carregar a arvore do arquivo
- `GET /v1/files/:key/nodes?ids=...`
  - carregar apenas nodes especificos
- `GET /v1/images/:key?ids=...`
  - renderizar imagens a partir de nodes
- `GET /v1/files/:key/images`
  - baixar imagens usadas em image fills
- `GET /v1/files/:file_key/variables/local`
  - enumerar variaveis locais e remotas usadas no arquivo

Referencias:
- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://developers.figma.com/docs/rest-api/variables-endpoints/
- https://developers.figma.com/docs/rest-api/dev-resources/

## Code Connect

Usar quando o design system do Figma ja tiver componentes publicados e mapeados para componentes reais do codigo.

Regras:
- Preferir componentes conectados em vez de recriar blocos do zero.
- Respeitar o label da framework selecionada no cliente.
- Explicar quando o mapeamento existente for insuficiente ou ambiguo.

Referencia:
- https://developers.figma.com/docs/code-connect/code-connect-ui-setup/

## Problemas comuns

### O MCP devolve algo parecido com React

Interpretar isso como contexto estruturado, nao como codigo final.
Reescrever para os padroes reais do repo, mantendo nomes, tokens e componentes locais.

### O frame esta pesado demais

Reduzir o escopo para um node, um fluxo ou um subconjunto de componentes.

### Variaveis nao aparecem

Trocar do MCP para a Variables REST API quando a tarefa depender de dados completos de variaveis.

### Permissao ou rate limit

Validar o plano, o tipo de assento e as permissoes do arquivo antes de insistir na mesma chamada.

## Formato de saida recomendado

1. Escopo analisado: arquivo, frame e node.
2. Componentes e variantes encontrados.
3. Tokens e variaveis relevantes.
4. Assets necessarios.
5. Mapeamento para arquivos e componentes do repo.
6. Lacunas ou decisoes que ainda precisam de confirmacao humana.
