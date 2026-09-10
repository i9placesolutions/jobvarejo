# Revisão dos campos dinâmicos — 10/09/2026

Revisados 124 formatos de 26 modelos e do encarte de referência, com os valores visíveis nas capturas do usuário. Medição com Fabric e fontes carregadas; 114 páginas tiveram ajustes e renderizações de conferência. O resultado da medição final não contém textos fora dos limites. Páginas sem campos dinâmicos não comprovam substituição de dados.

Correções: origem central dos slots de logo; uso da largura disponível da faixa de validade; altura do rodapé com endereço completo. Apenas zonas vazias de modelos cederam altura quando necessário; cards existentes foram preservados. Um endereço antigo tinha tamanho padrão 82 e tamanho visual 12 aplicado somente aos caracteres da amostra: uniformizado em 12.

Persistência: mesmas páginas e modelos, caminhos novos no storage, comparação do conteúdo original, atualização condicional de revisão, SHA-256 do JSON relido. As cópias já abertas não são substituídas automaticamente.

Código: preserva centro geométrico ao trocar slot por imagem e reaproveita limites do slot ao trocar a marca; refaz a largura da validade na atualização dos dados. Sem novas propriedades de serialização.

Validação: 20 testes passaram, typecheck e build concluídos. Preview do aplicativo em http://127.0.0.1:3005/ abre login; o fluxo autenticado completo não foi exercitado. As imagens nesta pasta são renderizações Fabric com os dados reais da captura, não screenshots de uma sessão autenticada.
