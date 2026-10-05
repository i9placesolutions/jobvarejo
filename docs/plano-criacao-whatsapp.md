# Solicitação de materiais pelo WhatsApp do JobVarejo

Data: 03/10/2026. Status: proposta organizada; integração conversacional ainda não implementada nem validada em produção.

## Objetivo

Permitir que o cliente solicite encartes, vídeos, cartazes e artes do Estúdio pelo WhatsApp do JobVarejo. O canal deve usar a identidade da loja e os modelos disponíveis para a conta, salvar o trabalho no módulo correspondente e entregar prévia, arquivo final e link de edição.

O fluxo manual e a criação assistida dentro do programa continuam disponíveis. O WhatsApp será outra entrada para os mesmos serviços de criação. Catálogo compartilhado não significa converter todos os módulos para um único formato de documento.

## Experiência do cliente

1. Cliente envia “Quero um encarte”, “Faça um vídeo das ofertas”, “Preciso de cartazes” ou “Crie uma arte de aniversário da loja”.
2. Sistema identifica a conta vinculada ao número verificado e verifica acesso atual. Quando não houver vínculo, orienta a vinculação no aplicativo antes de acessar dados privados.
3. Pergunta somente o que faltar: tipo de material, campanha, formato e conteúdo. Envia imagens dos cabeçalhos disponíveis para o tema pedido, com escolhas numeradas e paginação quando necessário. Por exemplo, “fecha mes” seleciona a campanha “Fecha Mês”; não envia o catálogo de outros temas.
4. Cliente envia a lista ou mensagem por texto, imagem ou áudio, já no piloto. Imagens passam por leitura visual; áudios passam por transcrição antes da interpretação. PDF entra depois, quando sua extração for validada.
5. Sistema apresenta os dados interpretados para confirmação: produtos, preços, gramaturas, validade, limites e condições; para artes institucionais, título, mensagem e chamada.
6. Busca imagens reais na biblioteca/Wasabi e envia ao cliente todas as fotos propostas, numeradas e identificadas por produto, marca, variante e peso. Pergunta se estão corretas; permite trocar somente os itens apontados. Se faltar ou houver ambiguidade, solicita a foto ou confirmação da variante. Remoção de fundo preserva a embalagem. Logo, contatos e endereço vêm do cadastro da conta, com confirmação de qualquer alteração solicitada.
7. Monta e salva um rascunho editável no módulo correspondente. Envia prévia identificada pelo pedido e pela versão.
8. Cliente pede correção ou aprova aquela versão. Qualquer mudança posterior invalida a aprovação anterior.
9. Sistema exporta a versão aprovada e envia o arquivo ou link autorizado, além do link para continuar a edição no JobVarejo. Registra separadamente geração, envio aceito pelo provedor e confirmação de entrega quando disponível.

Exemplo: “Encarte Story de fim de semana: arroz 5 kg R$ 19,90, óleo 900 ml R$ 7,49, válido sábado e domingo”. O sistema confirma as datas completas e as marcas faltantes, oferece modelos do tema e pede aprovação da prévia antes da entrega final.

## Requisitos definidos pelo usuário em 03/10/2026

- Agente conversacional com modelo muito barato da OpenRouter, capaz de ler imagens enviadas pelo cliente.
- Transcrição de mensagens de áudio do cliente, incluindo identificação e confirmação dos dados comerciais extraídos.
- Atendimento conduzido pelo n8n, com conversa em várias mensagens e retomada de pedido.
- Envio das imagens reais dos cabeçalhos do tema solicitado para o cliente escolher.
- Seleção e envio de todas as fotos dos produtos para confirmação explícita antes da montagem final.
- Criação e renderização do material dentro do servidor JobVarejo, com documento editável e identificação da conta.

## n8n, agente e servidor

A recomendação é usar n8n para coordenar o atendimento e integrar o provedor WhatsApp, a OpenRouter e os serviços do JobVarejo. O backend mantém o estado oficial do pedido, as permissões, o catálogo autorizado, as escolhas, aprovações, arquivos e projetos. Python/Pillow e os demais motores existentes executam a montagem/renderização no servidor.

Fluxo por mensagem: evento WhatsApp → validar e deduplicar → resolver conta/pedido → preparar texto/imagem/áudio → agente quando necessário → validar a operação proposta → serviço JobVarejo → resposta/mídia pelo provedor.

