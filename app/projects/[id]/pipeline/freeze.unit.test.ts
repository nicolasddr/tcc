import { describe, it, expect } from 'vitest'
import {
  frozenMessage,
  isFrozen,
  type FrozenSubject,
} from '@/app/projects/[id]/pipeline/freeze'
import {
  PHASE_1,
  PHASE_2,
  PHASE_3,
  PHASE_4,
} from '@/app/projects/[id]/pipeline/preconditions'

const SUBJECTS: FrozenSubject[] = ['codebook', 'prompt']

const JUDGEMENT_WORDS = /aprov|reprov|replicou|generaliz/i

function sharedPrefix(a: string, b: string): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return a.slice(0, i)
}

describe('app/projects/[id]/pipeline/freeze — o congelamento da Fase 4', () => {
  it.each([PHASE_1, PHASE_2, PHASE_3])('a Fase %i não congela nada', (phase) => {
    expect(isFrozen(phase)).toBe(false)
  })

  it('a Fase 4 congela', () => {
    expect(isFrozen(PHASE_4)).toBe(true)
  })

  it.each(SUBJECTS)(
    'a mensagem do %s diz que a Fase 4 congela codebook e prompt e que refinar exige voltar à Fase 3',
    (subject) => {
      const message = frozenMessage(subject)
      expect(message).toContain(`Fase ${PHASE_4}`)
      expect(message).toContain('congela o codebook e o prompt')
      expect(message).toContain(`voltar à Fase ${PHASE_3}`)
    },
  )

  it('a mensagem do codebook fala em refinar o codebook', () => {
    expect(frozenMessage('codebook')).toContain('refinar o codebook')
  })

  it('a mensagem do prompt fala em refinar o texto do prompt e diz que os metadados continuam editáveis', () => {
    const message = frozenMessage('prompt')
    expect(message).toContain('refinar o texto do prompt')
    expect(message).toContain('Nome, descrição e registro de mudanças continuam editáveis')
  })

  it('as duas mensagens têm o mesmo formato: começam pelo mesmo trecho', () => {
    const prefix = sharedPrefix(frozenMessage('codebook'), frozenMessage('prompt'))
    expect(prefix).toContain(`Este projeto está na Fase ${PHASE_4}`)
    expect(prefix).toContain(`o que a Fase ${PHASE_3} avaliou.`)
  })

  it('as duas mensagens são diferentes', () => {
    expect(frozenMessage('codebook')).not.toBe(frozenMessage('prompt'))
  })

  it.each(SUBJECTS)('a mensagem do %s não tem palavra de juízo', (subject) => {
    expect(frozenMessage(subject)).not.toMatch(JUDGEMENT_WORDS)
  })
})
