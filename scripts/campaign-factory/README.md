---
name: campanhas-varejo
description: Criar novas campanhas de varejo completas no JobVarejo (modelo de encarte em 5 formatos, 8 cartazes do Cartazista, vídeo vertical e horizontal) com selos 3D, fundos e elementos baixados do Magnific via API. Use quando o usuário pedir novos modelos/campanhas de encarte, cartaz ou vídeo "como o Sextou", com selo 3D, logo/WhatsApp/endereço/data dinâmicos.
---

# Campanhas de varejo (encarte + cartaz + vídeo) com acervo Magnific

Fábrica versionada em `scripts/campaign-factory/` (lote de referência: 10 campanhas de 06/10/2026,
`output/campanhas-magnific-2026-10-06`). Responder sempre em pt-BR.

## Regras do usuário (obrigatórias)
- **Magnific: só download do acervo** (não consome crédito). **IA só quando o usuário pedir**, e então o modelo mais econômico (`simulate_cost` antes). Conferir saldo no fim (`mcp__magnific__account_balance`).
- Uso interno para clientes do usuário (não é SaaS público): pode baixar e reutilizar. **Tudo que vier do Magnific vira catálogo reutilizável** (Wasabi + manifesto) com procedência em `docs/video-studio/`.
- **Selo não pode repetir arte já existente no sistema** (o nome da campanha pode repetir). Comparar com todos os selos das receitas antes de usar (`existing.mjs` + `similar.mjs`; ≥ 0,9 = duplicado; conferir visualmente a folha `similar.jpg`).
- **Cada campanha com identidade própria** — nunca o mesmo desenho só trocando cor. A referência que o usuário mostrar é inspiração, não molde.
- Qualidade de referência = **Sextou de Ofertas**: selo grande (~60% da largura no cabeçalho), fundo cheio estilo varejo (luz, faixas, confete, elementos 3D), nada de espaço vazio.
- **Logo sem quadro/cartão branco**: logo livre, respeitando a preferência de logo do perfil (sem fundo / contorno sticker / fundo próprio). O modelo usa padrão contorno sticker branco; a preferência do cliente sobrescreve.
- Instagram só (sem Facebook); logo, Instagram, WhatsApp, endereço, cartões e validade dinâmicos; datas centralizadas.
- Cartazes **seguem o padrão do Cartazista** (modelo padrão com fonte de pincel, A1–A7 + Faixa 2 m, cabeçalho `thematic-seal`), gerados pelo próprio código do app.
- **Piloto antes do lote**: gerar 1–2 campanhas, mostrar folhas (encartes, cartazes, quadros de vídeo + MP4) e só gravar na conta após aprovação.

## Passo a passo
1. **Lote novo**: `bash scripts/campaign-factory/init.sh campanhas-<tema>-AAAA-MM-DD` (copia scripts, troca caminhos, instala `ag-psd`, compila `runtime.mjs`). Rodar comandos de busca/download dentro da pasta do lote com `node --env-file=../../.env`.
2. **Buscar selos** (API `GET /v1/resources`, header `x-magnific-api-key`, filtro `filters[content_type][psd]=1`): `node scan.mjs "selo 3d para composição" "selo 3d oferta" ...` → `node sheet.mjs scan.json sheet-seals.jpg 64 "<regex de exclusão>"` e olhar a folha. Preferir PSD "para composição" (fundo transparente).
3. **Baixar e extrair**: `download.mjs <ids>` (`/v1/resources/{id}/download/psd`) → `inspect.mjs <id>` (árvore de camadas) → `extract.mjs <id>` (camada do selo; nomes conhecidos em `LAYER`, `"Nome#n"` para camadas repetidas; `SRC=el-raw DEST=elements` para elementos). Em zsh, listas de IDs dentro de `bash -c '...'`.
4. **Checar duplicidade**: `node --env-file=../../.env existing.mjs` (uma vez) → `node similar.mjs seals/*.png` → descartar duplicados.
5. **Elementos 3D** (cubos %, moedas, presente, raio, estrela, sacola, carrinho, megafone): `scan2.mjs <saida> psd <termos>` + `download-el.mjs` + `extract.mjs`. Cubos vermelhos recoloridos por `hue` viram azul/verde/roxo/laranja.
6. **Overlays e loops de vídeo**: `scan-video.mjs` (`/v1/videos`) → `download-video.mjs <ids>` (escolhe a opção MP4 H.264 maior via `/v1/videos/{id}/options/{option-id}/download`; evita o .mov ProRes). Overlays usados: confete dourado 3964557 e partículas 9031541 (mistura screen).
7. **Definir campanhas em `campaigns.mjs`**: `CAMPAIGNS` (slug, nome, selo, música da biblioteca `lib-magnific-*`), `PALETTES`, `DECOR` (elementos por campanha), `LOOK` (estilo + layout) e `VIDEO_FX` (transição + movimento) — **todos diferentes entre campanhas**.
   - Estilos (`design.mjs`): `swoosh`, `burst` (pop-art), `diagonal`, `wave`, `chevron`, `arch` (palco), `ribbon` (banner), `glam` (luxo dourado).
   - Layouts (`compose.mjs/layoutFor`): `left`, `right` (espelhado), `top` (selo centralizado; só para selos largos).
