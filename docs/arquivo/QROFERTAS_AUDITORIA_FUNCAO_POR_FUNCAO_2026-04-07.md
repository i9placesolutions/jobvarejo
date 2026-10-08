# QROfertas Builder V2 - Auditoria Função por Função

Data: 2026-04-07  
Builder auditado: `https://cdn.qrofertas.com/criar-jornal/builder-v2/`  
Documento comparado: [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md)  
Auditoria-base: [QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md](/workspace/projetos/jobvarejo/QROFERTAS_AUDITORIA_COMPLETA_2026-04-07.md)

## O que este arquivo cobre

Este relatório desce um nível além da auditoria geral e enumera as funções operacionais expostas pelo front do builder.

Cobertura desta passada:

- `264` handlers delegados detectados no front
- `33` views detectadas
- `27` endpoints de serviço relevantes detectados
- ações de usuário separadas de suporte, analytics e infraestrutura

Observação importante:

- nem todo handler é “função de negócio”; vários são analytics, animação, tour guiado ou suporte de UI
- a matriz abaixo prioriza funções operacionais reais do produto

## Legenda

- `Ao vivo`: a função foi observada em resposta real de view e/ou fluxo visível.
- `Source`: a função foi confirmada no HTML/JS da aplicação.
- `Parcial`: depende de contexto específico e não foi executada ponta a ponta.
- `Cobertura qroferta`: `Sim`, `Parcial` ou `Não`.

## 1. Navegação e shell do builder

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir painel lateral | `.menu-op` | Carrega a view do menu selecionado no painel lateral | `data-target` com `?view=...` | Ao vivo + Source | Sim |
| Alternar abas de temas/solicitações | `#requests-tab`, `#temas-itens-tab` | Troca entre galeria de temas e fila de solicitações | `?view=solicitar-temas`, `?view=escolher-tema` | Ao vivo + Source | Parcial |
| Colapsar/expandir menu | `.menu-control` | Fecha/abre menu lateral, persiste preferência | `user_field('builder_menu_open')` | Source | Não |
| Recarregar menu atual | `.reload-menu` | Recarrega a view ativa do menu | `load_page(obj.data('target'))` | Source | Não |
| Focar fluxo de adicionar produtos | `.produto-placeholder`, `.btn-produtos-add-null` | Abre menu de produtos e destaca a busca | menu item 1 | Source | Parcial |
| Abrir ajuda contextual | `.show-suporte` | Abre QR Academy filtrado pela categoria atual | `?view=qr-academy` | Ao vivo + Source | Não |
| Abrir artigo/modal de ajuda | `.modal-article`, `.article-content-page a` | Carrega artigo de ajuda em overlay | rotas `/criar-jornal/articles/` | Source | Não |
| Fechar overlay de ajuda | `.article-box .close` | Fecha central/overlay de ajuda | UI local | Source | Não |

