# Worker de vídeos (independente)

O serviço web salva projetos e solicitações. Este processo consome exclusivamente
`video_studio_jobs` usando lease no PostgreSQL e salva em `video-studio/{userId}/`.
Não altera rádio, encartes nem suas tabelas. A fila usa PostgreSQL (SKIP LOCKED)
para dispensar um segundo coordenador e manter a tarefa durável.

## Preparação

1. Aplicar `database/video_studio_migration.sql` com o proprietário das tabelas.
2. Web: `npm ci`; Python: `python3 -m venv /opt/video-python` e
   `/opt/video-python/bin/pip install -r workers/video-studio/requirements.txt`.
   Definir `VIDEO_STUDIO_PYTHON=/opt/video-python/bin/python` para preparar texto.
3. Worker local: `npm ci --prefix workers/video-studio`; executar a partir da raiz:
   `node --env-file=.env workers/video-studio/runner.mjs`.
4. Docker separado: `docker build -f workers/video-studio/Dockerfile -t jobvarejo-video .`.
   Usar os mesmos PostgreSQL/Wasabi do web, com variáveis privadas próprias no serviço.
   Não substituir o Dockerfile nem o comando de inicialização da rádio/web.

Variáveis: POSTGRES_DATABASE_URL, WASABI_ENDPOINT, WASABI_REGION, WASABI_BUCKET,
WASABI_ACCESS_KEY, WASABI_SECRET_KEY, MUSICGPT_API_KEY, MUSICGPT_DEFAULT_VOICE_ID.
Opcionais: MUSICGPT_TTS_URL, MUSICGPT_API_URL, VIDEO_RENDER_CONCURRENCY (padrão 2),
VIDEO_STUDIO_PYTHON. Contrato MusicGPT mantém consulta por task_id; não utiliza
nem modifica o webhook da rádio. O worker faz polling persistindo task_id.

Vozes: padrão configurado pelo servidor ou amostras já preparadas e autorizadas,
pertencentes à mesma conta e sem vínculo exclusivo a estação. Apenas leitura da
biblioteca de vozes. Não criar clonagens nem ampliar acesso a vozes de outras contas.

## Operação e recuperação

- Worker registra heartbeat a cada 20s. Sem worker ativo, o botão de geração é
  desabilitado; edição e salvamento continuam disponíveis.
- Lease de 90s renovado; worker interrompido permite retomada até três vezes.
- Antes de enviar ao MusicGPT, grava `sending`. Se faltar task_id após queda,
  não reenvia automaticamente: conferir no provedor para evitar cobrança duplicada.
- Áudios concluídos ficam em cache por proprietário, texto normalizado e voz.
- Um erro de duração preserva áudios gerados para revisão do texto e reaproveitamento.
- Sem callback público novo; não altera rádio. Previews usam URLs privadas autenticadas.
- Rollback: parar este worker e ocultar entrada de vídeos; preservar tabelas/arquivos.
- Custos/licença Remotion e MusicGPT devem ser conferidos antes da disponibilização comercial.

## Biblioteca

Trilhas instrumentais e efeitos originais sintetizados por `make_audio.py`;
reutilizáveis sem chamadas pagas. Música enviada/gerada fica privada por usuário.
Animações determinísticas em `shared/video-studio/composition.ts` servem à prévia
e ao render. Fontes locais com licenças já incluídas em public/art-studio/fonts.


## Modelo profissional e validação

Assets de cenário e selo Fecha Mês em `public/video-studio/templates` foram gerados
para este módulo; ficam separados dos produtos, preços, logo e contatos. Trocar o
título da campanha usa tipografia editável em lugar do selo com texto fixo.

`npx vitest run tests/video-studio/model.test.ts` e
`python -m unittest discover -s workers/video-studio -p test_normalize.py` validam
preços, isolamento de referências, identidade de áudio e orçamento real de frames.
`fixture.mjs` renderiza ambos os formatos offline; requer sharp do projeto raiz.
Scripts de integração em `scripts/video-studio` exigem `VIDEO_TEST_USER_ID` explícito
e aceitam somente instância localhost. O criador do modelo usa `VIDEO_DEMO_SOURCE_ID`
e `VIDEO_DEMO_INDICES` (array JSON). Não executar esses scripts contra produção.

Reinicie os workers ao atualizar a composição: o bundle Remotion fica em memória
para as gerações subsequentes. Dois processos podem consumir a fila com SKIP LOCKED;
as chamadas de áudio demoradas ocupam um processo, portanto dimensionar áudio/render
antes da abertura para todos os clientes. Não há capacidade de produção validada.

## Revisão Impacto

`broadcast.ts` é a composição de impacto por frames: abertura, ofertas e dados
comerciais no encerramento. `labels.ts`/`label-renderer.ts` adaptam cópias de etiquetas
simples existentes. O Player reserva 16 elementos de áudio para suportar locução,
trilha e efeitos durante a troca de cenas, sem atingir o limite padrão de cinco.
O teste autenticado Fecha Mês — Impacto recebeu cinco falas e trilha MusicGPT.
A duração das falas gerou uma composição de 26,1 segundos. Esse teste individual
não substitui benchmark de concorrência nem validação de reprodução em TV real.

`showcase.ts` implementa a montagem de vitrine (`layoutVersion: 2`) baseada na
hierarquia das referências fornecidas. Não altera o relógio de áudio: sobreposição
visual usa oito frames antes do início da cena, mantendo o orçamento <=30s.
`logoStyle` aceita sticker/clean; duplicação considera `imageAspectRatio < 0.9`,
com margens removidas na preparação da imagem. A versão anterior continua disponível.
