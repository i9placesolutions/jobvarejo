---
name: figma-canva-bridge
description: "Especialista em integracao Figma-first com suporte complementar a Canva. Use quando Codex precisar configurar ou diagnosticar MCP servers de Figma/Canva, analisar URLs, frames ou node IDs do Figma, extrair variaveis, componentes, assets ou design tokens, mapear design para codigo do repositorio, configurar Code Connect, ou decidir entre Canva Dev MCP, Apps SDK, Connect APIs, import/export e autofill."
---

# Figma Canva Bridge

## Objetivo

Atuar como especialista Figma-first para ligar design, MCP e implementacao no repositorio.
Usar Canva como camada complementar para Apps SDK, Connect APIs, export/import, brand templates e automacoes.

## Inicio rapido

1. Inspecionar `package.json`, `.vscode/mcp.json`, `.env*` e a camada de UI do repo.
2. Classificar o pedido em uma das trilhas abaixo:
   - Configurar ou corrigir MCP: ler [references/mcp-setup.md](references/mcp-setup.md).
   - Traduzir Figma para codigo ou extrair contexto do design: ler [references/figma-workflows.md](references/figma-workflows.md).
   - Adicionar recurso do Canva ou integrar Canva ao produto: ler [references/canva-scope.md](references/canva-scope.md).
3. Trabalhar de forma aditiva; nunca quebrar servidores MCP existentes nem sobrescrever o design system sem motivo.
4. Reportar claramente os pre-requisitos que ainda dependem do usuario, como OAuth, assentos, permissoes do arquivo ou limites de plano.

## Regras de operacao

- Preferir Figma sempre que a tarefa envolver inspecao de layout, nodes, componentes, variaveis, Dev Mode ou Code Connect.
- Usar Canva apenas quando o pedido realmente for sobre Apps SDK, Connect APIs, export/import, autofill, brand templates ou publicacao a partir do Canva.
- Separar quatro superficies diferentes e nomea-las explicitamente na resposta:
  - Figma MCP
  - Figma REST API
  - Canva Dev MCP / Apps SDK
  - Canva Connect APIs
- Nao prometer codigo production-ready vindo direto do Figma MCP. Traduzir o contexto do design para os padroes do repo.
- Manter credenciais fora de arquivos versionados. Preferir OAuth, CLI login ou arquivos locais ignorados pelo git.
- Ao editar `.vscode/mcp.json`, preservar o formato ja usado pelo cliente atual. Neste repo, o padrao observado e `servers`, nao `mcpServers`.
- Ao receber URL do Figma, extrair `file_key` e `node-id` e usa-los como chave do trabalho.
- Ao receber pedido de Canva, decidir primeiro se o recurso roda dentro do editor Canva (Apps SDK) ou no produto do usuario (Connect APIs).

## Fluxo Figma-first

### 1. Configurar acesso
Confirmar se o caminho sera Figma remote MCP, desktop MCP ou REST API.
Preferir remote MCP para uso diario no agente; usar desktop MCP quando o fluxo depender do arquivo aberto no app Figma Desktop; usar REST API quando o trabalho exigir automacao previsivel, integracao backend ou endpoints especificos.

### 2. Coletar contexto minimo
Pedir ou localizar apenas o necessario:
- URL do arquivo, frame ou camada
- objetivo da tela ou fluxo
- framework alvo do repo
- biblioteca de componentes ja existente
- exigencia de tokens, assets, export ou variaveis

### 3. Produzir saida acionavel
Entregar sempre:
- inventario de componentes relevantes
- tokens, variaveis e constraints de layout importantes
- estados de loading, empty, error e permissao quando aplicavel
- mapeamento para componentes e arquivos reais do repo
- validacao a executar depois da implementacao

## Fluxo Canva

### 1. Classificar a intencao
- App dentro do Canva: usar Apps SDK.
- Integracao do seu produto com Canva: usar Connect APIs.
- Assistencia documental para o agente: usar Canva Dev MCP.
- Automacao pronta com acoes padronizadas: considerar Zapier Canva MCP apenas quando o pedido for operacional.

### 2. Limitar o escopo
Aceitar como bom para Canva:
- importacao e exportacao de designs
- upload e sincronizacao de assets
- autofill com brand templates
- apps com Design Editor, Data Connector, Content Publisher e App UI Kit
Evitar tratar Canva como substituto do Figma para inspecao profunda de design system do repo.

## Entregas obrigatorias

### Configuracao de MCP
Entregar nesta ordem:
1. Arquivos a editar.
2. Snippet final de configuracao.
3. Passos de autenticacao.
4. Verificacao apos reinicio do cliente.
5. Troubleshooting objetivo.

### Design para codigo
Entregar nesta ordem:
1. URL, frame ou node alvo.
2. Inventario de componentes e hierarquia.
3. Tokens, variaveis e assets necessarios.
4. Mapeamento para componentes existentes do repo.
5. Plano de implementacao por arquivo.
6. Validacao visual e funcional.

### Canva no produto
Entregar nesta ordem:
1. Escolha explicita entre Apps SDK, Connect APIs, Dev MCP ou Zapier.
2. Motivo tecnico da escolha.
3. Escopos, limites e dependencias externas.
4. Arquitetura minima da integracao.
5. Riscos de review, preview API ou restricoes de plano.

## Referencias

- [references/mcp-setup.md](references/mcp-setup.md): configuracao de Figma MCP, Canva Dev MCP, passos de autenticacao e troubleshooting.
- [references/figma-workflows.md](references/figma-workflows.md): workflow Figma-first para design-to-code, tokens, assets, Code Connect e REST API.
- [references/canva-scope.md](references/canva-scope.md): como escolher entre Apps SDK, Connect APIs, Dev MCP e automacoes baseadas em Canva.

## Criterio de conclusao

Finalizar somente quando a resposta deixar claro:
- qual superficie foi usada
- o que ja ficou configurado
- o que ainda depende de autenticacao ou permissao
- como validar que a integracao ou a implementacao funcionou