## 2. Produtos: busca, ingestão e CRUD

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Buscar produtos por texto | `#SEARCH`, `Enter` em `#QUERY` | Pesquisa ou cria produtos a partir de texto digitado/colado | `/services/api-produtos`, `submitSearch()` | Ao vivo + Source | Sim |
| Buscar por sugestão rápida | `.go-search` | Copia a sugestão e dispara busca | `product_search()` | Source | Não |
| Abrir “Meus Produtos” | `#requests-meus-produtos` | Muda busca para catálogo do usuário | busca V4 | Source | Não |
| Voltar da busca para modo neutro | `#pesquisar-fake-button`, `#CLEARSEARCH` | Limpa busca ativa e reseta estado | busca V4 | Source | Não |
| Criar produto manualmente | `.criar-produto` | Cria item a partir do texto/query atual | `product_create()` | Source | Parcial |
| Clonar produto para o encarte | `.criar-produto[data-clone]` | Adiciona produto existente ao encarte | `product_manage(...,'add')` | Source | Não |
| Criar produto instantâneo | `.produto-estantaneo` | Cria item dos resultados rápidos | `product_create_estantaneo()` | Source | Não |
| Adicionar todos os produtos instantâneos | `.btn-add-all-produto-estantaneo` | Injeta todos os itens temporários no encarte | `product_create_estantaneo($('.produtos-estantaneos .produto-box'))` | Source | Parcial |
| Criar produto a partir de imagem sugerida | `.select-image-item-for-create` | Cria item usando a imagem escolhida | `product_create_by_image()` | Source | Não |
| Adicionar produto encontrado | `.resultados .produto-box .ADICIONAR` | Adiciona resultado da busca ao encarte | `product_manage(...,'add')` | Source | Sim |
| Remover produto do encarte | `.produto-box .REMOVER` | Remove item da peça atual | `product_manage(...,'remove')` | Source | Sim |
| Remover produto do catálogo próprio | `.REMOVER-MEUS-PRODUTOS` | Exclui item do “Meus Produtos” e de outros encartes | `product_manage_remove_proprio()` | Source | Não |
| Remover todos os produtos do encarte | `.REMOVER-TODOS` | Esvazia a arte após confirmação | `product_manage_remove_all()` | Source | Parcial |
| Reordenar produto | drag/drop + persistência | Regrava ordem visual dos itens | `/services/api-produtos-field/` | Source | Sim |
| Adicionar slot vazio | `.add-slot` | Cria slot adicional/layout placeholder | `addSlot()` | Source | Não |

## 3. Produtos: edição de campos

| Função | Gatilho/UI | O que faz | Endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Editar nome | `.editar-pem_nome` | Atualiza nome do produto e refresh do render | `/services/api-produtos-field/` | Source | Sim |
| Editar linhas de texto adicionais | `.editar-ted_line_1` a `.editar-ted_line_4` | Atualiza estruturas auxiliares de título | `/services/api-produtos-field/` | Source | Não |
| Editar campo textual genérico | `.editar-text-field` | Atualiza observação/campos livres do produto | `/services/api-produtos-field/` | Source | Parcial |
| Editar preço de oferta | `.editar-pem_preco_oferta` | Atualiza preço promocional | `/services/api-produtos-field/` | Source | Sim |
| Editar preço normal | `.editar-pem_preco` | Atualiza preço de referência | `/services/api-produtos-field/` | Source | Sim |
| Editar limite | `.editar-pem_limite` | Atualiza limite por cliente | `/services/api-produtos-field/` | Source | Sim |
| Editar unidade | `.editar-pem_unidade` | Atualiza unidade e avança foco | `/services/api-produtos-field/` | Source | Sim |
| Marcar maioridade 18+ | `.editar-pem_maioridade` | Liga/desliga restrição visual | `/services/api-produtos-field/` | Source | Sim |
| Alternar booleanos do produto | `.editar-bool` | Liga/desliga flags específicas do item | `/services/api-produtos-field/` | Source | Parcial |
| Alternar edição rápida/lazy inputs | `#fast-inputs` | Liga modo de inputs leves na lista | `user_field('builder_lazy_inputs')` | Source | Não |
| Navegação por Enter entre campos | `.col-dados input` | Move foco entre campos e entre produtos | UI local | Source | Não |
| Confirmar edição compacta | `.EDICAO-OK` | Fecha foco do editor inline e força render | UI local + `update_render()` | Source | Não |

