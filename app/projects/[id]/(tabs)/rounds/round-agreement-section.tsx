import { Section } from '@/app/components/ui/section'
import type { CodebookCriterion, CodebookDefinition } from '../../pipeline/codebook'
import type { RoundMark } from '../../round-usage'
import type { EvaluatorEffort, RoundObservation } from './agreement'
import { evaluatedRaters, evaluatedResponses, withoutExcluded } from './agreement-pair'
import { AgreementNotes, AgreementWarnings, type RoundSample } from './agreement-panel'
import { AgreementMatrixTable } from './agreement-matrix-table'
import { matrixColumns } from './agreement-matrix'
import { byDefinitionSummary } from './agreement-labels'
import { CriterionAgreementTable } from './criterion-agreement-table'
import { ByDefinition } from './by-definition'
import { excludedMemberIds, type OutlierMark } from './outliers'
import { AGREEMENT_SECTION_ID } from './reading-shortcuts'
import { isOpen, type RoundSummary } from './rounds'

export type AgreementRound = Pick<
  RoundSummary,
  'roundNumber' | 'status' | 'phase' | 'closedAt' | 'codebookVersionNumber'
>

export function agreementSectionTitle(round: AgreementRound): string {
  return round.closedAt
    ? `Concordância e confiabilidade na rodada ${round.roundNumber}, fechada`
    : `Concordância e confiabilidade na rodada ${round.roundNumber}`
}

export function roundAgreementSection({
  round,
  observations,
  outliers,
  effort,
  participation,
  definitions,
  criteria,
}: {
  round: AgreementRound
  observations: RoundObservation[]
  outliers: OutlierMark[]
  effort: EvaluatorEffort[]
  participation?: Readonly<Record<string, RoundMark>>
  definitions: CodebookDefinition[]
  criteria: CodebookCriterion[]
}) {
  const excluded = excludedMemberIds(outliers)
  const open = isOpen(round)
  const sampleOf = (group: readonly RoundObservation[]): RoundSample => ({
    raters: evaluatedRaters(group),
    responses: evaluatedResponses(group),
  })
  const sample = {
    all: sampleOf(observations),
    withoutOutliers:
      excluded.size > 0 ? sampleOf(withoutExcluded(observations, excluded)) : null,
  }
  const hasCodebook = definitions.length > 0 && criteria.length > 0
  const matrix = (
    <AgreementMatrixTable
      definitions={definitions}
      criteria={criteria}
      observations={observations}
      codebookVersionNumber={round.codebookVersionNumber}
    />
  )

  return (
    <Section
      id={AGREEMENT_SECTION_ID}
      className="scroll-mt-6"
      title={agreementSectionTitle(round)}
      help="Krippendorff's Alpha ordinal"
    >
      <div className="flex flex-col gap-4">
        <AgreementWarnings sample={sample} />

        {hasCodebook ? (
          <>
            <CriterionAgreementTable
              definitions={definitions}
              criteria={criteria}
              observations={observations}
              excluded={excluded}
            />

            <ByDefinition
              summary={byDefinitionSummary(
                definitions.length,
                matrixColumns(definitions, criteria).length,
              )}
            >
              {matrix}
            </ByDefinition>
          </>
        ) : (
          matrix
        )}

        <AgreementNotes
          effort={open ? [] : effort}
          outliers={outliers}
          {...(participation && !open ? { participation } : {})}
        />
      </div>
    </Section>
  )
}
