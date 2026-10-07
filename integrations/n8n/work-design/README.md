# n8n — fila de encartes Work

Os dois fluxos são **fontes locais inativas**, não foram importados/testados em uma instância n8n. A biblioteca local existente foi consultada; os fluxos WhatsApp atuais não atendem a esta fila sem efeitos de envio. Não há conexão MCP n8n disponível nesta sessão para consultar/alterar a instância real.

- `enqueue.json`: trigger tipado `request` (objeto conforme shared/work-design.ts), `idempotencyKey` (UUID estável). POST `/api/work-design/n8n/jobs`. Retorna pedido/revisão/status. O backend determina a conta pela credencial; não aceita ownerId arbitrário.
- `status.json`: trigger tipado `jobId` (UUID). GET `/api/work-design/n8n/jobs/:id`. Retorna estado e referências do novo projeto.
- Ambos: timeout de 30 segundos, três tentativas de rede, redirecionamento desativado, segunda saída de erro conectada a Stop and Error. Falha fica registrada como execução falha e propaga ao chamador. Não contém envio externo ou nó OpenAI.

Após publicar/configurar o backend e aplicar a migração no destino autorizado, importar os fluxos e selecionar uma credencial Header Auth chamada `JobVarejo | Work n8n piloto`: nome do header `Authorization`, valor `Bearer <WORK_DESIGN_N8N_TOKEN>`. Guardar segredo só nas credenciais do n8n e na configuração privada do backend. Nunca usar a credencial MCP do Work.

O chamador gera uma idempotencyKey por pedido comercial e reutiliza essa mesma chave nas retentativas. Executar o subworkflow em `each`/aguardar retorno quando houver vários itens. Criação concluída no n8n significa **pedido na fila**, não arte concluída. Consultar `status`; o Work lê a fila por lote, cria layout e devolve via MCP. Não criar um Schedule Trigger n8n que prometa disparar diretamente o Work Pro.

Antes de ativação automática: testar sucesso, entrada inválida, token incorreto, idempotência, consulta de pedido de outra conta e falha de backend; configurar o error workflow da instância para os chamadores agendados. Essa associação depende do ID real na instância e não foi inventada no JSON. Não há agendamento/ativação nem notificações externas nesta entrega.
