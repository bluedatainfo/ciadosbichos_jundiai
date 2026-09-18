/**
 * Normalizadores e utilitários para importação do legado Access 2.0 (BD_TESTE)
 * Colunas esperadas:
 * CTRL, NOME, ENDE, NUME, BAIR, CEP, CIDA, ESTA, TEL1, TEL2, TEL3, EMAIL, CPF, RG, INST,
 * ANIM, ESPE, RACA, PELA, SEXO, NASC, CHIP, VIVO, TEXTO, ULTV, DTRG,
 * VAC1, VAC2, VAC3, VAC4, VAC5, VTX1, VTX2, VTX3, VTX4, VTX5, DBTX
 */

/**
 * Limpa caracteres corrompidos originados de encoding MS-DOS / ASCII antigo
 * Ex: caixas não imprimíveis, bytes inválidos, trailing spaces
 */
export function sanitizeText(val: string | null | undefined): string {
  if (!val) return ''
  let result = ''
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i)
    // Manter quebras de linha e tabs: \t (9), \n (10), \r (13)
    if (code === 9 || code === 10 || code === 13) {
      result += val[i]
      continue
    }
    // Filtrar apenas caracteres de controle verdadeiros:
    // C0 controls (0-8, 11-12, 14-31), DEL (127), e replacement char (0xfffd)
    // ATENÇÃO: NÃO filtrar faixa 128-159 indiscriminadamente se já decodificado,
    // mas sim apenas controles C1 puros e caracteres de caixa quebrados.
    // Caracteres acentuados latinos (á, é, í, ó, ú, ç, ã, õ, Â, Ê, Î, Ô, Û, etc.)
    // ficam em 160-255 ou acima e NUNCA devem ser descartados!
    if (
      code < 32 ||
      code === 127 ||
      code === 0xfffd ||
      code === 0x25a1 ||
      code === 0x25a0 ||
      code === 0x25af
    ) {
      continue
    }
    result += val[i]
  }
  return result.trim()
}

/**
 * Normaliza datas com múltiplos formatos legados:
 * - "06/04/02" (DD/MM/YY) -> 2002 ou 1902
 * - "18/02/03" (DD/MM/YY) -> 2003
 * - "23/11/1989" ou "23/11/89" (DD/MM/YYYY ou DD/MM/YY)
 * - "Thu Nov 23 1989" (formato Date toString)
 * - "1989-11-23" (ISO YYYY-MM-DD)
 * - Rejeita lixo como CEPs "13.200-200" ou números corrompidos
 */
export function normalizeDate(val: string | null | undefined): string | null {
  if (!val) return null
  const clean = sanitizeText(val)
  if (!clean) return null

  // Rejeita padrões óbvios de CEP / telefone
  if (/^\d{2}\.\d{3}-\d{3}$/.test(clean) || /^\d{5}-\d{3}$/.test(clean)) {
    return null
  }

  // 1. Formato DD/MM/YYYY ou DD/MM/YY (com barra ou traço)
  const dmyMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    let year = parseInt(dmyMatch[3], 10)

    if (year < 100) {
      // Regra de século: se YY > 50 -> 19YY, senão 20YY
      year = year > 50 ? 1900 + year : 2000 + year
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      if (!isNaN(d.getTime())) {
        return d.toISOString()
      }
    }
  }

  // 2. Formato YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10)
    const day = parseInt(ymdMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      if (!isNaN(d.getTime())) {
        return d.toISOString()
      }
    }
  }

  // 3. Formato textual em inglês: "Thu Nov 23 1989", "Nov 23 1989", etc.
  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  }
  const textDateMatch = clean.match(
    /(?:[a-z]{3}\s+)?([a-z]{3})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/i,
  )
  if (textDateMatch) {
    const mStr = textDateMatch[1].toLowerCase()
    const month = months[mStr]
    const day = parseInt(textDateMatch[2], 10)
    const year = parseInt(textDateMatch[3], 10)
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day, 12, 0, 0))
      if (!isNaN(d.getTime())) {
        return d.toISOString()
      }
    }
  }

  // 4. Fallback padrão Date.parse
  const parsed = Date.parse(clean)
  if (!isNaN(parsed)) {
    const d = new Date(parsed)
    // Garantir que é um ano razoável (1950 a 2100)
    const year = d.getUTCFullYear()
    if (year >= 1950 && year <= 2100) {
      return d.toISOString()
    }
  }

  return null
}

