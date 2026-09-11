# Estúdio de Artes

Módulo independente dos editores de ofertas. Rotas `/art-studio` e `/art-studio/editor/:id`; APIs `/api/art-studio/*`. Usa somente autenticação, perfil comercial e cliente S3 compartilhados. Não usa `useProject`, `EditorCanvas`, product zones, tabelas de encartes, histórico nem autosave dos editores existentes.

## Uso

- Catálogo: 12 modelos iniciais próprios, categorias, coleções, busca, filtro de formato e prévia antes de criar.
- Cliente: escolhe modelo/formato, edita textos/fontes/cores, arrasta/redimensiona elementos, substitui fotos, recorta com sliders, troca ícones, administra camadas, salva/reabre e exporta PNG.
- `Minhas artes` lista trabalhos da conta autenticada.
- Super admin: `Administrar → Criar modelo`. Mesmo editor independente, em modo de autoria. Define vínculos dinâmicos por camada, importa/exporta composição JSON e publica ou retira modelo do catálogo. Modelos iniciais são imutáveis; editar um gera uma cópia administrável. Rascunhos não são listados para clientes. Categoria/coleção são configuráveis ao salvar; as opções no catálogo são derivadas dos modelos publicados.
- Logo: slot com `binding: 'logo'`. O cliente recebe `/api/art-studio/brand-logo`, resolvido pelo servidor a partir de `profiles.business_profile` do usuário autenticado. Não há logo de admin copiada entre contas. A logo é atual ao carregar; posição/tamanho/enquadramento ficam no documento. Se não cadastrada, mantém slot vazio. A troca da logo abre o cadastro da loja e preserva o vínculo. Auto trim remove somente margens transparentes; fundo e contorno são configuráveis. O contorno usa o mesmo EDT, preenchimento de vazios e supersampling 2x das ofertas, também na preparação das imagens para o Python.
- Os demais campos são preenchidos na criação; o botão “Atualizar dados da loja” reaplica os vínculos. Editar manualmente um texto remove seu vínculo para não sobrescrevê-lo depois.

## Composição e renderização

`ArtComposition` é um JSON versionado com camadas de texto, imagem, forma e ícone. É o formato canônico, não JSON interno do Fabric. Não há novas propriedades ou patches globais de Fabric: um WeakMap local associa objetos às camadas. O renderer usa classes nativas `Textbox`, `FabricImage`, `Rect`, `Ellipse` e `Path`, e mantém seu próprio estado e histórico. Export é feito no canvas em dimensões originais, restaurando o zoom e a seleção depois. Falha de imagem bloqueia o export, sem PNG incompleto silencioso.

A prévia leve do catálogo usa SVG e quebra aproximada. A montagem automática usa métricas reais do Pillow, e o editor ajusta a caixa de texto com Fabric. A mudança de proporção reposiciona proporcionalmente as camadas e pede conferência visual; não promete uma composição ideal em qualquer proporção. As fontes Barlow, Barlow Condensed, Oswald e Anton estão empacotadas localmente em `public/art-studio/fonts` (licenças OFL incluídas) e são usadas pelo Python e navegador, com nomes CSS isolados.

## Python / Pillow

O worker `workers/art_studio.py` está integrado ao Nitro:

- `POST /api/art-studio/compose`: recebe uma composição e até oito tamanhos, reposiciona camadas proporcionalmente e ajusta os textos com métricas Pillow.
- `POST /api/art-studio/generate`: super admin informa tema, título, mensagem e paleta; Python monta os modelos editáveis nos formatos escolhidos.
- `POST /api/art-studio/render`: resolve imagens autorizadas e a logo da conta, renderiza PNGs com Pillow e devolve PNG individual ou ZIP com todos os formatos.

No editor: “Montar modelo automaticamente”, “Formatos” e “Baixar todos os formatos (Python)”. Ao escolher um modelo no catálogo, a montagem inicial também passa pelo Python. Cada tamanho é editável individualmente e persistido em `composition.alternates`; mudar um formato não altera os demais. Os cinco presets acompanham as dimensões dos modelos de ofertas: feed 1080×1350, quadrado 1080×1080, stories 1080×1920, A4 794×1123 e banner 1920×1080. A4 neste preset usa as dimensões existentes do sistema; não é um arquivo de impressão de 300 DPI.

O worker não acessa rede, banco ou secrets: o Nitro autoriza e entrega os bytes. Processos sem shell, diretório temporário privado, timeout de 90s, até dois workers simultâneos por processo Nitro, até oito formatos e limites de imagens. A conexão não consome créditos de IA; é composição determinística editável. Executável: `ART_STUDIO_PYTHON`, depois `PRODUCT_IMAGE_PYTHON`, depois `python3`. O Docker existente já instala Pillow no ambiente de imagens e agora valida este worker/fontes no build, sem alterar o worker de produtos.

```
python3 workers/art_studio.py --self-test
python3 -m unittest discover -s tests/art-studio -p 'test_*.py'
```

