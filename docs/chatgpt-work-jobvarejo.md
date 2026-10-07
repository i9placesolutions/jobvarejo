# JobVarejo conectado ao ChatGPT Work — proposta de piloto

Data: 7 de outubro de 2026. Decisão do usuário: manter Pro 20x e processar fila por lotes/agendamento. Estado atualizado: piloto implementado localmente; sem plugin conectado à conta ChatGPT, migração aplicada em produção ou tarefa Work agendada. As seções de proposta abaixo registram a arquitetura desejada e não devem ser interpretadas como comprovação de ativação.

## Implementação local da versão 0.1

Tela `/encartes-ia`, fila dedicada, acesso por configuração/conta piloto, contrato de composição com bindings separados, render nativo, persistência em novos projetos, conector MCP e entrada/consulta n8n estão preparados no código. Ver [guia de integração e limites](../integrations/chatgpt-work/README.md).

Limites desta entrega: orientações são briefing, sem interpretação livre por chat; reutilização copia o pedido e referencia o projeto anterior, mas recalcula via Work; saída abre no editor completo, com `quickCompatible=false`; sincronização entre formatos e edição cotidiana sem nova composição não foram implementadas. A biblioteca inicial tem apenas o selo e fundo reais do teste Economia, restritos à conta proprietária. Não há cadastro visual amplo de kits nesta versão.

Nenhum módulo novo chama OpenAI/Magnific API. Os testes do render usam fixtures locais e não consomem a assinatura nem comprovam execução do Work. Conferir manualmente o fluxo real na conta Pro antes de criar agendamento. A migração foi testada somente em PostgreSQL embarcado em memória; sua aplicação em produção continua pendente de autorização.

## Solução escolhida

### Direção criativa proposta: tema como kit visual

Para o objetivo de variedade e composição adaptada à loja, o ponto de partida recomendado é um selo 3D acompanhado de direção visual do tema. O kit pode incluir elementos decorativos e referências, sem exigir um layout completo fixo. A marca, a paleta e os dados reais do cliente completam o contexto.

O Work recebe selo/kit, logo, paleta, lista integral de endereços e contatos, validade, produtos/fotos confirmados, destaques autorizados e formatos. Propõe o restante da composição: fundo, cabeçalho, posição/proporção da marca, blocos comerciais, área/cartões de produtos e etiquetas. Todas essas decisões precisam considerar o conteúdo real de cada pedido.

O backend materializa a composição em objetos editáveis, com preços/textos vinculados e zonas/cartões reconhecidos pelo rápido. Fundo e selo podem ser raster; dados comerciais e preços não podem depender de texto gravado no bitmap. A primeira versão passa pelo piloto de geração, persistência, leitura e edição antes de uso automático.

Para reutilização, salvar versões por tema, cliente e configuração compatível. Mudanças rotineiras de dados usam a composição aprovada; conteúdo/quantidade que exija um novo desenho entra na fila criativa. Criar tudo novamente em cada pedido tem custo de tempo/consumo a avaliar e não oferece entrega imediata nesta rota de lotes.

Os modelos completos atuais continuam disponíveis para uso e como referências. Eles não precisam restringir as novas composições criativas a suas posições originais. Nenhum modelo é descartado ou substituído por esta decisão.

Conectar o backend existente do JobVarejo ao Work por plugin privado com ferramentas MCP. O n8n registra o pedido; uma tarefa do Work consulta a fila e executa somente pedidos autorizados. O Work envia seus resultados ao JobVarejo pelo plugin, e o sistema valida, renderiza e salva o projeto editável. Essa rota não usa o trigger de Workspace Agents como entrada do Pro.

A documentação permite que tarefas agendadas usem plugins/skills e contexto persistente. O funcionamento de imagens geradas pelo Work, sua transferência para storage e execução sem intervenção precisam ser comprovados no piloto. Não confundir capacidade documentada de agendamento com comprovação ponta a ponta na conta.

> ⚠️ Precisa ser confirmado. Disponibilidade do plugin privado, das ferramentas de imagem e das permissões necessárias em tarefa agendada na conta Pro utilizada. Não há medição de latência ou garantia de prazo imediato.