## 4. Produtos: imagem e mídia

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir seletor de imagens do produto | `.escolher-imagens`, `.image-choice-btn` | Carrega imagens para o produto/box | `/services/api-produtos/` | Source | Parcial |
| Pesquisar imagens por termo | `.escolher-imagens-search` | Busca imagens por query informada | `/services/api-produtos/` | Source | Parcial |
| Polling de busca de imagens | `loaderXhrImages()` | Monitora resultados assíncronos de imagens | `/services/api-search-images/` | Source | Não |
| Selecionar imagem local/remota | `.select-image-item` | Solicita uso da imagem escolhida no produto | `imgRequestLocal()` via `/services/api-produtos/` | Source | Parcial |
| Abrir editor de imagem avançado | `.editar-imagens` | Abre `image builder` em overlay | `/services/api-image-builder/` | Source | Sim |
| Escolher template de composição | `.options-templates .previa-image-builder` | Troca composição dentro do image builder | UI local | Source | Não |
| Ampliar imagem ao centro | `#ampliaraocentro` | Recalcula centralização da composição | `normImagesBuilder()` | Source | Não |
| Ajustar escala da composição | `#sizeimagebuilder` | Redimensiona itens do builder de imagem | UI local | Source | Não |
| Renderizar e reenviar imagem composta | `#DOWNLOAD_AND_UPLOAD_IMAGE_BUILDER` | Captura canvas HTML e sobe a imagem resultante | `html2canvas` + upload | Source | Não |
| Upload direto de imagem do produto | uploader/cropper | Envia imagem recortada do produto | `/services/api-produtos-image-upload/` ou API externa | Source | Sim |
| Remover fundo no upload | checkbox do cropper | Envia `removeBackground` no upload do produto | upload product image | Source | Parcial |
| Upload da logo da empresa | uploader logo | Envia logo e re-renderiza a arte | `/services/api-usuario-image-logo-upload/` ou API externa | Source | Sim |

## 5. Produto: preço, etiqueta, bubble e destaque

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir modos de preço do produto | `.modo-de-precos` | Abre modal com 9 modos de preço | `?view=modal-opcoes-de-preco` | Ao vivo + Source | Sim |
| Aplicar modo de preço ao produto | `.row-options-produto` | Persiste `pop_id` no produto | `/services/api-produtos-field/` | Source | Parcial |
| Aplicar modo de preço à arte/tabela | `.row-options-arte` | Persiste `art_pop_id` no nível da arte/tabela | `/services/api-tabela-fields/` | Source | Não |
| Abrir preço de tabela | `.boxExibePrecos` | Abre modal de tabela de preços | `/services/api-tabela-de-precos/?view=modal-opcoes-de-preco-tabela` | Parcial | Não |
| Trocar etiqueta global rápida | `.etiqueta-item` | Altera etiqueta base do tema/cartaz | `tema_field('eti_id'/'car_eti_id')` | Source | Sim |
| Trocar bubble global rápida | `.bubble-item` | Altera balão base do tema/cartaz | `tema_field('bub_id'/'car_bub_id')` | Source | Sim |
| Abrir editor de cor/fundo do produto | `.destacar-produto` | Abre paleta/destaque de produto | `?view=escolher-destaque` | Ao vivo + Source | Parcial |
| Abrir editor de cor para tabela | `.destacar-produto-tabela` | Abre paleta para tabela | `?view=escolher-destaque-tabela` | Source | Não |
| Abrir editor de etiqueta do produto | `.destacar-produto-etiqueta` | Abre seletor de etiquetas customizadas | `?view=escolher-etiqueta-destaque` | Ao vivo + Source | Parcial |
| Abrir editor de bubble do produto | `.destacar-produto-bubble` | Abre seletor de bubble por produto | `?view=escolher-bubble-destaque` | Ao vivo + Source | Parcial |
| Selecionar visual de etiqueta | `.etiqueta-v2-select-item` | Marca opção antes de aplicar | UI local | Source | Não |
| Selecionar visual de bubble | `.bubble-v2-select-item` | Marca opção antes de aplicar | UI local | Source | Não |
| Aplicar etiqueta ao escopo escolhido | `#aplicar-etiqueta` | Persiste etiqueta por destaque/posição/produto/encarte | `/services/api-temas-fields/` | Source | Não |
| Aplicar bubble ao escopo escolhido | `#aplicar-bubble` | Persiste bubble por destaque/posição/produto/encarte | `/services/api-temas-fields/` | Source | Não |
| Selecionar cor de fundo | `.cor-item` | Atualiza preview do fundo/cor do produto | UI local | Source | Parcial |
| Ajustar transparência da paleta | `#transparencia-palleta` | Recalcula opacidade do destaque | UI local | Source | Não |
| Aplicar paleta ao escopo escolhido | `#aplicar-paleta` | Persiste cor/fundo/opacidade do produto | `/services/api-temas-fields/` | Source | Não |
| Aplicar paleta na tabela | `#aplicar-paleta-tabela` | Persiste cores de cabeçalho e corpo da tabela | `/services/api-temas-fields/` | Source | Não |
| Resetar cores | `.resetar-cores` | Restaura paleta padrão | `/services/api-temas-fields/` | Source | Não |
| Resetar etiquetas | `.resetar-etiquetas` | Restaura etiqueta padrão | `/services/api-temas-fields/` | Source | Não |
| Resetar bubbles | `.resetar-bubbles` | Restaura bubble padrão | `/services/api-temas-fields/` | Source | Não |
| Restaurar destaque do produto | `.restaurar-padrao` | Remove customização de destaque do item | `/services/api-produtos-field/` | Source | Não |
| Aplicar cor de destaque escolhida | `.select-produto-destaque` | Persiste `pem_bg_eti_id` e opacidade | `/services/api-produtos-field/` | Source | Não |
| Aplicar etiqueta customizada escolhida | `.select-produto-destaque-etiqueta` | Persiste `pem_custom_eti_id` | `/services/api-produtos-field/` | Source | Não |
| Atalho global para editor de etiquetas | `.item-menu-etiquetas` | Se houver produto, abre editor da primeira peça | fluxo interno | Source | Não |

