import { notFound, redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { requireUserId } from '@/lib/supabase/server'
import { transaction, projects, projectMembers } from '@/lib/db'
import { ProjectTabs } from '../project-tabs'
import { PhaseBar } from '../phase-bar'
import { PipelineChecklist } from './pipeline-checklist'
import { EMPTY_PIPELINE } from './preconditions'
import { loadCodebook } from './codebook'
import { CodebookEditor } from './codebook-editor'
import { defaultDefinitionType } from '@/app/projects/definition-types'
import { EmptyState } from '@/app/components/ui/empty-state'
import { Section } from '@/app/components/ui/section'
import {
  PageShell,
  TopBar,
  BackLink,
  PageTitle,
  PageSubtitle,
} from '@/app/components/ui/shell'

function Anchored({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      {children}
    </div>
  )
}

export default async function ProjectPipelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const userId = await requireUserId()

  const { project, memberships, codebook } = await transaction(async (tx) => {
    const [project] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        phase: projects.phase,
        taskType: projects.taskType,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)

    const memberships = await tx
      .select({ role: projectMembers.role, status: projectMembers.status })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, userId)))

    const codebook = project ? await loadCodebook(project.id, tx) : null

    return { project, memberships, codebook }
  })

  const isAdmin = memberships.some(
    (m) => m.role === 'administrator' && m.status === 'active',
  )
  const onboardingPending = memberships.some((m) => m.status === 'pending_onboarding')

  if (!project || !codebook) notFound()
  if (!isAdmin && onboardingPending) redirect(`/projects/${id}/onboarding`)
  if (!isAdmin) notFound()

  return (
    <PageShell
      width="wide"
      header={
        <TopBar>
          <BackLink href={`/projects/${id}`}>Voltar ao projeto</BackLink>
        </TopBar>
      }
    >
      <PageTitle>Configuração do pipeline</PageTitle>
      <PageSubtitle>{project.name}</PageSubtitle>

      <ProjectTabs projectId={project.id} isAdmin={isAdmin} active="pipeline" />

      <PhaseBar className="mt-4" current={project.phase} />

      <PipelineChecklist
        className="mt-3"
        inputs={{ ...EMPTY_PIPELINE, definitions: codebook.definitions.length }}
      />

      <Anchored id="definicoes">
        <Section
          title="Definições"
          hint="Os conceitos que estruturam a tarefa da LLM, cada um com título e tipo. A descrição de cada definição é escrita na Fase 2."
        >
          <CodebookEditor
            projectId={project.id}
            version={codebook.version}
            isOpen={codebook.isOpen}
            definitions={codebook.definitions}
            defaultType={defaultDefinitionType(project.taskType)}
          />
        </Section>
      </Anchored>

      <Anchored id="prompt">
        <Section
          title="Prompt"
          hint="A instrução enviada à LLM, versionada de forma independente do codebook."
        >
          <EmptyState>
            Nenhum texto de prompt escrito. O editor do prompt entra aqui.
          </EmptyState>
        </Section>
      </Anchored>

      <Anchored id="itens">
        <Section
          title="Itens de entrada"
          hint="O pool de itens do projeto: cada item vira uma resposta da LLM, e as fases seguintes amostram desse pool."
        >
          <EmptyState>
            Nenhum item de entrada cadastrado. O cadastro de itens entra aqui.
          </EmptyState>
        </Section>
      </Anchored>
    </PageShell>
  )
}
