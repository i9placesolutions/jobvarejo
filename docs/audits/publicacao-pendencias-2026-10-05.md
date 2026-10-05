# Publicação das pendências — 05/10/2026

Solicitação: finalizar os 82 modelos de vídeo e enviar todas as alterações pendentes ao main.

## Escopo

- 82 receitas de vídeo adicionadas, com origem identificada pelo UUID do encarte, configuração custom preservada, arte de referência e dados da loja dinâmicos.
- Catálogo de vídeo, cabeçalhos do Cartazista, Estúdio de Artes, responsividade do editor rápido, tipografia/exportação, helpers de manutenção de encartes e WhatsApp administrativo que já estavam pendentes.
- Correção descoberta na revisão: alternativas de schema do WhatsApp que declaram required sem repetir type agora são validadas. As alternativas descritivas da imagem de perfil deixam de ser indevidamente exclusivas. Testes não enviam mensagens nem solicitações de pagamento.
- Material temporário de verificação em work/renderer-verification permanece local e foi ignorado no Git. Nenhum arquivo foi apagado. Arquivos de ambiente e mídias geradas continuam fora do versionamento.

## Verificação

- Build de produção e limite de chunk passaram; maior chunk: 459 KB para limite de 500 KB.
- Typecheck passou. O ambiente Node 26 emite aviso de depreciação de module.register, sem falha nessa execução.
- Suite final: 3.803 testes passaram, 2 ignorados, 8 falharam. As cinco falhas de accessPolicy, fabricObjectOps, priceTemplateStyleSync e productImageUploadBackground foram reproduzidas em cópia isolada do HEAD anterior. As três falhas restantes, em campaign-direction e personalization, também foram reproduzidas no HEAD anterior. O teste antigo que exigia música exclusiva para cada receita foi atualizado para aceitar as trilhas compartilhadas existentes, preservando unicidade e hash das faixas model-UUID.
- Auditoria dos 82: UUIDs únicos, fontes custom equivalentes às receitas geradas, 82 imagens com HEAD/tamanho conferidos no Wasabi, 82 stills Story e 82 TV, 164 clipes preexistentes. Pranchas dos dois formatos inspecionadas; não houve renderização de novo lote. Testes específicos de receitas/catálogo/arte: 295 aprovados; seleção de assets do worker: 7 aprovados. Os 82 compartilham três trilhas existentes (73/8/1); não há promessa de música exclusiva por modelo.
- Revisão independente de autorização/credenciais dos novos endpoints administrativos e varredura de padrões de segredos/valores de credenciais locais nos arquivos candidatos. Nenhum valor de credencial encontrado.

## Limites

Finalização do catálogo não equivale a gerar 164 novos MP4s completos nem a confirmar deploy. O modelo Canaã — Virada de Mês — Bebidas, leites e temperos, identificado separadamente na auditoria, não pertence aos 82 adicionados e continua sem receita. O push e o SHA remoto são registrados no Vault após execução.