## 6. Produto: layout estrutural e título

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir seletor de layout do box | `.produtos-select-layout` | Abre modal com `box_type` e `image_type` | `?view=escolher-layout-produto-v2` | Ao vivo + Source | Não |
| Alterar tipo de layout na prévia | `.option-layout`, `.option-image-type`, `.option-box-type` | Recalcula opções/layouts disponíveis | `load_options_layouts()` | Source | Não |
| Aplicar layout escolhido | `.box-for-select` | Persiste layout para produto/posição/encarte/padrão | `/services/api-temas-fields/` | Source | Não |
| Resetar layout | `.resetar-layout` | Remove custom layout do produto/posição/encarte | `/services/api-temas-fields/` | Source | Não |
| Abrir estruturas de título | `.estrutura-de-titulo` | Abre modal de distribuição/destaque/cores/estilo | `?view=modal-estruturas-de-titulo` | Ao vivo + Source | Não |
| Aplicar estrutura de título | `.row-options-estrutura` | Persiste `tet_id` no produto | `/services/api-produtos-field/` | Source | Não |
| Marcar produto como destaque de grade | `.setdestaque` | Promove o item para posição de destaque na grade | `/services/api-temas-fields/` | Source | Não |
| Fixar posição do produto | `.fixar-posicao` | Mantém produto na posição/slot | `/services/api-produtos-manage/` | Source | Parcial |
| Fixar preço | `.fixar-preco` | Mantém preço do item travado | `/services/api-produtos-manage/` | Source | Parcial |

