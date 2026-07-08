'use client'

import { removeMember, leaveProject } from '@/app/projects/actions'
import { SubmitButton } from '@/app/components/submit-button'

// HU-021: o Administrador remove um avaliador (com confirmação). Botão inline na
// lista de membros; confirma antes de enviar porque a remoção desativa o avaliador.
export function RemoveMemberButton({
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
      action={removeMember}
      onSubmit={(e) => {
        if (
          !confirm(
            `Remover ${memberName} do projeto? A pessoa deixa de participar como avaliador (as avaliações são preservadas). Convites pendentes dela são cancelados.`,
          )
        )
          e.preventDefault()
      }}
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="member_user_id" value={memberUserId} />
      <SubmitButton className="member-remove" pendingText="Removendo…">
        Remover
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
      <SubmitButton className="btn-decline" pendingText="Saindo…">
        Sair do projeto
      </SubmitButton>
    </form>
  )
}
