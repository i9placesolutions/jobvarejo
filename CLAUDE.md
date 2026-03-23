# CLAUDE.md — Regras globais do projeto

## IDIOMA — OBRIGATÓRIO
- SEMPRE responda em **português brasileiro (pt-BR)**.
- Comentários no código em português.
- Commits em português.
- Nomes de variáveis e funções em inglês (padrão da indústria).
- Mensagens de erro e logs em português quando voltadas ao usuário, inglês quando internas.

---

## SKILLS — USO OBRIGATÓRIO

### Regra de ouro
**NUNCA comece a executar uma tarefa sem antes ler o SKILL.md correspondente.**
Isso não é sugestão — é requisito. Pule isso e o output será inferior.

### Fluxo obrigatório
1. Identifique a tarefa (criar arquivo, deploy, debug, documento, etc.)
2. Leia o SKILL.md correspondente usando a tool `Read`
3. Siga as instruções do skill à risca
4. Só então execute a tarefa

### Mapa de skills disponíveis

| Tarefa | Skill | Caminho |
|--------|-------|---------|
| Word/docx | docx | `/mnt/skills/public/docx/SKILL.md` |
| PDF | pdf | `/mnt/skills/public/pdf/SKILL.md` |
| PowerPoint/pptx | pptx | `/mnt/skills/public/pptx/SKILL.md` |
| Excel/xlsx | xlsx | `/mnt/skills/public/xlsx/SKILL.md` |
| Frontend/UI | frontend-design | `/mnt/skills/public/frontend-design/SKILL.md` |
| Leitura de arquivos | file-reading | `/mnt/skills/public/file-reading/SKILL.md` |
| Leitura de PDF | pdf-reading | `/mnt/skills/public/pdf-reading/SKILL.md` |
| Coolify/Deploy | coolify-expert | `/mnt/skills/user/coolify-expert/SKILL.md` |
| Produtos Anthropic | product-self-knowledge | `/mnt/skills/public/product-self-knowledge/SKILL.md` |

### Skills extras (usar quando relevante)
- Canvas/Design: `/mnt/skills/examples/canvas-design/SKILL.md`
- Co-autoria de docs: `/mnt/skills/examples/doc-coauthoring/SKILL.md`
- Criador de skills: `/mnt/skills/examples/skill-creator/SKILL.md`
- Temas visuais: `/mnt/skills/examples/theme-factory/SKILL.md`
- MCP Builder: `/mnt/skills/examples/mcp-builder/SKILL.md`
- Arte algorítmica: `/mnt/skills/examples/algorithmic-art/SKILL.md`
- Web artifacts: `/mnt/skills/examples/web-artifacts-builder/SKILL.md`

### Múltiplos skills
Se a tarefa envolve mais de uma área (ex: criar um PDF com design bonito), leia TODOS os skills relevantes antes de começar.

---

## RESOLUÇÃO DE ERROS — PROTOCOLO INTELIGENTE

### Quando encontrar um erro, NUNCA chute a solução. Siga este protocolo:

#### Passo 1: Analise o erro
- Leia a mensagem de erro COMPLETA
- Identifique: arquivo, linha, tipo de erro, stack trace
- Classifique: erro de sintaxe, runtime, dependência, configuração, permissão, rede

#### Passo 2: Pesquise ANTES de tentar corrigir
- Use `ctx_fetch_and_index` para buscar a documentação oficial da lib/framework envolvido
- Use `ctx_search` para verificar se já encontrou algo similar indexado
- Se o erro envolve uma dependência, consulte o GitHub Issues do pacote
- Se o erro é de uma API, consulte a documentação oficial

#### Passo 3: Consulte fontes confiáveis (nesta ordem)
1. **Documentação oficial** da lib/framework (sempre primeiro)
2. **GitHub Issues** do repositório do pacote
3. **Changelogs/Release Notes** (pode ser breaking change)
4. **Stack Overflow** (apenas respostas com alta votação)

#### Passo 4: Corrija com contexto
- Explique o que causou o erro em português
- Mostre a correção e POR QUE funciona
- Se houver risco de efeito colateral, avise

### Erros recorrentes
Se o mesmo erro aparecer 2x após tentativa de correção:
1. PARE de tentar corrigir
2. Faça uma análise mais profunda da causa raiz
3. Pesquise online com mais contexto
4. Considere que o problema pode estar em outro lugar (dependência, versão, config)

---

## PLUGINS E FERRAMENTAS MCP — USO PROATIVO

### Regras de uso de MCP
- SEMPRE verifique quais MCP servers estão conectados antes de tarefas que envolvem ferramentas externas
- Use `/mcp` para verificar status dos servidores
- Se um MCP server relevante estiver disponível, USE-O ao invés de alternativas manuais

### Prioridade de ferramentas
1. **MCP server específico** (PostgreSQL, GitHub, etc.) → sempre preferido
2. **ctx_batch_execute** → para comandos shell e análise
3. **ctx_fetch_and_index** → para buscar documentação online
4. **Bash direto** → apenas para comandos curtos (git, npm, ls, etc.)

### Pesquisa proativa
Quando trabalhar com uma lib/framework que não domina ou que pode ter mudado:
- Use Context7 MCP (se disponível) para docs atualizadas
- Use `ctx_fetch_and_index` na documentação oficial
- NÃO confie apenas no conhecimento de treinamento para versões recentes

---