## 7. Tema, modelo, grade e render

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Buscar temas | `#search-temas`, `#TEMA_QUERY` | Filtra temas | `?view=pesquisar-temas` e buscas relacionadas | Source | Parcial |
| Resetar busca de tema | `#reset-temas-search` | Limpa filtro e volta à lista base | UI local | Source | Não |
| Selecionar tema | `.temas .tema-item-select` | Troca o tema visual da arte | `load_page` de render | Source | Sim |
| Visualizar tema premium | `.item-premium` | Abre preview/clean preview do tema premium | `/criar-jornal/clean-preview-render-encarte/` | Source | Não |
| Ir para assinatura/premium | `.item-premium-ads`, `.item-premium-go-checkout` | Abre fluxo comercial de assinatura | `/minha-assinatura/` | Source | Não |
| Abrir lista de modelos | `load-preview-modelos` / cards | Carrega galeria de modelos | `?view=load-preview-modelos` | Ao vivo + Source | Parcial |
| Selecionar modelo por card | `.card-modelo` | Troca o modelo atual e re-renderiza | `load_page(obj.data('target'))` | Source | Sim |
| Selecionar modelo por select | `.modelo-select-form` | Troca o modelo atual e re-renderiza | `load_page(obj.val())` | Source | Sim |
| Selecionar modelo já preparando download | `.card-download-preview .set-download-format-and-go` | Muda formato e já inicia download | `prepareDownload()` | Source | Não |
| Selecionar modelo só para visualização | `.card-download-preview .img-top`, `.select-format` | Muda formato e re-renderiza | render local | Source | Não |
| Trocar grade por card | `.grade-item` | Persiste `lay_id` e recarrega render | `tema_field('lay_id', ...)` | Source | Sim |
| Trocar grade por select | `.grade-itens-select` | Persiste `lay_id` com validação | `tema_field('lay_id', ...)` | Source | Sim |
| Trocar estilo visual | `.estilo-item` | Muda `est_id` do tema/arte | `tema_field('est_id')` | Source | Parcial |
| Gerar capa | `#GERARCAPA` | Liga/desliga capa automática em modelos compatíveis | `tema_field('art_option_gerar_capa')` | Source | Parcial |
| Normalizar preço | `#NORMALIZARPRECO` | Altera estilo dos centavos/preço | `tema_field('art_option_normalizar_preco')` | Source | Não |
| Alterar economia de tinta | `.select-art-tinta`, `.disableEconomiaTinta` | Ajusta modo econômico do cartaz | `tema_field()` | Source | Parcial |
| Trocar modo de texto | `.text-type` | Alterna normalização/escala de texto | `user_field('builder_text_work')` | Source | Sim |
| Trocar estrutura global | `.option_estrutura-type` | Define modo estrutural dos produtos | `user_field('builder_option_estrutura')` | Source | Não |
| Trocar paleta global inteligente/padrão | `.option_palleta-type` | Define estratégia de cor | `user_field('builder_option_palleta')` | Source | Parcial |
| Trocar rodapé global | `.option_footer-type` | Persiste modelo de rodapé | `tema_field('art_footer_modelo')` | Source | Sim |
| Zoom do canvas | `.zoom` | Recalcula zoom do preview | `setCanvaZoom()` | Source | Sim |
| Navegar páginas do encarte | `.next-page`, `.prev-page` | Pagina preview multi-página | `reload_pagination()` | Source | Parcial |

## 8. Fontes

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir painel de fontes | menu `Fontes` | Exibe filtros de nome/peso/estilo | `?view=escolher-fontes` | Ao vivo + Source | Sim |
| Filtrar fontes | `.filtrar-estilo`, `.filtrar-peso`, `.filtrar-nome` | Atualiza lista renderizada de fontes | `?view=escolher-fontes-filtrar` | Ao vivo + Source | Parcial |
| Aplicar fonte em elementos marcados | `.fonte-select` | Persiste fonte em alvos selecionados | `/services/api-temas-fields/` | Source | Parcial |
| Resetar fonte de um alvo | `.resetar-fonte` | Remove fonte customizada e volta ao padrão | `/services/api-temas-fields/` | Source | Não |

