import { plural } from '@/lib/plural'

export type Progress = { evaluated: number; total: number }

export function progressMessage(progress: Progress): string {
  return (
    `${progress.evaluated} de ` +
    `${plural(progress.total, 'resposta avaliada', 'respostas avaliadas')} por você ` +
    'nesta rodada. O total pode crescer se o administrador gerar mais respostas.'
  )
}
