import { ITEM_CONTENT_MAX, ITEM_FILE_BYTES_MAX, ITEM_NAME_MAX } from '@/lib/limits'

const TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.bpmn',
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

export const TEXT_FILE_EXAMPLES = '.txt, .md, .csv, .tsv, .json, .xml, .bpmn, .html, .yaml, .log'

const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.odt', '.rtf', '.pages']

function megabytes(bytes: number): string {
  const rounded = Math.ceil((bytes / 1024 / 1024) * 10) / 10
  return rounded.toFixed(1).replace(/\.0$/, '').replace('.', ',')
}

export const ITEM_FILE_LIMIT_LABEL = `${megabytes(ITEM_FILE_BYTES_MAX)} MB`

export const ITEM_FILE_FORMATS = `Formatos de texto (${TEXT_FILE_EXAMPLES}) e arquivos de código, até ${ITEM_FILE_LIMIT_LABEL}.`

export const ITEM_FILE_NOTE =
  'O conteúdo entra no formulário e continua editável antes de cadastrar; o arquivo em si não é guardado.'


const FORMAT_REFUSED =
  `Este formato de arquivo não é aceito. Envie um arquivo de texto (${TEXT_FILE_EXAMPLES}) ` +
  'ou um arquivo de código, ou cole o conteúdo direto no campo.'

const DOCUMENT_REFUSED =
  'Arquivos PDF e Word não são aceitos nesta fase. Abra o arquivo no programa de origem, ' +
  'exporte o conteúdo como texto e envie o arquivo de texto.'

const NOT_TEXT =
  'Não foi possível ler este arquivo como texto: o conteúdo parece ser binário, mesmo com ' +
  'uma extensão aceita. Envie o conteúdo em texto puro.'

const NOT_TEXT_REASON = 'Não é texto puro'

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

export type ItemFileResult = { error: string; reason: string } | { text: string }

export async function readItemFile(file: File): Promise<ItemFileResult> {
  const extension = extensionOf(file.name)

  if (DOCUMENT_EXTENSIONS.includes(extension)) {
    return { error: DOCUMENT_REFUSED, reason: 'PDF e Word não são aceitos' }
  }
  if (!TEXT_FILE_EXTENSIONS.includes(extension)) {
    return { error: FORMAT_REFUSED, reason: 'Formato não aceito' }
  }
  if (file.size > ITEM_FILE_BYTES_MAX) {
    return { error: fileTooLarge(file.size), reason: `Maior que ${ITEM_FILE_LIMIT_LABEL}` }
  }

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    return { error: NOT_TEXT, reason: NOT_TEXT_REASON }
  }
  if (decoded.includes('\u0000')) return { error: NOT_TEXT, reason: NOT_TEXT_REASON }

  const text = normalizeItemContent(decoded)
  if (!text.trim()) return { error: EMPTY_FILE, reason: 'Arquivo vazio' }

  const tooLong = itemContentError(text)
  if (tooLong) {
    return {
      error: tooLong,
      reason: `Mais de ${ITEM_CONTENT_MAX.toLocaleString('pt-BR')} caracteres`,
    }
  }

  return { text }
}

export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

export type ItemBatchReady = {
  key: string
  name: string
  content: string
  duplicate: 'pool' | 'batch' | null
}

export type ItemBatchRefused = { key: string; name: string; reason: string }

export type ItemBatch = { ready: ItemBatchReady[]; refused: ItemBatchRefused[]; bytes: number }

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { numeric: true })
}

function batchNameReason(name: string): string | null {
  if (!name) return 'Nome em branco'
  if (name.length > ITEM_NAME_MAX) return `Nome com mais de ${ITEM_NAME_MAX} caracteres`
  return null
}

export async function readItemBatch(files: File[], poolNames: string[]): Promise<ItemBatch> {
  const read: { key: string; name: string; content: string }[] = []
  const refused: ItemBatchRefused[] = []

  for (const [index, file] of files.entries()) {
    const key = `${index}:${file.name}`
    const name = baseName(file.name).trim()

    const nameReason = batchNameReason(name)
    if (nameReason) {
      refused.push({ key, name: file.name, reason: nameReason })
      continue
    }

    const result = await readItemFile(file)
    if ('error' in result) {
      refused.push({ key, name: file.name, reason: result.reason })
      continue
    }
    read.push({ key, name, content: result.text })
  }

  const inPool = new Set(poolNames.map(nameKey))
  const timesInBatch = new Map<string, number>()
  for (const entry of read) {
    const key = nameKey(entry.name)
    timesInBatch.set(key, (timesInBatch.get(key) ?? 0) + 1)
  }

  const ready: ItemBatchReady[] = read.map((entry) => {
    const key = nameKey(entry.name)
    const duplicate = inPool.has(key) ? 'pool' : timesInBatch.get(key)! > 1 ? 'batch' : null
    return { ...entry, duplicate }
  })

  const encoder = new TextEncoder()
  const bytes = ready.reduce(
    (sum, entry) =>
      sum + encoder.encode(entry.name).length + encoder.encode(entry.content).length,
    0,
  )

  return { ready: ready.sort(byName), refused: refused.sort(byName), bytes }
}
