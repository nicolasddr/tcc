import { TabList, Tab } from '@/app/components/ui/tabs'
import {
  ChartIcon,
  RepeatIcon,
  BookIcon,
  CheckCircleIcon,
  HistoryIcon,
  SlidersIcon,
} from '@/app/components/ui/icons'

const soon = 'Ainda não implementado'

export type ProjectTab = 'overview' | 'pipeline'

export function ProjectTabs({
  projectId,
  isAdmin,
  active = 'overview',
}: {
  projectId: string
  isAdmin: boolean
  active?: ProjectTab
}) {
  return (
    <TabList className="mt-6">
      <Tab
        icon={<ChartIcon />}
        href={`/projects/${projectId}`}
        active={active === 'overview'}
      >
        Visão geral
      </Tab>
      {isAdmin ? (
        <Tab
          icon={<SlidersIcon />}
          href={`/projects/${projectId}/pipeline`}
          active={active === 'pipeline'}
        >
          Configuração
        </Tab>
      ) : null}
      <Tab icon={<RepeatIcon />} hint={soon}>
        Iterações
      </Tab>
      <Tab icon={<BookIcon />} hint={soon}>
        Codebook
      </Tab>
      <Tab icon={<CheckCircleIcon />} hint={soon}>
        Avaliações
      </Tab>
      <Tab icon={<HistoryIcon />} hint={soon}>
        Histórico
      </Tab>
    </TabList>
  )
}
