# Auditoria Completa do QROfertas Builder V2

Data da auditoria: 2026-04-07  
URL auditada: `https://cdn.qrofertas.com/criar-jornal/builder-v2/`  
Base documental comparada: [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md)  
Artefato empacotado comparado: [qrofertas-builder-v2.skill](/workspace/projetos/jobvarejo/qrofertas-builder-v2.skill)

## Escopo

Esta auditoria cobre:

- inventário funcional do builder ao vivo
- views expostas no HTML/JS
- fluxos visíveis e fluxos ocultos
- modelos, grades, opções de preço e módulos de produto
- pipeline de render, download e publicação
- endpoints de serviço expostos na aplicação
- comparação entre o produto vivo e o conteúdo de [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md)
- relação entre o produto externo e os arquivos reais do repo local

## Método

A auditoria foi feita com:

- fetch completo da página inicial do builder ao vivo
- inspeção do HTML/JS retornado pela aplicação
- carregamento de views internas por `?view=...` quando a operação parecia segura
- validação textual das telas retornadas
- leitura comparativa de [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md)
- leitura comparativa de [pages/ESPECIFICACAO_QROFERTAS.md](/workspace/projetos/jobvarejo/pages/ESPECIFICACAO_QROFERTAS.md)
- leitura de arquivos do builder local no repo

## Nível de confiança

- `Confirmado ao vivo`: texto, estrutura ou fluxo vistos diretamente na resposta do builder ao vivo.
- `Confirmado no source`: encontrado claramente no HTML/JS da aplicação, mesmo sem execução ponta a ponta.
- `Parcial / depende de contexto`: a feature existe, mas a execução completa exige produto, arte, tabela, sessão ou permissão específica.
- `Não reexecutado por risco de efeito colateral`: a rota parece mutar estado remoto e não foi insistida nesta passada.

## Resumo executivo

O builder vivo é maior do que o [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) descreve. O documento atual cobre bem a navegação principal e os fluxos mais comuns, mas deixa de fora uma parte relevante da operação real:

- o builder expõe `33` views distintas
- o builder expõe pelo menos `27` endpoints de serviço relevantes
- existem `13` modelos confirmados
- existem `28` grades confirmadas
- existem `9` modos de preço confirmados
- o módulo de produtos é mais profundo do que a documentação atual mostra
- há um pipeline assíncrono de render, snapshot, download e publicação não detalhado no arquivo
- existe uma base de ajuda interna (`qr-academy`) que o documento não menciona
- existem telas adicionais de portal, interesses, formas de pagamento e modais avançados por produto ausentes na documentação

## Base documental atual

- [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) tem `575` linhas e `3876` palavras.
- O conteúdo de [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) é byte a byte idêntico ao `SKILL.md` dentro de [qrofertas-builder-v2.skill](/workspace/projetos/jobvarejo/qrofertas-builder-v2.skill).
- Já existe uma especificação paralela em [pages/ESPECIFICACAO_QROFERTAS.md](/workspace/projetos/jobvarejo/pages/ESPECIFICACAO_QROFERTAS.md), o que aumenta o risco de drift documental.

## Arquitetura visível confirmada

O builder ao vivo confirma a divisão principal descrita em [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md:14):

- menu lateral esquerdo com `9` seções visíveis
- barra de ferramentas superior para modelo, grade e ajustes globais
- área central de render/preview do encarte
- editor detalhado de produtos e modais avançados acionados do canvas/lista

## Menu lateral visível confirmado

Views visíveis no menu lateral:

| Ordem | Rótulo | View |
|---|---|---|
| 1 | Produtos | `editar-produtos` |
| 2 | Temas | `escolher-tema` |
| 3 | Datas | `definir-regras` |
| 4 | Sua Logo | `personalizar` |
| 5 | Empresa | `empresa` |
| 6 | Fontes | `escolher-fontes` |
| 7 | Postar | `sugestao-de-post` |
| 8 | Encarte | `dados-sobre-o-encarte` |
| 9 | Portal | `config-portal` |

## Inventário completo de views

Views expostas na aplicação:

