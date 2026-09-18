'use client'

import { deactivateMember, leaveProject } from '@/app/projects/actions'
import { SubmitButton } from '@/app/components/submit-button'

// HU-021: o Administrador desativa um avaliador (com confirmação). Botão inline na
// lista de membros; confirma antes de enviar porque a desativação tira o acesso.
export function DeactivateMemberButton({
  projectId,
  memberUserId,
  memberName,
}: {
  projectId: string
  memberUserId: string
  memberName: string
}) {
  return (
    <form
      action={deactivateMember}
      onSubmit={(e) => {
        if (
          !confirm(
            `Desativar ${memberName} neste projeto? A pessoa perde o acesso e deixa de participar como avaliadora. As avaliações que ela já enviou continuam gravadas e continuam entrando no cálculo de concordância — para tirar as notas dela do cálculo de uma rodada, marque-a como outlier naquela rodada. Convites pendentes dela são cancelados.`,
          )
        )
          e.preventDefault()
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="member_user_id" value={memberUserId} />
      <SubmitButton variant="dangerGhost" pendingText="Desativando…">
        Desativar
      </SubmitButton>
    </form>
  )
}

// HU-022: o Avaliador sai voluntariamente (com confirmação). Confirma antes de enviar
// porque a saída desativa a própria participação (a fatia 05 impede reativar-se depois).
export function LeaveProjectButton({ projectId }: { projectId: string }) {
  return (
    <form
      action={leaveProject}
      onSubmit={(e) => {
        if (
          !confirm(
            'Sair deste projeto? Você deixa de participar como avaliador. Suas avaliações são preservadas, mas você não poderá reativar sozinho — só o administrador pode readmiti-lo.',
          )
        )
          e.preventDefault()
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <SubmitButton variant="danger" pendingText="Saindo…">
        Sair do projeto
      </SubmitButton>
    </form>
  )
}