## 9. Regras, datas, empresa e portal

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Alterar datas da oferta | `#data_inicial`, `#data_final`, `.dataPeriodoOferta` | Persiste período da oferta | `tema_field(...)` | Source | Sim |
| Alternar toggles da arte | `.bool-art` | Liga/desliga datas, avisos, frase, portal etc. | `tema_field(...)` | Source | Sim |
| Alternar dado inline da empresa usado pela arte | `.editar-bool-art` | Edita campo da empresa ao ativar toggle | `editar_empresa_field()` + `tema_field()` | Source | Não |
| Alternar dados da empresa | `.bool-emp-data` | Exibe/oculta telefone, WhatsApp, endereço etc. | `tema_field(...)` | Source | Sim |
| Editar mensagem personalizada do encarte | `#art_mensagem_personalizada` | Valida até 200 chars e persiste | `tema_field(...)` | Source | Não |
| Editar nome do encarte | `#art_nome` | Persiste nome da arte | `tema_field('art_nome')` | Source | Sim |
| Editar observações do encarte | `#art_observacoes` | Persiste observações | `tema_field('art_observacoes')` | Source | Sim |
| Alterar categoria do encarte | `#art_cat_id...` | Persiste macro/segmento/departamento/categoria | `tema_field(name, value)` | Source | Sim |
| Abrir formas de pagamento | `.editar-formas-de-pagamento` | Abre modal de meios de pagamento | `?view=editar-formas-de-pagamento` | Ao vivo + Source | Não |
| Selecionar forma de pagamento | `.card-forma` | Ativa/desativa bandeira ou meio de pagamento | `/services/api-empresa-fields/` | Source | Não |
| Abrir onboarding de portal | `.publicar-portal` | Abre modal `empresa-portal` | `?view=empresa-portal` | Ao vivo + Source | Não |
| Validar slug/URL do portal | `#empurl`, `.empurl` | Normaliza e valida URL da loja | `/services/check_is_valid_emp_nome/` | Source | Parcial |
| Validar CEP | `.emp_cep` | Normaliza e valida CEP | `/services/check_is_valid_cep/` | Source | Parcial |
| Alterar segmento principal | `.emp_segmento` | Persiste segmento da empresa | campo empresa | Source | Parcial |
| Alternar booleans do portal | `.bool-emp-portal`, `.bool-art-portal` | Liga/desliga dados usados no portal | campos empresa/arte | Source | Não |
| Alterar nome da empresa no portal | `.empNomePortal` | Persiste campo do portal e atualiza preview textual | `emp_field(...)` | Source | Não |

## 10. Interesses, temas e agenda

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir “Meus Interesses” | `.select-meus-interesses` | Abre modal de segmentos/interesses | `?view=escolher-interesses` | Ao vivo + Source | Não |
| Selecionar interesse simples | `.card-interesse` | Marca interesse e persiste no usuário | `/services/api-usuario/` | Source | Não |
| Seleção detalhada de interesses | `.item-cat-selectable label` | Marca segmentos, inclusive “Tudo” | `/services/api-usuario/` | Source | Não |
| Salvar interesses e recarregar menu | `.btn-interesses-salvar` | Fecha modal e recarrega view atual | `load_page(obj.data('target'))` | Source | Não |
| Fechar modal de onboarding de interesses | `.modal-hello ...` | Recarrega menu/render se houve mudança | render + menu | Source | Não |
| Solicitar novo tema | `#solicitar-tema` | Envia pedido de tema à fila | `/services/api-temas-fields/` | Source | Parcial |
| Votar em solicitação de tema | `.votar-tema` | Incrementa votos na fila | serviço de temas | Source | Não |
| Abrir novos temas | `.btn-temas-novos` | Navega bloco de temas novos | UI local | Source | Não |
| Paginar carrosséis/listas de tema | `.control-right`, `.control-left`, `.show-more-open`, `.view-more` | Avança/expande listas | UI local | Source | Não |

## 11. Texto social, acessibilidade e postagem

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir texto social | menu `Postar` | Exibe sugestão de post acessível | `?view=sugestao-de-post` | Ao vivo + Source | Sim |
| Usar texto social bruto | fluxo interno | Disponibiliza texto raw para publicação | `?view=sugestao-de-post-raw` | Ao vivo | Não |
| Editar texto de postagem da publicação turbo | `.texto_postagem_publish` | Atualiza conteúdo da postagem | `ST_data["post_content"]` | Source | Não |
| Validar limite do Instagram | `input/change .texto_postagem_publish` | Mostra erro acima de 2200 caracteres | UI local | Source | Não |

## 12. Download, render e exportação

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Disparar download | `.go-download` | Inicia export com escala/formato | `prepareDownload()` | Source | Sim |
| Selecionar escala do download | `.go-download[data-scale]` | Define `SCALE` 1x, 2x, 3x, 4x etc. | UI local | Source | Não |
| Exportar PDF | `.go-download[data-format='pdf']` | Define modo PDF antes do render remoto | `IS_PDF = true` | Source | Parcial |
| Fechar banner e destacar download | `.close-to-download` | Colapsa menu e destaca botão de baixar | UI local | Source | Não |
| Snapshot pré-download | `upload_encarte()` | Cria snapshot da arte antes do download | `?view=snapshot` | Source | Não |
| Render local com html2canvas | `prepareDownload()` | Renderiza no navegador quando permitido | `html2canvas` | Source | Parcial |
| Render remoto por job | `request_job_render()` | Envia arte para fila de render | `/services/api-job_artes_render` | Source | Parcial |
| Monitorar jobs de export | `monitor_job_status()` | Acompanha status e dispara arquivos prontos | `/services/api-job_artes_render` | Source | Não |
| Download sequencial em iOS | `downloadSequential()` | Serializa downloads quando necessário | `/services/api-job_artes_render` | Source | Não |

