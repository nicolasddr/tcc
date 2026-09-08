import { Badge } from '@/app/components/ui/badge'

export function VersionStatus({
  version,
  isOpen,
}: {
  version: { versionNumber: number } | null
  isOpen: boolean
}) {
  if (!version) {
    return (
      <p className="m-0 text-[13px] text-muted">
        Nenhuma versão salva ainda. O primeiro salvamento cria a versão 1.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-[13px] font-semibold text-ink">
        Versão {version.versionNumber}
      </span>
      {isOpen ? (
        <>
          <Badge tone="info">em aberto</Badge>
          <span className="text-[13px] text-muted">
            {`Enquanto nenhuma rodada usar esta versão, salvar altera a própria versão. Assim que uma rodada a usar, ela congela e o salvamento seguinte cria a versão ${version.versionNumber + 1}.`}
          </span>
        </>
      ) : (
        <>
          <Badge tone="neutral">congelada</Badge>
          <span className="text-[13px] text-muted">
            {`Esta versão já foi usada por uma rodada e não muda mais. A próxima alteração salva cria a versão ${version.versionNumber + 1}, com o conteúdo copiado desta.`}
          </span>
        </>
      )}
    </div>
  )
}
