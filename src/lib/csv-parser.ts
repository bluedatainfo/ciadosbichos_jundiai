export interface ParsedRow {
  [key: string]: string
}

export interface ParseResult {
  headers: string[]
  rows: ParsedRow[]
  errors: string[]
}

/**
 * Tabela de conversão do Code Page 850 (MS-DOS Latin-1 / Português Brasil) para Unicode
 * Usado com frequência por bancos legados como Access 2.0 / Clipper / DBase exportados no DOS
 */
const CP850_MAP: Record<number, string> = {
  0x80: 'Ç',
  0x81: 'ü',
  0x82: 'é',
  0x83: 'â',
  0x84: 'ä',
  0x85: 'à',
  0x86: 'å',
  0x87: 'ç',
  0x88: 'ê',
  0x89: 'ë',
  0x8a: 'è',
  0x8b: 'ï',
  0x8c: 'î',
  0x8d: 'ì',
  0x8e: 'Ä',
  0x8f: 'Å',
  0x90: 'É',
  0x91: 'æ',
  0x92: 'Æ',
  0x93: 'ô',
  0x94: 'ö',
  0x95: 'ò',
  0x96: 'û',
  0x97: 'ù',
  0x98: 'ÿ',
  0x99: 'Ö',
  0x9a: 'Ü',
  0x9b: 'ø',
  0x9c: '£',
  0x9d: 'Ø',
  0x9e: '×',
  0x9f: 'ƒ',
  0xa0: 'á',
  0xa1: 'í',
  0xa2: 'ó',
  0xa3: 'ú',
  0xa4: 'ñ',
  0xa5: 'Ñ',
  0xa6: 'ª',
  0xa7: 'º',
  0xa8: '¿',
  0xa9: '®',
  0xaa: '¬',
  0xab: '½',
  0xac: '¼',
  0xad: '¡',
  0xae: '«',
  0xaf: '»',
  0xb0: '░',
  0xb1: '▒',
  0xb2: '▓',
  0xb3: '│',
  0xb4: '┤',
  0xb5: 'Á',
  0xb6: 'Â',
  0xb7: 'À',
  0xb8: '©',
  0xb9: '╣',
  0xba: '║',
  0xbb: '╗',
  0xbc: '╝',
  0xbd: '¢',
  0xbe: '¥',
  0xbf: '┐',
  0xc0: '└',
  0xc1: '┴',
  0xc2: '┬',
  0xc3: '├',
  0xc4: '─',
  0xc5: '┼',
  0xc6: 'ã',
  0xc7: 'Ã',
  0xc8: '╚',
  0xc9: '╔',
  0xca: '╩',
  0xcb: '╦',
  0xcc: '╠',
  0xcd: '═',
  0xce: '╬',
  0xcf: '¤',
  0xd0: 'ð',
  0xd1: 'Ð',
  0xd2: 'Ê',
  0xd3: 'Ë',
  0xd4: 'È',
  0xd5: 'ı',
  0xd6: 'Í',
  0xd7: 'Î',
  0xd8: 'Ï',
  0xd9: '┘',
  0xda: '┌',
  0xdb: '█',
  0xdc: '▄',
  0xdd: '¦',
  0xde: 'Ì',
  0xdf: '▀',
  0xe0: 'Ó',
  0xe1: 'ß',
  0xe2: 'Ô',
  0xe3: 'Ò',
  0xe4: 'õ',
  0xe5: 'Õ',
  0xe6: 'µ',
  0xe7: 'þ',
  0xe8: 'Þ',
  0xe9: 'Ú',
  0xea: 'Û',
  0xeb: 'Ù',
  0xec: 'ý',
  0xed: 'Ý',
  0xee: '¯',
  0xef: '´',
  0xf0: '­',
  0xf1: '±',
  0xf2: '‗',
  0xf3: '¾',
  0xf4: '¶',
  0xf5: '§',
  0xf6: '÷',
  0xf7: '¸',
  0xf8: '°',
  0xf9: '¨',
  0xfa: '·',
  0xfb: '¹',
  0xfc: '³',
  0xfd: '²',
  0xfe: '■',
  0xff: ' ',
}

