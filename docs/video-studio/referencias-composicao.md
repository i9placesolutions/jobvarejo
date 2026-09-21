# Referências de composição de varejo

Revisão local de 20/09/2026. Referências fornecidas pelo usuário, consultadas no navegador; não foram importados os assets, logos ou trilhas de terceiros.

- https://www.instagram.com/p/DTO4LuEkYTr/ — abertura Janeiro Imbatível com selo grande, validade acima e marca abaixo; oferta com embalagem grande, nome em área adjacente, preço à frente da lateral da embalagem; fechamento com marca, rede social e WhatsApp. Partículas permanecem atrás dos elementos comerciais. Referência observada em reprodução e pausada na oferta de feijão.
- https://www.instagram.com/propaganda_de_supermercados/ — perfil e grade consultados; fonte de direção visual indicada pelo usuário.
- https://www.instagram.com/p/DcoG6RiRT-K/ — oferta de Chopp Ecobier observada em reprodução: duas embalagens em alturas diferentes, etiqueta grande sobre a parte inferior/lateral do produto, nome à direita, selo no topo e marca junto da validade. Confirma a sobreposição intencional da etiqueta, sem nome atravessando a embalagem.

## Aplicação no catálogo

Nome sempre fora da imagem. Embalagem pode passar por trás da etiqueta, que mantém precedência visual e números compactos. Reels preserva duas cópias quando a embalagem é estreita. TV usa três cópias com entradas distintas, a central maior e à frente das laterais, preenchendo uma área comercial larga. Selo e marca ocupam área lateral própria no formato TV, com variações de lado e posição do preço. Produtos largos ou duplicação desativada preservam uma única imagem grande. Duplicar a foto não altera preço, quantidade ou unidade da oferta.

A revisão 11 preserva a montagem aprovada com três embalagens na TV e baixa a etiqueta para a base do produto. A validade fica no rodapé abaixo da etiqueta, pequena e com margem para os movimentos da câmera; a condição mantém área própria. A edição permite deslocamento, escala, rotação e visibilidade por cena/formato, além de uma, duas ou três cópias com redistribuição automática. MP4s de revisões anteriores não comprovam a montagem atual. A conclusão do lote deve ser demonstrada por 102 jobs da revisão correspondente prontos e 204 registros no verificador de exportação.

Os 100 selos rasterizados têm cópias derivadas com trim e 3 px de margem transparente, preservando os arquivos de origem. Dois modelos usam título nativo. CanvasImage respeita a proporção real do selo; a abertura TV usa uma área de 1480 × 900 px.

As fontes locais são carregadas com FontFace e a captura aguarda useDelayRender, para estabilizar os textos. O preço e o R$ usam curvas vetoriais das mesmas fontes locais: isso elimina a divergência de métricas do texto SVG durante a entrada animada. A espera da fonte isoladamente não resolveu esse defeito; a revisão 11 usa curvas.

A revisão 12 encerra todos os modos de câmera após 24 frames da entrada, mantendo shake global apenas no impacto e nas transições. O preço fica imóvel durante a leitura, enquanto o fundo continua animado. Na abertura vertical, a logo fica 24 px abaixo do limite visual do selo, calculado pela proporção da imagem sem margens. Gravação do usuário confirmou variação indevida dos glifos no MP4 antigo; o preço vetorial evita essa alteração.

## Fluxo de revisão antes do lote final

Em 20/09/2026 o usuário decidiu deixar a renderização completa para o final. A publicação de modelos deve ocorrer sem `--render`. Revisar composições na prévia em Reels e TV, conferindo abertura, produtos, preço, validade e fechamento; usar apenas clipes curtos para confirmar movimentos e áudio quando necessário. Os 102 modelos permanecem editáveis no catálogo.

O lote final só deve ser retomado depois da aprovação dos modelos da revisão vigente. O script exige `--render --approved-review`; a opção confirma uma aprovação já recebida, não a substitui. Se o ledger ainda corresponder à revisão aprovada, usar também `--resume` para reaproveitar exportações concluídas. Preservar os MP4s existentes. Novas alterações invalidam a aprovação da revisão modificada. Workers continuam disponíveis para testes pontuais; parar o publicador suspende a alimentação automática do lote, sem interromper os jobs já iniciados.

## Revisão 13 — catálogo completo conferido

Conferidos os 204 quadros de oferta (102 modelos × Reels/TV) em 12 pranchas. Os selos verticais e a logo inferior ganharam margem segura para o overscan da câmera. As duas campanhas com título nativo agora calculam tamanho e distância da logo pelas linhas efetivamente renderizadas. Preservadas as etiquetas cadastradas e a estabilidade do preço durante a leitura.

Amostragem de movimento: 16 clipes curtos cobrem oito entradas/transições nos dois formatos; 65 quadros adicionais cobrem aberturas, tela de logo TV e fechamentos de 11 famílias e dois modelos de texto nativo. As correções dos dois títulos foram conferidas novamente em ambos os formatos. Não equivale a inspecionar cada frame de 204 MP4s finais. As 102 músicas têm áudio válido; isso não representa audição integral de todas as faixas.

Galeria local: `output/video-all-models/review-v13/review.html`, gerada por `build-review-gallery.mjs`. Skill do projeto: `.agents/skills/jobvarejo-video-retail/SKILL.md`. Build e 161 testes do módulo passaram; typecheck geral continua bloqueado pelo erro preexistente `cloneReady` em `pages/admin/musicgpt.vue`. Exportação final permanece suspensa para revisão do usuário.
