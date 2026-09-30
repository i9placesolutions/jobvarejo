# Isolamento da página na melhoria com IA — 29/09/2026

O original da página `156e78018f9f`, do projeto “Fecha Mês com Tudo” (`88ac5b41-74d1-412f-a1e2-7894ca161538`), contém somente cerveja Brahma e cerveja Lokal. A referência salva da geração `48d0580ffa8b002db4f56f310500b1b3` já inclui produtos de limpeza sobre as cervejas. A contaminação aconteceu na preparação da referência, antes da geração.

O recibo no Wasabi registra criação em 29/09/2026 às 16:31:24 (America/Sao_Paulo), pipeline `retail-layout-v15`, modelo `openai/gpt-image-2.5-sunburst`, conclusão e custo de US$ 0,046919. Foram lidos os PNGs original, referência, resultado e overlay, além do JSON da página. O JSON ainda contém cinco cards de limpeza antes dos dois cards de cerveja na ordem de camadas; a reconstrução percorria todos esses cards. O original exportado mostra apenas as duas ofertas que ficaram por cima.

O recibo antigo não armazenava o prompt literal. A revisão do código encontrou regras de preservação comercial, porém a IA recebia uma imagem reconstruída que já violava essas regras. Não é possível afirmar o texto histórico exato somente pelo recibo.

## Correção

- No redesign, a única referência enviada ao provedor passa a ser o PNG original exportado. A guia e o overlay continuam no contrato de preparação existente, mas não compõem a referência nem são enviados ao modelo.
- O prompt exige uma página independente, exatamente os produtos e embalagens visíveis nela, sem novas ofertas, importação de outras páginas ou recuperação de conteúdo oculto; preserva ordem, grid, posições e proporções.
- Pipeline incrementado para `retail-layout-v16`, descartando o reuso automático dos resultados v15 para novas solicitações.
- O prompt completo passa a ser gravado no recibo e incluído no fingerprint. O envio usa esse mesmo texto salvo, permitindo auditoria posterior.
- Modelo, qualidade high da tela, uma imagem por pedido, proporção, timeout de 300 segundos, limite diário e tratamento de erros/cobrança permanecem conforme o fluxo existente. Nenhuma chamada paga adicional é introduzida.

## Validação e limites

Os testes exercitam a persistência da referência quando as camadas auxiliares contêm outro conteúdo e a execução de duas páginas consecutivas com um provedor inteiramente simulado. Cada payload deve conter exatamente uma referência, igual aos bytes de seu próprio original, e o prompt deve coincidir com o gravado no recibo.

Validação executada: 119 testes em cinco arquivos de enhancement passaram, `npm run typecheck`, `npm run build`, `npm run check:client-chunk` e `git diff --check` passaram. Maior chunk client: 449 KB, abaixo do limite de 500 KB. Build emitiu avisos de depreciação, Browserslist, chunks circulares e sourcemaps, sem falha.

A inspeção do banco configurado localmente e do Wasabi foi somente leitura. Resultados antigos, produtos e páginas persistidas não foram alterados. Nenhuma nova geração paga ou publicação em produção foi feita nesta correção. Uma geração real e sua comparação visual ainda precisam confirmar o comportamento do modelo; a imagem já salva permanece no histórico.
