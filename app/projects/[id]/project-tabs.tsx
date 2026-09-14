'use client'

import { usePathname } from 'next/navigation'
import { TabList, Tab } from '@/app/components/ui/tabs'
import {
  ChartIcon,
  RepeatIcon,
  BookIcon,
  FileTextIcon,
  ListIcon,
  CheckCircleIcon,
} from '@/app/components/ui/icons'

const soon = 'Ainda não implementado'

export type ProjectTab =
  | 'overview'
  | 'codebook'
  | 'prompt'
  | 'items'
  | 'rounds'
  | 'evaluate'

export function activeTab(pathname: string, projectId: string): ProjectTab {
  const rest = pathname.slice(`/projects/${projectId}`.length).split('/')[1]
  switch (rest) {
    case 'codebook':
      return 'codebook'
    case 'prompt':
      return 'prompt'
    case 'items':
      return 'items'
    case 'rounds':
      return 'rounds'
    case 'evaluate':
      return 'evaluate'
    default:
      return 'overview'
  }
}

export function ProjectTabs({
  projectId,
  isAdmin,
  isEvaluator,
}: {
  projectId: string
  isAdmin: boolean
  isEvaluator: boolean
}) {
  const active = activeTab(usePathname() ?? '', projectId)

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

      {isEvaluator ? (
        <Tab
          icon={<CheckCircleIcon />}
          href={`/projects/${projectId}/evaluate`}
          active={active === 'evaluate'}
        >
          Avaliar
        </Tab>
      ) : null}
    </TabList>
  )
}
