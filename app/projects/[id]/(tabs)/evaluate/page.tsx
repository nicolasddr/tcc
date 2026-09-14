import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import {
  loadCodebookVersion,
  type CodebookCriterion,
  type CodebookDefinition,
} from '../../pipeline/codebook'
import { resolveCells, type CodebookCell } from '../../pipeline/criteria'
import {
  listRoundResponses,
  loadRoundResponse,
  type ResponseDetail,
} from '../../pipeline/responses'
import { loadOpenRound, type OpenRound } from '../rounds/rounds'
import { requireEvaluator } from './access'
import {
  loadEvaluatedResponseIds,
  loadEvaluationOf,
  type SubmittedEvaluation,
} from './evaluation'
import { nextResponseId, pickResponseId } from './queue'
import { EvaluationForm } from './evaluation-form'
import { ButtonLink } from '@/app/components/ui/button'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'

type EvaluateView = {
  round: OpenRound | null
  response: ResponseDetail | null
  cells: CodebookCell<CodebookDefinition, CodebookCriterion>[]
  submitted: SubmittedEvaluation | null
  nextId: string | null
}

const empty: Omit<EvaluateView, 'round'> = {
  response: null,
  cells: [],
  submitted: null,
  nextId: null,
}

export default async function ProjectEvaluatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ response?: string }>
}) {
  const { id } = await params
  const requested = (await searchParams).response ?? null
  const userId = await requireUserId()

  const { round, response, cells, submitted, nextId } = await transaction<EvaluateView>(
    async (tx) => {
      const { memberId } = await requireEvaluator(id, userId, tx)

      const round = await loadOpenRound(id, tx)
      if (!round) return { round: null, ...empty }

      const queue = await listRoundResponses(round.id, tx)
      const evaluated = await loadEvaluatedResponseIds(round.id, memberId, tx)
      const currentId = pickResponseId(queue, evaluated, requested)
      if (!currentId) return { round, ...empty }

      if (currentId !== requested) {
        redirect(`/projects/${id}/evaluate?response=${currentId}`)
      }

      const codebook = await loadCodebookVersion(id, round.codebookVersionId, tx)

      return {
        round,
        response: await loadRoundResponse(round.id, currentId, tx),
        cells: codebook ? resolveCells(codebook.definitions, codebook.criteria) : [],
        submitted: await loadEvaluationOf(currentId, memberId, tx),
        nextId: nextResponseId(queue, evaluated, currentId),
      }
    },
  )

  return (
    <Section
      title={round ? `Avaliar na rodada ${round.roundNumber}` : 'Avaliar respostas'}
      hint="Cada resposta é avaliada uma vez, em cada critério de cada definição do codebook que esta rodada fixou. O envio é definitivo."
    >
      {!round ? (
        <EmptyState>
          Este projeto não tem rodada aberta agora. Quando o administrador abrir uma
          rodada, as respostas dela aparecem aqui para avaliar.
        </EmptyState>
      ) : !response ? (
        <EmptyState>
          A rodada {round.roundNumber} ainda não tem resposta gerada. Assim que o
          administrador gerar as respostas, elas aparecem aqui.
        </EmptyState>
      ) : cells.length === 0 ? (
        <EmptyState>
          O codebook que a rodada {round.roundNumber} fixou não tem critério nenhum, e
          sem critério não há o que avaliar.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <EvaluationForm
            key={response.id}
            projectId={id}
            roundNumber={round.roundNumber}
            response={response}
            cells={cells}
            submitted={submitted}
          />

          {submitted && nextId ? (
            <div>
              <ButtonLink
                variant="secondary"
                href={`/projects/${id}/evaluate?response=${nextId}`}
              >
                Avaliar a próxima resposta
              </ButtonLink>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  )
}
