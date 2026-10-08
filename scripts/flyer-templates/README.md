# Ferramentas dos modelos de encarte

Padronização em lote da biblioteca de modelos e variações de estrutura. Regras de design em
`docs/encartes-padrao-design.md`. Todos os comandos rodam na raiz do repositório.

## Padronizar todos os modelos (rodapé completo)

1. **Cópia de segurança** (somente leitura):
   `node --env-file=.env scripts/flyer-templates/snapshot.mjs output/<lote>/before`
2. **Inventário** (tipos de rodapé, títulos, campos):
   `node scripts/flyer-templates/inventory.mjs output/<lote>/before`
3. **Plano** (ajusta e renderiza; não grava). Para todos, em 4 lotes paralelos:
   ```
   npx esbuild scripts/flyer-templates/runtime.ts --bundle --format=esm --platform=browser --outfile=output/.flyer-templates-runtime.mjs
   for i in 0 1 2 3; do FLYER_RUNTIME_READY=1 node --env-file=.env scripts/flyer-templates/standardize.mjs plan output/<lote>/before output/<lote>/plano --shard=$i/4 & done; wait
   ```
   Junte `report-*.json` em `report.json`. Para uma amostra: `--sample=12`; para modelos específicos: `--only=<id>,<id>`.
4. **Qualidade**: `node scripts/flyer-templates/qa.mjs output/<lote>/plano` (limites, sobreposição, ícones, espaçamento) e
   `node --env-file=.env scripts/flyer-templates/compare-sheet.mjs output/<lote>/before output/<lote>/plano saida.jpg 6 feed` (antes/depois).
5. **Gravar** (caminhos novos no Wasabi, leitura de volta, conferência de concorrência, transação):
   `node --env-file=.env scripts/flyer-templates/persist.mjs output/<lote>/before output/<lote>/plano --confirm`
6. **Desfazer**, se preciso: `node --env-file=.env scripts/flyer-templates/revert.mjs output/<lote>/plano --confirm`

O que o ajuste faz (`standardize-lib.mjs`, testado em `standardize-lib.test.mjs`): rodapé de referência vira rodapé de
3 blocos com cartões; títulos `FALE CONOSCO`, `ENDEREÇO`, `CARTÕES ACEITOS`; rodapé desenhado no fundo ganha faixa
invisível com colunas pelas divisórias da arte; valores alinhados aos títulos. TV e os modelos protegidos
(`EXCLUDED_TEMPLATE_IDS`) ficam como estão. É idempotente.

## Variações de estrutura (Produto Herói, Setores, Faixa Lateral)

Para temas da fábrica de campanhas (`scripts/campaign-factory`), que têm fundo gerado por layout:

1. `node --env-file=.env scripts/flyer-templates/structures/build.mjs <lote-da-fábrica> output/<saída> [tema...]`
2. Prancha: `node scripts/flyer-templates/structures/sheet.mjs output/<saída>/<tema> prancha.jpg`
3. `node --env-file=.env scripts/flyer-templates/structures/persist.mjs output/<saída> --confirm [tema...]`

As variações vão para `template_config.structureBlueprints` (o editor não muda). O gerador do WhatsApp escolhe a
estrutura pelas ofertas (`utils/flyerStructure.ts`) ou pelo pedido do cliente, e expande o painel de setores
(`utils/flyerSectorPanel.ts`) com os departamentos do pedido.
