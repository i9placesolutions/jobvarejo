# Auditoria mobile — 6 de setembro de 2026

## Alterações

- Editor avançado e modelos de encarte: Recursos abre o mesmo SidebarLeft do desktop (elementos, dados da loja, arquivos, IA e formatos). Eventos de inserção e geração chegam ao editor; propriedades encaminham também zoom, apresentação, compartilhamento e ajustes de grade.
- Camadas: modo de seleção múltipla por toque, sem teclado.
- Edição rápida: seletor de zona deixa de ser escondido; dock em duas linhas, nomes das ferramentas visíveis e área reservada para não sobrepor o painel. Controles de páginas com alvos de toque de 44 px.
- Admin: tabelas preservam colunas em regiões roláveis. Editores de cabeçalho, rodapé e card alternam painéis de largura inteira no celular. Cabeçalho e rodapé recebem Pointer Events, cancelamento do gesto e limpeza de listeners. Menus de card abrem com clique, sem depender de hover.
- Builder: ferramentas em faixa rolável, painel de largura inteira com ação de concluir, toolbar rolável, navegação com rótulos e editor de imagem empilhado.
- Projetos: ações deixam de depender de hover no celular.
- Correção associada: imagens que extrapolam cards podem ser selecionadas por seus pixels externos e removidas pela barra de imagem.

## Evidências

- Playwright / Chrome headless, viewports 320 × 844, 390 × 844 e 768 × 844, toque habilitado, APIs interceptadas com dados de teste: 12 rotas admin/builder (índice, cabeçalhos, rodapés, cards, temas, modelos, grades, selos, fontes, etiquetas, segmentos, clientes) sem transbordamento da página nem exceções JavaScript.
- Alternância dos três painéis dos editores de cabeçalho, rodapé e card: exatamente um painel visível em cada aba.
- Gesto PointerEvent de toque moveu um elemento do cabeçalho; prévia mediu 358 × 143 px dentro do viewport de 390 px.
- Editor avançado: abertura dos cinco painéis móveis e acesso ao catálogo completo Recursos/IA; sem exceções JavaScript na fixture.
- Testes unitários do contrato dos painéis e de composição/substituição de imagens; typecheck e build de produção.

## Limites da validação

As fixtures comprovam layout e navegação, não gravação autenticada no banco, serviços externos de IA nem exportação real. O Mac estava bloqueado durante a validação. Não foi feita uma auditoria funcional exaustiva de cada combinação de formulário ou um teste físico no Safari/iOS.

O índice administrativo também contém links preexistentes para `/admin/canva/templates` e `/admin/builder/qr-academy`, cujas páginas não existem neste checkout; isso afeta desktop e mobile e não foi confundido com uma função mobile validada.

O gate de tamanho do bundle continua reprovando: maior chunk de aproximadamente 589 KB frente ao limite de 500 KB. Build bem-sucedido não implica aprovação desse gate.