Referências oficiais: [conectar plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt), [tarefas agendadas e plugins](https://learn.chatgpt.com/docs/automations), [consumo Work/Codex](https://learn.chatgpt.com/docs/pricing). Chamadas a provedores externos mantêm cobrança própria; este desenho não transforma APIs pagas em chamadas incluídas na assinatura.

## Biblioteca de elementos para reduzir geração e permitir variedade

Requisito do usuário: fornecer ao Work uma base de selos, backgrounds e elementos reutilizáveis para montar encartes com menos geração de imagens por pedido. A biblioteca deve apoiar composição livre e adaptada ao conteúdo.

Categorias propostas:

- Selos 3D por tema/campanha, com transparência e versões de paleta quando necessário.
- Fundos por formato, com áreas úteis claras para marca, produtos e dados comerciais.
- Faixas, molduras, brilhos, separadores e ícones compatíveis com o tema.
- Etiquetas, cards e blocos comerciais nativos editáveis, com fontes e estilos preparados.
- Fotos de produto selecionadas/confirmadas, logo e recursos próprios da loja.
- Composições aprovadas e referências que ajudem a escolher uma distribuição adequada.

Cada recurso precisa de ID/revisão, categoria/função, tema, paleta, dimensões/proporção, formatos compatíveis, prévia leve e referência durável. Para fundos, registrar limites/áreas onde o conteúdo pode entrar; para recursos nativos, registrar os parâmetros editáveis e tipos de dado aceitos. Recursos por cliente devem respeitar seu escopo de acesso.

Ferramenta de busca proposta: search_design_elements(theme, palette, format, role). O servidor retorna um conjunto pequeno e pertinente de candidatos com metadados/prévias; Work escolhe as peças e a composição. Buscar primeiro metadados e carregar apenas os arquivos selecionados evita enviar a biblioteca inteira ao agente.

Fluxo: pedido + dados → busca de elementos → proposta de composição → montagem/validação/render nativo → rascunho editável → versão aprovada reutilizável. A geração de um recurso novo fica reservada para falta de peça compatível ou solicitação de arte exclusiva. Uma peça raster não adquire recoloração seletiva apenas por estar na biblioteca; preparar variantes ou edição específica quando necessário.

Reaproveitar os catálogos/storage/etiquetas já existentes onde houver compatibilidade, conferindo o schema e os contratos antes de criar estruturas novas. Cadastrar peças separadas não autoriza extrair arbitrariamente todo modelo existente nem modificar seus originais.

É razoável esperar menos trabalho de geração e transferência quando os recursos já estiverem preparados, mas a latência total ainda depende de espera do lote, seleção/composição, revisão e render. Medir no piloto; não prometer um número de segundos. Comparar casos equivalentes usando apenas biblioteca e usando geração de recursos, mantendo qualidade, dados e editabilidade como critérios.

## Destino dos modelos atuais

O catálogo atual continua sendo a base operacional. Não remover, substituir ou migrar em lote os modelos existentes para começar o piloto.

- Pedido normal com versão aprovada compatível: JobVarejo reutiliza a composição e seus formatos disponíveis, preenchendo produtos, fotos, validade e perfil comercial. Os modelos completos atuais também permanecem disponíveis como opção de criação.
- Personalização compatível com objetos nativos: aplicar as configurações já existentes de paleta, logo, tipografia e etiqueta no projeto do cliente.
- Alteração visual de fundo/selo raster ou tema novo: encaminhar trabalho criativo ao Work; criar uma derivação identificada pelo modelo de origem e sua revisão.
- Resultado do Work: salvar inicialmente como rascunho privado. Promover para modelo reutilizável somente após revisão visual e validação de compatibilidade com o rápido.

A personalização fica associada ao cliente e ao modelo de origem. A chave de reaproveitamento deve incluir versão do modelo, paleta/identidade e formato. Mudanças na identidade ou no original invalidam apenas as variantes correspondentes.

Exemplo: Semana de Ofertas original → Semana de Ofertas / cliente Economia / azul e amarelo. Outra loja pode receber vermelho e branco, sem modificar o original ou a versão Economia.

## Composição comercial adaptada ao conteúdo

Esclarecimento do usuário: a maior necessidade é qualidade e variedade do cabeçalho e dos dados comerciais dinâmicos. O piloto deve adaptar o desenho ao conteúdo real da loja, incluindo dois endereços, em vez de apenas preencher espaços de dimensão fixa ou trocar a paleta.

Leitura do código local em 7 de outubro: `BusinessProfile` e a tela de dados da loja já possuem `addresses[]`. `getQuickBusinessProfileValue` mantém modelos com `businessProfileEntryIndex === 0` vinculados apenas ao primeiro endereço. Outros objetos recebem os endereços concatenados por `formatBusinessAddressValues`; o rodapé genérico trabalha com um único campo address. Isso confirma caminhos limitados de composição, não uma impossibilidade de guardar duas unidades. Comportamento dos modelos e do deploy atual ainda precisa de validação visual específica.

O Work deve receber dados estruturados e completos: unidades/endereço, contatos, identidade visual, conteúdo da campanha, quantidade de produtos e formatos. Cada endereço tem identidade própria e deve poder virar um bloco nativo independente. Rótulos de unidade só entram quando fornecidos/autorizados pelo cliente; não inventar nomes, contatos ou dados postais.

A saída criativa deve descrever a composição: hierarquia, posições, dimensões, alinhamento, tipografia, formas, decoração e área dos produtos. O backend materializa essa proposta em objetos editáveis e verifica que todos os dados exigidos foram preservados, com legibilidade e sem sobreposição. Textos comerciais não ficam gravados no bitmap do fundo.

Exemplos de composição a serem avaliados, sem fixar uma receita única:

- Uma unidade: endereço dominante com bloco de contato equilibrado.
- Duas unidades: dois blocos identificáveis, empilhados no Story quando houver largura insuficiente ou lado a lado em formatos mais largos.
- Logo horizontal ou vertical: cabeçalho com proporção e distribuição adequadas à marca.
- Conteúdo comercial extenso: reorganizar áreas e espaçamentos, preservando tamanho legível e importância dos produtos.

Os modelos atuais passam a servir como ponto de partida visual e estrutural. Cabeçalho e rodapé podem receber novas composições por loja/campanha. A versão aprovada é reaproveitada enquanto dados e estrutura permanecerem compatíveis. Mudança na quantidade de endereços/contatos, proporção do logo ou volume de conteúdo dispara nova composição; correções de texto dentro do espaço existente podem seguir pelo motor nativo.

Acrescentar ao piloto obrigatório: loja com dois endereços completos, logo em proporção distinta, contatos reais e pelo menos dois formatos. Conferir ambos os endereços no render/export, campos separados editáveis, comportamento ao atualizar/remover uma unidade e preservação das zonas/cartões no rápido. Validar execução no Work e resultado visual antes de automatizar.

## Área de produtos adaptada à quantidade e às fotografias

Requisito acrescentado pelo usuário: a composição da área de produtos deve variar com a quantidade e com o desenho/proporção das fotografias dos itens.

O Work recebe a lista confirmada, as fotos selecionadas, dimensões/proporções e área útil após cabeçalho e dados comerciais. Propõe distribuição, tamanhos, destaques, distâncias entre cards e posições das etiquetas. Produtos de foto alta (ex.: garrafa), larga (ex.: bandeja) ou volumosa pedem tratamento proporcional; preservar o recorte inteiro e evitar esticar as imagens. Nome longo também entra no cálculo do espaço. Não alterar foto escolhida ou inventar uma embalagem para melhorar a composição.

A quantidade não fixa uma única grade obrigatória. Exemplos possíveis: um item com destaque grande, poucos produtos com distribuição mais espaçosa, quantidade intermediária com destaque e cards secundários. Para listas extensas, preservar a legibilidade e organizar mais páginas quando necessário; não omitir itens para encaixar a arte. Preservar a ordem enviada, salvo autorização explícita para reorganizar os produtos.

Base existente no código: ProductZone admite estrutura por quantidade e formato, variantes e destaques. A integração deverá materializar a proposta criativa dentro desse contrato e manter dados/IDs de produto, objetos nativos e etiquetas editáveis. A presença desse contrato não comprova que o Work já o produz nem que todo modelo atual adapta as fotos corretamente.

Reaproveitar composições aprovadas quando quantidade, formato e características do conteúdo forem compatíveis. Uma mudança que exceda esses limites pede novo cálculo de layout ou nova composição criativa. Conferir contagem de produtos, ausência de cortes/deformação, legibilidade de nome/preço, colisões, limite de página e integridade dos vínculos no rápido.

Piloto ampliado: 1, 5 e 12 produtos em dois formatos, misturando imagens altas/largas e nomes curtos/longos; incluir cenário com dois endereços. Os números são casos de teste propostos, não regras fixas do layout. Verificar adicionar/remover produto e salvar/reabrir no rápido; dividir em páginas apenas quando o conteúdo exigir e conferir a lista completa.

## Editor rápido e vários formatos

O Work pode criar fundos/selos e escolher parâmetros de composição. O contrato de saída precisa manter zonas de produtos, cartões e dados de produto reconhecidos pelo rápido; textos e preços permanecem nativos.

Cada formato recebe sua composição própria. As páginas devem compartilhar os identificadores de produto e as informações comerciais da campanha. Sincronização automática de edições entre páginas requer implementação; não é uma capacidade comprovada do piloto atual.

O Story Economia já criado nesta sessão comprova composição e persistência programáticas em Fabric, mas usa objetos livres em FREE_DESIGN. Ele não comprova o contrato do rápido, nem execução agendada pelo Work.

## Edição cotidiana, novas opções e dados dinâmicos

A experiência proposta mantém os controles familiares do editor rápido para inserir/remover produtos, trocar fotos/preços e editar as informações comerciais. Esta seção descreve o comportamento desejado, não funcionalidades já implementadas.

Os dados continuam no cadastro da loja e nos dados da campanha. Work recebe os valores completos com identificação/tipo e propõe onde cada bloco entra. Nome, preço, validade, contato e endereço ficam vinculados em objetos nativos separados. Dois endereços são dois blocos, com IDs distintos; remoção/atualização usa essa identidade e não a posição de uma string concatenada.

- Trocar valor de preço, data ou texto compatível com o espaço: atualizar pelo motor nativo e recalcular ajuste permitido, sem execução criativa por digitação.
- Inserir/remover produtos: usar receita compatível com a nova quantidade/formato; quando necessário recalcular a composição e conferir legibilidade/lista completa.
- Acrescentar endereço, contato ou informação comercial: adicionar bloco identificado e tentar redistribuição compatível. Se for necessário novo desenho, criar pedido criativo na fila Work.
- Acrescentar uma opção visual (ex.: variante de etiqueta ou destaque): disponibilizar como parâmetro reconhecido pelo gerador e controles do editor; composições aprovadas podem ser reutilizadas.
- Criar tipo de campo ou controle ainda não suportado: implementar seu cadastro, validação, vínculo, renderização e controle uma vez no sistema. Um prompt isolado não cria esse suporte.

Quando uma edição exigir Work, manter o estado editável atual e apresentar que a reorganização visual está pendente. O resultado volta como versão conferida contra a revisão de origem; uma edição mais nova deve impedir sobrescrita automática pelo resultado atrasado. Na fila por lotes escolhida pelo usuário, uma composição nova não tem resposta imediata garantida.

Dados atuais da loja devem entrar em novos pedidos. Projetos existentes precisam distinguir valores vinculados de alterações locais do usuário; não atualizar silenciosamente artes antigas/aprovadas por uma mudança de cadastro. Sincronização dos formatos da campanha, quando implementada, deve respeitar as mesmas revisões e escolhas.

Adicionar ao piloto: modificar preço; adicionar/remover um produto; acrescentar segundo endereço; corrigir endereço após enfileirar composição; receber resultado atrasado; criar/exportar versão consistente preservando edição recente. Conferir controles rápidos e dados vinculados em cada etapa.

## Reutilização pelo painel e chat contextual

Requisito: cliente deve poder reutilizar o encarte salvo, informar nova lista e acrescentar produto esquecido. Proposta de interface: ação Reutilizar no projeto e, no editor, lista de produtos editável acompanhada de chat contextual do JobVarejo. Esses controles/integração não foram implementados nesta etapa.

Reutilizar cria uma nova edição da campanha baseada na composição salva. Permite substituir a lista completa, atualizar preços/datas ou manter produtos e acrescentar novos. A edição anterior continua acessível. No projeto atual, uma solicitação explícita de adicionar um item modifica somente a lista desse projeto, respeitando sua revisão.

A lista de produtos deve oferecer Adicionar produto, colar lista e importação suportada. O cliente confere nome, preço e foto; o backend atualiza objetos vinculados e usa estrutura compatível com nova quantidade/formato. Itens existentes são preservados ao acrescentar, e substituição completa deve ser diferenciada de inclusão.

O chat acompanha o projeto/edição atual, sem exigir que o cliente abra ChatGPT. Exemplos:

- Use essa arte com os produtos desta semana: [lista].
- Adicione açúcar 5 kg por 18,99 e mantenha os demais.
- Mude o preço do arroz para 24,99.
- Atualize a validade e gere também o Story.

O chat deve resolver produtos pelo contexto/lista e pedir identificação quando o alvo for ambíguo, preservando conteúdo não solicitado. Dados enviados são interpretados/validados pelo backend; cliente não recebe credenciais nem acesso à assinatura/conta do operador Work.

Operações suportadas pelos controles/motor nativo atualizam a edição diretamente. Quando a solicitação exige criação de recursos ou nova composição, o backend registra pedido na fila Work e mostra estado de processamento. Uma resposta textual no chat não prova alteração: apresentar resultado de ferramenta, versão salva e prévia correspondente. A interpretação do chat tem seu próprio caminho de execução e custo, a definir; não afirmar que todo texto no painel é automaticamente atendido pelo Work Pro.

Aplicar revisão/identidade e impedir que uma execução atrasada substitua alterações feitas pelo cliente após o pedido. Ao acrescentar produto, validar quantidade final e conferir as imagens; se precisar paginar, preservar a lista inteira e explicar a organização.

Adicionar ao piloto: reutilizar edição salva com nova lista; adicionar um item esquecido mantendo os demais; atualizar preço por chat; corrigir foto pela lista; continuar editando enquanto um redesenho Work está na fila; conferir dados salvos e reabrir a nova edição.

## Área experimental e proteção do editor existente

Pergunta do usuário: reutilizar editor pronto ou criar outro, de modo que falhas do piloto não afetem o sistema atual.

Recomendação: criar uma área/interface experimental Encartes com IA para chat, contexto, pedidos, prévias e versões. Reaproveitar o motor Fabric, os contratos de projeto/storage e os controles do editor existente que já atendam à saída validada. Um novo editor completo não é requisito para provar a integração.

O piloto preserva as rotas e o fluxo de criação atuais. A área experimental fica desabilitada para contas comuns até validação, com liberação restrita às contas de teste. Nenhuma nova rota, flag ou controle foi criado nesta etapa documental.

Resultados Work recebem novos IDs de projeto e paths próprios de storage. Referências/modelos e projetos originais são lidos como base; pedidos de alteração geram cópias/versões com revisão de origem e proprietário verificado. Primeiro validar o contrato e visualizar a prévia; abrir no rápido somente saídas compatíveis. A indicação FREE_DESIGN ou uma rota nova, por si, não assegura isolamento de estado e autosave.

Leitura local: pages/editor/[id].vue carrega EditorCanvas.vue para rápido e avançado, com seleção por papel/query. useProject concentra estado de projeto, drafts e autosave. Alterar esses módulos compartilhados pode afetar os dois modos; uma nova rota chamando o mesmo componente não elimina esse risco. Inicialmente implementar fila/chat/compilação em módulos separados e consumir contratos/funções estáveis, evitando modificar o núcleo compartilhado para o piloto. Qualquer modificação futura nele exige verificação proporcional e teste do fluxo antigo.

Se for necessária interface de edição nova para capacidades ainda ausentes no rápido, desenvolver os controles da área experimental com estado e lifecycle próprios. Reusar utilitários estáveis sem ligar duas sessões de autosave concorrentes ao mesmo projeto. A rotina experimental só pode salvar os projetos atribuídos ao pedido autorizado.

Critérios de liberação: encarte atual abre/edita/salva/exporta normalmente; resultado Work é novo projeto; original e modelo mantêm conteúdo/revisão; falha/retry não duplica resultados; salvar/reabrir/undo e adicionar produto funcionam; dois endereços e formatos preservados. Só depois avaliar disponibilizar integração dentro do rápido convencional.

Desativar a área e o consumidor experimental deve interromper novos pedidos desse caminho sem interromper o fluxo existente. Isso é objetivo do desenho e depende de implementação/testes; não declarar garantia de impacto zero apenas por chamar a interface de beta.

## Ferramentas mínimas propostas para o plugin

Nomes abaixo são contrato proposto, não endpoints disponíveis:

| Ferramenta | Resultado |
| --- | --- |
| list_pending_design_jobs | Pedidos criativos pendentes no escopo autorizado, com limite de lote. |
| claim_design_job | Reserva exclusiva por prazo, revisão e identidade; evita duplicar trabalho. |
| get_design_job_context | Produtos confirmados, perfil/paleta, modelo de origem, versões e formatos autorizados. |
| get_template_preview | Prévia e estrutura do modelo existente, sem expor credenciais de storage. |
| stage_generated_asset | Recebe arquivo gerado, valida tipo/tamanho/origem autorizada e devolve referência durável. |
| submit_design_draft | Recebe proposta/recursos, valida os dados e salva nova derivação privada editável. |
| get_design_result_preview | Permite conferir a composição renderizada antes da conclusão. |
| complete_design_job | Confirma projeto, formatos e leitura da persistência para a revisão esperada. |
| fail_design_job | Registra erro recuperável sem alterar projetos aprovados. |

O backend decide a conta e os recursos permitidos pelo pedido reservado; não confiar em um ownerId enviado livremente pelo modelo. Autenticação e escopo precisam ficar no conector/backend. Não colocar credenciais no prompt. Pedidos/referências recebidos de clientes são dados, não instruções para ampliar o acesso do agente.

Não expor geração que envie WhatsApp automaticamente no piloto. A conclusão retorna IDs/links ao backend. Mensagens externas e publicação de modelos ficam fora da primeira validação.

## Reaproveitamento do código existente

Leitura local confirmou:

- `server/utils/project-templates.ts`: projetos com `is_template` e `template_config`.
- `server/utils/whatsapp-creation/flyer-canvas-customization.ts`: personalização pura de canvas e estilos de zonas, sem gravar o modelo de origem.
- `server/utils/whatsapp-creation/draft-project.ts`: sincronização de rascunhos, identificação de alterações e derivação para preservar edição no painel.
- `server/utils/whatsapp-creation/jobs.ts`: identidade de pedido/conta, revisão e proteção contra resultado atrasado.
- `components/EditorCanvas.vue`: troca de formato usa composição específica quando disponível e preserva conteúdo dinâmico.
- `integrations/n8n/whatsapp-creation/encarte.json`: fluxo versionado chama a geração do backend.

A fila criativa pode reaproveitar contexto dos pedidos existentes, mas schema real, índices, estados e concorrência devem ser conferidos antes de escolher sua persistência. Não foi criada nova tabela ou aplicado DDL nesta análise. Não conectar o novo consumidor ao fluxo ativo sem validar propriedade exclusiva do trabalho.

## Sequência de implantação

1. Inventariar um pequeno conjunto de modelos existentes, conferindo formatos, zonas, bindings, etiquetas e recursos raster.
2. Criar as ferramentas restritas do plugin e testar schema, escopo, idempotência e resultados.
3. Rodar manualmente um único pedido no Work com modelo existente e um cliente; gerar/transferir recursos, salvar e reabrir a derivação.
4. Validar troca de produto/preço/foto no rápido, identidade comercial, exportação e cada formato solicitado.
5. Testar o mesmo pedido duas vezes e uma revisão alterada durante a execução; nenhum resultado duplicado ou sobrescrita de edição recente.
6. Somente após esses testes, configurar tarefa agendada de lote pequeno, observar os primeiros resultados e ajustar a cadência. Nenhuma cadência foi fixada ou agendamento criado nesta etapa.
7. Expandir a reutilização das versões aprovadas. Pedidos comuns continuam usando o motor nativo, sem uma geração criativa completa por encarte.

O trigger direto de Workspace Agents é outra rota e requer workspace elegível; não é a solução escolhida para o Pro pessoal. [Elegibilidade](https://developers.openai.com/api/docs/guides/agent-builder/migrate-from-agent-builder#option-2-create-a-workspace-agent-from-the-export), [trigger](https://developers.openai.com/workspace-agents/trigger-runs).
