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

  if (!text || !text.trim()) {
    return { headers: [], rows: [], errors: ['Arquivo vazio ou inválido.'] }
  }

  // Detectar delimitador analisando a primeira linha
  let firstLine = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n' || text[i] === '\r') break
    firstLine += text[i]
  }

  // Contar delimitadores na primeira linha fora de aspas
  let commaCount = 0
  let semicolonCount = 0
  let tabCount = 0
  let inQ = false
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i]
    if (c === '"') inQ = !inQ
    else if (!inQ) {
      if (c === ',') commaCount++
      else if (c === ';') semicolonCount++
      else if (c === '\t') tabCount++
    }
  }

  let delimiter = ','
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ';'
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t'
  }

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
      } else if (char === delimiter) {
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

  // Normalizar cabeçalhos: remover aspas residuais e espaços, além de caracteres de controle
  const headers = lines[0].map((h) => {
    let clean = h.replace(/^["']|["']$/g, '')
    let result = ''
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i)
      if (code < 32 || (code >= 127 && code <= 159) || code === 0xfffd) {
        continue
      }
      result += clean[i]
    }
    return result.trim()
  })
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
        'Arquivos Excel (.xlsx/.xls) devem ser salvos/exportados como arquivo de texto delimitado por vírgula (.csv ou .txt) para a migração.',
      ],
    }
  }
  // Suporta .csv e .txt
  const text = await file.text()
  return parseCSV(text)
}