## 13. Publicação turbo, redes sociais, portal e TV Indoor

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir modal de publicação | `.modal-publicar-open`, `.abrir-modal-publicar` | Carrega gerenciador de publicação | `/services/api-job_artes_render_v2/` com `start-publish` | Source | Parcial |
| Preparar estado de publicação | `ST_start` / `ST_gui` | Monta instruções por canal/local/modelo | `ST_data` local | Source | Não |
| Publicar agora | `#publicacaoTurboPublicar` | Envia instruções de publicação para fila | `/services/api-job_artes_render_v2/` com `publish-jobs` | Source | Parcial |
| Validar limites por canal | fluxo `publicacaoTurbo` | Limita criativos por canal e por Instagram | lógica `overLimits` / `2200 chars` | Source | Não |
| Publicar em redes Meta | grupo `meta` | Mapeia páginas Facebook e perfis Instagram | Facebook SDK + `/services/api-usuario/` | Source | Parcial |
| Conectar Facebook/Instagram | `#login-facebook` | Inicia login no Facebook SDK | `FB.login()` | Source | Não |
| Desconectar Facebook | `#disconnect-facebook` | Revoga app e limpa canais conectados | Facebook SDK + `/services/api-usuario/` | Source | Não |
| Publicar no portal | grupo `portal` | Inclui link público da loja/oferta | instruções ST_data + modal sucesso | Ao vivo + Source | Parcial |
| Publicar em TV Indoor | grupo `qrindoor` | Monta criativos e TVs selecionadas | instruções ST_data + validação TV | Source | Não |
| Agendar publicação | `.novo-agendamento` | Abre novo agendamento a partir da arte atual | `/services/api-job_artes_render_v2/` com `create-new` | Source | Não |
| Cancelar publicação agendada | `.cancelar-publicacao` | Remove job agendado | `/services/api-job_artes_render_v2/` com `cancel-publish` | Source | Não |
| Modal de sucesso da publicação | `mostrarPublicacaoAgendada()` | Exibe resultados de redes, portal e TV | modal `#modalItensPublicados` | Ao vivo + Source | Parcial |
| Publicar/despublicar arte base | `.disponibilizar-encarte-base`, `.despublicar-arte-base` | Disponibiliza a arte a associados/portal base | `/services/api-publicar-arte-base/` | Source | Não |
| Aviso de arte com publicações em andamento | load do builder | Alerta quando a arte já tem publicações pendentes/agendadas | dialog inicial | Source | Não |

## 14. Tabela de preços e variantes tabulares

| Função | Gatilho/UI | O que faz | Endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir configuração de preço de tabela | `.boxExibePrecos` | Carrega modal de opções da tabela | `/services/api-tabela-de-precos/` | Parcial | Não |
| Editar campo da tabela | `input.configurar-tabela-precos` | Persiste campo da tabela ao perder foco | `/services/api-tabela-fields/` | Source | Não |
| Confirmar campo da tabela no Enter | `keydown input.configurar-tabela-precos` | Dá blur e salva | `/services/api-tabela-fields/` | Source | Não |
| Alternar switch da tabela | `.form-switch.configurar-tabela-precos` | Persiste booleano da tabela | `/services/api-tabela-fields/` | Source | Não |
| Abrir destaque da tabela | `.destacar-produto-tabela` | Customiza header/body da tabela | `?view=escolher-destaque-tabela` | Source | Não |
| Aplicar paleta na tabela | `#aplicar-paleta-tabela` | Persiste cores em header e corpo | `/services/api-temas-fields/` | Source | Não |

