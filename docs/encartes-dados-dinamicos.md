# Encartes — dados dinâmicos da loja (diagnóstico 07/10/2026)

Logo, Instagram, WhatsApp, endereço e cartões aceitos: de onde vêm, como entram no encarte e onde o sistema se complica hoje.

## 1. Onde os dados ficam hoje

| Fonte | Usada por | Campos |
|---|---|---|
| `profiles.business_profile` (JSONB) — tela `/business-profile` e diálogo do modo rápido | Editor (avançado e rápido), Cartazista, Vídeos, criação por WhatsApp, Work | `companyName`, `logo` + `logoPreference`, `whatsapp` + `whatsappNumbers[]`, `address` + `addresses[]`, `instagram`, `facebook`, `website`, `slogan`, `phone`, `hours`, `paymentMethods[]`, `footerPaymentImages[]` |
| `builder_tenants` (colunas próprias) — `/builder/profile` | QROfertas Builder V2 | `logo`, `whatsapp`, `instagram`, `address`… + `builder_flyers.show_*`, `logo_x/y/size` por encarte |
| Cópia no vídeo (`loadVideoBrandFromProfile`) | Vídeos | Logo é **copiada** como asset do vídeo; trocar a logo depois não atualiza o vídeo já criado |
| Overrides por encarte (`applyBusinessOverrides`) | Criação por WhatsApp | Sobrescreve campos só naquele encarte |

`builder_tenants` só é sincronizado em e-mail, nome e ativo (`server/utils/account-access.ts`, `admin/users/[id].patch.ts`). **Contatos e logo não são sincronizados** entre as duas fontes.

## 2. Como o modelo se liga ao dado

Cada objeto do canvas carrega uma marcação:

- `businessProfileField`: `logo`, `whatsapp`, `address`, `instagram`, `footerPaymentImages`, `validity` (+ raros `slogan`, `name`, `companyName`, `website`, `facebook`).
- `quickDataField: 'validity'` — segunda propriedade para a validade, coexistindo com `businessProfileField: 'validity'`.
- `quickDynamicIconFor` — ícone que some junto com o campo.
- `quickTemplateSample` — amostra só do modelo, escondida no modo rápido.

Aplicação: `applyQuickBusinessProfileBindings` (`components/EditorCanvas.vue:19870`). A regra de texto muda conforme o contexto:

| Contexto | Texto exibido | Campo vazio |
|---|---|---|
| Edição de modelo (admin) | amostra fixa ou texto do modelo | aparece a amostra |
| Editor avançado | dado da loja → texto do modelo → amostra | mostra o texto do modelo |
| Modo rápido | dado da loja | **some** (ícone some junto) |

Há ainda um ajuste em tempo de execução: textos "FALE CONOSCO" sem campo ganham um Textbox de WhatsApp criado na hora.

## 3. Cartões aceitos

São dois campos paralelos:

- `paymentMethods[]`: IDs de bandeiras, com **padrão automático** (`DEFAULT_BUSINESS_PAYMENT_METHODS`) e a flag `__paymentMethodsConfigured` para saber se a loja escolheu de fato.
- `footerPaymentImages[]`: até 6 imagens do sistema. É o que o slot do rodapé desenha (`utils/footerPaymentImages.ts`).

O slot só aparece se `footerPaymentImages` tiver itens. `paymentMethods` alimenta outras telas. A loja pode ter bandeiras configuradas e mesmo assim ficar com o rodapé sem cartões, ou o contrário.

## 4. Dificuldades encontradas

1. **Duas fontes de perfil** (Editor x Builder V2): o cliente atualiza o WhatsApp num lugar e o outro continua antigo.
2. **Cartões duplicados** (`paymentMethods` x `footerPaymentImages`), com padrão automático em um e vazio no outro.
3. **Validade com duas marcações** e três regras de exibição diferentes por modo, o que dificulta prever o resultado.
4. **Múltiplos WhatsApps/endereços**: o modelo tem um slot; a lista (`whatsappNumbers[]`, `addresses[]`) depende de `formatBusinessContactValues` e do rodapé compacto para caber.
5. **Conteúdo gravado no bitmap** (auditoria de 05/10): selos, slogans, Instagram ou contatos dentro do fundo não são dinâmicos. A troca de perfil não altera esse conteúdo.
6. **Instagram sem painel padrão**: em parte dos modelos há só handle/ícone, sem cabeçalho.
7. **TV** esconde Instagram, WhatsApp e endereço por regra; os objetos continuam no JSON, desativados.
8. **Correções em runtime** ("FALE CONOSCO", `compactBusinessFooter`, `repairDynamicTextLayoutBounds`): o modelo salvo não está correto por si; o editor conserta a cada carga.
9. **Vídeo e PNGs exportados** guardam cópia: trocar a logo não propaga para peças já geradas.

## 4.1 Montagem engessada (problema principal)

Prancha de 30 dos 279 modelos Feed: todos têm o mesmo esqueleto. Selo no canto superior esquerdo, caixa da logo à direita, faixa de validade, um retângulo de produtos e o rodapé com WhatsApp, endereço e cartões. Só mudam o fundo e o selo.

Origem:
- `scripts/standardize-flyer-template-dynamics.mjs` reaplica rodapé, validade e zona de produtos de **um único modelo doador** (`DEFAULT_DONOR_TEMPLATE_ID`) com `forceFooter`/`forceValidity`.
- A auditoria de 05/10 reposicionou logo, selo e zona pelo mesmo critério em cerca de 775 páginas.
- `docs/campanhas-varejo-padrao.md` fixa "selo à esquerda, logo grande à direita" como regra para retratos.
- No modo rápido, a grade só oferece `model | 2 | 3` linhas (`utils/quickGridPreset.ts`), sem produto em destaque nem setores.

Direção: separar **esqueleto** (onde ficam selo, logo, validade, contatos e produtos) de **tema** (fundo, cores e arte do selo). Com vários esqueletos, o mesmo tema gera encartes diferentes.

## 5. Proposta de organização

1. **Uma fonte só**: `profiles.business_profile`. O Builder V2 passa a ler e gravar nela (ou `builder_tenants` vira espelho sincronizado na escrita).
2. **Contrato único de slots** em `shared/`: `logo`, `instagram`, `whatsapp`, `address`, `paymentCards`, `validity`, com regras de visibilidade e encaixe por slot (1 ou N valores, quebra máxima de linhas, ícone associado).
3. **Cartões**: um campo (`paymentCards`) com as bandeiras escolhidas; as imagens são derivadas dele. Sem padrão automático: vazio = não mostra.
4. **Validade**: só `businessProfileField: 'validity'`; migrar `quickDataField`.
5. **Validador de modelo** no salvar do admin: exige slots nativos por formato (TV sem contatos), recusa contato/Instagram no bitmap, e grava o modelo já corrigido. Isso permite aposentar os reparos em runtime.
6. **Modo de pré-visualização** no admin com três perfis de teste (completo, longo, vazio) antes de publicar.