Cada mensagem retoma o estado persistido. Não manter uma execução aberta esperando dias por respostas nem usar apenas memória de chat como prova de seleção ou aprovação. A sessão considera instância do JobVarejo, remetente validado, conta e pedido; mensagens simultâneas devem ser serializadas por conversa.

Ferramentas propostas, ainda a implementar: consultar cabeçalhos por tema/formato, registrar escolha, buscar candidatos de imagens, registrar correções/aprovação das fotos, criar prévia, consultar job e registrar aprovação final. O contexto da conta é resolvido pelo servidor; não é parâmetro livre escolhido pela IA. Cada ferramenta retorna resultado estruturado, pendências e identificadores estáveis. A resposta ao cliente só anuncia criação quando houver projeto/job persistido.

## Modelo barato da OpenRouter

Candidato inicial para o piloto: `google/gemini-2.5-flash-lite`. A página oficial consultada em 03/10/2026 informa entrada de texto, imagem e áudio, saída de texto, chamada de ferramentas e saída estruturada. Preços publicados: US$ 0,10 por milhão de tokens de entrada de texto/imagem; US$ 0,40 por milhão de tokens de saída; entrada de áudio US$ 0,30 por milhão de tokens. Estes preços não representam custo por minuto, imagem ou pedido completo.

- Usar contexto curto com resumo do pedido e apenas a mídia relevante à etapa. Não reenviar toda a conversa, todos os cabeçalhos e todas as fotos ao modelo a cada mensagem.
- Catálogo, envio de mídia, busca de imagens e escolhas numéricas inequívocas usam operações determinísticas. A IA interpreta o pedido e responde a linguagem natural.
- Validar saída com schema e limitar chamadas/tokens por mensagem e pedido. Tratamento de JSON inválido e repetição devem ser limitados e contabilizados; sem fallback automático para modelo caro.
- Fixar modelo e conferir suporte do provedor selecionado às modalidades/parâmetros usados. Não presumir que qualquer nó n8n ou fallback encaminha mídia corretamente.
- O suporte anunciado não comprova acerto com fotos de embalagens, letras pequenas, ruído, sotaque ou ferramentas do JobVarejo. Escolha definitiva depende do piloto.

O n8n tem nó OpenRouter Chat Model para agentes. Para mídia, verificar que a imagem/áudio chega realmente ao modelo; quando o nó não expuser o payload necessário, usar integração HTTP explícita e autenticada. Passar apenas o nome do arquivo ou uma URL privada inacessível ao provedor não permite leitura.

