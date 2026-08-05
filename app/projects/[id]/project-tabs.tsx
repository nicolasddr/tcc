import { TabList, Tab } from '@/app/components/ui/tabs'
import {
  ChartIcon,
  RepeatIcon,
  BookIcon,
  CheckCircleIcon,
  HistoryIcon,
} from '@/app/components/ui/icons'

const soon = 'Ainda não implementado'

export function ProjectTabs() {
  return (
    <TabList className="mt-6">
      <Tab icon={<ChartIcon />} active>
        Visão geral
      </Tab>
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
