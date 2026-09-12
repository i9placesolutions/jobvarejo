# Auditoria do editor: persistência, contorno e movimento

## Evidências

- Projeto `e707caf9-443e-49e9-a675-05bc0c5f517f`: leitura do PostgreSQL e dos quatro JSONs no Wasabi confirmou logo com `__stickerOutlineEnabled: true`, largura 4 e cor branca em todas as páginas. Não foi necessário alterar dados salvos.
- Em Safari autenticado, um clique simples na logo da página 4 abriu o painel e deslocou todo o encarte aproximadamente 149 px para a esquerda. A posição relativa da logo permaneceu igual: o painel flex consumia largura da área do canvas.
- Miniaturas são renderizadas em um novo StaticCanvas. Os atributos do contorno eram carregados, mas o patch de desenho, que não é serializável, não era restaurado nesse caminho.
- A geração do contorno tinha atraso obrigatório de 30 ms, inclusive com imagem já carregada. Grupos ancestrais também não eram invalidados quando o cache ficava pronto.

## Correções

- Painel da logo sobreposto à área de edição, sem modificar suas dimensões ao selecionar a logo; em tela pequena fica no rodapé.
- Contorno gerado imediatamente para imagens prontas e reaplicado após carregamento de página, nas miniaturas e na exportação.
- Invalidação dos caches de grupos ancestrais e da silhueta quando o elemento de imagem é substituído, mesmo mantendo suas dimensões.
- Preservadas as correções locais anteriores: repetição limitada de carregamento de imagens e fila independente de miniaturas por página com proteção contra resultado obsoleto.

## Limites da verificação

A reprodução visual foi feita na versão de produção anterior à correção. Os testes automatizados validam a reconstrução do efeito e a preservação da geometria; a conferência visual autenticada da versão corrigida e sua publicação continuam sendo etapas distintas. A auditoria não comprova resolução de todos os problemas possíveis de rede, storage ou seleção múltipla.
