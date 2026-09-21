# Modelo reutilizável Fecha Mês

O cartão Fecha Mês, na seleção de modelos de `/videos`, aplica a composição de vitrine refinada: abertura própria para TV e vertical, selo 3D, sticker, ofertas, validade pequena e encerramento com contatos.

`shared/video-studio/templates.ts` cria uma instância independente do estilo. Não copia o projeto de demonstração: marca, produtos, validade e roteiro começam vazios; a locução começa desligada. Música instrumental e efeitos próprios acompanham o modelo, sem referências a áudios privados de outra conta.

A página obtém a identidade da loja por `/api/videos/brand`, usando o usuário autenticado. A voz selecionável vem da lista da própria conta. O usuário adiciona suas ofertas, informa a validade e pode ativar a locução na etapa “Locução e som”. Trocar de estilo preserva seus dados e sua escolha de voz.

Datas e produtos da demonstração servem apenas para revisar o visual. Não são valores padrão dos novos projetos. O registro do catálogo permanece no código; esta implementação não cria uma galeria administrativa nem publica o projeto privado como modelo público.

Validação: `tests/video-studio/templates.test.ts` cobre instâncias independentes, ausência de dados e mídias privadas no modelo inicial e preservação dos dados ao trocar de estilo. A rota continua autenticada e CSR, usando a divisão de código existente do módulo de vídeo.
