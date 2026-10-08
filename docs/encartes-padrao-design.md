# Padrão de design dos encartes (varejo)

Referência única para criar e ajustar modelos de encarte. Base: regras já aprovadas pelo cliente (memória `encarte-forma-e-logo`, `docs/campanhas-varejo-padrao.md`) e boas práticas de encarte de supermercado. O script `scripts/flyer-templates/standardize.mjs` aplica as regras mensuráveis em lote.

## 1. Hierarquia de leitura

Ordem em que o olho percorre um encarte de oferta:

1. **Selo da campanha** (o "nome" da promoção)
2. **Preço** de cada produto (o maior número da peça depois do selo)
3. **Foto do produto**
4. **Logo da loja** — quem está oferecendo
5. **Validade** — quando vale
6. **Contatos** — como comprar (WhatsApp, endereço, cartões)

Tudo que não serve a essa ordem é decoração e não pode competir com ela.

## 2. Cabeçalho

- Modelos com cabeçalho em cima e rodapé embaixo: **selo e logo lado a lado**, os dois grandes e altos. Selo ~50% da largura à esquerda; logo à direita com Instagram e validade logo abaixo dela.
- Exceção: estrutura **Faixa Lateral** — coluna com selo, logo, validade e contatos empilhados.
- Logo nunca pequena: ≥ 330 px de largura no Feed (1080 px), proporcional nos demais formatos.
- Validade sempre em faixa própria, centralizada, em uma linha quando possível; nunca inventar datas.

## 3. Rodapé completo

Cada bloco do rodapé tem **ícone + título + valor**. Sem título, o cliente não sabe se o número é WhatsApp ou telefone fixo.

| Bloco | Título | Valor |
|---|---|---|
| WhatsApp | `FALE CONOSCO` | número(s) do perfil |
| Endereço | `ENDEREÇO` | endereço(s) do perfil |
| Cartões | `CARTÕES ACEITOS` | bandeiras escolhidas |

- Título em Barlow Condensed 700, caixa alta, cor de destaque do tema (dourado/amarelo sobre fundo escuro; cor escura sobre fundo claro), ~20% da altura do bloco.
- Campo vazio no perfil → bloco inteiro some (ícone, título e valor), os demais se redistribuem.
- TV: sem contatos (regra do formato).

## 4. Grade e espaçamento

- Margem externa única por formato: 17 px a cada 1080 px de largura. Selo, logo, painel de produtos e rodapé alinham na mesma margem.
- Espaços em múltiplos de 4 px (escala 1080). Distância cabeçalho → painel ≤ 12 px; painel → rodapé = 8 px.
- Nenhum vazio grande: a área de produtos ocupa todo o espaço entre cabeçalho e rodapé.

## 5. Formas e tipografia

- **Um único raio de canto** por tema (o da faixa de validade, ≈ 24 × escala do cabeçalho). Nunca raio proporcional à altura do bloco.
- No máximo duas famílias: Barlow Condensed (títulos, preços, nomes) e Barlow (contatos, validade).
- Contraste mínimo 4,5:1 para textos de contato e validade.

## 6. Produtos

- Estrutura escolhida pelo motor (`utils/flyerStructure.ts`): Produto Herói (destaque marcado), Setores (2+ departamentos), Faixa Lateral (até 10 ofertas), Clássico (listas maiores).
- Todos os cards de uma página com o mesmo formato; setores pequenos dividem a faixa.