8. **Prévia rápida**: `node test/looks.mjs` (criar a pasta `test/`) mostra os 10 fundos com selo lado a lado — conferir variedade antes de renderizar.
9. **Gerar tudo**: `./run-all.sh` (prepare → fundo animado do vídeo → encartes → integração no catálogo → publicação no Wasabi → cartazes → vídeos). Folhas: `OUT=sheet-a.jpg node sheets.mjs <slugs>`.
10. **Testes**: `npx vitest run tests/video-studio tests/cartazista` e `node --test workers/video-studio/catalog-assets.test.mjs`.
11. **Gravar na conta (após aprovação)**, nesta ordem:
    - `REVISION=<n> node --env-file=.env <lote>/build.mjs` (revisão nova = chaves novas no Wasabi) → `node --env-file=.env <lote>/persist.mjs` (encartes; cria ou atualiza).
    - `node <lote>/render-video.mjs --doc` por campanha (`SLUG=`) e depois `node --env-file=.env <lote>/persist-extras.mjs` (8 cartazes + projeto de vídeo + 2 renders + vínculo no `template_config`). Esta etapa complementa o `template_config`, então roda sempre depois do `persist.mjs`.
12. **Encerrar**: saldo Magnific inalterado, procedência atualizada, entregar pasta `entrega/` com folhas e MP4.

## Armadilhas já resolvidas
- `migrate-catalog-to-wasabi.mjs --archive` **move** os arquivos de `public/video-studio/templates` para `output/video-studio-catalog-source/`; `render-posters.mjs` serve os arquivados.
- Raios girando no vídeo: PNG cinza sobre preto (sem alfa) + `blend=screen`; com alfa o `rotate` vira branco chapado.
- Estrela fixa atrás do selo só no encarte (no vídeo o selo se move).
- Efeito de fogo da receita (`fire-jets`) exige `retail-fire-curtain-v1.png`; o worker já inclui assets pela atmosfera da receita.
- Layout `top`: manter selo com y ≥ 56 (margem do zoom) e logo acima da validade (testes de `personalization`/`flyer-recipes`).
- Faixa de validade do vídeo usa `ribbonColors` da receita (padrão vermelho do Sextou).
- O renderizador de prévia aplica a preferência de logo do perfil só na imagem; o JSON salvo mantém os padrões do modelo.

## Dependências locais (não versionadas)
Doador de objetos dinâmicos `output/operacao-fecha-mes-reference-2026-10-01/*.json`, fotos de produtos de exemplo
`output/rodrigues-carrinho-cheio-2026-10-05/`, logo de exemplo `output/sextou-ofertas-rodrigues-2026-10-05/video/out/brand-logo.png`.
Se faltarem, gerar de novo a partir de um modelo existente da conta antes de rodar.
