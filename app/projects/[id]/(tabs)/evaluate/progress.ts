import { plural } from '@/lib/plural'

export type Progress = { evaluated: number; total: number }

export const PROGRESS_HELP = 'O total pode crescer se o administrador gerar mais respostas.'

export function progressMessage(progress: Progress): string {
  return (
    `${progress.evaluated} de ` +
    `${plural(progress.total, 'resposta avaliada', 'respostas avaliadas')} por você ` +
    'nesta rodada'
  )
}
