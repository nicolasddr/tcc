import { describe, it, expect } from 'vitest'
import {
  COMPARISON_AGREEMENT_ROW,
  COMPARISON_EMPTY,
  COMPARISON_TOTAL_ROW,
  REFERENCE_COMPARISON_HELP,
  REFERENCE_COMPARISON_POINTS,
  closedOn,
  comparedPhase,
  comparedVersions,
  comparisonAgreementRow,
  comparisonRows,
  referenceLine,
  type ComparisonRow,
} from '@/app/projects/[id]/(tabs)/rounds/reference-comparison-labels'
import type { ComparedRound } from '@/app/projects/[id]/(tabs)/rounds/reference-comparison'
import type { RoundAgreements } from '@/app/projects/[id]/(tabs)/rounds/agreement-matrix'
import type { Quality, QualityPair } from '@/app/projects/[id]/(tabs)/rounds/quality'
import {
  AGREEMENT_WITHOUT_OUTLIERS_LABEL,
  CELL_UNRATED_LABEL,
  NOT_CALCULABLE_LABEL,
} from '@/app/projects/[id]/(tabs)/rounds/agreement-labels'
import {
  QUALITY_UNRATED,
  QUALITY_UNRATED_WITHOUT_OUTLIERS,
} from '@/app/projects/[id]/(tabs)/rounds/quality-labels'
import { scaleLabel } from '@/app/projects/[id]/(tabs)/evaluate/scale'
import { ROUND_CLOSED, ROUND_OPEN } from '@/app/projects/[id]/(tabs)/rounds/round-status'
import { PHASE_3, PHASE_4 } from '@/app/projects/[id]/pipeline/preconditions'
import type { Agreement } from '@/lib/agreement'

function calculable(alpha: number): Agreement {
  return { calculable: true, alpha, units: 10, raters: 3 }
}

const NOT_CALCULABLE: Agreement = {
  calculable: false,
  reason: 'few_evaluators',
  units: 4,
  raters: 1,
}

type Kind = 'general' | 'per_response'

function criterion(
  name: string,
  all: Agreement | null,
  withoutOutliers: Agreement | null = null,
  kind: Kind = 'general',
): RoundAgreements[number] {
  const cell = (agreement: Agreement | null) =>
    agreement
      ? ({ state: 'calculated', agreement, profile: null } as const)
      : ({ state: 'unrated' } as const)
  return {
    column: {
      key: `${kind}-${name}`,
      name,
      isGeneral: kind === 'general',
      isPerResponse: kind === 'per_response',
      criteria: new Map(),
    },
    cell: cell(all),
    withoutOutliers: withoutOutliers ? cell(withoutOutliers) : null,
  }
}

const ICR = comparisonAgreementRow('Clareza')

function rated(high: number, medium: number, low: number): Quality {
  const total = high + medium + low
  return {
    rated: true,
    total,
    levels: [
      { value: 'high', count: high, share: high / total },
      { value: 'medium', count: medium, share: medium / total },
      { value: 'low', count: low, share: low / total },
    ],
  }
}

function side(
  roundNumber: number,
  phase: number,
  {
    all = calculable(0.741),
    withoutOutliers = null,
    agreement = [criterion('Clareza', all, withoutOutliers)],
    quality = { all: rated(25, 10, 5), withoutOutliers: null, excluded: 0 },
    status = ROUND_CLOSED,
  }: {
    all?: Agreement
    withoutOutliers?: Agreement | null
    agreement?: RoundAgreements
    quality?: QualityPair | null
    status?: string
  } = {},
): ComparedRound {
  return {
    id: `r${roundNumber}`,
    roundNumber,
    phase,
    status,
    closedAt: status === ROUND_CLOSED ? '2026-09-28T12:00:00.000Z' : null,
    codebookVersionNumber: 4,
    promptVersionNumber: 3,
    agreement,
    quality,
  }
}

function table(rows: ComparisonRow[]): [string, string, string][] {
  return rows.map((row) => [
    row.label,
    ...(row.cells.map((cell) =>
      cell === null ? COMPARISON_EMPTY : cell.count === undefined ? cell.text : `${cell.text} (${cell.count})`,
    ) as [string, string]),
  ])
}