| View | Status | Observação |
|---|---|---|
| `config-portal` | Confirmado ao vivo | Configuração de portal, slug, CEP e segmento. |
| `dados-sobre-o-encarte` | Confirmado ao vivo | Nome, observações e categoria do encarte. |
| `definir-regras` | Confirmado ao vivo | Datas, avisos legais, frase promocional e toggle de publicação no portal. |
| `editar-formas-de-pagamento` | Confirmado ao vivo | Lista extensa de meios e bandeiras aceitas. |
| `editar-produtos` | Confirmado ao vivo | Busca, criação, colagem em massa e edição de produtos. |
| `empresa` | Confirmado ao vivo | Toggles de dados da empresa. |
| `empresa-portal` | Confirmado ao vivo | Onboarding/configuração da empresa no portal. |
| `escolher-bubble-destaque` | Confirmado ao vivo | Escolha do balão de desconto. |
| `escolher-destaque` | Confirmado ao vivo | Cor/fundo/destaque do card do produto. |
| `escolher-destaque-tabela` | Confirmado no source | Variante de destaque para layout de tabela. |
| `escolher-etiqueta-destaque` | Confirmado ao vivo | Etiquetas e tamanho relativo de preço. |
| `escolher-fontes` | Confirmado ao vivo | Seleção de fontes e filtros. |
| `escolher-fontes-filtrar` | Confirmado ao vivo | Resposta incremental para filtrar fontes. |
| `escolher-interesses` | Confirmado ao vivo | Segmentos/interesses para recomendação de temas. |
| `escolher-layout-produto-render-v2` | Confirmado ao vivo | Resposta auxiliar de layout renderizado. |
| `escolher-layout-produto-v2` | Confirmado ao vivo | Tipos de box e image type por produto. |
| `escolher-tema` | Confirmado ao vivo | Galeria de temas, novos temas e busca. |
| `load-preview-modelos` | Confirmado ao vivo | Biblioteca de modelos com exemplos. |
| `modal-estruturas-de-titulo` | Confirmado ao vivo | Distribuição, destaque, cores e estilo do título. |
| `modal-opcoes-de-preco` | Confirmado ao vivo | Os 9 modos de preço. |
| `modal-opcoes-de-preco-tabela` | Parcial / depende de contexto | Sem contexto suficiente, retornou `Erro / Tente Novamente`. |
| `personalizar` | Confirmado ao vivo | Upload da logo. |
| `pesquisando-produtos` | Parcial / depende de contexto | Carregado isoladamente retornou `Erro / Tente Novamente`; existe em tutoriais. |
| `pesquisar-temas` | Confirmado ao vivo | Agenda de marketing e temas gratuitos/premium. |
| `produtos-estilos-cartaz` | Confirmado ao vivo | QRCODE, etiqueta, rodapé e economia de tinta. |
| `qr-academy` | Confirmado ao vivo | Central interna de suporte/tutorial. |
| `render-arte` | Confirmado ao vivo | Render com upsell premium e seleção de modelo/grade. |
| `render-arte-clean` | Confirmado ao vivo | Render “clean” usado para atualização e export. |
| `selecionar-arte-pronta` | Não reexecutado por risco de efeito colateral | Em teste anterior respondeu `Arte clonada com sucesso`, indicando mutação de estado. |
| `snapshot` | Confirmado no source | Chamado por `upload_encarte()` antes de exportação/download. |
| `solicitar-temas` | Confirmado ao vivo | Fila de solicitação e votação de campanhas/temas. |
| `sugestao-de-post` | Confirmado ao vivo | Texto acessível para redes sociais. |
| `sugestao-de-post-raw` | Confirmado ao vivo | Resposta bruta do texto social. |

## Modelos confirmados

Modelos confirmados no builder vivo:

1. Encarte feed facebook quadrado
2. Formato para status e stories
3. Formato feed/reels instagram
4. Vídeo tabela rede social
5. Encarte grande para impressão
6. Encarte a4 para impressão
7. Encarte a4 horizontal para impressão
8. Cartaz a4 vertical para impressão
9. Cartaz a4 horizontal para impressão
10. Formato para tv horizontal
11. Formato para tv vertical
12. Vídeo tabela tv horizontal
13. Vídeo tabela tv vertical

