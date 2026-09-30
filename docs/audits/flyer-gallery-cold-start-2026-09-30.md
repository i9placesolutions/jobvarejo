# Primeira abertura da galeria de encartes

Cada card sem cache fazia GET do projeto, carregava o canvas do Wasabi,
carregava imagens/fontes e renderizava Fabric no cliente. Memória e IndexedDB
só reduziam o custo nas próximas visitas da mesma conta/revisão.

A biblioteca agora entrega `gallery_preview_url`, uma miniatura WebP neutra
pré-renderizada, de até 480 px na maior dimensão, armazenada no Wasabi. O card
carrega apenas essa imagem (lazy fora da viewport); os primeiros cards são eager.
Não precisa de perfil, logo, canvas, Fabric ou cache local. No modal, a mesma
imagem aparece primeiro; a renderização personalizada só acontece se a conta
possui logo. Erro de personalização conserva a miniatura disponível.

A miniatura neutra remove a logo e todos os campos dinâmicos da conta de origem,
inclusive endereço, Instagram e WhatsApp. O modelo original e seus produtos não
são alterados. A listagem continua autorizando a biblioteca pelas mesmas regras.

## Preparação de novas revisões

Após salvar alterações em modelos da biblioteca e antes de publicar:

```sh
node --env-file=.env scripts/prepare-flyer-gallery-previews.mjs --upload
```

Requer o ambiente de desenvolvimento com `fabric/node`, `canvas`, `sharp` e o
loader TS já instalado no worker. Sem `--upload`, produz somente arquivos locais
em `output/flyer-gallery-previews`; `--limit=N` permite uma revisão parcial sem
substituir o manifesto. O comando não escreve no banco nem modifica modelos.

Somente modelos de admin/super_admin são preparados. Uploads recebem MD5 e
metadados SHA-256, são confirmados com HEAD e só então entram no manifesto.
O progresso confirmado é persistido para retomar após falhas; a chave é imutável
por hash. Reexecução confirma arquivos já preparados. O manifesto guarda apenas
referências e revisões; binários ficam no Wasabi e no output ignorado pelo Git.

Uma edição posterior invalida a referência pela igualdade exata de `updated_at`.
Até executar novamente a preparação, o modelo editado usa a renderização anterior
no cliente como fallback funcional; uma miniatura antiga não é exibida como atual.

## Evidência e limites

A primeira amostra preparada tinha 14.042 bytes. Essa medida é tamanho do arquivo,
não tempo de exibição na produção. A duração de preparação offline também não
representa a latência de um navegador. A validação deve comparar download de
miniaturas e número de chamadas/renderizações com cache local vazio. Rede,
consulta inicial de catálogo e implantação ainda influenciam o tempo percebido.

Preparação concluída: 181 miniaturas, 2.754.364 bytes somados. Leitura nova do
banco confirmou a mesma revisão para os 181 modelos aprovados. A lista com
um usuário comum foi validada por HTTP local, sem usar o cache do navegador.
Amostra inicial de downloads reais via proxy/Wasabi: 757, 162, 179 e 172 ms
(11–13 KB); são tempos de rede locais, sem equivalência a um SLA de produção.
Typecheck e testes focados passaram; a suíte geral manteve oito falhas anteriores.

Validação final no servidor compilado: listagem autenticada de usuário comum
entregou 181 modelos e 181 `gallery_preview_url` válidas, resposta de 158.920
bytes em 1.297 ms. Quatro imagens baixadas sem cache do navegador tiveram SHA
conferido e tempos de 921, 205, 195 e 210 ms. Build passou; maior chunk client
452 KB, abaixo do limite de 500 KB. Testes focados: 32 passaram, mais um teste
Node de escopo. Suíte completa: 3.381 passaram e as mesmas oito falhas anteriores.
No Safari em origem nova foi conferida a listagem; a inspeção visual final das
miniaturas prontas não terminou porque o Mac ficou bloqueado. HTTP final não
equivale a uma conta recém-criada nem a tempo de exibição medido em produção.