describe('app/projects/[id]/rounds/reference-comparison-labels — comparisonRows', () => {
  it('uma linha por medida, a referência primeiro, sem linha de outlier quando ninguém tem', () => {
    const reference = side(4, PHASE_3)
    const round = side(6, PHASE_4, {
      all: calculable(0.688),
      quality: { all: rated(16, 11, 5), withoutOutliers: null, excluded: 0 },
    })

    expect(table(comparisonRows(reference, round))).toEqual([
      [ICR, '0,741', '0,688'],
      [scaleLabel('high'), '62,5% (25)', '50% (16)'],
      [scaleLabel('medium'), '25% (10)', '34,4% (11)'],
      [scaleLabel('low'), '12,5% (5)', '15,6% (5)'],
      [COMPARISON_TOTAL_ROW, '40', '32'],
    ])
  })

  it('as linhas de Alto, Médio e Baixo levam o nível, e só as de medida principal são destacadas', () => {
    const rows = comparisonRows(side(4, PHASE_3), side(6, PHASE_4))

    expect(rows.map((row) => row.level ?? null)).toEqual([null, 'high', 'medium', 'low', null])
    expect(rows.map((row) => row.secondary)).toEqual([false, false, false, false, true])
  })

  it('com outlier só num lado, cada medida ganha a linha sem outlier e o outro lado mostra o traço', () => {
    const reference = side(4, PHASE_3, {
      withoutOutliers: calculable(0.802),
      quality: { all: rated(25, 10, 5), withoutOutliers: rated(20, 8, 4), excluded: 1 },
    })
    const round = side(6, PHASE_4, { all: calculable(0.688) })

    const without = (label: string) => `${label} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`
    expect(table(comparisonRows(reference, round))).toEqual([
      [ICR, '0,741', '0,688'],
      [without(ICR), '0,802', COMPARISON_EMPTY],
      [scaleLabel('high'), '62,5% (25)', '62,5% (25)'],
      [without(scaleLabel('high')), '62,5% (20)', COMPARISON_EMPTY],
      [scaleLabel('medium'), '25% (10)', '25% (10)'],
      [without(scaleLabel('medium')), '25% (8)', COMPARISON_EMPTY],
      [scaleLabel('low'), '12,5% (5)', '12,5% (5)'],
      [without(scaleLabel('low')), '12,5% (4)', COMPARISON_EMPTY],
      [COMPARISON_TOTAL_ROW, '40', '40'],
      [without(COMPARISON_TOTAL_ROW), '32', COMPARISON_EMPTY],
    ])

    const rows = comparisonRows(reference, round)
    expect(rows.filter((row) => row.label.endsWith(AGREEMENT_WITHOUT_OUTLIERS_LABEL)).every((row) => row.secondary)).toBe(true)
  })

  it('ICR não calculável e Qualidade sem nota aparecem por extenso, sem número', () => {
    const reference = side(4, PHASE_3, {
      all: NOT_CALCULABLE,
      withoutOutliers: NOT_CALCULABLE,
      quality: { all: { rated: false, total: 0 }, withoutOutliers: { rated: false, total: 0 }, excluded: 1 },
    })
    const round = side(6, PHASE_4)

    const rows = table(comparisonRows(reference, round))
    expect(rows[0]).toEqual([ICR, NOT_CALCULABLE_LABEL, '0,741'])
    expect(rows[1][1]).toBe(NOT_CALCULABLE_LABEL)
    expect(rows[2][1]).toBe(COMPARISON_EMPTY)
    expect(rows.at(-2)![1]).toBe(QUALITY_UNRATED)
    expect(rows.at(-1)![1]).toBe(QUALITY_UNRATED_WITHOUT_OUTLIERS)

    const cell = comparisonRows(reference, round)[0].cells[0]
    expect(cell?.muted).toBe(true)
  })

  it('um lado sem Qualidade mostra o traço nas linhas de Qualidade', () => {
    const rows = table(comparisonRows(side(4, PHASE_3, { quality: null }), side(6, PHASE_4)))
    expect(rows.slice(1).map((row) => row[1])).toEqual([
      COMPARISON_EMPTY,
      COMPARISON_EMPTY,
      COMPARISON_EMPTY,
      COMPARISON_EMPTY,
    ])
  })
})

