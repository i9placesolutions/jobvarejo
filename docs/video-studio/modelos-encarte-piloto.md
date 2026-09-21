# Três modelos de encarte em vídeo

Receitas próprias em `shared/video-studio/flyer-recipes.ts`, renderizadas por `flyer-composition.ts`. Escolha pelo catálogo de `/videos`. O modelo Fecha Mês anterior permanece separado.

| Modelo de origem | Composição das ofertas | Linguagem |
| --- | --- | --- |
| Alerta de Oferta | Preço à esquerda da embalagem; selo e logo em áreas próprias | Sirene luminosa, faixas de alerta, disparo lateral, corte em persianas |
| Oferta Relâmpago — Azul | Produto à esquerda do preço; etiqueta com ponta angular | Raios, rastros laterais, corte diagonal |
| Saldão de Ofertas — Neon | Produto centralizado sobre faixa de preço | Arcos luminosos, partículas, subida das embalagens, chicote vertical |

Cada receita tem coordenadas independentes para TV e Reels/Stories. Os selos/fundos são os assets do encarte, copiados sem edição de pixels para `public/video-studio/templates/`. As etiquetas são as cadastradas, resolvidas somente no catálogo da conta: PRETA VERMELHA AMARELA no Alerta, preto/amarelo 3d no Relâmpago e Padrão no Saldão. O Saldão usa uma área compacta abaixo do produto. Não há etiqueta gráfica nova nesses modelos. O preço permanece dinâmico e a escolha explícita prevalece; se a etiqueta preferida não existe na conta, usa uma compatível disponível. Sem nenhuma etiqueta, a exportação é bloqueada com mensagem. Reflexos percorrem os selos; fundos têm camadas próprias e a biblioteca de atmosfera configurável.

Novos projetos recebem somente o estilo e a trilha instrumental. Marca, ofertas, validade e voz não fazem parte da receita compartilhada. A demonstração usa os dados do projeto aberto e data ilustrativa autorizada (20 a 27/09/2026), sem locução. Dados e assets privados continuam nos endpoints autenticados e não são colocados na pasta pública. As demonstrações não modificam os encartes de origem.

Para ampliar: conferir o modelo real e suas camadas, preparar assets, adicionar receita/tipos/schema, validar áreas e renderizar aberturas/ofertas/encerramentos nos dois formatos. A skill específica de vídeo continua pendente; este documento não se apresenta como uma skill instalada.

Scripts:
- `render-flyer-models.mjs --all-stills`: inspeção das duas aberturas, entrada e leitura dos produtos e encerramento.
- `publish-flyer-demos.mjs --create --render`: cria demonstrações na conta explicitamente selecionada por VIDEO_TEST_USER_ID e enfileira exportações pela API local; nunca executa em domínio remoto.
- `publish-flyer-demos.mjs --status` / `--download`: confere jobs e baixa resultados.

Sem alteração nos editores de imagem e Rádio Indoor. Não há conversão automática do restante do catálogo.
