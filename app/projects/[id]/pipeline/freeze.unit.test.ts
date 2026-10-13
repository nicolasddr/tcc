import { describe, it, expect } from 'vitest'
import {
  FROZEN_BADGE_HELP,
  FROZEN_BADGE_LABEL,
  FROZEN_RETURN_LINK,
  frozenLead,
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

describe('app/projects/[id]/pipeline/freeze — o congelamento da Fase 4', () => {
  it.each([PHASE_1, PHASE_2, PHASE_3])('a Fase %i não congela nada', (phase) => {
    expect(isFrozen(phase)).toBe(false)
  })

  it('a Fase 4 congela', () => {
    expect(isFrozen(PHASE_4)).toBe(true)
  })

  it('a mensagem do codebook é uma frase só, que manda voltar à Fase 3', () => {
    expect(frozenMessage('codebook')).toBe(
      `Codebook congelado na Fase ${PHASE_4}, para o teste de replicação. ` +
        `Para refinar, volte à Fase ${PHASE_3}.`,
    )
  })

  it('a mensagem do prompt diz o que congela, o que continua editável e manda voltar à Fase 3', () => {
    expect(frozenMessage('prompt')).toBe(
      `Texto do prompt congelado na Fase ${PHASE_4}, para o teste de replicação. ` +
        'Nome, descrição e registro de mudanças continuam editáveis. ' +
        `Para refinar o texto, volte à Fase ${PHASE_3}.`,
    )
  })

  it.each(SUBJECTS)(
    'a mensagem do %s é o trecho do aviso seguido do texto do link',
    (subject) => {
      expect(FROZEN_RETURN_LINK).toBe(`volte à Fase ${PHASE_3}`)
      expect(frozenMessage(subject)).toBe(`${frozenLead(subject)} ${FROZEN_RETURN_LINK}.`)
    },
  )

  it('as duas mensagens são diferentes', () => {
    expect(frozenMessage('codebook')).not.toBe(frozenMessage('prompt'))
  })

  it.each(SUBJECTS)('a mensagem do %s não tem palavra de juízo', (subject) => {
    expect(frozenMessage(subject)).not.toMatch(JUDGEMENT_WORDS)
  })

  it('o selo da visão geral diz que codebook e prompt estão congelados', () => {
    expect(FROZEN_BADGE_LABEL).toBe('Codebook e prompt congelados')
  })

  it('a ajuda do selo diz por que congela: a replicação mede o que a Fase 3 avaliou', () => {
    expect(FROZEN_BADGE_HELP).toContain('replicação')
    expect(FROZEN_BADGE_HELP).toContain(`o que a Fase ${PHASE_3} avaliou`)
  })

  it('a ajuda do selo diz o que fica congelado, o que continua editável e como mudar', () => {
    expect(FROZEN_BADGE_HELP).toContain('rodada de referência')
    expect(FROZEN_BADGE_HELP).toContain(`Fase ${PHASE_4}`)
    expect(FROZEN_BADGE_HELP).toContain('Metadados do prompt e itens seguem editáveis')
    expect(FROZEN_BADGE_HELP).toContain(`volte à Fase ${PHASE_3}`)
    expect(FROZEN_BADGE_HELP).not.toMatch(JUDGEMENT_WORDS)
    expect(FROZEN_BADGE_HELP.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(35)
  })
})
