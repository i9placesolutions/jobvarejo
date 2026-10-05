# Auditoria do Estúdio de Artes — 03/10/2026

Escopo: código local de catálogo, criação, preview e Python/Pillow. Não houve inspeção autenticada de produção, consulta ao catálogo persistido nem alteração de banco. “Mocks” identificados: os 12 modelos estáticos `starter-*` injetados pela API; não são os modelos cadastrados pelos administradores.

## Correções desta revisão

- Removida a inclusão dos 12 modelos demonstrativos na API. Catálogo passa a usar somente registros persistidos; ausência das tabelas retorna catálogo vazio e indisponibilidade, sem demonstrações.
- Geração automática desacoplada do índice 10 da coleção demonstrativa; mantém uma composição-base editável própria.
- Filtro de orientação considera também os formatos alternativos.
- Prévia do formato usa a montagem salva em `alternates`, quando disponível.
- Criação preserva os formatos publicados sem reajustar fontes pelo Pillow. Apenas formatos ausentes são enviados ao motor, em uma chamada. Seleção de formatos é deduplicada e abre o formato preferido quando incluído no lote.

## Melhorias necessárias, por prioridade

### Alta — fidelidade do PNG

1. **Preço com centavos diferenciados:** `ArtPreview.vue` possui ramo `richPrice`, mas `workers/art_studio.py` não interpreta essa propriedade; o Fabric também não possui ramo equivalente. Reprodução local com `19,90`: ativar `richPrice` retorna exatamente os mesmos bytes no Pillow. Implementar o mesmo contrato nos três renderizadores e comparar imagens.
2. **Texto e recorte da imagem na prévia:** o SVG quebra texto pela estimativa de caracteres (`fontSize * 0.53`), enquanto Pillow mede fontes e Fabric usa suas métricas. A prévia usa `xMidYMid slice` e não aplica `cropX/cropY`. Usar o mesmo cálculo de layout/recorte e validar com frases longas, acentos e enquadramentos deslocados.
3. **Gradiente em texto:** schema e Fabric aceitam gradientes; o Pillow aplica apenas em formas/ícones. Implementar preenchimento pela máscara do texto, preservando contorno e sombra, ou restringir explicitamente os efeitos disponíveis antes de exportar.

### Alta — criação útil de modelos

4. **Gerador determinístico limitado:** tema, título, mensagem e paleta preenchem uma única receita; não há planejamento criativo ou pesquisa de imagens. Pillow desenha uma composição recebida, não inventa uma direção visual. Evoluir para receitas por finalidade e proporção, com áreas de logo, título, imagem e mensagem, assets reutilizáveis e revisão de prévia antes de publicar. Manter JSON como fonte editável.
5. **Adaptação de proporção:** `compose` multiplica x/largura e y/altura independentemente. Pode distorcer elementos e não reorganiza hierarquia ao transformar feed em banner. Usar montagens específicas ou regras por formato, evitando apenas esticar a arte. A preservação de alternates nesta revisão evita degradar modelos já preparados.

### Média — robustez e operação

6. **Orçamento de memória:** limite de 24 milhões de pixels por camada antecede expansão por blur e rotação; texto com `fontScaleX < 1` cria bitmap mais largo. Definir orçamento para intermediários e lote, verificar antes da alocação e retornar erro compreensível. Risco identificado no código; estouro de memória não foi provocado.
7. **Falhas do worker:** timeout, fonte ausente, texto que não cabe e entrada inválida terminam em mensagens genéricas. Padronizar códigos de erro e destacar camada/formato afetado para orientar a correção.
8. **Carregamento do perfil:** catálogo captura falhas de perfil silenciosamente, deixando logo vazia. Distinguir ausência de cadastro de falha temporária e oferecer tentativa novamente.
9. **Publicação:** acrescentar validação visual dos cinco formatos com textos longos, logo larga/alta, transparência, efeitos e imagens ausentes. O self-test atual abre fontes; não comprova equivalência visual.

## Verificações executadas

- 33 testes TypeScript em seis arquivos passaram, incluindo catálogo sem injeção de exemplos e formatos alternativos.
- 11 testes Python passaram; self-test abriu as 13 famílias de fontes.
- Typecheck e `npm run check` aprovados; maior chunk client 455 KB / 500 KB. Build emitiu avisos de sourcemap e referência de asset do Video Studio, sem impedir conclusão.
- `git diff --check` aprovado.
- Reprodução de `richPrice`: o indicador não altera os pixels do Pillow.

## Limites de evidência

A suíte Python existente e os testes TypeScript cobrem contratos, não a equivalência visual entre SVG/Fabric/Pillow nem a interação autenticada. Nenhum modelo persistido foi classificado como mock pelo nome ou excluído. Não houve commit, push ou deploy.

> ⚠️ Precisa ser confirmado. Estado do catálogo em produção e fidelidade dos modelos publicados precisam de sessão autenticada e comparação dos renders reais.
