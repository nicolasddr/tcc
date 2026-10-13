'use client'

import { deactivateMember, leaveProject } from '@/app/projects/actions'
import { Button } from '@/app/components/ui/button'
import { ConfirmDialog, DialogLines } from '@/app/components/ui/confirm-dialog'

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
    <ConfirmDialog
      trigger={(open) => (
        <Button variant="dangerGhost" onClick={open}>
          Desativar
        </Button>
      )}
      title={`Desativar ${memberName}?`}
      confirmLabel="Desativar"
      pendingLabel="Desativando…"
      tone="danger"
      action={deactivateMember}
      fields={{ project_id: projectId, member_user_id: memberUserId }}
    >
      <DialogLines
        lines={[
          'A pessoa perde o acesso a este projeto e deixa de participar como avaliadora.',
          'As avaliações que ela já enviou continuam gravadas e continuam entrando no cálculo de concordância. Para tirar as notas dela do cálculo de uma rodada, marque-a como outlier naquela rodada.',
          'Convites pendentes dela são cancelados.',
        ]}
      />
    </ConfirmDialog>
  )
}

// HU-022: o Avaliador sai voluntariamente (com confirmação). Confirma antes de enviar
// porque a saída desativa a própria participação (a fatia 05 impede reativar-se depois).
export function LeaveProjectButton({ projectId }: { projectId: string }) {
  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button variant="danger" onClick={open}>
          Sair do projeto
        </Button>
      )}
      title="Sair deste projeto?"
      confirmLabel="Sair do projeto"
      pendingLabel="Saindo…"
      tone="danger"
      action={leaveProject}
      fields={{ project_id: projectId }}
    >
      <DialogLines
        lines={[
          'Você deixa de participar como avaliador. Suas avaliações são preservadas.',
          'Você não poderá reativar sozinho: só o administrador pode readmiti-lo.',
        ]}
      />
    </ConfirmDialog>
  )
}