A ferramenta CLI `scripts/art-studio/compose.py` também permite preparar JSON a partir de `brief.example.json`, usando `--font` e `--output`, para importação no editor do super admin. Use a mesma fonte do briefing. O arquivo JSON importado passa por validação de schema e autorização de imagens.

## Banco e storage

Aplicar manualmente `database/art_studio_migration.sql` na conexão configurada. Migração aditiva/idempotente cria somente `art_studio_templates`, `art_studio_designs`, `art_studio_assets`, `art_studio_audit` e seus índices. Não altera tabelas/triggers existentes. Atualização de timestamp e revisão é feita nas queries parametrizadas. Sem cache de catálogo neste MVP; todos os endpoints privados usam `private, no-store`.

Imagens são decodificadas, limitadas a 24M pixels, normalizadas em PNG (máximo 4096 em cada eixo) e enviadas a `art-studio/{userId}/{assetId}.png`. JSON guarda referências estáveis `/api/art-studio/assets/:id`; nunca blob/data/presigned URL. A leitura permite proprietário ou asset publicado pelo super admin. Assets publicados permanecem acessíveis a contas autenticadas para preservar artes já criadas, mesmo após retirar o modelo do catálogo. Não há exclusão de assets nesta versão.

Autorização: todas as queries de designs incluem `owner_id`. Administração verifica `role === 'super_admin'` no backend. JSON rejeita URLs arbitrárias, IDs duplicados e dimensões abusivas. Não habilitar acesso SQL direto de clientes: autenticação é JWT próprio no Nitro, sem dependência de `auth.uid()`.

Salvamento usa revisão otimista (409 em conflito), UUID estável para a primeira criação e rascunho local por usuário/trabalho/modo. Requisições são serializadas. Conflitos interrompem autosave e oferecem salvar cópia. Publicação e compartilhamento dos assets ocorrem na mesma transação e registram ator/revisão em auditoria.

## Validação e operação

- `npx vitest run tests/art-studio`
- `npm run typecheck`
- `npm run check`
- `ART_STUDIO_TEST_URL=http://127.0.0.1:3119 node --env-file=.env scripts/art-studio/verify.mjs`
- Browser: catálogo, filtro, criação, texto/cor/fonte, movimento, upload/substituição, undo/redo, save/reload, PNG, publicação e conta comum sem administração.

O script de integração usa apenas servidor local, tokens temporários com as roles reais de duas contas existentes e fixtures identificadas nas novas tabelas. Nunca altera credenciais ou perfis. Limpa somente os IDs criados por ele.

Rollback: remover os links e desativar as novas rotas. Conservar as tabelas e o prefixo de assets para não perder trabalhos. Não há motivo para remover dados dos editores de ofertas.

## Evidências desta implementação

- Migração executada duas vezes com sucesso na conexão configurada, comprovando idempotência e presença das quatro tabelas isoladas.
- 33 chamadas/assertivas de integração passaram no servidor local, incluindo leitura da logo cadastrada do super admin, ausência de logo na conta comum, renderização Python com logo, escopo de assets, conflito de revisão, publicação e ZIP com cinco PNGs nas dimensões esperadas.
- 20 testes TypeScript do módulo, oito do contorno das ofertas e seis testes Python passaram; typecheck e build com limite de chunk passaram (492 KB / 500 KB na primeira validação).
- A suíte geral encontrou uma falha em `backgroundExteriorPreservation.test.ts` no pipeline de remoção de fundo, que já possui alterações de outro escopo no checkout. Os arquivos desse pipeline não foram modificados por este módulo.
- A validação visual autenticada depende de login no preview; não confundir testes de API/render com teste de interação do navegador.

## Efeitos editáveis e coleção do consumidor

Camadas agora aceitam `gradient` linear/radial com `from`, `to`, `startOpacity`, `endOpacity` e `angle`, formas vetoriais `shape: path` + `pathData` e `cornerRadius`. O inspetor permite editar cores/intensidade/direção e cantos. Fabric, SVG do catálogo e Pillow interpretam o mesmo documento. Roboto Slab, Audiowide, Bebas Neue e Caveat são fontes locais adicionais, com licenças. A coleção e os IDs persistidos estão em `artifacts/art-studio/consumidor/manifest.json`.

### Revisão de fidelidade (rascunhos)

- O carregador de fontes respeita o arquivo especial da família antes do fallback; a precedência anterior acabava carregando Oswald para outras famílias.
- `Consumidor Referencia` é uma reconstrução dos caracteres visíveis, derivada de Russo One sob OFL; não é identificação da fonte original. Caracteres não presentes na referência conservam a base e precisam de revisão para novas mensagens.
- `blur` (0–150 px) mantém as formas de sombra independentes, com cor, opacidade, posição e desfoque. Fabric usa um raster temporário do SVG filtrado; o JSON conserva a camada editável. Pillow amplia o bitmap antes do desfoque para evitar bordas retangulares.
- Os seis modelos continuam como rascunhos: ainda há diferenças visuais nas fotografias e na composição em relação à referência.
