# UX Quality Gates (checklist)

## Clareza e hierarquia
- [ ] A ação principal é óbvia em <3s
- [ ] Hierarquia visual guia a leitura (não “tudo igual”)
- [ ] Terminologia consistente (mesma coisa, mesmo nome)

## Estados e resiliência
- [ ] Loading tem skeleton/placeholder real (não spinner solto)
- [ ] Empty state ajuda a agir (CTA + explicação)
- [ ] Erro é acionável (o que aconteceu + o que fazer)
- [ ] Permission denied explica e orienta

## A11y e teclado
- [ ] Foco visível sempre
- [ ] Tab order faz sentido
- [ ] Não tem “focus trap” quebrado em modal
- [ ] Labels associadas em inputs
- [ ] Contraste razoável (principalmente texto)

## Densidade e esforço cognitivo
- [ ] Denso onde é trabalho, leve onde é decisão
- [ ] Progressive disclosure para opções avançadas
- [ ] Sem “poluição” (bordas, sombras, badges sem propósito)

## Microcopy (UX de texto)
- [ ] Botões são verbos claros (“Salvar”, “Publicar”, “Gerar relatório”)
- [ ] Evita culpa do usuário (“Algo deu errado” + próximo passo)
- [ ] Mensagens curtas, específicas, com contexto

## Performance percebida
- [ ] Feedback imediato ao clicar
- [ ] Otimiza re-render / listas grandes quando necessário
- [ ] Evita layout shift (CLS)