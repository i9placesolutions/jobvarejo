# Formato atacado por embalagem

Identificador de produto: `offerFormat: 'wholesale-pack-v1'`.

A detecção exige cabeçalhos de produto, embalagem, quantidade por embalagem,
preço base da embalagem, base unitário, especial da embalagem e especial
unitário. Uma linha pode deixar preços vazios. A coluna repetida “PREÇO
ESPECIAL” contendo “ACIMA DE…” é condição; posição na lâmina não é condição.

O formato exibe preço da embalagem em destaque, unitário complementar quando
informado, quantidade da embalagem e condição original. Não calcula preços
ausentes. Cada faixa sem valor é ocultada. Só oferece etiquetas com espaço
para os valores e a embalagem presentes.

Produtos anteriores, sem esse identificador, continuam no fluxo anterior.
As regras novas não alteram modelos globais nem atribuem formato a projetos
antigos. Novos formatos devem receber outro identificador e seu próprio
resolvedor; não alterar o resolvedor legado para reproduzir uma referência.

O identificador atravessa importação, migrateProduct e revisão e é salvo dentro
de `_productData`, já coberto pela serialização do canvas. Não há migração SQL.

Entrada rápida: XLSX, XLS, CSV, TSV, TXT e PDF com texto, até 12 MB. A revisão
inicia a busca existente de imagens e permite conferir os itens antes de
aplicá-los. PDFs digitalizados sem texto precisam de outra origem; OCR não
faz parte deste fluxo.

Validação: tests/utils/wholesaleImportReference.test.ts inclui dados da
referência, XLSX e PDF reais, colunas vazias, quatro/dois preços e isolamento
em relação ao resolvedor anterior.
