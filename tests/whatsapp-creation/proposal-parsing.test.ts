import { describe, expect, it } from 'vitest'
import { extractModelJson, interpretationRequest, newConversationState, parseProposal } from '../../server/utils/whatsapp-creation/conversation'

// Respostas reais do modelo (07/10/2026) que derrubavam mensagens como "oi" e "confirmar":
// o modelo devolve o contrato inteiro com vazios e a validação estrita recusava a mensagem toda.
const filledContract = (overrides: Record<string, unknown> = {}) => ({
  action: 'status', confirmationIntent: 'unclear', confirmationEvidence: '', productOperation: 'unclear',
  kind: '', additionalKinds: [], theme: '', catalogTheme: '', formats: [], division: '', pageCount: 0,
  products: [], validity: '', conditions: '', institutionalText: { title: '', message: '', callToAction: '' },
  choice: 0, script: '', itemNumbers: [], artifactNumbers: [], approvalRevision: 0, projectQuery: '', edits: [],
  ...overrides
})

describe('interpretação tolerante da resposta da IA', () => {
  it('aceita "oi" e "confirmar" com o contrato preenchido de vazios', () => {
    expect(parseProposal(filledContract({ action: 'new_order' }))).toEqual({ action: 'new_order', confirmationIntent: 'unclear', productOperation: 'unclear' })
    expect(parseProposal(filledContract({ action: 'status' })).action).toBe('status')
  })

  it('mantém os campos válidos e descarta só o que estiver fora do formato', () => {
    const proposal = parseProposal(filledContract({
      action: 'update', kind: 'encarte', formats: ['stories'], division: 'qualquer', choice: -1,
      products: [{ name: 'Picanha', price: '59,90', department: 'Açougue', unidade: 'kg', brand: null }],
      campoInventado: 'x'
    }))
    expect(proposal).toMatchObject({ action: 'update', kind: 'encarte', formats: ['stories'] })
    expect(proposal.division).toBeUndefined()
    expect(proposal.choice).toBeUndefined()
    expect(proposal.products).toEqual([{ name: 'Picanha', price: '59,90', department: 'Açougue', brand: '', variant: '', weight: '' }])
  })

  it('ação desconhecida vira atualização em vez de erro', () => {
    expect(parseProposal({ action: 'cumprimentar' }).action).toBe('update')
    expect(parseProposal(null).action).toBe('update')
  })

  it('pede um modelo reserva para limite ou queda do provedor principal', () => {
    const request = interpretationRequest(newConversationState(), 'oi', 'Rafa') as any
    expect(request.models.length).toBeGreaterThanOrEqual(2)
    expect(request.models[0]).toBe(request.model)
    expect(request.provider.allow_fallbacks).toBe(true)
  })

  it('aproveita o JSON completo do começo quando o modelo entra em repetição', () => {
    const looped = '{"action":"approve_data","confirmationIntent":"approve","confirmationEvidence":"confirmar {ok}"}' + ' confirmar confirmar'.repeat(500)
    expect(extractModelJson(looped)).toEqual({ action: 'approve_data', confirmationIntent: 'approve', confirmationEvidence: 'confirmar {ok}' })
    expect(extractModelJson('```json\n{"action":"status"}\n```')).toEqual({ action: 'status' })
    expect(extractModelJson('{"action":"upd')).toBeUndefined()
    expect(extractModelJson('sem json')).toBeUndefined()
  })
})
