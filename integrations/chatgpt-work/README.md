# Piloto JobVarejo → ChatGPT Work

**Estado:** piloto publicado em produção em 07/10/2026 (be8c677f), migração/configuração restrita aplicadas. MCP com dez ferramentas e discovery OAuth conferidos por HTTPS. Plugin privado salvo na conta pessoal: [JobVarejo — Encartes](https://chatgpt.com/plugins/plugins_6ac6609d3a8c819196c289a4c6fb1a53), referência em `plugin-release.json`. Autorização OAuth da conta ainda pendente; nenhuma geração pelo Work ou tarefa agendada foi comprovada. A pasta `jobvarejo-work` contém manifesto, skill e `mcp.json`; o pacote não contém credenciais.

## Escopo da versão 0.1

- `/encartes-ia`: lista de produtos com fotos escolhidas na biblioteca, preços, formatos, paleta, orientação criativa, pedidos/revisões, reutilização e prévias. Orientações são acrescentadas ao briefing; não há interpretação livre de comandos por chat nesta versão.
- O campo de mensagem é do JobVarejo: não incorpora uma sessão de chat do Work. Uma futura conversa imediata exige um motor de IA próprio integrado ao painel; API OpenAI tem cobrança separada do Pro. Neste piloto, mudanças na lista são feitas pelos controles de produtos e pedidos criativos seguem a fila.
- Fila SQL dedicada, reserva de 15 minutos, revisão e idempotência. Sem escrita no modelo/projeto de origem. Resultados são novos projetos privados.
- Composição declarativa com dados resolvidos no servidor, endereços separados, slots variados, formas/imagens e cards nativos pelo worker existente. Conferência de arquivos por leitura após gravação.
- Conector MCP com credencial exclusiva por uma conta piloto, e entrada/consulta n8n com outra credencial. Nenhuma chamada OpenAI/Magnific é feita por esses módulos.
- Dois elementos reais do teste Economia estão no catálogo `server/data/work-design-elements.json`, restritos ao proprietário. Novos kits entram por cadastro desse manifesto; busca ampla/classificação automática de toda a biblioteca não foi implementada.
- Resultado abre no editor completo. O contrato do rápido e sincronização automática entre formatos ainda dependem do piloto visual. Reutilização mantém o briefing/lista; a composição anterior é uma referência, não uma atualização instantânea da arte.

## Ativação revisável

1. Publicar o código somente após revisão e autorização de release. Aplicar manualmente `database/work_design_jobs_migration.sql` no destino autorizado. Nenhum endpoint aplica DDL.
2. Configurar no servidor, fora do Git: `WORK_DESIGN_ENABLED=true`, `WORK_DESIGN_PILOT_IDS=<UUID permitido>`, `WORK_DESIGN_WORKER_OWNER_ID=<mesmo UUID>`, `WORK_DESIGN_WORKER_TOKEN=<aleatório com pelo menos 32 caracteres>`, `WORK_DESIGN_N8N_TOKEN=<outro valor aleatório>`. Seleção de outra conta pelo painel é bloqueada no piloto. Desligar `WORK_DESIGN_ENABLED` bloqueia novos acessos/execuções.
3. `WORK_DESIGN_PYTHON` deve apontar a Python com Playwright; o Chromium/fontes e o worker `workers/whatsapp-creation/render.py` são os já usados pelo sistema. Testar os recursos/memória do servidor antes de permitir geração concorrente com outros módulos. O render experimental possui sua própria trava por processo; não é um scheduler distribuído de render.
4. Verificar HTTPS real do endpoint `/api/work-design/mcp`, autenticação, inicialização e `tools/list`. O transporte mínimo responde JSON e suporta MCP 2025-03-26, 2025-06-18 e 2025-11-25; não oferece SSE server-initiated. Clientes de protocolos futuros precisam negociar versão suportada.
5. Conectar esse endpoint à conta ChatGPT do operador por OAuth. Ativar `WORK_DESIGN_OAUTH_ENABLED=true` e definir `WORK_DESIGN_PUBLIC_ORIGIN=https://jobvarejo.com.br`. O servidor oferece discovery, CIMD oficial da OpenAI, PKCE S256, autorização explícita com sessão da conta piloto, código de uso único, acesso de uma hora e refresh rotativo de sete dias. Redis obrigatório, com falha fechada. Não inserir credencial no prompt ou no manifesto.
6. Conectar o plugin/skill e executar um pedido manual real no Work. Esta implementação não prova disponibilidade do plugin/imagem/transferência em sua conta. Confirmar que o projeto salvo pode ser reaberto/editado/exportado e que o original permaneceu intacto.
7. Só depois criar tarefa **no Work da conta**, usando plugin e skill. Não substituir por heartbeat local do Codex. Prompt sugerido: “Processe até dois pedidos pendentes do piloto JobVarejo usando compose-flyers, confira todas as prévias, conclua somente resultados válidos; sem pedidos, não crie nada; registre impedimentos na fila.” Definir a frequência conforme tempo medido e uso disponível do Pro.
8. Importar os fluxos n8n de `integrations/n8n/work-design` com credencial separada e testar criação/consulta. O n8n não usa um trigger imediato de Workspace Agents neste caminho Pro.

## Validação de ativação

Produção: deploy be8c677f concluído e aplicação saudável; discovery OAuth HTTP 200; MCP initialize e tools/list HTTP 200 com dez ferramentas. Credenciais Work/n8n não são intercambiáveis (401 nos dois sentidos); token OAuth inexistente foi recusado (401), depois da conexão inicial do Redis. Pedido de cinco produtos/Story/data 07 de outubro criado e consultado pelo n8n (200), idempotência e leitura do banco confirmadas. Tela autenticada da conta piloto abriu no Safari e exibiu o pedido, cinco preços e fotos selecionadas; formulário de revisão carregou esses dados. O teste usa os dados atuais do cadastro Job Varejo, sem mudar o perfil global para Economia. Não houve composição pelo Work, revisão salva pelo navegador, abertura de resultado, exportação ou certificação do editor rápido.

## Verificação local

Em 07/10/2026, passaram 95 testes selecionados (31 do piloto, incluindo oito OAuth, e 64 de contratos existentes), build de produção e limite de chunk client (459 KB / 500 KB). O render offline passou em sete páginas, com 1/5/12 produtos, dois formatos e dois endereços; conferência visual feita em Story de cinco produtos e feed de doze. A checagem completa de tipos **não passou**: há erros espalhados de tipagem global de `$fetch` e imports `.ts` no script de benchmark; os arquivos existentes relacionados não foram alterados. Uma tentativa com heap padrão também esgotou memória. Não há certificação completa de tipos nem certificação de edição/exportação no editor conectado nesta etapa.

`npm test -- --run tests/work-design` usa PostgreSQL embarcado PGlite em memória, sem conexão com produção. Verifica SQL/revisões/escopo/idempotência. PGlite não prova concorrência entre processos/instâncias reais.

`WORK_DESIGN_PYTHON=<python com Playwright> node scripts/work-design/render-pilot.mjs <pasta de fotos do teste Economia>` renderiza fixtures de 1/5/12 produtos em Story/feed, dois endereços, paginação e roundtrip Fabric. Saídas em `output/work-design-pilot` são fixtures locais, **não artes geradas pelo Work**. Não chama API, banco de produção nem storage. Fotos esperadas: logo.png, coxao-mole.webp, almondega-bovina.webp, costela-bovina.webp, suan-suina.png e coxinha-asa.webp.

Ainda verificar no ambiente conectado: logo com outras proporções, fotos altas/largas, nomes extensos, adicionar/remover item pelo editor, desfazer/refazer, reabrir/exportar, transferência de imagens Work, disponibilidade em agendamento e latência de lote. Não promover modelos automaticamente nesta versão.

O lease dura 15 minutos. Um lote longo pode expirar e ser recusado antes da publicação; arquivos intermediários já gravados podem ficar sem projeto referenciador. Retentativas simultâneas são protegidas no banco contra duplicação do projeto, mas podem produzir arquivos intermediários. Manter o piloto em lotes pequenos até medir tempo e definir renovação/limpeza com isolamento adequado.

Referências: [conexão ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt), [agendamentos Work](https://learn.chatgpt.com/docs/automations), [transporte MCP implementado](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
