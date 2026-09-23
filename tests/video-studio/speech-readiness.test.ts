import { describe, expect, it } from 'vitest'
import { speechReadinessIssue } from '../../shared/video-studio/speech-readiness.mjs'

describe('ElevenLabs speech readiness', () => {
  it('accepts a fully spoken retail offer', () => {
    expect(speechReadinessIssue([{ id: 'offer', text: 'Pernil suíno com osso, dezenove reais e noventa centavos o quilo.' }])).toBeNull()
  })
  it('stops ambiguous brand numbers and leftover symbols before paid speech', () => {
    expect(speechReadinessIssue([{ id: 'intro', text: 'I9 apresenta as ofertas!' }])).toMatch(/números/)
    expect(speechReadinessIssue([{ id: 'offer', text: 'Leve 3% off!' }])).toMatch(/números/)
    expect(speechReadinessIssue([{ id: 'offer', text: 'Oferta @ loja!' }])).toMatch(/símbolos/)
    expect(speechReadinessIssue([{ id: 'offer', text: 'Arroz pct por nove reais.' }])).toMatch(/unidade abreviada/)
  })
})
