# Rádio Indoor do JobVarejo

O módulo fica em `/radio-indoor` e é protegido pelo mesmo login do JobVarejo. Ele não lê nem grava projetos do editor de artes.

Cada loja é uma estação independente. O seletor no topo permite alternar entre
lojas e o botão `+` cria outra sem misturar playlists, programas, horários,
solicitações ou histórico de execução. O catálogo de músicas é compartilhado
na conta para evitar duplicação no Wasabi; a organização e a programação ficam
isoladas por estação.

## Usuários, lojas e players

O proprietário pode abrir **Equipe e players** no menu e cadastrar usuários
com acesso a uma ou várias lojas. Os níveis da Rádio Indoor são:

- **Gerente**: configura a loja, equipe e agenda.
- **Editor de programação**: organiza catálogo, playlists e programas.
- **Operador**: usa o player e solicita jingles, offs e locuções.
- **Player**: somente reprodução na loja vinculada.

O proprietário principal continua sendo o administrador da conta. Um usuário
pode ter níveis diferentes em lojas diferentes. Para pontos de reprodução
simultâneos, crie um player por computador/filial; o token é mostrado uma única
vez e pode autenticar integrações que enviem `X-Radio-Player-Token` ou
`Authorization: RadioPlayer <token>` para o endpoint do player.

## Primeiro teste

1. Execute `database/radio_indoor_migration.sql` no PostgreSQL da aplicação.
2. Confirme as variáveis Wasabi já usadas pelo JobVarejo.
3. Abra `/radio-indoor`, clique em **Importar catálogo** e teste uma faixa.
4. Crie um programa, adicione um bloco de playlist e publique um horário.

Para importar o mesmo manifesto para uma loja específica pela linha de
comando, informe o identificador exibido pela API/player:

```bash
node scripts/radio-indoor/import-wasabi-manifest.mjs \
  --user-id UUID_DO_USUARIO --station-id UUID_DA_LOJA
```

O importador usa, por padrão, o manifesto já enviado para:

`radio-indoor/catalog/metadata/playlists/henrique-e-juliano/menos-e-mais-ao-vivo-2018.json`

Os áudios continuam privados no Wasabi. O navegador recebe o áudio pelo proxy autenticado `/api/radio-indoor/audio`, com suporte a `Range` e cache local do próximo conteúdo.

## MusicGPT

Configure no servidor (nunca em `runtimeConfig.public`):

```env
MUSICGPT_API_KEY=...
MUSICGPT_API_URL=https://api.musicgpt.com/api/public/v1/MusicAI
MUSICGPT_TTS_URL=https://api.musicgpt.com/api/public/v1/TextToSpeech
# Se omitido, usa APP_BASE_URL + /api/radio-indoor/ai/musicgpt-webhook
MUSICGPT_WEBHOOK_URL=https://jobvarejo.com.br/api/radio-indoor/ai/musicgpt-webhook
MUSICGPT_WEBHOOK_SECRET=um-segredo-longo
# opcional para off/locução sem preencher o voice_id no formulário
MUSICGPT_DEFAULT_VOICE_ID=...
MUSICGPT_DEFAULT_VOICE_GENDER=female
```

O MusicGPT **não envia header de autenticação** no callback. O JobVarejo
embute `?secret=...` na `webhook_url` enviada ao provedor e valida esse
valor no endpoint. Sem `MUSICGPT_WEBHOOK_SECRET` (ou URL derivada de
`APP_BASE_URL`), o pedido ainda é criado, mas o retorno depende do polling
da tela de solicitações.

