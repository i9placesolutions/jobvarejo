# Plano: vídeos de ofertas do JobVarejo

Status: módulo implementado localmente em 19/09/2026; modelo visual reformulado após rejeição da primeira prévia. Sem deploy ou benchmark de produção. O planejamento abaixo permanece como referência e inclui evoluções ainda não implementadas.

## Escopo acordado
- Vídeos de no máximo 30 segundos, incluindo abertura, transições e encerramento.
- Reels/Stories: vertical 1080 × 1920 (9:16). TV: horizontal 1920 × 1080 (16:9), assumindo TV convencional.
- MP4 H.264, áudio AAC e 30 fps; verificar compatibilidade em aparelho de TV representativo.
- Um projeto gera os dois formatos, com composição própria em cada proporção.
- Nome comercial, logo e contatos inicialmente provenientes do perfil comercial do usuário autenticado, editáveis no projeto. Alterar no vídeo não altera o cadastro automaticamente.
- Produtos selecionados do encarte ou cadastrados no projeto; texto sugerido editável; Python prepara pronúncia e MusicGPT gera a locução.
- Biblioteca reutilizável de efeitos, movimentos, cenas, temas, músicas de fundo e efeitos sonoros.

## Fluxo de uso
1. Meus vídeos → Criar vídeo → escolher modelo e um ou ambos os formatos.
2. Selecionar produtos e ordem, verificar identidade, validade e condições comerciais.
3. Receber roteiro sugerido a partir exclusivamente dos dados selecionados; editar livremente.
4. Escolher voz, ajustar pronúncia e ouvir a locução gerada; selecionar trilha e pacote de efeitos, com volumes independentes.
5. Visualizar prévias vertical/horizontal; revisar produtos, preços, legibilidade e tempo.
6. Gerar MP4; acompanhar fila, geração de áudio, montagem, renderização e conclusão.
7. Baixar, duplicar projeto ou reutilizar modelo com outras ofertas.

## Duração e quantidade de produtos
- Opções 15, 20 e 30 segundos; duração escolhida é teto, não obrigação de preencher com silêncio.
- Começar com 3 a 4 ofertas por vídeo de 30s, ajustando ao tamanho real das descrições.
- Exemplo de orçamento: abertura 3s + 4 ofertas de 5,5s + encerramento 4s = 29s. Transições incluídas nesses intervalos.
- Estimar duração antes da solicitação paga; medir os arquivos reais após retorno do provedor.
- Reservar tempo de leitura visual, inclusive para unidade, validade e condições.
- Se exceder: sugerir texto mais curto ou divisão em vídeos separados de até 30s. Usuário revisa mudanças; nunca omitir ofertas, cortar fala, alterar preços ou acelerar excessivamente para caber.
- Revalidar após qualquer edição. Bloquear exportação acima do teto. Conferir duração final do MP4, com margem para arredondamento de frames/áudio.

## Roteiro, Python e MusicGPT
- Separar dados comerciais, roteiro editável e texto normalizado para fala.
- Roteiro usa nome da empresa e apenas produtos/condições confirmados; evitar promessas inventadas.
- Python normaliza BRL, números decimais, unidades, pesos, volumes, datas e abreviações com contexto; utiliza dicionário de pronúncia por conta para nomes e marcas.
- Preservar o texto editado, mostrar a versão de locução e diferenças relevantes. Em conflito entre preço falado e preço exibido, pedir correção antes de gerar.
- Preferência inicial: blocos abertura/ofertas/encerramento, mesma voz e parâmetros. Validar naturalidade dos blocos no protótipo; usar locução contínua e alinhamento se as emendas prejudicarem o resultado.
- Medir duração de cada bloco para montar cenas. MusicGPT não deve ser presumido como fornecedor de timestamps ou duração exata.
- Reutilizar áudio somente quando texto normalizado, voz e parâmetros forem idênticos dentro da conta; alterações comerciais invalidam os trechos afetados.
- Trilha opcional com volume reduzido durante a fala; TV também deve ser compreensível sem som.
- Não prometer pronúncia perfeita; permitir escutar, corrigir e regenerar.

## Biblioteca de animações
- Categorias: fundos, partículas/fogo/luzes, selos, entradas de produto, etiquetas de preço, transições, aberturas e encerramentos.
- Registrar versão, miniatura/prévia, duração, possibilidade de loop, transparência, parâmetros de cor/intensidade, compatibilidade com formatos e origem/licença.
- Efeito genérico pode aparecer em vários temas; selo específico permanece identificado com sua campanha.
- Guardar recursos separados e modelos parametrizados, mantendo nome/preço/produto como camadas independentes.
- Usar biblioteca global de recursos autorizados e biblioteca privada da conta; não compartilhar mídia privada entre clientes.
- Cada projeto fixa a versão do modelo/efeito; atualização futura da biblioteca não modifica vídeos existentes.