## 15. Suporte, QR Academy e onboarding

| Função | Gatilho/UI | O que faz | View/endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Abrir QR Academy | `.show-suporte` | Abre biblioteca de ajuda | `?view=qr-academy` | Ao vivo + Source | Não |
| Filtrar artigos | `#SEARCH-ARTIGOS`, botão de envio | Filtra tutoriais da central de ajuda | filtro local + `/services/api-usuario/` para tracking | Source | Não |
| Abrir tutorial em vídeo | `.artigo-list-item`, `.open-video-tutorial` | Carrega iframe/tutoriais | articles + YouTube embed | Source | Não |
| Avaliar artigo | `.evaluate .stars-input .fas` | Envia nota do artigo | `/criar-jornal/articles/` | Source | Não |
| Tour guiado de primeiros passos | `tourguide.TourGuideClient` | Conduz usuário por busca, adicionar e download | `api-events` para tracking | Source | Não |
| Fechar dicas inline | `.close-dica` | Remove dica e grava preferência | `user_field()` | Source | Não |

## 16. Modos especiais e bloqueios

| Função | Gatilho/UI | O que faz | Endpoint | Confiança | Cobertura qroferta |
|---|---|---|---|---|---|
| Modo Artes Prontas: bloquear edição | `edicaoBloqueada` | Impede alterações em ações sensíveis no modo pronto | bloqueio no front | Source | Não |
| Alerta ao tentar editar arte publicada como base | load do builder | Oferece criar nova arte ou despublicar | diálogo inicial | Source | Não |
| Modo Leve | checkbox/condição | Força render remoto e otimização do arquivo | `prepareDownload()` | Source | Sim |
| Economia de tinta | cartaz/tabela | Reduz intensidade/uso de fundo | `tema_field` | Ao vivo + Source | Parcial |

## 17. Mapa de backend por domínio funcional

| Domínio | Endpoints principais |
|---|---|
| Produtos | `/services/api-produtos`, `/services/api-produtos-create/`, `/services/api-produtos-field/`, `/services/api-produtos-manage/`, `/services/api-produtos-image-upload/` |
| Imagens | `/services/api-search-images/`, `/services/api-image-builder/` |
| Tema e arte | `/services/api-temas-fields/`, `/services/api-tabela-fields/`, `/services/api-list-temas` |
| Empresa e usuário | `/services/api-empresa-fields/`, `/services/api-usuario`, `/services/api-usuario-image-logo-upload/` |
| Portal/validação | `/services/check_is_valid_cep/`, `/services/check_is_valid_emp_nome/` |
| Render e publicação | `/services/api-job_artes_render`, `/services/api-job_artes_render_v2`, `/services/api-publicar-arte-base/` |
| Suporte/eventos | `/services/api-events`, `/services/api-narracao` |

## 18. O que o qroferta.md cobre mal nesta camada

As maiores lacunas do [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) quando olhamos função por função são:

- CRUD mais fino de produtos e catálogo próprio
- comportamento de busca, criação instantânea e “Adicionar Tudo”
- layouts por produto e persistência por escopo
- aplicação por destaque/posição/produto/encarte
- modais avançados de etiqueta, bubble, destaque e estrutura de título
- QR Academy e tour guiado
- onboarding e validações do portal
- formas de pagamento detalhadas
- pipeline completo de publicação turbo
- canais Meta e TV Indoor
- configuração e persistência de tabela de preços
- bloqueios de “Artes Prontas” e avisos de arte publicada

## Veredito desta camada

Se a pergunta for “o builder tem muito mais função real do que o `qroferta.md` mostra?”, a resposta é `sim`.

Se a pergunta for “agora temos uma auditoria função por função do que o front do builder expõe?”, a resposta também é `sim`, dentro deste limite honesto:

- a matriz acima cobre as funções de negócio expostas pelo front
- nem toda ação foi executada até o fim em ambiente produtivo com conta e dados reais
- mas a existência, os gatilhos, os alvos e os endpoints das funções estão mapeados com alta confiança