Fontes: [modelo e preços](https://openrouter.ai/google/gemini-2.5-flash-lite), [nó OpenRouter do n8n](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenrouter/), [envio de imagem ao modelo](https://openrouter.ai/blog/tutorials/send-image-to-llm/), [transcrição na OpenRouter](https://openrouter.ai/blog/tutorials/transcription-on-openrouter/).

## Áudio e leitura de imagens

Áudio: baixar o anexo autorizado do provedor → validar tamanho, duração e formato → converter no servidor se necessário → transcrever → guardar transcrição vinculada ao ID da mensagem → extrair o pedido → confirmar os dados críticos. Notas de voz OGG/Opus exigem teste com o caminho de processamento escolhido; não renomear extensão como se fosse conversão.

Comparar no piloto a transcrição com o próprio Gemini e um serviço dedicado de transcrição via OpenRouter. O serviço dedicado é uma alternativa a avaliar, não uma dependência já contratada. Separar transcrição literal da interpretação do pedido e sinalizar trecho inaudível; não completar preço, marca ou peso por suposição. Para “dezenove e noventa”, apresentar “R$ 19,90” na confirmação.

Imagem: receber bytes autorizados e normalizados, preservar original e enviar versão adequada à leitura visual. Foto de lista deve produzir ofertas revisáveis; foto de produto deve produzir candidato de identificação e arquivo utilizável. Limitar redução de resolução para manter legibilidade; detalhe ilegível exige nova foto ou pergunta. Dados de ofertas podem vir de texto, imagem e áudio no mesmo pedido.

## Seleção visual no WhatsApp

### Cabeçalho por tema

1. Cliente pede “Fecha Mês”. O agente normaliza o termo e consulta a campanha no catálogo acessível à conta.
2. Servidor retorna IDs, revisões, formatos e imagens de apresentação dos cabeçalhos cadastrados daquele tema. Se não houver correspondência, pergunta por alternativa; não inventa opções.
3. n8n envia os cabeçalhos em imagens identificadas: “1 — modelo A”, “2 — modelo B”. Usar imagem do cabeçalho ou recorte fiel preparado no servidor; não substituir pela imagem do encarte inteiro quando a solicitação é escolher somente o cabeçalho.
4. Para muitos modelos, enviar em lotes com “ver mais”, preservando acesso a todas as opções compatíveis. O número escolhido é resolvido pelo mapa da seleção enviada, não por posição atual no catálogo.
5. Servidor registra ID/revisão/formato selecionados e pode preparar o pedido ou rascunho-base; não gerar/exportar a peça final antes das confirmações de dados e imagens.

### Fotos dos produtos

1. Buscar candidatos reais a partir da lista confirmada, priorizando a biblioteca/Wasabi e conferindo marca, linha e gramatura.
2. Preparar folhas de conferência legíveis em lotes e, quando necessário, imagens individuais. Cada item mantém número estável e legenda com produto, variante e peso. Todos os produtos com foto proposta devem aparecer.
3. Perguntar: “Estas são as fotos que vou usar. Estão todas corretas? Se alguma estiver errada, diga o número ou envie a foto certa”.
4. Registrar aprovação/correção por item e associar cada resposta à versão do conjunto enviado. “A 3 está errada” troca somente o item 3 e exige aprovação da substituição.
5. Item sem foto permanece pendente. Não ocultar um produto faltante nem tratar ausência de resposta como aprovação.
6. Depois de confirmar todas as imagens e os dados comerciais, o servidor compõe o material, salva o documento editável e devolve a prévia para aprovação final.

Escolha do cabeçalho, aprovação das fotos e aprovação da prévia são eventos distintos. Mudança de preço ou foto atualiza a versão e invalida as aprovações afetadas. O manifesto de imagens aprovadas conserva os IDs/hashes dos arquivos usados no render.

## Os quatro tipos de pedido

| Material | Informações específicas | Resultado proposto |
| --- | --- | --- |
| Encarte | Lista, tema, formato, validade, limites, imagens e quantidade de páginas | Projeto editável de encarte; PNG e PDF quando suportado pelo fluxo escolhido |
| Vídeo | Ofertas ou campanha, modelo de movimento, formato, duração compatível, música, locução e roteiro | Projeto no Estúdio de Vídeos; prévia do vídeo e MP4 |
| Cartaz | Produtos, tipo de oferta, tamanho físico, orientação, quantidade de cópias, validade e condições | Trabalho no Cartazista; prévia PNG e PDF com tamanho físico correto |
| Arte do Estúdio | Ocasião, título, mensagem, chamada, modelo, formato, fotos e identidade da loja | Composição editável no Estúdio de Artes; PNG por formato |

O pedido pode originar mais de uma peça: “Use estas ofertas para encarte, vídeo e cartazes”. Dados comerciais e kit visual podem ser compartilhados, mas cada resultado terá documento, versão e aprovação próprios. No primeiro piloto, atender um tipo por pedido; depois permitir um pedido com várias entregas.

## Base encontrada no código local

Esta tabela descreve leitura de código, não comprovação do ambiente publicado.

| Área | Componentes encontrados | Trabalho necessário para o canal |
| --- | --- | --- |
| WhatsApp | `server/utils/uazapi.ts` envia texto para códigos de autenticação; `server/utils/auth-whatsapp.ts` e migração de login por WhatsApp | Recepção autenticada de eventos, conversa persistente, anexos, envio de mídia, recibos e retomada |
| Identidade | `profiles.login_whatsapp`, verificação do número e perfil comercial | Resolver remetente em conta ativa; diferenciar número de login do contato comercial exibido na arte |
| Encartes | `utils/flyerTemplateApi.ts`, `server/api/projects.post.ts`, parser e busca de imagens; Builder tem APIs próprias de cabeçalhos e flyers | Adaptador para o editor de encartes escolhido, montagem e exportação sem operador |
| Vídeos | `server/api/videos/projects/index.post.ts`, `server/api/videos/jobs.post.ts`, `server/utils/video-studio/service.ts`, worker de vídeo | Compor documento, validar roteiro/áudio, enfileirar e acompanhar job existente; integrar prévia e entrega |
| Cartazes | APIs de catálogo e designs em `server/api/cartazista`; composição, render e PDF em `utils/cartazista` | Compositor e exportação automatizada com os tamanhos físicos do Cartazista |
| Artes | APIs de catálogo, compose, designs e render em `server/api/art-studio`; `workers/art_studio.py` | Conectar briefing e modelo publicado à composição, persistência e PNG/Python já existentes |

No vídeo, o endpoint de jobs já controla revisão, propriedade, disponibilidade do worker e reaproveitamento por fingerprint. Com locução ativa, o render exige áudio pronto compatível com o roteiro. A conversa deve respeitar esses contratos.

O Estúdio de Artes tem composição e render Python no servidor. O export do Builder consultado usa `html2canvas-pro` no navegador; para ele, a execução automática requer um renderizador apropriado ou navegador controlado. A existência de um renderizador em um módulo não comprova compatibilidade com os demais.

> ⚠️ Precisa ser confirmado. Número/instância do WhatsApp do JobVarejo, conexão do provedor, suporte e limites de mídia, banco atual, catálogo publicado e workers em produção não foram verificados nesta tarefa. Não foi localizado um webhook de conversa que já execute estes pedidos.

## Organização técnica proposta

Fluxo: WhatsApp → n8n/recepção de eventos → identificação da conta → pedido persistido → interpretação e confirmação → cabeçalho escolhido → fotos aprovadas → adaptador do módulo no servidor → projeto e prévia → aprovação da versão → exportação → envio e recibos.

- **Entrada e entrega:** um adaptador do provedor recebe texto/anexos e envia respostas/mídia. Eventos repetidos são deduplicados pelo identificador do provedor. Ignorar mensagens próprias e eventos de grupos no piloto.
- **Conversa:** conserva pedido ativo, campos pendentes, escolhas de modelos e versão da prévia. Uma resposta como “sim” só vale quando houver uma pergunta ativa inequívoca para aquele pedido.
- **Pedido:** contém conta, tipo, briefing original, dados confirmados, referência/revisão do modelo, versão dos dados comerciais, arquivos autorizados, projeto de destino, jobs e aprovações.
- **Interpretação:** IA propõe dados estruturados e operações permitidas; validações do sistema decidem acesso, preços, formato, capacidade e transições. Arquivos e mensagens do cliente não concedem permissões.
- **Adaptadores:** cada módulo oferece catálogo, validação, criação, salvamento, prévia e exportação usando seus contratos atuais. Extrair serviços internos quando necessário; não simular sessão administrativa nem confiar em `userId` fornecido pelo cliente.
- **Execução:** persistir o pedido antes de confirmar recebimento; jobs duráveis com retomada após reinício. Reutilizar fila de vídeo; planejar jobs para render das demais peças e uma fila de saída com recibos.
- **Identidade:** perfil comercial compartilhado e congelado por versão da prévia. Mudanças em logo/cadastro/modelo não podem alterar silenciosamente a versão aprovada.

Estados sugeridos para criação: recebido → coletando dados → aguardando escolha do cabeçalho → aguardando confirmação dos dados → aguardando aprovação das fotos → montando prévia → aguardando aprovação final → exportando → pronto. As etapas podem receber dados antecipadamente, mas cada confirmação deve permanecer registrada. Estados de entrega separados: pendente → aceito pelo provedor → entregue, ou falha. Pedidos podem ser cancelados, bloqueados por dado faltante ou encaminhados ao atendimento.

Antes de propor migrações, inspecionar schema e estruturas existentes de pedidos, jobs, anexos e auditoria. As entidades acima são contratos propostos; nenhuma nova tabela é determinada ou criada neste planejamento.

## Regras de composição e aprovação

- Catálogo por tipo, tema, formato e acesso da conta. Exibir somente modelos publicados/autorizados. Modelos para vídeos têm movimento próprio; compartilhar o kit da campanha sem prometer transformação automática de qualquer imagem em vídeo.
- Textos, preços e condições permanecem elementos editáveis. IA de imagem pode preparar fundos e assets, sem substituir composição nativa dos dados comerciais.
- Não inventar marca, peso, validade, desconto ou preço. Mostrar pendências e bloquear a finalização quando afetarem a oferta.
- Capacidade pertence ao modelo. Para um modelo Story limitado a nove produtos, oferecer divisão em páginas ou outro modelo; não aplicar esse limite globalmente a todo Story.
- Troca de proporção exige composição e revisão próprias. Cartaz para impressão usa medida física e resolução verificadas; o preset A4 em pixels do Estúdio de Artes não garante qualidade de impressão.
- Aprovação registra pedido, versão, dados confirmados, projeto/revisão e arquivo/manifesto da prévia. Pedido duplicado ou reenvio de webhook não gera nova cobrança ou trabalho automaticamente.
- Vídeo: aprovar roteiro antes de gerar locução paga, permitir ouvir o áudio e aprovar a prévia final. Nova tentativa paga precisa de ação explícita; timeout exige reconciliação antes de reenviar.
- Guardar originais com acesso privado. Entrega usa arquivo ou link temporário autorizado; link de edição exige autenticação. Nunca publicar permanentemente assets privados para facilitar o envio.

## Sequência de implementação

1. **Preparar a criação interna:** selecionar poucos modelos reais de cada módulo; inventariar formatos, slots, capacidade e exportação; definir adaptadores compartilhados com o fluxo assistido do aplicativo. Validar salvamento, reabertura e prévia.
2. **Piloto WhatsApp de encartes:** n8n com agente OpenRouter barato, um número do JobVarejo, contas previamente vinculadas, texto/imagem/áudio, cabeçalhos enviados por tema, fotos de todos os produtos confirmadas, prévia, aprovação e PNG gerado no servidor. Começar por modelos preparados do editor usado pelos clientes; Builder é uma alternativa separada, não um destino automático.
3. **Artes do Estúdio:** conectar catálogo publicado, briefing institucional, composição Python, salvamento e PNG; medir fidelidade visual entre prévia, export e reabertura.
4. **Cartazes:** entrada de produtos, campos específicos das ofertas, tamanhos, cópias e PDF; validar escala física e paginação.
5. **Vídeos:** catálogo de movimento, roteiro, voz/música, acompanhamento de jobs, prévia e MP4; preservar a proteção contra geração paga duplicada.
6. **Expandir:** PDF, mais formatos/limites de anexos, vários materiais por campanha e correções conversacionais mais completas, conforme resultados do piloto.

Não atribuir prazo, custo por peça ou percentual de acerto antes de medir o piloto. A ordem proposta pode mudar se os testes dos renderizadores indicarem bloqueios; o render Python das artes oferece uma rota adicional já presente no código.

## Critérios de aceite do piloto

- Duas contas de teste: cada uma recebe somente seus projetos, logo e arquivos; conta bloqueada e número sem vínculo não acessam criação privada.
- Pelo menos um pedido real por tipo habilitado: dados confirmados → projeto persistido → reabertura → prévia → aprovação da versão → exportação → envio com ID do provedor e confirmação de entrega quando disponível.
- Foto faltante, produto ambíguo, excesso de ofertas e correção de preço têm tratamento visível e não produzem arquivo final incorreto.
- “Fecha Mês” envia somente cabeçalhos da campanha autorizados para a conta/formato; escolha numérica resolve o ID/revisão efetivamente enviado.
- Todas as fotos propostas aparecem na conferência. Corrigir um item não altera os demais; aprovação de conjunto antigo não libera render com fotos novas.
- Texto, imagem de lista, foto de embalagem e áudio em português chegam ao modelo/serviço de transcrição e são interpretados sem perder o vínculo à mensagem. Preço inaudível/ilegível exige confirmação.
- Medir acerto de marcas/pesos/preços/datas, fidelidade da transcrição, chamadas de ferramentas e custo do modelo em casos reais; suporte multimodal anunciado não substitui execução.
- Mensagem repetida, reinício do worker, evento fora de ordem e “aprovar” após alteração não duplicam pedidos, jobs ou envio de versão antiga.
- Falha de render/armazenamento/provedor não vira sucesso; reenvio de arquivo pronto não exige nova geração paga.
- Medir tempo até prévia/final, correções, custo de interpretação/geração/render/armazenamento/WhatsApp e custo por material aprovado.
- Antes de publicar código: verificações existentes pertinentes, typecheck, build e revisão proporcional dos controles de acesso e concorrência. Banco, deploy e envio real são validações adicionais.

## Próximo passo concreto

Inventariar uma seleção pequena de modelos de encarte e demonstrar o fluxo assistido dentro do JobVarejo com salvamento, reabertura, prévia e exportação. Depois conectar o WhatsApp a esse serviço, expandindo para os outros módulos pelas etapas acima.

Esta tarefa organizou o plano e verificou componentes por leitura local. Não ativou atendimento, enviou mensagens, criou mídia, alterou banco ou publicou código.
