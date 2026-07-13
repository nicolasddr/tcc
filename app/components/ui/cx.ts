// Junta classes ignorando valores falsy. As primitivas aceitam um `className` extra do
// chamador (ex.: uma classe de layout da página), então precisamos concatenar sem trazer
// uma dependência só para isso.
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
