// Rótulos de exibição (PT) para os códigos de papel e status de projeto/membro.
// Neutro: usado pela página do projeto e pela lista do dashboard.

export function roleLabel(role: string): string {
  return role === 'administrator' ? 'Administrador' : role === 'evaluator' ? 'Avaliador' : role
}

export function projectStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'completed':
      return 'Concluído'
    case 'archived':
      return 'Arquivado'
    default:
      return status
  }
}

// Rótulo (PT) do status de um membro dentro do projeto (HU-025). Usado na lista de
// membros da página do projeto.
export function memberStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'pending_onboarding':
      return 'Onboarding pendente'
    case 'inactive':
      return 'Inativo'
    default:
      return status
  }
}
