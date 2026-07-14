// Rótulos (PT) e formatação para o inbox de notificações (HU-010/011) e para a
// lista de convites pendentes (HU-019). Módulo neutro: usado no Server Component
// do dashboard para montar texto pronto antes de passar ao sino (client).

// Payload denormalizado ao emitir a notificação (ver lib/notifications/invitation).
export type NotificationPayload = {
  project_name?: string
  inviter_name?: string
  result?: 'approved' | 'rejected'
  [key: string]: unknown
}

// Texto exibido para cada tipo de notificação in-platform.
export function notificationText(type: string, payload: NotificationPayload): string {
  switch (type) {
    case 'project_invitation':
      return `Você foi convidado para o projeto “${payload.project_name ?? 'sem nome'}” por ${
        payload.inviter_name ?? 'um administrador'
      }.`
    case 'permission_decision':
      return payload.result === 'approved'
        ? 'Sua solicitação para criar projetos foi aprovada.'
        : 'Sua solicitação para criar projetos foi recusada.'
    default:
      return 'Você tem uma nova notificação.'
  }
}

// Data curta (dd/mm/aaaa) em PT. Formatada no servidor e passada como string para
// evitar divergência de hidratação entre fuso do servidor e do cliente.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}
