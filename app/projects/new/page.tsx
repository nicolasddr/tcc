import { requireUserId } from '@/lib/supabase/server'
import { canCreateProjects, hasPendingPermissionRequest } from '@/lib/authz'
import { Alert } from '@/app/components/ui/alert'
import { Card } from '@/app/components/ui/card'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'
import { NewProjectForm } from './new-project-form'
import { RequestPermissionForm } from './request-permission-form'

export default async function NewProjectPage() {
  const userId = await requireUserId()

  const allowed = await canCreateProjects(userId)
  const pendingRequest = allowed ? false : await hasPendingPermissionRequest(userId)

  return (
    <PageShell
      header={
        <TopBar>
          <BackLink href="/dashboard" />
        </TopBar>
      }
    >
      <PageTitle>Criar novo projeto</PageTitle>

      {allowed ? (
        <>
          <PageSubtitle>
            Você se torna o Administrador deste projeto e pode convidar avaliadores
            depois.
          </PageSubtitle>
          <Card padding="lg">
            <NewProjectForm />
          </Card>
        </>
      ) : pendingRequest ? (
        <>
          <PageSubtitle>
            Sua conta ainda não tem permissão para criar projetos.
          </PageSubtitle>
          <Alert tone="notice">
            Sua solicitação está em análise. Você receberá uma notificação assim que ela
            for aprovada ou recusada.
          </Alert>
        </>
      ) : (
        <>
          <PageSubtitle>
            Sua conta ainda não tem permissão para criar projetos. Solicite o acesso e um
            administrador da plataforma vai analisar o pedido.
          </PageSubtitle>
          <RequestPermissionForm />
        </>
      )}
    </PageShell>
  )
}
