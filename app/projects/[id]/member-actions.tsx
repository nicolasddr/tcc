'use client'

import { useActionState } from 'react'
import {
  deactivateMember,
  grantAdminRole,
  leaveProject,
  revokeAdminRole,
  type GrantAdminState,
  type RevokeAdminState,
} from '@/app/projects/actions'
import {
  grantAdminConfirmationLines,
  revokeAdminConfirmationLines,
} from '@/app/projects/admin-role'
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
        <Button variant="danger" size="sm" onClick={open}>
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
          'Você não poderá reativar sozinho: só um administrador pode readmiti-lo.',
        ]}
      />
    </ConfirmDialog>
  )
}

const initialGrant: GrantAdminState = null

export function GrantAdminButton({
  projectId,
  memberUserId,
  memberName,
}: {
  projectId: string
  memberUserId: string
  memberName: string
}) {
  const [state, grant] = useActionState(grantAdminRole, initialGrant)

  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          Tornar administrador
        </Button>
      )}
      title={`Tornar ${memberName} administrador(a)?`}
      confirmLabel="Tornar administrador"
      pendingLabel="Concedendo…"
      action={grant}
      fields={{ project_id: projectId, member_user_id: memberUserId }}
      error={state && 'error' in state ? state.error : null}
    >
      <DialogLines lines={grantAdminConfirmationLines(memberName)} />
    </ConfirmDialog>
  )
}

const initialRevoke: RevokeAdminState = null

export function RevokeAdminButton({
  projectId,
  memberUserId,
  memberName,
  self,
  keepsEvaluator,
}: {
  projectId: string
  memberUserId: string
  memberName: string
  self: boolean
  keepsEvaluator: boolean
}) {
  const [state, revoke] = useActionState(revokeAdminRole, initialRevoke)
  const label = self ? 'Deixar de ser administrador' : 'Remover administrador'

  return (
    <ConfirmDialog
      trigger={(open) => (
        <Button variant="danger" size="sm" onClick={open}>
          {label}
        </Button>
      )}
      title={
        self
          ? 'Deixar de ser administrador(a) deste projeto?'
          : `Remover o acesso de administrador de ${memberName}?`
      }
      confirmLabel={label}
      pendingLabel="Removendo…"
      tone="danger"
      action={revoke}
      fields={{ project_id: projectId, member_user_id: memberUserId }}
      error={state && 'error' in state ? state.error : null}
    >
      <DialogLines
        lines={revokeAdminConfirmationLines({ name: memberName, self, keepsEvaluator })}
      />
    </ConfirmDialog>
  )
}
