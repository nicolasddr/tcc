import { notFound } from 'next/navigation'
import { requireUserId } from '@/lib/supabase/server'
import { transaction } from '@/lib/db'
import { loadCodebookVersion } from '../../../../pipeline/codebook'
import { PHASE_4 } from '../../../../pipeline/preconditions'
import { listEvaluatorEffort, loadRoundObservations } from '../../agreement'
import { loadRoundOutliers } from '../../outliers'
import { loadEvaluatorParticipation } from '../../participation'
import { participationBefore } from '../../participation-labels'
import { requireReviewAccess } from '../../review-access'
import { loadRoundHeader, roundHeaderChips } from '../../round-header'
import { roundAgreementSection } from '../../round-agreement-section'
import { BackLink } from '@/app/components/ui/shell'

export default async function RoundAgreementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; roundId: string }>
  searchParams: Promise<{ criterio?: string }>
}) {
  const { id, roundId } = await params
  const query = await searchParams
  const userId = await requireUserId()

  const view = await transaction(async (tx) => {
    const access = await requireReviewAccess(id, userId, tx)
    if (!access.isAdmin) notFound()

    const projectId = access.project.id
    const header = await loadRoundHeader(projectId, roundId, tx)
    if (!header) notFound()

    const { round } = header
    const codebook = await loadCodebookVersion(projectId, round.codebookVersionId, tx)

    return {
      header,
      observations: await loadRoundObservations(round.id, tx),
      outliers: await loadRoundOutliers(round.id, tx),
      effort: await listEvaluatorEffort(round.id, projectId, tx),
      participation:
        round.phase === PHASE_4 ? await loadEvaluatorParticipation(projectId, tx) : null,
      definitions: codebook?.definitions ?? [],
      criteria: codebook?.criteria ?? [],
    }
  })

  const { header, observations, outliers, effort, participation } = view
  const { round } = header

  return (
    <>
      <div className="mt-6">
        <BackLink href={`/projects/${id}/rounds`}>Voltar às rodadas</BackLink>
      </div>

      {roundHeaderChips(header)}

      {roundAgreementSection({
        round,
        observations,
        outliers,
        effort,
        definitions: view.definitions,
        criteria: view.criteria,
        ...(query.criterio ? { criterion: query.criterio } : {}),
        href: `/projects/${id}/rounds/${roundId}/agreement`,
        ...(participation
          ? { participation: participationBefore(participation, round.roundNumber) }
          : {}),
      })}
    </>
  )
}