/**
 * Decodifica um Uint8Array para string tentando sequencialmente:
 * 1. UTF-8 estrito (fatal: true)
 * 2. Se falhar, avalia se os bytes se encaixam melhor em CP850 (MS-DOS) ou Windows-1252 / ISO-8859-1
 * 3. Faz o decode preservando todos os acentos e cedilhas.
 */
export function decodeBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  // 1. Tentar UTF-8 estrito
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    const text = utf8Decoder.decode(bytes)
    // Se não gerou erro e não contém replacement char 0xFFFD, avaliar
    if (!text.includes('\uFFFD')) {
      return text
    }
  } catch {
    // Não é UTF-8 válido, cair para decodificadores legados
  }

  // 2. Decodificar com Windows-1252
  let win1252Text = ''
  try {
    const winDecoder = new TextDecoder('windows-1252')
    win1252Text = winDecoder.decode(bytes)
  } catch {
    // Fallback ISO-8859-1 se o browser não aceitar 'windows-1252'
    const latinDecoder = new TextDecoder('iso-8859-1')
    win1252Text = latinDecoder.decode(bytes)
  }

  // 3. Decodificar com CP850 manual
  let cp850Text = ''
  let cp850Score = 0
  let win1252Score = 0

  // Contar características que indicam português com acentos
  // CP850 comuns: 0x82 (é), 0x87 (ç), 0x80 (Ç), 0xa0 (á), 0xa2 (ó), 0xa3 (ú), 0x88 (ê), 0x83 (â), 0xc6 (ã), 0xc7 (Ã), 0xe4 (õ), 0xe5 (Õ)
  // No Windows-1252, esses mesmos caracteres têm outros códigos: 0xE9 (é), 0xE7 (ç), 0xC7 (Ç), 0xE1 (á), 0xF3 (ó), 0xFA (ú), 0xEA (ê), 0xE3 (ã)...
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b >= 0x80) {
      if (
        b === 0x80 || // Ç
        b === 0x82 || // é
        b === 0x83 || // â
        b === 0x87 || // ç
        b === 0x88 || // ê
        b === 0xa0 || // á
        b === 0xa1 || // í
        b === 0xa2 || // ó
        b === 0xa3 || // ú
        b === 0xc6 || // ã
        b === 0xc7 || // Ã
        b === 0xe2 || // Ô
        b === 0xe4 || // õ
        b === 0xe5 // Õ
      ) {
        cp850Score++
      }

      if (
        b === 0xc1 || // Á
        b === 0xc9 || // É
        b === 0xcd || // Í
        b === 0xd3 || // Ó
        b === 0xda || // Ú
        b === 0xc3 || // Ã
        b === 0xc7 || // Ç
        b === 0xe1 || // á
        b === 0xe9 || // é
        b === 0xed || // í
        b === 0xf3 || // ó
        b === 0xfa || // ú
        b === 0xe3 || // ã
        b === 0xe7 || // ç
        b === 0xea || // ê
        b === 0xf4 // ô
      ) {
        win1252Score++
      }
    }
  }

  // Se a pontuação de CP850 for significativamente maior que Windows-1252, decodificar via mapa CP850
  if (cp850Score > win1252Score && cp850Score > 0) {
    let result = ''
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]
      if (b < 128) {
        result += String.fromCharCode(b)
      } else {
        result += CP850_MAP[b] || String.fromCharCode(b)
      }
    }
    return result
  }

  // Caso contrário, Windows-1252 é o padrão perfeito para exports ANSI/Windows
  return win1252Text
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

  // Normalizar cabeçalhos: remover aspas residuais e espaços, além de caracteres de controle C0 e replacement char
  const headers = lines[0].map((h) => {
    let clean = h.replace(/^["']|["']$/g, '')
    let result = ''
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i)
      if (code < 32 || code === 127 || code === 0xfffd) {
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
  // Suporta .csv e .txt lendo como buffer e decodificando com encoding adequado (UTF-8, Windows-1252, CP850)
  const arrayBuffer = await file.arrayBuffer()
  const text = decodeBuffer(arrayBuffer)
  return parseCSV(text)
}