## Catálogo ampliado de efeitos visuais
- Movimento e impacto: shake curto de câmera ou de elemento, punch zoom, bounce, pulsação, giro, entrada elástica e parallax.
- Atmosfera: fumaça leve/densa/colorida, névoa, vapor, poeira, faíscas, brasas, fogo e explosão de partículas.
- Luz: brilho, glow, reflexo passando pelo produto/preço, raios de luz, flare e flash suave.
- Celebração e temas: confetes, serpentinas, estrelas, moedas e elementos sazonais reutilizáveis.
- Transições adicionais: whip pan, zoom com desfoque, passagem de fumaça, revelação por partículas e glitch breve opcional.
- Aplicação por camada: cenário, produto, selo, logo, preço ou cena completa. Shake de produto não deve obrigar preço/validade a tremer; fumaça tem profundidade/posição para não encobrir dados comerciais.
- Ajustes: intensidade, duração, início, direção, escala, cor, opacidade e velocidade; presets Suave, Equilibrado e Impactante com prévias reais.
- Pacotes combináveis por campanha: Impacto (shake + punch zoom + impacto sonoro), Churrasco (fumaça + brasas + luz quente) e Celebração (confetes + brilho + som de destaque).
- Implementar movimentos por parâmetros e usar assets com transparência ou composição adequada para fumaça/fogo; catálogo registra formato, loop e modo de composição. Não gerar novamente um efeito a cada vídeo.
- Fixar parâmetros e semente de partículas/shake por revisão para prévia/exportação reproduzíveis; adaptar amplitude e enquadramento aos dois formatos.
- Definir orçamento de efeitos simultâneos após medir desempenho; presets mantêm textos legíveis e tempo de leitura estável entre impactos, evitando flashes repetitivos.
- Primeiro protótipo inclui shake curto, fumaça, partículas/brasas, brilho, zoom e transição com som; expandir demais famílias após validar o conjunto.
- Aceite adicional: desligar/trocar um efeito não altera dados ou locução; salvar/reabrir preserva ajustes; efeitos não vazam fora da cena nem estendem o vídeo além de30s; prévia e MP4 reproduzem o mesmo resultado.

## Música, efeitos sonoros e acabamento
- Cada modelo entrega um pacote coordenado de animações, transições, música e efeitos sonoros; o usuário pode substituir, ajustar ou desligar cada camada.
- Biblioteca de trilhas instrumentais por clima/tema (ofertas animadas, promoção intensa, suave, sazonal); permitir escolher uma existente, enviar arquivo autorizado ou solicitar geração via MusicGPT, após validar capacidade, custo e direitos de uso comercial.
- Biblioteca de sons: passagem de ar (whoosh), impacto de abertura, destaque de preço, brilho, subida de tensão e assinatura de encerramento. Usar com moderação, sem disparar som em toda animação.
- Música, locução e efeitos permanecem em faixas independentes; não embutir locução na trilha reutilizável.
- Reduzir automaticamente a música durante a fala, com transições suaves; ajustar níveis, controlar picos e evitar distorção. Voz e preços falados têm prioridade sobre impactos e trilha.
- Eventos sonoros vinculados aos eventos da cena (entrada, preço, transição e encerramento); recalcular tempos após mudanças na duração da locução.
- Trilha adaptada à duração final com início/final suaves e loop ou emendas discretas quando necessário. Caudas de reverberação e efeitos encerram dentro do teto de30s, sem cortar fala.
- Transições visuais: zoom, deslizamento, passagem de luz, dissolução e revelação por máscara. Adaptar direção/distância aos formatos vertical e horizontal.
- Complementos de acabamento: sombras, profundidade, iluminação, movimentos de câmera, entrada de logo, selo de campanha, validade e encerramento com contatos; manter produto/preço legíveis e áreas seguras.
- Controles simples: ouvir prévia, trocar música/pacote, volume de voz/música/efeitos, intensidade visual e opção sem música/sem efeitos/sem áudio. Modo TV continua compreensível sem som.
- Guardar origem, autorização de uso, versão, duração, volume padrão, pontos de loop e identificação de cada recurso; recursos gerados ou enviados ficam privados por conta até publicação autorizada na biblioteca global.
- Reutilizar arquivos existentes sem nova geração paga; trocar trilha ou transição não regenera locução válida. Prévia e exportação usam o mesmo arranjo de áudio.