## Grades confirmadas

Grades confirmadas no builder vivo:

1. 2 Produtos - 2x1
2. 3 Produtos - 3x1
3. 4 Produtos - 2x2
4. 5 Produtos - 4 produtos + 1 destaque Esquerdo
5. 5 Produtos - 4 produtos + 1 destaque Direito
6. 6 Produtos - 3x2
7. 6 Produtos - 4 produtos + 2 destaques laterais
8. 7 Produtos - 3 Destaques no topo e 4 produtos
9. 7 Produtos - 4 produtos e 3 destaques em baixo
10. 7 Produtos - 1 destaque lateral + 6 produtos
11. 8 Produtos - 4x2
12. 8 Produtos - 3x2 3 destaques no topo e 5 produtos
13. 8 Produtos - 5 produtos e 3 destaques em baixo
14. 9 Produtos - 3x3
15. 10 Produtos - 1 destaque lateral + 9 produtos
16. 11 Produtos - 3x4 com destaque central com 11 produtos
17. 11 Produtos - 3 destaque topo + 8 produtos
18. 12 Produtos - 8 produtos e 4 destaques no topo
19. 12 Produtos - 4x3
20. 12 Produtos - 4x3 8 produtos e 4 destaques em baixo
21. 13 Produtos - 1 destaque + 4x3
22. 14 Produtos - 2 destaques + 4x3
23. 14 Produtos - 3x5 13 produtos e 1 destaque em baixo no centro
24. 14 Produtos - 3x5 13 produtos e 1 destaque em cima no centro
25. 18 Produtos - 4x3 14 produtos e 4 destaques em baixo
26. 18 Produtos - 4x3 4 Destaques no topo e 14 produtos
27. 10 Produtos - TABELA de 10 produtos
28. 20 Produtos - TABELA de 20 produtos

## Ajustes globais confirmados

A barra superior e o render confirmam os seguintes ajustes globais:

- Boxes de Produtos: `Padrão`, `Inteligente`
- Texto: `Texto Maior Possível`, `Texto mínimo`, `Texto médio`
- Cores: `Padrão`, `Inteligente`
- Rodapé: `Redondo Grande`, `Quadrado Grande`, `Quadrado Compacto`
- Zoom: `Auto`, `30%`, `40%`, `50%`, `60%`, `70%`, `80%`, `90%`, `100%`
- `Modo Leve`
- Download

## Módulo de produtos: auditoria funcional

O módulo de produtos é o coração do sistema e é mais rico do que [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md:311) documenta.

Funcionalidades confirmadas:

- busca de produtos por nome
- indicação de uso por código de barras
- colagem em massa de lista textual
- criação rápida de produtos
- listagem de `Meus Produtos`
- edição individual persistida por `pem_id`
- edição de:
  - nome
  - preço de oferta
  - preço normal
  - limite
  - unidade
  - observação
  - maioridade `18+`
- reordenação de produtos
- remoção de produto
- adição/remoção com atualização do render
- modal de modos de preço
- etiqueta de preço
- balão de desconto
- cor de fundo do card
- estrutura de título
- layout estrutural do card
- fixar preço
- edição/seleção de imagem do produto
- busca assíncrona de imagens
- upload de imagem
- opção de remover fundo da imagem
- request de imagem local
- editor visual de imagem via `api-image-builder`

Detalhes técnicos confirmados no source:

- a identidade operacional do item usa `pem_id`
- há sincronização entre lista lateral e render principal
- várias mudanças fazem `update_render()` imediato
- existe separação entre operações em produto, tabela e arte
- a UI possui ramificações para produto comum, destaque e tabela

## Modos de preço confirmados

Os 9 modos de preço confirmados na view `modal-opcoes-de-preco` são:

1. Preço Simples
2. Preço normal e Preço de oferta
3. Preço X por Y
4. Preço Leve X pague Y
5. Preço À vista e Parcelado
6. Preço Simbólico
7. Preço clube ou `Nome do programa` e preço normal
8. Antecipação de Ofertas
9. Sem Etiqueta

## Imagem e mídia do produto

Fluxos confirmados:

