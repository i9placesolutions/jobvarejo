# MCP Setup

Ler este arquivo quando o pedido for configurar, corrigir ou expandir o acesso do agente a Figma ou Canva.

## Fontes oficiais verificadas em 10 de marco de 2026

- Figma MCP remote server: https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/
- Figma MCP desktop server: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/
- Figma troubleshooting e limites: https://developers.figma.com/docs/figma-mcp-server/tools-not-loading/ e https://developers.figma.com/docs/figma-mcp-server/plans-access-and-permissions/
- Canva Dev MCP server: https://www.canva.dev/docs/connect/mcp-server/
- Canva Connect APIs overview: https://www.canva.dev/docs/connect/

## Regra do repo atual

Neste workspace, `.vscode/mcp.json` usa a chave `servers`.
Preservar esse formato ao adicionar novos servidores.

## Configuracao recomendada para este projeto

### Figma remote MCP

Usar quando o objetivo for inspecionar frames, extrair contexto de design, enviar UI para Figma ou trabalhar com links do Figma sem depender do app desktop aberto.

```json
{
  "type": "http",
  "url": "https://mcp.figma.com/mcp"
}
```

### Figma desktop MCP

Usar quando o fluxo depender do arquivo aberto no Figma Desktop e do Dev Mode local.

```json
{
  "type": "http",
  "url": "http://127.0.0.1:3845/mcp"
}
```

Pre-requisitos:
- Figma Desktop atualizado
- arquivo aberto
- Dev Mode ativo
- desktop MCP habilitado no painel inspect

### Canva Dev MCP

Usar quando o agente precisar de contexto oficial para Apps SDK, App UI Kit, Connect APIs e exemplos de implementacao do ecossistema Canva.

```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@canva/cli@latest", "mcp"]
}
```

Pre-requisitos:
- Node.js compativel com a documentacao atual do Canva CLI
- `npx` disponivel
- autenticacao do Canva CLI quando solicitada

## Snippet combinado para `.vscode/mcp.json`

Mesclar com os servidores ja existentes; nao substituir o arquivo inteiro sem checar o diff.

```json
{
  "servers": {
    "postgresJobvarejo": {
      "type": "stdio",
      "command": "node",
      "cwd": "${workspaceFolder}",
      "args": ["./scripts/mcp/postgres-server.mjs"]
    },
    "vercel-jobvarejo": {
      "type": "http",
      "url": "https://mcp.vercel.com/i9place/jobvarejo-xj25"
    },
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    },
    "canva-dev": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@canva/cli@latest", "mcp"]
    }
  }
}
```

## Procedimento

1. Editar `.vscode/mcp.json` de forma aditiva.
2. Reiniciar o cliente MCP ou o editor.
3. Autenticar Figma quando o cliente solicitar OAuth.
4. Executar login do Canva CLI se o servidor `canva-dev` pedir credenciais.
5. Testar com uma pergunta curta antes de partir para uma tarefa longa.

## Prompts de smoke test

- Figma: "Leia este frame do Figma e descreva os componentes, variaveis e constraints principais."
- Canva Dev MCP: "Quais componentes existem no App UI Kit e qual o caminho recomendado para exportar designs?"

## Troubleshooting

### Figma

- Se as tools nao carregarem, confirmar que o servidor escolhido esta realmente acessivel e que o cliente foi reiniciado.
- No desktop MCP, manter o arquivo aberto no Figma Desktop; se o app fechar, o servidor local deixa de responder.
- Se houver erro de permissao, validar acesso ao arquivo e o tipo de assento/plano do usuario.
- Se houver comportamento estranho ou lentidao, reduzir o frame alvo e pedir um node especifico em vez de uma pagina inteira.

### Canva

- Se o servidor nao aparecer, reiniciar o cliente apos salvar `mcp.json`.
- Se o comando falhar, confirmar `npx` e Node instalados.
- Se a resposta vier generica, pedir referencias explicitas de `App UI Kit`, `Apps SDK` ou `Connect APIs`.

## Quando nao usar MCP

- Usar Figma REST API quando a tarefa exigir endpoint especifico, automacao backend, export de imagens por node ou sincronizacao de variaveis.
- Usar Canva Connect APIs quando o objetivo for integrar Canva ao produto do usuario, e nao apenas orientar o desenvolvimento.
