const SHARE_FORMAT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function shareNumber(share: number): string {
  return SHARE_FORMAT.format(share * 100)
}

export function formatShare(share: number): string {
  return `${shareNumber(share)}%`
}