## QUALIDADE DE CÓDIGO — PADRÕES

### Antes de entregar qualquer código:
- Verifique se compila/roda sem erros
- Trate TODOS os erros com try/catch ou equivalente
- Valide inputs quando relevante
- Não deixe console.log de debug no código final
- Não use `any` em TypeScript (use tipos explícitos)

### Ao editar código existente:
- Leia o arquivo completo antes de editar
- Entenda o padrão existente e siga-o
- Não refatore o que não foi pedido (a menos que solicitado)
- Mantenha consistência com o estilo do projeto

---

## COMUNICAÇÃO

### Formato de resposta
- Respostas diretas e objetivas
- Código vai em ARQUIVOS, não inline (a menos que seja snippet curto de explicação)
- Quando criar/editar arquivo: retorne caminho + descrição de 1 linha
- Máximo 500 palavras por resposta (exceto quando a tarefa exige mais)
- Use emojis com moderação (apenas para destacar avisos ⚠️ ou sucesso ✅)

### Quando não souber
- Diga "não sei" ao invés de inventar
- Pesquise usando as ferramentas disponíveis
- Sugira alternativas quando possível

---

## context-mode — Regras de roteamento OBRIGATÓRIAS

Você tem ferramentas MCP de context-mode disponíveis. Estas regras NÃO são opcionais — elas protegem sua janela de contexto de flooding. Um único comando não roteado pode despejar 56 KB no contexto e desperdiçar a sessão inteira.

### Comandos BLOQUEADOS — NÃO tente estes

#### curl / wget — BLOQUEADO
Qualquer comando Bash contendo `curl` ou `wget` é interceptado e substituído por mensagem de erro. NÃO tente novamente.
Use ao invés:
- `ctx_fetch_and_index(url, source)` para buscar e indexar páginas web
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` para chamadas HTTP em sandbox

#### HTTP Inline — BLOQUEADO
Qualquer comando Bash contendo `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, ou `http.request(` é interceptado e substituído por mensagem de erro. NÃO tente novamente com Bash.
Use ao invés:
- `ctx_execute(language, code)` para rodar chamadas HTTP em sandbox — apenas stdout entra no contexto

#### WebFetch — BLOQUEADO
Chamadas WebFetch são negadas completamente. A URL é extraída e você é orientado a usar `ctx_fetch_and_index`.
Use ao invés:
- `ctx_fetch_and_index(url, source)` depois `ctx_search(queries)` para consultar o conteúdo indexado

### Ferramentas REDIRECIONADAS — use equivalentes em sandbox

#### Bash (>20 linhas de output)
Bash é APENAS para: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, e outros comandos de output curto.
Para todo o resto, use:
- `ctx_batch_execute(commands, queries)` — rode múltiplos comandos + busca em UMA chamada
- `ctx_execute(language: "shell", code: "...")` — rode em sandbox, apenas stdout entra no contexto

#### Read (para análise)
Se você está lendo um arquivo para **Editar** → Read está correto (Edit precisa do conteúdo no contexto).
Se você está lendo para **analisar, explorar ou resumir** → use `ctx_execute_file(path, language, code)`. Apenas seu resumo impresso entra no contexto. O conteúdo bruto do arquivo fica no sandbox.

#### Grep (resultados grandes)
Resultados de Grep podem inundar o contexto. Use `ctx_execute(language: "shell", code: "grep ...")` para rodar buscas em sandbox. Apenas seu resumo impresso entra no contexto.

### Hierarquia de seleção de ferramentas

1. **COLETAR**: `ctx_batch_execute(commands, queries)` — Ferramenta primária. Roda todos os comandos, auto-indexa output, retorna resultados de busca. UMA chamada substitui 30+ chamadas individuais.
2. **ACOMPANHAR**: `ctx_search(queries: ["q1", "q2", ...])` — Consulte conteúdo indexado. Passe TODAS as perguntas como array em UMA chamada.
3. **PROCESSAR**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Execução em sandbox. Apenas stdout entra no contexto.
4. **WEB**: `ctx_fetch_and_index(url, source)` depois `ctx_search(queries)` — Buscar, fragmentar, indexar, consultar. HTML bruto nunca entra no contexto.
5. **INDEXAR**: `ctx_index(content, source)` — Armazene conteúdo na base de conhecimento FTS5 para busca posterior.

### Roteamento de subagentes

Ao criar subagentes (ferramenta Agent/Task), o bloco de roteamento é automaticamente injetado no prompt deles. Subagentes do tipo Bash são atualizados para propósito geral para que tenham acesso às ferramentas MCP. Você NÃO precisa instruir manualmente os subagentes sobre context-mode.

### Restrições de output

- Mantenha respostas abaixo de 500 palavras.
- Escreva artefatos (código, configs, PRDs) em ARQUIVOS — nunca retorne como texto inline. Retorne apenas: caminho do arquivo + descrição de 1 linha.
- Ao indexar conteúdo, use rótulos descritivos de fonte para que outros possam `ctx_search(source: "rótulo")` depois.

### Comandos ctx

| Comando | Ação |
|---------|------|
| `ctx stats` | Chame a tool MCP `ctx_stats` e exiba o output completo |
| `ctx doctor` | Chame a tool MCP `ctx_doctor`, rode o comando shell retornado, exiba como checklist |
| `ctx upgrade` | Chame a tool MCP `ctx_upgrade`, rode o comando shell retornado, exiba como checklist |
