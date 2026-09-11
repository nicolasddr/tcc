import { Badge } from '@/app/components/ui/badge'
import { InfoTooltip } from '@/app/components/ui/tooltip'

export const NO_VERSION_EXPLANATION =
  'Nenhuma versão salva ainda. O primeiro salvamento cria a versão 1.'

export function versionExplanation(versionNumber: number, isOpen: boolean): string {
  return isOpen
    ? `Enquanto nenhuma rodada usar esta versão, salvar altera a própria versão. Assim que uma rodada a usar, ela congela e o salvamento seguinte cria a versão ${versionNumber + 1}.`
    : `Esta versão já foi usada por uma rodada e não muda mais. A próxima alteração salva cria a versão ${versionNumber + 1}, com o conteúdo copiado desta.`
}

export function VersionStatus({
  version,
  isOpen,
}: {
  version: { versionNumber: number } | null
  isOpen: boolean
}) {
  if (!version) {
    return <p className="m-0 text-[13px] text-muted">{NO_VERSION_EXPLANATION}</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span className="text-[13px] font-semibold text-ink">
        Versão {version.versionNumber}
      </span>
      <Badge tone={isOpen ? 'info' : 'neutral'}>
        {isOpen ? 'em aberto' : 'congelada'}
      </Badge>
      <InfoTooltip text={versionExplanation(version.versionNumber, isOpen)} />
    </div>
  )
}