## Arquitetura proposta
- Nuxt/Vue: biblioteca, formulário de criação, roteiro e prévia. Remotion/React isolado e carregado apenas na área de vídeos.
- Nitro: autenticação, validação, persistência, autorização dos assets e orquestração.
- Python: normalização textual PT-BR e suporte à análise de áudio.
- Worker Node/Remotion: composição e renderização; FFmpeg/ffprobe: áudio, inspeção e validação dos arquivos.
- PostgreSQL: projetos, revisões, roteiros, cenas, solicitações e resultados. Auditar schema real antes de criar tabelas ou migrações.
- Redis/fila: tarefas com concorrência limitada, recuperação após reinício, tentativas controladas e progresso persistido.
- Wasabi: assets, áudios, prévias e MP4 em caminhos privados por proprietário/projeto/revisão; acesso autorizado.
- Reutilizar adaptador MusicGPT existente, separando associação de tarefas e armazenamento hoje ligados à rádio. Webhook autenticado, deduplicado e roteado pelo ID persistido da tarefa; consulta de recuperação quando callback não chegar.
- Correlacionar cada job à revisão original: resposta atrasada não pode substituir áudio/vídeo de uma edição mais recente.
- Não repetir automaticamente solicitação paga com resultado incerto; consultar tarefa existente antes de nova geração.
- Renderização em serviço separado do servidor web para controlar consumo de CPU/memória. Definir concorrência após benchmark.

## Etapas e entregas
1. Protótipo de qualidade: um tema Fecha Mês, abertura + ofertas + encerramento, layouts vertical/horizontal, produtos e identidade reais autorizados. Entrega: dois MP4 revisáveis, ambos até30s, já com música, efeitos sonoros e transições coordenados.
2. Roteiro e voz: sugestões, edição, normalização Python, pronúncia por conta e integração MusicGPT; testar continuidade e duração real.
3. Área de vídeos: biblioteca, criação, seleção de ofertas, identidade editável, prévias, salvamento e duplicação.
4. Renderização persistente: fila, progresso, recuperação, versões, cache de áudio e armazenamento privado.
5. Biblioteca reutilizável: separar/publicar os componentes do primeiro modelo; novos temas reutilizam esses componentes com composição própria.
6. Homologação e disponibilização: testes, build, carga controlada, produção e execução real acompanhada. Publicação em redes/agendamento não integra o primeiro escopo.

## Critérios de aceite
- Ambos os formatos corretos; duração final <=30s; cenas e transições sem cortes de texto, distorções ou imagens faltantes.
- Nome, produtos, preços, unidades e condições coerentes entre cadastro selecionado, edição final, tela e locução.
- Um preço alterado invalida o áudio antigo; mudanças só visuais permitem reutilizar áudio válido.
- Revisão manual de números, pronúncia da empresa/marcas e sincronização por oferta.
- Conferir mixagem com fones, alto-falante de celular e TV: fala inteligível, música reduzida durante locução, efeitos sincronizados, ausência de distorção e encerramento suave dentro do limite.
- Trocar/desligar música ou efeitos preserva roteiro e locução; reabrir projeto mantém volumes e sincronização; prévia e MP4 têm o mesmo arranjo sonoro.
- Leitura confortável no celular e em TV; composição horizontal própria e margens seguras no vertical.
- Isolamento entre contas, callbacks repetidos, falha do provedor, reinício do worker e resultado atrasado testados.
- Reabrir projeto preserva roteiro, voz, ofertas, assets e versões; erro de render não aparece como sucesso.
- Medir tempo e custo de gerar os dois formatos; verificar presença e reprodução dos MP4 no armazenamento.
- Testes unitários significativos para normalização e limites; integração de jobs/webhooks; typecheck/build e teste autenticado ponta a ponta.

## Evidências e pendências
- Inspeção local identificou submitMusicGptTextToSpeech, consulta por tarefa, webhook e ingestão de áudio na Rádio Indoor. Isso não comprova disponibilidade atual do provedor em produção.
- Na implementação posterior, MusicGPT retornou locução e trilha reais; ver evidências de entrega abaixo.
- Validar vozes, limites, custos e comportamento real da API; licença/custo do Remotion para o SaaS; direitos dos recursos visuais e trilhas; capacidade do servidor e modelo de TV.
- Referências: https://www.instagram.com/p/DcoG6RiRT-K/ e https://www.instagram.com/p/DWVAPQtkS8c/ — inspeção visual anterior, locução não validada.
- Documentação: https://www.remotion.dev/docs/vue e https://www.remotion.dev/docs/renderer.


## Entrega local — 19/09/2026

