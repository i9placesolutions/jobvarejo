# Paridade dos encartes WhatsApp com o modo manual — 05/10/2026

## Escopo confirmado

Inventário somente leitura da mesma seleção de modelos publicada no catálogo: 282 projetos, 1.403 páginas em feed, square, stories, print e TV. Os canvases foram baixados de seus caminhos persistidos, sem alterar banco ou modelos.

## Correções

- Cards criados por `createEditorProductGridController.createSmartObject` e distribuição por `recalculateZoneLayout`, incluindo variantes, destaques e preenchimento de linhas incompletas.
- Correção compartilhada do padding mínimo: a margem de 2 px passa a ser descontada antes de calcular a área útil.
- Composição manual de rodapé, Instagram, validade e limites executada após personalização.
- Preços Red Burst, atacarejo e fardo usam os mesmos helpers de aplicação, fitting, âncoras e visibilidade do editor. Etiquetas antigas sem nomes recuperam a identificação sem substituir a configuração visual.
- Os 82 fundos públicos usados pela coleção têm allowlist exata no adaptador; as bandeiras nativas `/cartoes/cartao-N.png` são carregadas localmente. Caminhos arbitrários continuam rejeitados.
- Fira Sans original (normal/itálico nos pesos do catálogo) incluída para 10 páginas que a usam. Licença OFL preservada.

## Evidências

- 1.403 canvases carregados: nenhuma falha de leitura, todos com área de produtos.
- 34.320 verificações de encaixe (1 a 24 produtos por zona): zero itens fora dos limites após a correção de margem.
- 18 combinações reais de família/formato/dimensão em fixture sanitizada, testadas com textos longos, vazios e transformações manuais.
- 51 testes focados passaram, incluindo Fabric real e Chromium com fontes efetivamente carregadas.
- 28 renderizações reais por assinatura de formato, rodapé, validade e número de zonas; cinco casos de etiqueta legada foram corrigidos e repetidos com checagem explícita dos preços. Isso não equivale a inspeção visual individual das 1.403 páginas.
- 63 etiquetas distintas do catálogo carregadas com Fabric real e valor 42,37: nenhuma conservou o preço de exemplo.
- Typecheck e build da árvore seletiva passaram. Os 82 fundos públicos tiveram existência confirmada no storage. Três renders atingiram timeout sob compilação concorrente e passaram ao repetir. Publicação registrada no Registro de Atividades.

## Pendência de configuração de origem

“Fim de semana maluco”, Post 1:1, tem uma zona Mercearia maior que as demais e sobreposta às três zonas seguintes no próprio arquivo manual salvo. A situação também existe em snapshots anteriores. A geometria não foi alterada por suposição: aguarda confirmação do layout esperado. A validação de slots dentro de cada zona não valida sobreposição entre zonas.

Não houve envio de mensagens pelo WhatsApp nem substituição automática da revisão já enviada. A revisão antiga precisa ser regenerada para comprovar entrega externa.
