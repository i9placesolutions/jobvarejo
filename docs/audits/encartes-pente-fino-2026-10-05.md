# Auditoria dos modelos de encarte — 05/10/2026

## Resultado e escopo

Foram lidos do PostgreSQL e do Wasabi os **282 modelos da biblioteca administrativa, com 1.403 páginas**. A auditoria cobriu geometria, limites dos frames, áreas de produtos, selos, logos, Instagram, validade e rodapés nos formatos disponíveis. Projetos pessoais derivados desses modelos não fazem parte deste lote.

**A auditoria identificou problemas e produziu uma rodada de correções seguras; não equivale à aprovação visual irrestrita da coleção.** Permanecem composições que exigem recomposição individual, detalhadas abaixo.

Estado da persistência: **CONCLUÍDA**. 281 modelos e 1401 páginas salvos; conteúdo do Wasabi e metadados/páginas/blueprints do PostgreSQL conferidos por leitura de volta. Recibo: `output/flyer-full-audit-2026-10-05/saved.json`, revisão `flyer-full-audit-1791213144194`.

## Correções preparadas e verificadas

| Ajuste | Páginas |
|---|---:|
| Área de produtos aproximada da faixa de validade, preservando o limite inferior | 775 |
| Selo nativo reenquadrado proporcionalmente | 775 |
| Logo redimensionada/reposicionada na coluna segura | 753 |
| Guia inferior do Instagram sincronizada com o painel | 794 |
| Metadados de posicionamento da logo sincronizados | 1.401 |
| Layout TV tratado para validade inferior e contatos legados | 279 |

Os números se sobrepõem. São **1.401 páginas de 281 modelos** no lote alterado. As duas páginas do modelo Canaã — Virada de Mês — Bebidas, leites e temperos permaneceram intactas.

No modelo da imagem enviada, **Preço Baixo de Verdade — Azul e Dourado**, a zona Stories passou de `top=581` para `top=541`, mantendo o limite inferior em `1786`: a distância acima da zona caiu de 48 para 8 pixels. Feed, square e print receberam o mesmo critério proporcional. Modelos vazios continuam com área vazia reservada aos produtos; isso não significa perda de conteúdo.

As imagens dos produtos, os estilos, os vínculos e os objetos das zonas preenchidas foram preservados. Painéis Polygon/Path/Image/Group usam escala vertical, mantendo suas dimensões intrínsecas. Os objetos ocultados dos contatos de TV permanecem no JSON, com seus textos preservados e vínculos dinâmicos desativados.

No editor, o centro da logo agora considera a geometria real e a origem do objeto Fabric. Isso evita tratar a coordenada superior/esquerda como centro quando o usuário troca a marca.

## Validações executadas

- Leitura das 1.403 páginas sem erro e análise de transparência de 220 assinaturas de assets, sem erro.
- 1.403 renders de auditoria; 47 pranchas de cabeçalhos/TV inspecionadas pela equipe, cobrindo todas as páginas. Essa inspeção por pranchas não comprova a legibilidade individual de cada texto pequeno.
- 40 renders de amostra da correção; 1.401 renders finais com os helpers atuais, sem falha de renderização.
- O harness de render final gravou o relatório completo (1.401 resultados, zero erros), mas permaneceu no encerramento dos processos; foi interrompido depois da conclusão e persistência. O encerramento do processo terminou com código 130, não um exit 0.
- 209.391 verificações estruturais: preservação dos IDs/fontes/frames/cards, estilos e snapshots de produtos, além de idempotência do lote combinado. Todas passaram.
- 27 cenários dinâmicos em nove páginas, com dados usuais, longos e ausentes; nenhum texto visível inspecionado pelo harness quebrou para mais de uma linha. Isso não substitui a troca de perfil no editor autenticado.
- 40 testes focados passaram. `npm run typecheck`, `npm run build`, `npm run check:client-chunk` e `git diff --check` passaram. Maior chunk: 459 KB, limite 500 KB. O build emitiu avisos de sourcemap do Tailwind.
- O build local não comprova deploy. O estado do servidor publicado não foi verificado nesta auditoria.