- Área isolada `/videos`: criação em quatro passos, importação de ofertas, dados do perfil editáveis, salvamento com revisão, duplicação, prévia e exportação nos dois formatos.
- Quatro temas e dez efeitos determinísticos, com intensidade, transição e volumes simples. Não é um editor livre de camadas/timeline.
- A primeira prévia Fecha Mês foi rejeitada pelo usuário. A revisão Impacto usa abertura com selo 3D/logo, moldura industrial, fundo em movimento, fogo/brasas, entradas rápidas coordenadas e encerramento com dados comerciais. A aprovação visual pelo usuário permanece pendente. Alterar o título utiliza texto editável; o selo 3D corresponde ao título Fecha Mês.
- PostgreSQL com quatro tabelas próprias, fila durável e leases; Wasabi privado por usuário. Sem alterações no editor Fabric ou nas rotas/tabelas da rádio. Biblioteca de vozes autorizadas apenas consultada.
- Worker Node/Remotion independente com Python para pronúncia. Polling MusicGPT com task_id persistido, cache de voz por usuário e proteção contra reenvio de solicitação incerta.
- MusicGPT retornou cinco falas para a revisão Impacto e uma trilha instrumental. Durações reais formam uma composição de 26,1 segundos; preços e unidades foram normalizados por Python. As trilhas locais continuam disponíveis.
- Build Nuxt e limite de chunk aprovados; 16 testes do módulo e 4 testes Python aprovados. Typecheck global bloqueado por erro preexistente cloneReady em pages/admin/musicgpt.vue, sem erros nos novos arquivos de vídeo.
- Migração aplicada ao banco configurado; web local na porta 3042 e worker local. A aplicação em produção e o serviço Docker de renderização não foram publicados nem testados em produção.
- Evoluções: biblioteca com upload de novos efeitos/transições, controles por camada, dicionário de pronúncia global da conta, validação em aparelho de TV real e benchmark de capacidade/custos.

## Base técnica e escala

- Remotion 4.0.526 fixa a mesma composição por frames na prévia e no worker; React fica encapsulado no componente de vídeo do Nuxt/Vue. FFmpeg/FFprobe codificam e inspecionam o MP4. Versões devem ser atualizadas em conjunto no app e worker.
- Etiquetas existentes são adaptadas como cópias sanitizadas para SVG; formatos complexos de múltiplos preços não são importados como preço único. Nenhuma mutação no catálogo Fabric.
- Fila PostgreSQL usa SKIP LOCKED, lease, revisão e progresso; recursos privados por proprietário. Isso permite múltiplos consumidores, mas não comprova capacidade de atender o varejo em escala.
- Antes da abertura ampla: benchmark de CPU/memória por tema/formato, limites por conta, separação das filas de render/áudio, métricas de espera/erro/custo e implantação supervisionada. Remotion/FFmpeg são a base atual; camadas 3D reais e efeitos GPU avançados devem entrar com necessidade visual e medição, sem sobrecarregar o fluxo simples do usuário.

## Refinamento pelas três referências — 19/09/2026

- A pedido do usuário, a composição `layoutVersion: 2` segue a hierarquia: abertura com logo/selo grandes e validade abaixo; ofertas com validade acima do selo, produto livre, descrição/preço lateral e logo no rodapé; encerramento com logo, Instagram, WhatsApp e endereço com ícones.
- `shared/video-studio/showcase.ts` mantém identidade entre cenas por interpolação de posição/tamanho; as ofertas usam molas amortecidas, entradas defasadas, desfoque na entrada/saída e sobreposição visual de oito frames. A locução conserva seus intervalos e duração.
- Novo selo próprio verde/dourado; etiqueta circular automática. Contorno sticker ou logo limpa, duplicação opcional de embalagens estreitas e normalização das margens vazias da imagem. Produtos largos permanecem com uma imagem. Ajustes comerciais continuam editáveis.
- Layout anterior preservado para projetos sem `layoutVersion: 2`; opção de montagem disponível no formulário. Dados visuais não invalidam a locução existente; data/preço/texto continuam invalidando-a.
- O projeto de demonstração permanece marcado como demonstração, sem inventar uma validade comercial. O usuário pediu para criar uma skill reutilizável somente depois de ajustar/aprovar este modelo; ela não foi criada nesta etapa.

## Biblioteca reutilizável de movimentos — 20/09/2026

- Catálogo, origem dos recursos e limites de integração documentados em [Biblioteca de efeitos](video-studio/biblioteca-efeitos.md). O inventário verifica 74 funções do pacote completo `@remotion/effects`, com sete integradas à composição. Efeitos do CapCut foram usados como referência; seus pacotes nativos não foram extraídos.
- Seis combinações prontas e controles de produtos/textos/preços/câmera/transições/ambiente/acabamento. Doze sons e duas novas trilhas originais sintetizados e reutilizáveis. A locução MusicGPT existente permanece reutilizável quando apenas esses parâmetros mudam.
- Configuração opcional `document.motion`, validada e persistida pelo contrato de projeto; preview e worker usam o mesmo código. Pacotes Remotion fixos em 4.0.526 e módulos React/Remotion/efeitos divididos para carregamento. Sem alteração dos editores de imagem ou Rádio Indoor.
