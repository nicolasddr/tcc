import { TabList, Tab } from '@/app/components/ui/tabs'
import {
  ChartIcon,
  RepeatIcon,
  BookIcon,
  FileTextIcon,
  ListIcon,
} from '@/app/components/ui/icons'

const soon = 'Ainda não implementado'

export type ProjectTab = 'overview' | 'codebook' | 'prompt' | 'items' | 'rounds'

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
        <>
          <Tab
            icon={<BookIcon />}
            href={`/projects/${projectId}/codebook`}
            active={active === 'codebook'}
          >
            Codebook
          </Tab>
          <Tab
            icon={<FileTextIcon />}
            href={`/projects/${projectId}/prompt`}
            active={active === 'prompt'}
          >
            Prompt
          </Tab>
          <Tab
            icon={<ListIcon />}
            href={`/projects/${projectId}/items`}
            active={active === 'items'}
          >
            Itens
          </Tab>
        </>
      ) : null}

      {isAdmin ? (
        <Tab
          icon={<RepeatIcon />}
          href={`/projects/${projectId}/rounds`}
          active={active === 'rounds'}
        >
          Rodadas
        </Tab>
      ) : (
        <Tab icon={<RepeatIcon />} hint={soon}>
          Rodadas
        </Tab>
      )}
    </TabList>
  )
}
