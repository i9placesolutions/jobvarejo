# Catálogo de mídia no Wasabi

Fundos, selos, trilhas e efeitos de áudio do catálogo ficam no Wasabi. O Git contém somente o manifesto `shared/video-studio/catalog-assets.json`, os metadados de origem/licença e o código.

- Chaves: `video-studio/catalog/{sha256}/{audio|templates}/{arquivo}`.
- A rota `/video-studio/**` mantém os endereços usados pelo player e pela galeria. Somente arquivos do manifesto são servidos; assets privados dos usuários continuam no fluxo autenticado existente.
- O worker baixa os arquivos necessários para cada job e mantém cache local validado por SHA-256. A renderização continua lendo arquivos locais, sem baixar o catálogo inteiro.
- A rota suporta ETag, cache por uma hora e ranges de áudio/vídeo. O bucket continua privado, sem alteração de ACL.

## Publicar ou atualizar mídia

1. Gere os arquivos em `public/video-studio/audio` ou `public/video-studio/templates`, como nos scripts existentes.
2. Execute:

```bash
node --env-file=.env scripts/video-studio/migrate-catalog-to-wasabi.mjs --upload --archive
```

O script calcula hashes, atualiza o manifesto, envia com Content-MD5 e confirma tamanho e SHA-256 nos metadados do Wasabi. Somente arquivos confirmados são movidos para `output/video-studio-catalog-source`, preservando a cópia local. Execute novamente em caso de falha; chaves verificadas são reaproveitadas. Sem flags, o script somente inventaria e atualiza o manifesto, sem publicar.

3. Execute os testes, typecheck e build. Faça commit do manifesto e do código. O prebuild recusa binários do catálogo que ainda não foram publicados e arquivados.

`public/video-studio` mantém arquivos pequenos de licença/proveniência. Os binários e a cópia em `output` são excluídos do Git e do contexto Docker. Para scripts de edição de mídia que exigem uma fonte local já arquivada, recupere a fonte de `output/video-studio-catalog-source` ou baixe a entrada correspondente pelo helper do worker; publique novamente após gerar a versão atualizada.

Remover arquivos do estado atual não elimina versões já presentes no histórico antigo do Git. Essa migração não reescreve commits que já foram publicados.