- busca automática e polling de imagens por `/services/api-search-images/`
- upload do produto por `/services/api-produtos-image-upload/`
- suporte a remoção de fundo no upload
- seleção de imagem local do produto
- editor de imagem em overlay via `/services/api-image-builder/`
- troca da imagem no preview do produto e no render do encarte

## Datas, regras e avisos

A view `definir-regras` confirma:

- Data de Inicio
- Data Final
- Mostrar datas
- Enquanto durarem os estoques
- Imagens Meramente Ilustrativas
- Advertência Medicamento
- Mostrar Percentual de desconto
- Mostrar Frase Promocional
- Frase Promocional
- Publicar este encarte no portal?

Observação crítica:

- `Mostrar Percentual de desconto` existe no builder vivo e não está documentado em [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md:76).

## Empresa, portal e formas de pagamento

Views confirmadas:

- `empresa`: toggles de telefone, WhatsApp, nome da empresa, slogan, formas de pagamento, observação de pagamento, endereço, Instagram, Facebook e website
- `config-portal`: nome para URL, CEP e segmento
- `empresa-portal`: onboarding mais completo para publicação no portal
- `editar-formas-de-pagamento`: vários meios de pagamento e bandeiras, incluindo Pix, crédito, débito, alimentação, refeição e bandeiras diversas

## Temas, interesses e agenda

Fluxos confirmados:

- galeria principal de temas
- bloco de novos temas
- temas premium e grátis
- busca de temas
- agenda de marketing
- interesses/segmentos para recomendar temas
- fila de solicitação de novos temas com votos

## Texto social e acessibilidade

O builder vivo confirma:

- tela `sugestao-de-post` com texto para redes sociais
- foco explícito em acessibilidade
- marcação `#PraCegoVer`
- versão `raw` do texto social

## QR Academy

A central de ajuda `qr-academy` é parte real do produto e não aparece em [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md).

Categorias confirmadas:

- Encartes, Cartazes e Mídia TV
- Assinatura e pagamentos
- Editar Produto
- Temas
- Produto
- Alerta e Observações
- Grades
- Aparência
- Fontes
- Datas e Informações
- Marketing e acessibilidade
- Logo
- Dúvidas
- Modelos
- Dados da empresa
- Anotações
- Meus Encartes
- Cartaz
- Etiquetas
- Portal
- Impressão

Exemplos de tutoriais confirmados:

- adicionar produto usando imagem
- mudar ordem dos produtos
- usar preço à vista e parcelado
- usar preço club
- usar preço simbólico
- trocar opção de preço
- trocar imagem do produto
- trocar preço, nome e unidade
- usar observações e alerta 18+
- pesquisar produto por nome ou código de barras

## Download, snapshot, render e publicação

Pipeline confirmado:

- `upload_encarte()` chama `?view=snapshot`
- `prepareDownload()` decide entre render local e render remoto
- render remoto é acionado em iOS, mobile, PDF, TV, `Modo Leve` ou `remote_render`
- render remoto usa `/services/api-job_artes_render`
- publicação/agendamento usa `/services/api-job_artes_render_v2`
- monitoramento de jobs acompanha status e libera download ao concluir
- existe modal pós-publicação com estados para:
  - Redes Sociais
  - Portal de Ofertas
  - QR TV Indoor
- existe publicação/despublicação de arte base por `/services/api-publicar-arte-base/`
- existem ações de agendamento e cancelamento de publicação

## Endpoints de serviço confirmados

Endpoints expostos ou claramente referenciados:

- `/services/api-empresa-fields/`
- `/services/api-events`
- `/services/api-image-builder/`
- `/services/api-job_artes_render`
- `/services/api-job_artes_render_v2`
- `/services/api-list-temas`
- `/services/api-narracao`
- `/services/api-produtos`
- `/services/api-produtos-create/`
- `/services/api-produtos-field/`
- `/services/api-produtos-image-upload/`
- `/services/api-produtos-manage/`
- `/services/api-publicar-arte-base/`
- `/services/api-search-images/`
- `/services/api-tabela-de-precos/?view=modal-opcoes-de-preco-tabela`
- `/services/api-tabela-fields/`
- `/services/api-temas-fields/`
- `/services/api-usuario`
- `/services/api-usuario-image-logo-upload/`
- `/services/check_is_valid_cep/`
- `/services/check_is_valid_emp_nome/`

