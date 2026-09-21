---
name: jobvarejo-video-retail
description: Criar e refinar modelos reutilizáveis de vídeos de varejo no JobVarejo com Remotion, derivados dos encartes, em Reels/Stories e TV. Usar para composição, movimentos, etiquetas, áudio, revisão e renderização do módulo de vídeos; não para editar os encartes de origem ou Rádio Indoor.
---

# Vídeos de varejo JobVarejo

## Contrato visual e de produto

- Trabalhar em `shared/video-studio`, `components/video-studio`, `pages/videos`, APIs/worker de vídeo. Preservar os editores de imagem e rádio.
- Inventariar por UUID do encarte, não por nome. Receitas em `generated-flyer-recipes.json` são geradas por `scripts/video-studio/build-all-recipes.mjs`; ajustar a fonte antes de gerar.
- Cada modelo tem direção visual própria: combinar arte original, fundo, atmosfera, música, montagem e entrada. Não prometer que todos têm estruturas completamente exclusivas: verificar quantas famílias/layouts existem de fato.
- Produto, selo, logo e preço grandes; nome menor em área própria. TV preenche a área comercial com imagens perceptíveis, até três cópias quando couberem. Reels até duas automaticamente. Cópias têm entradas diferentes e não alteram a oferta.
- Usar etiquetas cadastradas na conta. Manter formas e cores; preço inteiro e centavos compõem um conjunto compacto. Não substituir por etiqueta inventada. `label-renderer.ts` usa glifos vetoriais para evitar deformação de texto SVG durante escala animada.
- Preço tem impacto na entrada e depois fica estável. Shake movimenta a composição inteira apenas durante impactos/transições. Fundo continua vivo; jamais animar continuamente o tamanho dos números.
- Selo respeita sua proporção real e trim de margens transparentes. Preservar arquivo de origem, gerar derivado. Abertura Reels: selo grande e logo grande próxima abaixo. TV: selo central grande, depois logo central grande em tela própria.
- Validade dinâmica, com ícone, no rodapé abaixo da etiqueta durante ofertas. Não inventar data no modelo compartilhado. Datas ilustrativas apenas em demonstrações autorizadas.
- Logo e contatos vêm da conta; permitir editar. Fechamento usa logo, redes, WhatsApp e endereço quando cadastrados. Não inserir dados de outra empresa nos modelos compartilhados.
- Música varia entre modelos; sons de abertura, entrada e transição combinam com os movimentos. Modelos compartilhados não têm locução fixa. MusicGPT apenas quando autorizado e solicitado, preservando identidade/recibo de tarefas para evitar cobranças duplicadas.
- Edição simples: arrastar, redimensionar, ocultar, quantidade de cópias; edição por cena e formato. Lista/fotos seguem o fluxo de encartes. Conferir persistência e isolamento da conta.

## Revisão antes da exportação

1. Ler `docs/video-studio/referencias-composicao.md` e verificar a revisão atual no código. Usar as skills Remotion relevantes, sem baixar recursos de terceiros indiscriminadamente.
2. Publicar/configurar modelos sem `--render`. Conferir quadros de ambos os formatos, incluindo nome, produto, etiqueta e validade. Verificar abertura/fechamento e extremos de proporção do selo.
3. Renderizar clipes curtos abrangendo a entrada completa e o período de leitura. Um still ou clipe que começa depois da entrada não detecta o defeito de métricas SVG. Conferir som e transições, além do frame parado.
4. Corrigir achados, executar testes do módulo e build se código do aplicativo mudou. Distinguir erro preexistente de regressão. Não dizer que todos os frames foram vistos ao revisar amostras.
5. Nesta sessão o usuário determinou revisão primeiro e lote final depois de aprovação. Não retomar o lote enquanto essa orientação estiver vigente. `--approved-review` registra aprovação recebida; não a substitui.
6. Após aprovação, publicar a revisão e renderizar. `--resume --render --approved-review` só quando o ledger corresponder à versão aprovada. Preservar resultados anteriores; nunca apagar assets para disfarçar falhas.
7. Conclusão é o total de jobs da revisão prontos mais arquivos verificados, não simplesmente processos rodando. Separar modelos configurados, quadros revisados, MP4s renderizados, arquivos conferidos e deploy. Registrar no Vault conforme AGENTS.md.

## Pontos de entrada

- `scripts/video-studio/render-all-model-stills.mjs`: quadros por modelo/formato; usar diretório próprio por revisão. Não executar duas instâncias no mesmo diretório de assets.
- `scripts/video-studio/publish-all-flyer-demos.mjs`: demonstrações na conta explicitamente selecionada; sem locução fixa; enfileiramento final condicionado à revisão.
- `scripts/video-studio/verify-all-exports.mjs`: conferência das saídas da revisão corrente, sem considerar versões antigas como prova.
- `workers/video-studio/engine.mjs`: stills, intervalos de frames e exportação completa. Guardar evidências em `output`, nunca segredos.
- `tests/video-studio`: geometria, catálogo, preço, movimento, trim, persistência e contratos do módulo.
