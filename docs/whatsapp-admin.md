# Chat WhatsApp administrativo

A página `/admin/whatsapp` mostra a instância exclusiva JobVarejo configurada por `JOBVAREJO_UAZAPI_URL` e `JOBVAREJO_UAZAPI_INSTANCE_TOKEN`. Não há fallback para a instância usada no login OTP. As credenciais permanecem no backend. O acesso usa os guards de autenticação/admin existentes.

## Integração com n8n e realtime

Os workflows de criação em `integrations/n8n/whatsapp-creation` continuam recebendo seus webhooks. O painel usa uma assinatura independente da UAZAPI `/sse`, através de `/api/admin/whatsapp/realtime`: não substitui webhooks, não filtra mensagens `fromMe` e não depende do n8n para atualizar conversas. São assinados connection, history, messages, messages_update, newsletter_messages, status_posts, call, contacts, presence, groups, labels, chats, chat_labels e sender.

O painel de eventos mantém somente os últimos 100 envelopes recebidos na memória do navegador. Não é arquivo permanente de auditoria.

O servidor filtra credenciais dos dados e mantém heartbeat. A conexão expira a cada cinco minutos para revalidar a sessão na reconexão. A UI reconcilia o estado pela API após reconexão; não há promessa de replay durável dos eventos do SSE. A fonte de histórico é a UAZAPI, não as tabelas de pedidos do agente n8n.

## Contrato e cobertura

`shared/whatsapp-admin/operations.json` é um catálogo derivado do OpenAPI público consultado em 05/10/2026: 158 operações. O backend resolve operações por ID, valida os campos tipados/obrigatórios/enums e usa exclusivamente a origem e credenciais de servidor. A página oferece controles de conversa e um painel de recursos por categoria com parâmetros do contrato para as demais operações. Esse painel não equivale a uma interface dedicada para cada função.

As operações com `admintoken` exigem `super_admin` e `JOBVAREJO_UAZAPI_ADMIN_TOKEN`, opcional. Modificações de webhook, proxy, Chatwoot e desconexão/reset/exclusão da instância exigem super_admin mesmo quando a UAZAPI usa apenas token de instância. Não informe token administrativo para um usuário comum. Não altere o webhook existente indiscriminadamente: ele atende os workflows n8n de criação.

A API instalada pode divergir do contrato publicado. Na leitura real, `message/find` retornou os campos de paginação na raiz; `chat/find` retornou `pagination.totalRecords` sem `hasMore`. A UI aceita os dois formatos. Operações não disponíveis na versão instalada devem mostrar falha real, sem fingir sucesso.

## Limites do provedor

- Histórico local da UAZAPI: até sete dias, podendo ser menor em alto volume. A lista inclui os chats sincronizados na instância; não comprova acesso a todas as mensagens de todo o passado da conta.
- Histórico mais antigo depende de `requestHistorySync`, do aparelho principal online e dos eventos `history`; a resposta não é imediata nem garantida.
- `makeCall` faz o destinatário tocar; com arquivo reproduz áudio. Não oferece conversa de voz bidirecional no navegador.
- O aceite de envio pela API não prova entrega. Os estados exibidos devem seguir os recibos reais do provedor.
- Mensagens e ações do celular, do painel e do n8n compartilham a mesma conta. O chat não desativa automaticamente o agente durante atendimento humano.

## Configuração

Áudios gravados em WebM/MP4/WAV e enviados como PTT são convertidos no servidor para OGG/Opus com FFmpeg, já instalado no Docker. Conversão falha explicitamente se a ferramenta ou o arquivo estiver indisponível; não há envio automático ao parar/cancelar a gravação. Limite de arquivo: 12 MB.

Configure as variáveis privadas documentadas no `.env.example`. Host HTTPS customizado exige `JOBVAREJO_UAZAPI_ALLOWED_HOST`. Não é necessária migração: este chat consulta o histórico mantido pelo provedor. Para retenção permanente, será necessário um projeto separado de persistência de eventos.

Fontes: https://docs.uazapi.com/openapi-bundled.json, https://docs.uazapi.com/reference/subscribeSSE.md, https://docs.uazapi.com/docs/collections/message-history-retention.md e https://docs.uazapi.com/reference/makeCall.md.
