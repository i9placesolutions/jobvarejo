# Varredura de carregamento e prévia de vídeo — 09/10/2026

## Escopo e evidências

A tela enviada corresponde ao modal de `/videos`, modelo **Impacto de Oferta**. Inspeção do Safari em produção confirmou o player visível enquanto **Fechar prévia** e **Usar modelo** permaneciam desabilitados. Foram inspecionados o bootstrap da página, montagem Vue/React/Remotion, preparação de mídia, logo, efeitos, entrega dos arquivos de catálogo, limites Redis e bundle client.

As correções abaixo são locais. Não houve alteração de banco, storage, credenciais, deploy ou publicação. As alterações preexistentes em EditorCanvas e helpers de etiquetas foram preservadas.

## Gargalos corrigidos

1. **Modal aguardava dados de todo o editor.** `prepareModel` chamava `loadEditorData`, aguardando etiquetas, saúde do worker, imagens, músicas, vozes e projetos-fonte. Uma requisição lenta mantinha o estado `busy` e bloqueava até fechar a prévia. Agora esse carregamento ocorre ao entrar no editor. Modelos com ofertas continuam carregando suas etiquetas em segundo plano; modelos sem ofertas não precisam delas.
2. **Imagens originais grandes na galeria e prévia.** O catálogo passa a oferecer uma variante WebP com lado máximo de 1280 px, transparência preservada, ETag próprio, cache em memória de até 32 MiB, compartilhamento de requisições concorrentes e no máximo duas conversões simultâneas. Apenas caminhos públicos presentes no manifesto são aceitos. Falhas voltam ao original sem guardar o redirecionamento. Vídeos/áudios mantêm o streaming e Range; exportações continuam com as URLs originais.
3. **Contorno da logo repetido entre cenas e loops.** Cada montagem gerava novamente uma imagem de até 1400 px, com 40 desenhos da máscara e preenchimento de pixels. Cache limitado a oito fontes compartilha a mesma promessa e resultado. Uma falha pode ser tentada novamente. A produção dos pixels não mudou.

Os originais dos primeiros 12 modelos referenciam 22 imagens distintas que somam **42.923.518 bytes** no manifesto. É o volume potencial desses arquivos, não uma captura de transferência: cache e lazy loading influenciam o download real.

## Medições

| Amostra | Antes | Depois |
|---|---:|---:|
| Fundo do modelo | 1.783.628 bytes, 1080×1920 | 47.428 bytes, 720×1280 |
| Selo do modelo | 2.432.396 bytes, 1295×1110 | 297.832 bytes, 1280×1097 |
| Total fundo + selo | 4.216.024 bytes | 345.260 bytes (**−91,8%**) |
| Logo sintética, 3 preparações no navegador | 639,5 / 611,6 / 590,8 ms | 558,3 / <0,1 / <0,1 ms |

Os seis resultados da logo tiveram data URLs idênticas. A primeira preparação ainda exige trabalho; o ganho se aplica à reutilização, sem alegação de reduzir esse custo a zero.

Em três GETs locais do fundo, o original levou 26.151 / 9.166 / 3.899 ms; a variante **já aquecida** levou 43 / 21 / 14 ms. O servidor original lê Wasabi; a variante aquecida usa memória. Build/typecheck estavam concorrendo nesta máquina. Esses tempos não devem ser apresentados como ganho percentual de toda a página ou de produção. Uma medição pública independente do fundo original foi 2,403 s.

## Verificações e limites

- 536 testes passaram na suíte de vídeo e utilitários do catálogo; mais 5 testes da rota passaram (541 total nesta rodada).
- Testes cobrem transparência, dimensões, deduplicação, limite de concorrência, orçamento de memória, retentativa, LRU da logo, ETag/304, Range/206 do original, WebM e rejeição de caminhos fora do manifesto.
- Inspeção visual local da composição real com marca sintética, sem locução/música na bancada: fundo e selo completos, imagens WebP decodificadas nas dimensões esperadas. Não foi usado login de outra conta nem copiada a sessão do Safari.
- O maior chunk do build anterior era 459 KiB, abaixo do limite de 500 KiB. O client do build atual passou no mesmo gate: 460 KiB / limite 500 KiB. `npm run typecheck` concluiu com código 0. `npm run build` concluiu com código 0; Nitro informou 47,6 MB (14 MB gzip). `npm run check:bundle` também concluiu: 55 MiB em disco / limite 250 MiB; a recompilação limpa passou e o gate client foi repetido em sua saída (460 KiB / 500 KiB).
- As amostras de reprodução durante a compilação mediram 23,55 e 16,37 atualizações/s (30 e 71 quadros pulados). Houve tarefas longas entre 50 e 145 ms. A amostra posterior de 28,92 atualizações/s foi invalidada: logs mostraram fontes/efeito ausentes após o servidor local parar durante a limpeza de build. Servidor local restaurado e nova execução com semente fixa, imagens/efeitos carregados, três fontes confirmadas e nenhum erro de mídia: **28,59 atualizações/s durante 6,016 s, 5 quadros pulados e nenhuma tarefa longa**. **Ainda não comprova 30 fps estáveis nem a fluidez do Safari em produção.**
- O modo `fastPreview` e a espera pela decodificação das imagens dos produtos já existiam; foram preservados. Redis já tinha timeout de comando de 2 s e fila offline desativada; não foi alterado sem evidência de falha.

Durante a investigação, a máquina de 16 GiB apresentou 14.714 MiB de swap em uso (`sysctl`), contexto adicional para a variação dos tempos locais. Isso não identifica, por si só, a causa da lentidão em produção.

A conversão custa CPU e leitura de storage na primeira requisição após iniciar o servidor. A fila limitada e o cache evitam repetir esse trabalho a cada usuário.

## Evidências locais

`output/performance-audit/`: bancada no navegador, cópia da geração de logo anterior, `media-benchmark.json`, `http-benchmark.json`, logs de testes, typecheck e build. A pasta é ignorada pelo Git e não contém credenciais.
