# Auditoria dos textos dinâmicos — 09/09/2026

Foram carregadas 84 páginas: 18 modelos e o encarte atual. A medição usou Fabric.js com as fontes Barlow e Inter carregadas, além de Arial, e encontrou 220 campos dinâmicos configurados.

Foram corrigidas e salvas cinco páginas, com novas miniaturas:

- Terça e quarta verde — Feed: limite direito do WhatsApp.
- Quinta da carne — A4: limite direito de texto dinâmico.
- Terça e quarta mais verde — Feed: limite direito do WhatsApp.
- Quarta mais verde — A4: limite direito do WhatsApp.
- Quinta da carne — Story atual: rodapé, títulos, ícones, divisores e endereço, mantendo as duas linhas do Instagram visíveis.

As cinco páginas alteradas foram renderizadas com seus assets reais. Foram preservados fontes, escalas, conteúdo, produtos e preços. As mudanças foram relidas do armazenamento e verificadas; a atualização dos registros protegeu contra alterações concorrentes do canvas. A regra de correção é idempotente e não invade a zona de produtos quando falta espaço.

Limite da auditoria: as 84 páginas passaram pela medição dos campos configurados; a inspeção visual com todos os assets foi realizada nas cinco páginas alteradas. Outros textos decorativos ou incorporados nas imagens não são campos dinâmicos.

Seis formatos não têm campos dinâmicos identificados e não foram classificados como validados: Terça verde (Feed), Segunda suína (TV) e Independênica de preços baixos (A4, Feed, Story e TV). Nos dois primeiros há textos estáticos; nos quatro últimos não há objetos de texto.

Validação local: 36 testes relacionados, typecheck e build aprovados. A proteção automática está no código local; este trabalho não fez commit, push ou deploy.
