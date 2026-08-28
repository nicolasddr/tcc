import { ITEM_CONTENT_MAX, ITEM_FILE_BYTES_MAX } from '@/lib/limits'

const TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.yaml',
  '.yml',
  '.log',
  '.rst',
  '.tex',
]

const CODE_EXTENSIONS = [
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.py',
  '.rb',
  '.php',
  '.java',
  '.kt',
  '.scala',
  '.go',
  '.rs',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cc',
  '.cs',
  '.swift',
  '.m',
  '.r',
  '.jl',
  '.lua',
  '.pl',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.sql',
  '.css',
  '.scss',
  '.less',
  '.vue',
  '.svelte',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
]

export const TEXT_FILE_EXTENSIONS: string[] = [...TEXT_EXTENSIONS, ...CODE_EXTENSIONS]

export const TEXT_FILE_ACCEPT = TEXT_FILE_EXTENSIONS.join(',')

export const TEXT_FILE_EXAMPLES = '.txt, .md, .csv, .tsv, .json, .xml, .html, .yaml, .log'

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.pages']

function megabytes(bytes: number): string {
  const rounded = Math.ceil((bytes / 1024 / 1024) * 10) / 10
  return rounded.toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

export const ITEM_FILE_LIMIT_LABEL = `${megabytes(ITEM_FILE_BYTES_MAX)} MB`

const FORMAT_REFUSED =
  `Este formato de arquivo não é aceito. Envie um arquivo de texto (${TEXT_FILE_EXAMPLES}) ` +
  'ou um arquivo de código, ou cole o conteúdo direto no campo.'

const DOCUMENT_REFUSED =
  'Arquivos PDF e Word não são aceitos nesta fase. Abra o arquivo no programa de origem, ' +
  'exporte o conteúdo como texto e envie o arquivo de texto.'

const NOT_TEXT =
  'Não foi possível ler este arquivo como texto: o conteúdo parece ser binário, mesmo com ' +
  'uma extensão aceita. Envie o conteúdo em texto puro.'

const EMPTY_FILE = 'O arquivo não tem conteúdo de texto para carregar no campo.'

function fileTooLarge(bytes: number): string {
  return (
    `O arquivo tem ${megabytes(bytes)} MB e o limite é ${ITEM_FILE_LIMIT_LABEL}. ` +
    'Envie um arquivo menor ou cole no campo só o trecho que interessa.'
  )
}

export function normalizeItemContent(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
}

export function itemContentError(content: string): string | null {
  if (content.length <= ITEM_CONTENT_MAX) return null
  return `O conteúdo do item pode ter no máximo ${ITEM_CONTENT_MAX} caracteres, e este tem ${content.length}.`
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return ''
  return fileName.slice(dot).toLowerCase()
}

export type ItemFileResult = { error: string } | { text: string }

export async function readItemFile(file: File): Promise<ItemFileResult> {
  const extension = extensionOf(file.name)

  if (DOCUMENT_EXTENSIONS.includes(extension)) return { error: DOCUMENT_REFUSED }
  if (!TEXT_FILE_EXTENSIONS.includes(extension)) return { error: FORMAT_REFUSED }
  if (file.size > ITEM_FILE_BYTES_MAX) return { error: fileTooLarge(file.size) }

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    return { error: NOT_TEXT }
  }
  if (decoded.includes('\u0000')) return { error: NOT_TEXT }

  const text = normalizeItemContent(decoded)
  if (!text.trim()) return { error: EMPTY_FILE }

  const tooLong = itemContentError(text)
  if (tooLong) return { error: tooLong }

  return { text }
}
