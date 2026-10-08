import { PHASE_3, PHASE_4 } from './preconditions'

export type FrozenSubject = 'codebook' | 'prompt'

export function isFrozen(phase: number): boolean {
  return phase >= PHASE_4
}

const FROZEN_PREFIX =
  `Este projeto está na Fase ${PHASE_4}, que congela o codebook e o prompt enquanto ` +
  `dura, para que o teste de replicação meça exatamente o que a Fase ${PHASE_3} avaliou.`

export const FROZEN_BADGE_LABEL = 'codebook e prompt congelados'

export const FROZEN_BADGE_HELP =
  `Codebook e prompt ficam como na rodada de referência enquanto o projeto estiver na Fase ${PHASE_4}. ` +
  `Os metadados do prompt e os itens continuam editáveis. Para mudar, volte à Fase ${PHASE_3}.`

export function frozenMessage(subject: FrozenSubject): string {
  switch (subject) {
    case 'codebook':
      return `${FROZEN_PREFIX} Para refinar o codebook, é preciso voltar à Fase ${PHASE_3}.`
    case 'prompt':
      return (
        `${FROZEN_PREFIX} Para refinar o texto do prompt, é preciso voltar à Fase ` +
        `${PHASE_3}. Nome, descrição e registro de mudanças continuam editáveis, ` +
        'porque não vão à LLM.'
      )
  }
}