## Pendências e limites reais

1. **Artes com conteúdo incorporado no bitmap.** Há selos, slogans e marcas dentro de fundos ou recortes de referência. Reposicionar um objeto nativo não remove o conteúdo gravado no fundo. A série Dia D, por exemplo, ainda apresenta campanha recortada no próprio fundo de TV; não foi declarada resolvida. Esses casos exigem recompor a arte com fonte adequada, mantendo a identidade visual.
2. **Instagram sem painel nativo padronizado.** Nos derivados da coleção de referência, existem formatos com apenas handle/ícone ou sem o título superior. Foram preservados os elementos incorporados para evitar encobrir slogans ou texto original. A correção da guia não cria um cabeçalho que não existe.
3. **Zonas preenchidas e múltiplas zonas.** Canaã — Especial Dia do Cliente possui quatro páginas preenchidas com distância maior acima dos produtos. Sábado de Ofertas — Dourado e Vinho — Dinâmico e Fim de semana maluco precisam de revisão da disposição das zonas/setores. Alterar somente o retângulo da zona não comprova redistribuição correta dos produtos.
4. **Decoração no espaço da zona.** Vem Pagar Menos — Azul e Amarelo possui uma moeda no corredor em quatro formatos; o ajuste genérico não a encobriu.
5. **Cabeçalhos estreitos.** Nove páginas ainda acionam o limite heurístico de selo pequeno. Esse limite não é prova isolada de defeito: selos horizontais e versões TV têm proporções distintas. Entre os casos para decisão visual individual estão 48H square, Quarta Suína square e Leve Mais Calculadora Stories.

O detector refinado registra **134 alertas em 101 modelos**: 114 distâncias acima das zonas, nove selos pequenos, uma zona fora do frame, sete possíveis sobreposições com validade e três sobreposições entre zonas. São itens de triagem, não 134 defeitos confirmados. A faixa fina de estoque e os limites reais da coluna/alpha foram considerados para eliminar falsos positivos da primeira análise. A revisão individual dos 11 alertas de zonas confirmou: quatro contatos de até 3 px em Queima de Estoque sem falha visual material comprovada; dois falsos positivos em Canaã, cuja validade fica abaixo dos produtos; colisões reais entre as quatro zonas de Fim de semana maluco (square); e extrapolação de 7,8 px da zona de Quinta da carne (TV). Estas duas últimas composições permanecem pendentes de ajuste e validação com produtos. O relatório de exceções contém a evidência e a recomendação específica.

## Evidências e reprodução

Arquivos locais em `output/flyer-full-audit-2026-10-05/`:

- `index.html`: galeria pesquisável dos renders finais.
- `plan.json` e `after/`: alterações por página e JSONs candidatos.
- `geometry-final.json` e `pendencias-geometricas.csv`: inventário de alertas, com nome, formato, IDs e evidências.
- `zone-exceptions.md`: revisão específica das zonas complexas.
- `visual-01-16.md`, `relatorio-visual-17-32.md`, `visual-33-47.md`: observações por pranchas; hipóteses não confirmadas estão identificadas.
- `validation-final.json`, `renders-final.json`, `tests.log`, `build.log`, `chunk.log`: recibos das verificações.
- `uploaded.json` e `saved.json`: recibos da persistência, sem credenciais.

O snapshot anterior está em `output/product-zone-fill-2026-10-05/projects.json` e `before/`. A publicação usa novos caminhos no Wasabi, valida o conteúdo lido de volta e verifica concorrência por revisão e conteúdo antes de atualizar, em transação, as páginas e `template_config.pageBlueprints`. Não apaga os assets anteriores.

Modelos salvos precisam ser selecionados novamente para gerar uma nova peça. PNGs/exportações antigas e projetos já criados não são reescritos automaticamente.