## Divergências e lacunas em qroferta.md

Pontos que o documento cobre bem:

- menu lateral principal
- modelos e grades principais
- fluxo geral de edição
- modos de preço
- editor de imagem em alto nível
- download/publicação em alto nível
- fluxos recomendados

Pontos ausentes ou incompletos:

- `Mostrar Percentual de desconto` em `definir-regras`
- `editar-formas-de-pagamento`
- `empresa-portal`
- `escolher-interesses`
- `qr-academy`
- `escolher-destaque`
- `escolher-destaque-tabela`
- `escolher-etiqueta-destaque`
- `escolher-bubble-destaque`
- `modal-estruturas-de-titulo`
- `escolher-layout-produto-v2`
- `escolher-layout-produto-render-v2`
- `render-arte-clean`
- `snapshot`
- diferenças de contexto entre produto comum e tabela
- parte do pipeline assíncrono de render e publicação

Ambiguidades:

- `Publicar este encarte no portal?` aparece em mais de um ponto do documento, sem separar claramente regra local de publicação versus configuração de portal.

Afirmações frágeis para um `SKILL.md`:

- “principal editor de encartes promocionais para varejo do Brasil” em [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md:8)
- “disclaimer legal obrigatório” e “obrigatório por lei” em [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md:87)

Essas afirmações deveriam ser classificadas como:

- `validado com fonte`
- `inferido`
- `recomendação operacional`

## Relação com o repo local

O repo local já tem componentes que reinterpretam partes relevantes do QROfertas:

- [BuilderSidebar.vue](/workspace/projetos/jobvarejo/components/builder/BuilderSidebar.vue)
- [BuilderPriceOptionsModal.vue](/workspace/projetos/jobvarejo/components/builder/BuilderPriceOptionsModal.vue)
- [BuilderProductEditorCard.vue](/workspace/projetos/jobvarejo/components/builder/BuilderProductEditorCard.vue)
- [BuilderExportDialog.vue](/workspace/projetos/jobvarejo/components/builder/BuilderExportDialog.vue)
- [useBuilderSocialText.ts](/workspace/projetos/jobvarejo/composables/useBuilderSocialText.ts)

Isso significa:

- o repo local não depende apenas do texto de [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md)
- já existe uma tradução parcial do produto externo para a implementação interna
- usar [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) como única “fonte da verdade” tende a gerar drift

## Classificação final do qroferta.md

Como documentação de produto:

- cobertura: alta
- utilidade para onboarding humano: alta
- aderência ao builder vivo: boa, mas incompleta

Como `SKILL.md` operacional para Codex:

- escopo: amplo demais
- acionamento: agressivo demais
- instruções operacionais: insuficientes
- acoplamento com arquivos reais do repo: baixo
- rastreabilidade de fonte: baixa

## Veredito

Conclusão final:

- [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) não é “falso”; ele descreve bastante coisa real do builder
- mas ele não é completo o suficiente para sustentar a afirmação de “TODAS as funcionalidades”
- ele é melhor como base de referência do produto do que como skill final do agente

Forma recomendada de reorganização:

- manter um `SKILL.md` curto e operacional
- mover o inventário detalhado da UI para referências
- manter uma auditoria viva por data
- ligar a skill aos arquivos reais do repo e não só à interface externa

## Limitações honestas desta auditoria

Esta auditoria é exaustiva em descoberta estrutural e cobertura funcional exposta, mas não executa manualmente cada mutação ponta a ponta com uma conta operacional real. Em especial:

- algumas views exigem contexto específico de tabela/produto/arte
- algumas rotas parecem mutar estado remoto
- não forcei fluxos potencialmente destrutivos ou dependentes de publicação real

Mesmo com essa limitação, o inventário acima é suficiente para dizer com alta confiança o que o builder expõe, quais são seus módulos reais e onde [qroferta.md](/workspace/projetos/jobvarejo/qroferta.md) está completo, incompleto ou impreciso.
