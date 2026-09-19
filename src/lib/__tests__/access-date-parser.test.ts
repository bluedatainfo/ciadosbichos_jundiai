import {
  normalizeDate,
  extractClinicalHistory,
  extractClinicalHistoryWithDiagnostics,
  extractAppointmentsFromRow,
} from '@/lib/access-migration-utils'

/**
 * Suite de testes unitários para o parser de datas da migração do Access 2.0.
 * Pode ser executada no build/QA ou invocada diretamente.
 */
export function runAccessDateParserTests(): {
  passed: boolean
  results: { name: string; ok: boolean; message?: string }[]
} {
  const results: { name: string; ok: boolean; message?: string }[] = []

  function test(name: string, fn: () => void) {
    try {
      fn()
      results.push({ name, ok: true })
    } catch (err: any) {
      results.push({ name, ok: false, message: err?.message || String(err) })
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  // 1. normalizeDate - Formatos de 2 dígitos e 4 dígitos
  test('normalizeDate: 06/04/02 -> 2002-04-06', () => {
    const res = normalizeDate('06/04/02')
    assert(res !== null && res.startsWith('2002-04-06'), `Esperado 2002-04-06, recebido: ${res}`)
  })

  test('normalizeDate: 08/03/1999 -> 1999-03-08', () => {
    const res = normalizeDate('08/03/1999')
    assert(res !== null && res.startsWith('1999-03-08'), `Esperado 1999-03-08, recebido: ${res}`)
  })

  test('normalizeDate: 13/03/99 -> 1999-03-13 (regra >= 30)', () => {
    const res = normalizeDate('13/03/99')
    assert(res !== null && res.startsWith('1999-03-13'), `Esperado 1999-03-13, recebido: ${res}`)
  })

  test('normalizeDate: 25/05/17 -> 2017-05-25 (regra < 30)', () => {
    const res = normalizeDate('25/05/17')
    assert(res !== null && res.startsWith('2017-05-25'), `Esperado 2017-05-25, recebido: ${res}`)
  })

  test('normalizeDate com ponto: 15.08.01 -> 2001-08-15', () => {
    const res = normalizeDate('15.08.01')
    assert(res !== null && res.startsWith('2001-08-15'), `Esperado 2001-08-15, recebido: ${res}`)
  })

  test('normalizeDate com traço: 20-10-1995 -> 1995-10-20', () => {
    const res = normalizeDate('20-10-1995')
    assert(res !== null && res.startsWith('1995-10-20'), `Esperado 1995-10-20, recebido: ${res}`)
  })

  test('normalizeDate rejeita CEP: 13.200-200 -> null', () => {
    const res = normalizeDate('13.200-200')
    assert(res === null, `CEP deveria retornar null, recebeu: ${res}`)
  })

  // 2. extractClinicalHistory: Variantes de delimitador no início e no meio
  test('extractClinicalHistory: 06/04/02. e 18/02/03:', () => {
    const text = '06/04/02. FEITO RAIO X TORACICO 18/02/03: APLICADO PENTA + DEPO.'
    const entries = extractClinicalHistory(text)
    assert(entries.length === 2, `Esperado 2 entradas, recebido ${entries.length}`)
    assert(entries[0].rawDateStr === '06/04/02', `Data 1 errada: ${entries[0].rawDateStr}`)
    assert(entries[0].date?.startsWith('2002-04-06') === true, `ISO 1 errado: ${entries[0].date}`)
    assert(entries[1].rawDateStr === '18/02/03', `Data 2 errada: ${entries[1].rawDateStr}`)
    assert(entries[1].date?.startsWith('2003-02-18') === true, `ISO 2 errado: ${entries[1].date}`)
  })

  test('extractClinicalHistory: 08/03/1999---- e 13/03/99 -----', () => {
    const text = '08/03/1999----Consulta inicial 13/03/99 -----Vacina triplice'
    const entries = extractClinicalHistory(text)
    assert(entries.length === 2, `Esperado 2 entradas, recebido ${entries.length}`)
    assert(entries[0].rawDateStr === '08/03/1999', `Data 1: ${entries[0].rawDateStr}`)
    assert(entries[0].text.includes('Consulta inicial'), `Texto 1 preservado: ${entries[0].text}`)
    assert(entries[1].rawDateStr === '13/03/99', `Data 2: ${entries[1].rawDateStr}`)
    assert(entries[1].text.includes('Vacina triplice'), `Texto 2 preservado: ${entries[1].text}`)
  })

  test('extractClinicalHistory: 25/05/17.P= 1,3 KG... (ponto colado sem espaço)', () => {
    const text = '25/05/17.P= 1,3 KG. VACINA V10 + RAIVA.'
    const entries = extractClinicalHistory(text)
    assert(entries.length === 1, `Esperado 1 entrada, recebido ${entries.length}`)
    assert(entries[0].rawDateStr === '25/05/17', `Data extraída: ${entries[0].rawDateStr}`)
    assert(entries[0].date?.startsWith('2017-05-25') === true, `ISO date: ${entries[0].date}`)
    assert(entries[0].text.includes('P= 1,3 KG'), `Conteúdo colado preservado: ${entries[0].text}`)
  })

  test('extractClinicalHistory: preserva texto sem data anterior', () => {
    const text = 'Observacao inicial de triagem 10/05/2010. Consulta normal'
    const entries = extractClinicalHistory(text)
    assert(
      entries.length === 2,
      `Esperado 2 entradas (preText e datada), recebido ${entries.length}`,
    )
    const undated = entries.find((e) => e.isUndated || !e.date)
    assert(undated !== undefined, 'Deveria conter entrada sem data')
    assert(
      undated!.text.includes('Observacao inicial de triagem'),
      `Texto sem data preservado: ${undated!.text}`,
    )
  })

  test('extractClinicalHistory: texto inteiramente sem data não é descartado', () => {
    const text = 'Animal atendido em regime de urgencia sem data anotada pelo veterinario.'
    const entries = extractClinicalHistory(text)
    assert(entries.length === 1, `Esperado 1 entrada sem data, recebido ${entries.length}`)
    assert(entries[0].date === null, 'Data deve ser null')
    assert(entries[0].text === text, 'Texto integral preservado')
  })

  test('extractClinicalHistoryWithDiagnostics: detecta avisos para datas inválidas', () => {
    const text = '31/02/2015. Data impossivel no calendario'
    const res = extractClinicalHistoryWithDiagnostics(text)
    // 31/02 não normaliza (normalizeDate retorna null)
    assert(res.entries.length === 1, 'Entrada gravada mesmo com data inválida')
    assert(res.entries[0].isUndated === true, 'Marcada como sem data/não normalizada')
    assert(res.warnings.length > 0, 'Aviso registrado no resultado de diagnósticos')
  })

  test('extractAppointmentsFromRow: gera agendamentos históricos a partir das datas do TEXTO e ULTV', () => {
    const text = '06/04/02. Consulta cardiológica 18/02/03. Retorno com raio x'
    const entries = extractClinicalHistory(text)
    const row = { ULTV: '10/05/2005' }
    const apps = extractAppointmentsFromRow(row, entries)
    assert(apps.length === 3, `Esperado 3 agendamentos, obtido: ${apps.length}`)
    assert(apps[0].date.startsWith('2002-04-06'), `Data app 1: ${apps[0].date}`)
    assert(apps[1].date.startsWith('2003-02-18'), `Data app 2: ${apps[1].date}`)
    assert(apps[2].date.startsWith('2005-05-10'), `Data app 3 (ULTV): ${apps[2].date}`)
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
