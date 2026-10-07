import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
describe('fluxos n8n do piloto', () => {
  it.each(['enqueue', 'status'])('%s: entradas tipadas, retry e erro conectado; sem ativação ou OpenAI', name => {
    const flow = JSON.parse(readFileSync(`integrations/n8n/work-design/${name}.json`, 'utf8'))
    expect(flow.active).toBe(false)
    const trigger = flow.nodes.find((n: any) => n.type === 'n8n-nodes-base.executeWorkflowTrigger')
    expect(trigger.parameters.inputSource).toBe('workflowInputs')
    expect(trigger.parameters.workflowInputs.values.length).toBeGreaterThan(0)
    const http = flow.nodes.find((n: any) => n.type === 'n8n-nodes-base.httpRequest')
    expect(http.retryOnFail).toBe(true); expect(http.onError).toBe('continueErrorOutput')
    expect(flow.connections[http.name].main[1][0].node).toBe('Falha visível')
    expect(flow.nodes.find((n: any) => n.name === 'Falha visível').type).toBe('n8n-nodes-base.stopAndError')
    expect(flow.nodes.some((n: any) => /openai|langchain/i.test(n.type))).toBe(false)
    expect(http.parameters.options.redirect.redirect.followRedirects).toBe(false)
  })
})