describe('app/projects/[id]/rounds/reference-comparison-labels — ICR por critério', () => {
  it('uma linha de ICR por critério, ligada por nome e tipo, com o traço do lado que não tem o critério', () => {
    const reference = side(4, PHASE_3, {
      agreement: [
        criterion('Relevance', calculable(-0.031)),
        criterion('Diversity', calculable(0.548), null, 'per_response'),
      ],
    })
    const round = side(6, PHASE_4, {
      agreement: [
        criterion('Relevance', calculable(0.702)),
        criterion('Diversity', calculable(0.611)),
        criterion('Fluência', null, null, 'per_response'),
      ],
    })

    expect(table(comparisonRows(reference, round)).slice(0, 4)).toEqual([
      [comparisonAgreementRow('Relevance'), '-0,031', '0,702'],
      [comparisonAgreementRow('Diversity'), '0,548', COMPARISON_EMPTY],
      [comparisonAgreementRow('Diversity'), COMPARISON_EMPTY, '0,611'],
      [comparisonAgreementRow('Fluência'), COMPARISON_EMPTY, CELL_UNRATED_LABEL],
    ])
    expect(comparisonRows(reference, round).slice(0, 4).map((row) => row.secondary)).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  it('com outlier num lado, cada critério ganha a sua linha sem os marcados', () => {
    const reference = side(4, PHASE_3, {
      agreement: [
        criterion('Relevance', calculable(-0.031), calculable(0.2)),
        criterion('Diversity', calculable(0.548), calculable(0.6)),
      ],
    })
    const round = side(6, PHASE_4, {
      agreement: [criterion('Relevance', calculable(0.702)), criterion('Diversity', calculable(0.611))],
    })

    const without = (label: string) => `${label} ${AGREEMENT_WITHOUT_OUTLIERS_LABEL}`
    expect(table(comparisonRows(reference, round)).slice(0, 4)).toEqual([
      [comparisonAgreementRow('Relevance'), '-0,031', '0,702'],
      [without(comparisonAgreementRow('Relevance')), '0,200', COMPARISON_EMPTY],
      [comparisonAgreementRow('Diversity'), '0,548', '0,611'],
      [without(comparisonAgreementRow('Diversity')), '0,600', COMPARISON_EMPTY],
    ])
  })

  it('a linha da referência na lista traz o ICR de cada critério', () => {
    const reference = side(4, PHASE_3, {
      agreement: [
        criterion('Relevance', calculable(-0.031)),
        criterion('Diversity', NOT_CALCULABLE, null, 'per_response'),
      ],
    })

    expect(referenceLine(reference)).toBe(
      `Referência: rodada 4 · ${COMPARISON_AGREEMENT_ROW} Relevance -0,031 · ` +
        `Diversity ${NOT_CALCULABLE_LABEL} · Alto 62,5% · Médio 25% · Baixo 12,5%`,
    )
  })
})

describe('app/projects/[id]/rounds/reference-comparison-labels — cabeçalho', () => {
  it('as versões aparecem uma vez quando as duas rodadas fixaram as mesmas', () => {
    expect(comparedVersions(side(4, PHASE_3), side(6, PHASE_4))).toBe(
      'Codebook v4 · Prompt v3 nas duas',
    )
  })

  it('com versões diferentes, cada rodada aparece com as suas', () => {
    const round = { ...side(6, PHASE_4), codebookVersionNumber: 5 }
    expect(comparedVersions(side(4, PHASE_3), round)).toBe(
      'Rodada 4: Codebook v4 · Prompt v3 · Rodada 6: Codebook v5 · Prompt v3',
    )
  })

  it('a coluna da referência diz que é a referência, e a outra só a fase', () => {
    expect(comparedPhase(side(4, PHASE_3), true)).toBe(`Fase ${PHASE_3} · referência`)
    expect(comparedPhase(side(6, PHASE_4, { status: ROUND_OPEN }), false)).toBe(`Fase ${PHASE_4}`)
  })

  it('a data de fechamento vem por extenso', () => {
    expect(closedOn('2026-09-28T12:00:00.000Z')).toBe('fechada em 28/09/2026')
  })
})

describe('app/projects/[id]/rounds/reference-comparison-labels — a ajuda da comparação', () => {
  it('o ⓘ define a rodada de referência, e o resto vira tópicos', () => {
    expect(REFERENCE_COMPARISON_HELP.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(25)
    expect(REFERENCE_COMPARISON_HELP).toContain(
      'a que validou as versões de codebook e de prompt que a Fase 4 testa',
    )

    expect(REFERENCE_COMPARISON_POINTS.length).toBeGreaterThanOrEqual(1)
    expect(REFERENCE_COMPARISON_POINTS.length).toBeLessThanOrEqual(3)
    const points = REFERENCE_COMPARISON_POINTS.join(' ')
    expect(points).toContain('mesmo cálculo da lista de rodadas')
    expect(points).toContain('as suas marcas de outlier')
    expect(points).toContain('A ferramenta não diz se a diferença basta: quem lê é você.')
  })
})