/**
 * Normaliza espécies legadas
 * CAN -> Canino, FEL -> Felino, etc.
 */
export function normalizeSpecies(raw: string | null | undefined): string {
  const clean = sanitizeText(raw).toUpperCase()
  if (!clean) return 'Canino' // fallback padrão
  if (
    clean === 'CAN' ||
    clean.includes('CANIN') ||
    clean === 'CAO' ||
    clean === 'CÃO' ||
    clean === 'CACHORRO'
  ) {
    return 'Canino'
  }
  if (clean === 'FEL' || clean.includes('FELIN') || clean === 'GATO' || clean === 'GATA') {
    return 'Felino'
  }
  if (clean === 'AVE' || clean === 'PASSARO' || clean === 'PÁSSARO') {
    return 'Ave'
  }
  if (clean === 'EQU' || clean.includes('EQUIN') || clean === 'CAVALO') {
    return 'Equino'
  }
  if (clean === 'BOV' || clean.includes('BOVIN')) {
    return 'Bovino'
  }
  if (clean === 'ROEDOR' || clean === 'HAMSTER' || clean === 'COELHO') {
    return 'Silvestre'
  }
  // Se for qualquer outra palavra, capitalizar
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
}

/**
 * Normaliza gênero do paciente
 */
export function normalizeGender(raw: string | null | undefined): 'Macho' | 'Fêmea' {
  const clean = sanitizeText(raw).toUpperCase()
  if (clean === 'F' || clean.startsWith('FEM') || clean.startsWith('FÊM')) {
    return 'Fêmea'
  }
  return 'Macho'
}

/**
 * Normaliza situação de óbito:
 * - VIVO === "0" ou "N" ou "NAO" ou "NÃO" ou DBTX contém "OBITO"/"ÓBITO" -> deceased = true
 */
export function normalizeDeceased(
  vivoRaw: string | null | undefined,
  dbtxRaw: string | null | undefined,
): boolean {
  const vivo = sanitizeText(vivoRaw).toUpperCase()
  const dbtx = sanitizeText(dbtxRaw).toUpperCase()

  if (vivo === '0' || vivo === 'N' || vivo === 'NAO' || vivo === 'NÃO' || vivo === 'FALSE') {
    return true
  }
  if (dbtx.includes('OBIT') || dbtx.includes('ÓBIT') || dbtx.includes('FALEC')) {
    return true
  }
  return false
}

/**
 * Representa uma evolução clínica extraída do campo TEXTO
 */
export interface ExtractedClinicalEntry {
  date: string | null
  rawDateStr: string
  text: string
  timestamp: number
}

/**
 * Separa o campo TEXTO corrido em entradas individuais por data.
 * O Access armazena histórico contínuo com marcações de datas como:
 * "06/04/02. Consulta..." ou "18/02/03: Retorno..." ou "25/08/1999 - Vacina..."
 * Retorna as entradas ordenadas em ordem CRONOLÓGICA.
 *
 * Cada chamada instancia regex novo localmente para total segurança contra estado compartilhado.
 */