O formulário de solicitações registra jingle, off, locução e música. Sem a chave, o pedido fica salvo como `queued` e pode ser enviado depois. Com a chave, jingles e músicas usam MusicAI; offs e locuções usam TextToSpeech com a voz escolhida no banco (ou o padrão configurado). A amostra clonada é entregue ao MusicGPT por uma URL pública de curta duração em `/api/radio-indoor/ai/voice-sample` (não pela URL assinada do Wasabi). Esse endpoint recodifica com ffmpeg um clip mono de ~12s — amostras longas falham na conversão e corte cru em bytes deixa o clone genérico. A amostra ideal é só fala, sem música de fundo (recomendação do MusicGPT). O JobVarejo guarda `task_id`/`conversion_id` e o webhook atualiza o status sem expor o segredo ao cliente. Consulte os contratos assíncronos na [documentação oficial do MusicGPT](https://docs.musicgpt.com/api-documentation/endpoint/MusicAI) e no [TextToSpeech](https://docs.musicgpt.com/api-documentation/conversions/texttospeech).

### Banco de vozes

O cadastro de uma voz clonada é feito exclusivamente em **Administração do
Builder → MusicGPT / Banco de vozes** (`/admin/musicgpt`). O administrador envia
a amostra (preferência: só fala, ~20–60s, sem música), registra a confirmação de
autorização e pode revogar o perfil. No upload, o servidor isola a fala (remove/atenua
trilha da amostra) num clip `.clone.mp3` (~18s) — esse arquivo é o que o MusicGPT
usa para clonar a voz. Off/locução = TTS com essa voz. Jingle/música = MusicAI gera
trilha ORIGINAL (não herda música da amostra). A amostra completa continua privada
no Wasabi para prévia humana.

Na Rádio Indoor, a tela **Banco de vozes** é somente leitura: cada usuário pode
ouvir a prévia e selecionar uma voz liberada ao criar um off ou uma locução. O
servidor verifica novamente a loja, o status ativo e o consentimento antes de
enviar uma URL assinada de curta duração ao TextToSpeech. O endpoint de upload
(`/api/admin/musicgpt/voices`) e a revogação exigem uma sessão com papel
`admin` ou `super_admin`; esconder o formulário no cliente não é a única
barreira.

## Worker de agenda

O processo opcional `workers/radio_worker.py` usa `radio_schedule_jobs` no PostgreSQL e deve rodar como serviço separado do `node-server`:

```bash
# Em produção, injete POSTGRES_DATABASE_URL no serviço do worker.
# No teste local, carregue o .env antes de iniciar o processo:
set -a; source .env; set +a
./workers/start-radio-worker.sh --once --dry-run
./workers/start-radio-worker.sh
```

O mesmo processo atende todas as estações. Ele reivindica somente jobs vencidos
com `SKIP LOCKED`, mantém um lease para permitir outra réplica quando um
processo cair, faz cinco tentativas por padrão (configurável) com backoff e grava presença em
`radio_worker_heartbeats`. O painel de saúde mostra quantos workers estão vivos
nos últimos 90 segundos. Para várias réplicas, defina um `RADIO_WORKER_ID`
distinto em cada serviço; para uma instalação simples, um processo já atende
todas as lojas.

Opções operacionais:

```bash
RADIO_WORKER_ID=radio-01 ./workers/start-radio-worker.sh --poll-ms 15000 --batch-size 20
./workers/start-radio-worker.sh --once --dry-run
```

O player sempre calcula a faixa ativa no fuso da estação. O worker mantém os ticks observáveis e prepara a extensão para AudioPack, comerciais e ingestão de áudio gerado.

## Cache offline

`public/radio-indoor-sw.js` é registrado somente quando o usuário abre o módulo. Ele intercepta apenas `/api/radio-indoor/audio` e `/api/radio-indoor/media`, pré-carrega as próximas três faixas e mantém até 20 respostas locais. Em uma queda de conexão, a faixa atual continua pelo buffer do elemento `<audio>` e as próximas faixas armazenadas podem ser reproduzidas por até aproximadamente 45 minutos, dependendo do tamanho do catálogo.

## Player kiosk

Use `/radio-indoor/player` em computadores da loja. Autenticação é só pelo token
do player (`X-Radio-Player-Token`, `Authorization: RadioPlayer <token>` ou
`?playerToken=` nas URLs de áudio). Após criar um player em **Equipe e players**,
copie o token ou abra o kiosk direto. A fila da agenda é recarregada a cada 60s
no painel e no kiosk quando a janela de horário muda.
