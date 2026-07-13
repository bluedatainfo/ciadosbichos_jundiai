export interface ParsedRow {
  [key: string]: string
}

export interface ParseResult {
  headers: string[]
  rows: ParsedRow[]
  errors: string[]
}

export function parseCSV(text: string): ParseResult {
  const errors: string[] = []
  const lines: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',' || char === ';') {
        current.push(field)
        field = ''
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i++
        current.push(field)
        lines.push(current)
        current = []
        field = ''
      } else {
        field += char
      }
    }
  }
  if (field || current.length > 0) {
    current.push(field)
    lines.push(current)
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['Arquivo vazio ou inválido.'] }
  }

  const delimiter = text.includes(';') && !text.includes(',') ? ';' : ','
  if (delimiter === ';') {
    return parseCSV(text.replace(/;/g, ','))
  }

  const headers = lines[0].map((h) => h.trim())
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.length === 1 && !line[0].trim()) continue
    const row: ParsedRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (line[j] || '').trim()
    }
    rows.push(row)
  }

  if (rows.length === 0) {
    errors.push('Nenhuma linha de dados encontrada além do cabeçalho.')
  }

  return { headers, rows, errors }
}

export async function parseFile(file: File): Promise<ParseResult> {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (isExcel) {
    return {
      headers: [],
      rows: [],
      errors: [
        'Arquivos Excel (.xlsx) não podem ser processados diretamente. Por favor, exporte para CSV (.csv) e tente novamente.',
      ],
    }
  }
  const text = await file.text()
  return parseCSV(text)
}