export function extractClinicalHistory(
  rawText: string | null | undefined,
): ExtractedClinicalEntry[] {
  const clean = sanitizeText(rawText)
  if (!clean) return []

  // Regex para detectar início de entrada por data:
  // Exemplos: "06/04/02.", "18/02/03:", "23/11/1989 -", "15.08.01:", "12/05/2004 "
  const datePattern = /(?:^|\n|\r\n?|\s{2,})(\d{1,2}[./-](\d{1,2})[./-](\d{2,4}))(?:[.:\-\s]+)/g

  const entries: { startIndex: number; dateStr: string; matchEnd: number }[] = []
  let match: RegExpExecArray | null

  while ((match = datePattern.exec(clean)) !== null) {
    entries.push({
      startIndex: match.index,
      dateStr: match[1],
      matchEnd: match.index + match[0].length,
    })
  }

  // Se nenhuma data foi encontrada no texto, retorna o texto inteiro como entrada única
  if (entries.length === 0) {
    return [
      {
        date: null,
        rawDateStr: '',
        text: clean,
        timestamp: 0,
      },
    ]
  }

  const results: ExtractedClinicalEntry[] = []

  // Se houver texto ANTES da primeira data identificada
  if (entries[0].startIndex > 0) {
    const preText = clean.substring(0, entries[0].startIndex).trim()
    if (preText) {
      results.push({
        date: null,
        rawDateStr: '',
        text: preText,
        timestamp: 0,
      })
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const current = entries[i]
    const nextStart = i + 1 < entries.length ? entries[i + 1].startIndex : clean.length
    const content = clean.substring(current.matchEnd, nextStart).trim()
    const isoDate = normalizeDate(current.dateStr)
    const timestamp = isoDate ? new Date(isoDate).getTime() : 0

    // O texto completo inclui a data original como cabeçalho da anotação
    const fullEntryText = content ? `[${current.dateStr}] ${content}` : `[${current.dateStr}]`

    results.push({
      date: isoDate,
      rawDateStr: current.dateStr,
      text: fullEntryText,
      timestamp,
    })
  }

  // Ordenar em ordem cronológica (datas mais antigas primeiro, sem data no final ou início)
  results.sort((a, b) => {
    if (a.timestamp === 0 && b.timestamp === 0) return 0
    if (a.timestamp === 0) return 1
    if (b.timestamp === 0) return -1
    return a.timestamp - b.timestamp
  })

  return results
}

/**
 * Representa um agendamento / retorno legado extraído da linha do Access
 */
export interface ExtractedLegacyAppointment {
  date: string
  type: 'return' | 'vaccine' | 'surgery' | 'consultation'
  status: 'completed' | 'scheduled'
  notes: string
  source: 'internal'
}

/**
 * Detecta o tipo de agendamento a partir do texto clínico
 */
function detectAppointmentType(text: string): 'return' | 'vaccine' | 'surgery' | 'consultation' {
  const upper = text.toUpperCase()
  if (upper.includes('CIRURG') || upper.includes('EUTAN') || upper.includes('CASTRA')) {
    return 'surgery'
  }
  if (
    upper.includes('RET') ||
    upper.includes('RETORNO') ||
    upper.includes('REVISAO') ||
    upper.includes('REVISÃO')
  ) {
    return 'return'
  }
  if (
    upper.includes('VACIN') ||
    upper.includes('REVACIN') ||
    upper.includes('TRIPLICE') ||
    upper.includes('TRÍPLICE') ||
    upper.includes('RAIVA')
  ) {
    return 'vaccine'
  }
  return 'consultation'
}

/**
 * Extrai os agendamentos / retornos históricos vinculados à linha do paciente:
 * 1. A partir das entradas datadas do TEXTO (consultas e retornos históricos ocorridos)
 * 2. A partir da última visita (ULTV), caso não esteja já contemplada nas datas de histórico
 */
export function extractAppointmentsFromRow(
  row: Record<string, string>,
  clinicalEntries: ExtractedClinicalEntry[],
): ExtractedLegacyAppointment[] {
  const appointments: ExtractedLegacyAppointment[] = []
  const recordedDates = new Set<string>()

  // 1. Criar agendamento histórico para cada entrada clínica que possui data válida
  for (const entry of clinicalEntries) {
    if (!entry.date) continue

    const dateKey = entry.date.slice(0, 10)
    if (recordedDates.has(dateKey)) continue
    recordedDates.add(dateKey)

    const appType = detectAppointmentType(entry.text)
    // Limitar notas a um resumo limpo (até 250 caracteres)
    const cleanNotes = entry.text.slice(0, 250)

    appointments.push({
      date: entry.date,
      type: appType,
      status: 'completed',
      notes: `[Migração Access] ${cleanNotes}`,
      source: 'internal',
    })
  }

  // 2. Se houver ULTV (última visita) e essa data não estiver registrada ainda, criar agendamento de retorno/visita
  const ultvRaw = sanitizeText(row.ULTV || row.ultv)
  if (ultvRaw) {
    const ultvIso = normalizeDate(ultvRaw)
    if (ultvIso) {
      const ultvKey = ultvIso.slice(0, 10)
      if (!recordedDates.has(ultvKey)) {
        recordedDates.add(ultvKey)
        appointments.push({
          date: ultvIso,
          type: 'return',
          status: 'completed',
          notes: `[Migração Access] Registro de última visita (ULTV: ${ultvRaw})`,
          source: 'internal',
        })
      }
    }
  }

  // Ordenar cronologicamente
  appointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return appointments
}

/**
 * Extrai vacinas das colunas VAC1-VAC5 e VTX1-VTX5
 */
export interface ExtractedVaccine {
  date: string | null
  rawDate: string
  name: string
  notes?: string
}

export function extractVaccinesFromRow(row: Record<string, string>): ExtractedVaccine[] {
  const vaccines: ExtractedVaccine[] = []

  for (let i = 1; i <= 5; i++) {
    const dateVal = sanitizeText(row[`VAC${i}`] || row[`vac${i}`])
    const textVal = sanitizeText(row[`VTX${i}`] || row[`vtx${i}`])

    if (!dateVal && !textVal) continue

    const isoDate = normalizeDate(dateVal)
    // Se tem texto, usamos o texto como nome da vacina; se não tem, colocamos "Vacina (registro legado)"
    const name = textVal || (dateVal ? `Vacina VAC${i}` : 'Vacina')

    vaccines.push({
      date: isoDate,
      rawDate: dateVal,
      name,
      notes: dateVal && !isoDate ? `Data original: ${dateVal}` : undefined,
    })
  }

  return vaccines
}

/**
 * Chave de desduplicação do tutor
 * Desduplica por CPF (quando presente e válido) e/ou por Nome normalizado
 */
export function getTutorDedupeKey(name: string, cpf?: string): string {
  const cleanCpf = (cpf || '').replace(/\D/g, '')
  if (cleanCpf && cleanCpf.length === 11) {
    return `cpf:${cleanCpf}`
  }
  const cleanName = sanitizeText(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `name:${cleanName}`
}

/**
 * Normaliza um texto para uso em chave de composição (sem acentos, minúsculo, sem pontuações extras)
 */
export function normalizeKeyText(val: string | null | undefined): string {
  return sanitizeText(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Gera a base da chave composta para o paciente da importação legada:
 * tutor + ANIM + ESPE (+ NASC e PELA quando existirem)
 *
 * Formato base:
 * tutorKey|anim|espe[|nasc][|pela]
 */
export function getPatientCompositeBaseKey(params: {
  tutorDedupeKey: string
  anim?: string
  espe?: string
  nasc?: string
  pela?: string
}): string {
  const tutorKey = params.tutorDedupeKey || 'tutor:none'
  const anim = normalizeKeyText(params.anim) || 'semnome'
  const espe = normalizeKeyText(normalizeSpecies(params.espe)) || 'canino'

  const parts = [tutorKey, anim, espe]

  const nascClean = normalizeKeyText(params.nasc)
  if (nascClean) {
    parts.push(`nasc:${nascClean}`)
  }

  const pelaClean = normalizeKeyText(params.pela)
  if (pelaClean) {
    parts.push(`pela:${pelaClean}`)
  }

  return parts.join('|')
}

/**
 * Constrói a chave final com contador de ocorrências (ex: `#1`, `#2`)
 * Colisões exatas no mesmo arquivo ganham contador sequencial incrementado,
 * garantindo pacientes separados na ordem do arquivo, enquanto reimportações
 * encontram a mesma chave `#N` e não duplicam.
 */
export function buildPatientImportKey(baseKey: string, occurrenceNumber: number = 1): string {
  return `${baseKey}#${occurrenceNumber}`
}
