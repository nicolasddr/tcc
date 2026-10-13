import { PHASE_3, PHASE_4 } from './preconditions'

export type FrozenSubject = 'codebook' | 'prompt'

export function isFrozen(phase: number): boolean {
  return phase >= PHASE_4
}

export const FROZEN_BADGE_LABEL = 'Codebook e prompt congelados'

export const FROZEN_BADGE_HELP =
  `Na Fase ${PHASE_4}, codebook e prompt ficam como na rodada de referência, para a ` +
  `replicação medir o que a Fase ${PHASE_3} avaliou. Para mudá-los, volte à Fase ` +
  `${PHASE_3}. Metadados do prompt e itens seguem editáveis.`

export const FROZEN_RETURN_LINK = `volte à Fase ${PHASE_3}`

export function frozenLead(subject: FrozenSubject): string {
  switch (subject) {
    case 'codebook':
      return `Codebook congelado na Fase ${PHASE_4}, para o teste de replicação. Para refinar,`
    case 'prompt':
      return (
        `Texto do prompt congelado na Fase ${PHASE_4}, para o teste de replicação. ` +
        'Nome, descrição e registro de mudanças continuam editáveis. Para refinar o texto,'
      )
  }
}

export function frozenMessage(subject: FrozenSubject): string {
  return `${frozenLead(subject)} ${FROZEN_RETURN_LINK}.`
}
