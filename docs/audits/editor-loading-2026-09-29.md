# Abertura do editor — 29/09/2026

## Resultado local

- Catálogo carregado no boot: 3.057.674 bytes antes; 30.109 bytes depois, cerca de 99% menos na abertura autenticada do mesmo projeto.
- Referências anteriores: aproximadamente 4 s na primeira abertura e 3,67 s em uma reabertura. Reabertura final instrumentada: 2,10 s entre navigation timeOrigin e `Carregamento finalizado`.
- São observações do servidor de desenvolvimento com cache, sem ensaio controlado de cache frio nem medição de produção. Execuções durante HMR/build/typecheck concorrentes foram descartadas da comparação de tempo.
- Cache IndexedDB confirmado em páginas do projeto; versão do cache da página ativa igual ao timestamp do save confirmado. Outros clientes/edições podem invalidar entradas, como esperado.
- Comparação entre catálogo usado no boot e catálogo completo, sobre o mesmo canvas: 34 objetos e igualdade direta de todos os 3.092.580 bytes RGBA renderizados.

## Mudanças

1. `label-templates.get.ts` aceita IDs filtrados e omissão das prévias base64. GET padrão continua completo para consumidores existentes. `complete` sinaliza truncamento a 500 entradas, inclusive no fallback de schema legado. Autenticação, precedência pessoal/global e filtros SQL parametrizados preservados.
2. Editor consulta só IDs usados e a etiqueta padrão de fallback, em lotes com limites de quantidade e comprimento de URL. Snapshots de outras páginas permanecem elegíveis. Catálogo truncado não passa por catálogo completo; troca de usuário limpa estado e descarta respostas antigas.
3. Catálogo completo e rasterização de suas prévias ficam sob demanda nos seletores/revisão. Bibliotecas secundárias iniciam após a arte ficar pronta. Histórico de uploads da IA já é atualizado ao abrir o diálogo.
4. Cache de snapshots remotos em IndexedDB, separado de drafts: usuário/projeto/página, caminho, timestamp confirmado e revisão devem coincidir com metadata autenticada. Saves sem alteração concorrente e com upload/metadados confirmados também alimentam o cache. Dados são copiados, expiram em sete dias, têm limite de 24 entradas e falhas de quota/private mode retornam à rede.
5. Miniatura existente aparece no overlay enquanto os objetos editáveis carregam. Ela não substitui a arte nem entra na exportação.

## Qualidade e persistência

Nenhuma imagem foi reduzida ou substituída. Resolução, fontes e serialização de objetos continuam no pipeline existente. PNG/PDF usam os originais, sem mudança em multiplier ou qualidade. O cache não decide recuperação de drafts: o resolvedor existente continua escolhendo o estado adequado depois da leitura remota/cache.

Não houve migração, commit, push ou deploy. Alterações anteriores de autosave e arquivos de outras tarefas foram preservados.

## Validações

- 107 testes em 11 arquivos: cache, IDs usados/lotes, respostas incompletas, catálogo autenticado, preservação de páginas não solicitadas, autosave/miniaturas/history/persistência.
- 65 testes em seis arquivos existentes de exportação, seleção e preflight.
- `npm run typecheck`: passou (aviso existente de depreciação de module.register).
- `npm run build`: passou; `/tmp/jobvarejo-loading-build-final.log`.
- `npm run check:client-chunk`: passou, maior chunk 450 KB / limite 500 KB.
- `git diff --check`: passou.
- Preview autenticado: arte pronta, 34 objetos, seis páginas sem dirty/thumbnailDirty, status saved e nenhuma mensagem de erro; respostas reduzidas e hits de cache observados.

## Limites

Exportação real de PNG/PDF, edição manual/undo pelo navegador, troca de todas as páginas e mudança real de conta não foram exercitadas. O onboarding de validade foi mantido sem confirmação para preservar dados comerciais. Comportamento de conta/revisão e exportação foi coberto pelas verificações de código e testes indicados. Uma sincronização automática após abertura ainda pode ocorrer pelos mecanismos existentes; esta mudança não promete zero saves no boot.

O ganho de tempo total em produção e na primeira abertura sem cache continua pendente de publicação e medição autenticada.
