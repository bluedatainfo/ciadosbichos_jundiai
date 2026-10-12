import {
  stringHash,
  normalizeForHash,
  generateClinicalRecordHash,
  generateAppointmentHash,
  generateVaccineHash,
} from '../sync-hash-utils'

/**
 * Suite de testes unitários para o gerador de hashes da Sincronização Incremental.
 */
export function runSyncHashUtilsTests(): {
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

  test('stringHash produz hashes determinísticos e estáveis', () => {
    const h1 = stringHash('teste 123')
    const h2 = stringHash('teste 123')
    const h3 = stringHash('teste 456')

    assert(h1 === h2, 'Hashes para a mesma string devem ser idênticos')
    assert(h1 !== h3, 'Hashes para strings distintas devem ser diferentes')
    assert(h1.length === 8, 'Hash FNV-1a deve ter 8 caracteres hex')
  })

  test('normalizeForHash normaliza espaços, maiúsculas e caracteres irrelevantes', () => {
    const n1 = normalizeForHash('  Paciente   COM   febre  ')
    const n2 = normalizeForHash('paciente com febre')

    assert(n1 === 'paciente com febre', `Esperado 'paciente com febre', obtido: ${n1}`)
    assert(n1 === n2, 'Strings com espaçamento divergente devem normalizar iguais')
  })

  test('generateClinicalRecordHash é determinístico e sensível a paciente e conteúdo', () => {
    const hashA = generateClinicalRecordHash('p1', 'Consulta de rotina. Sem alterações.')
    const hashB = generateClinicalRecordHash('p1', 'Consulta de rotina.  Sem alterações.')
    const hashOtherPatient = generateClinicalRecordHash('p2', 'Consulta de rotina. Sem alterações.')
    const hashOtherText = generateClinicalRecordHash('p1', 'Prescrito antibiótico.')

    assert(hashA === hashB, 'Diferença de espaços extras deve gerar mesmo hash')
    assert(hashA !== hashOtherPatient, 'Pacientes distintos devem gerar hashes diferentes')
    assert(hashA !== hashOtherText, 'Conteúdos clínicos distintos devem gerar hashes diferentes')
  })

  test('generateAppointmentHash é determinístico', () => {
    const hash1 = generateAppointmentHash(
      'p1',
      '2026-05-10T10:00:00Z',
      'return',
      'Retorno de cirurgia',
    )
    const hash2 = generateAppointmentHash(
      'p1',
      '2026-05-10T14:30:00Z',
      'return',
      'Retorno de cirurgia',
    )
    const hash3 = generateAppointmentHash(
      'p1',
      '2026-05-11T10:00:00Z',
      'return',
      'Retorno de cirurgia',
    )

    assert(hash1 === hash2, 'Mesmo paciente, data de retorno e nota devem gerar mesmo hash')
    assert(hash1 !== hash3, 'Datas diferentes de retorno devem gerar hashes diferentes')
  })

  test('generateVaccineHash é determinístico e sensível a paciente, nome e data', () => {
    const h1 = generateVaccineHash('p1', 'V8 / V10', '2025-01-15')
    const h2 = generateVaccineHash('p1', 'v8 / v10', '2025-01-15T00:00:00')
    const h3 = generateVaccineHash('p1', 'Antirrábica', '2025-01-15')

    assert(h1 === h2, 'Nome da vacina em caixa diferente e data normalizada devem gerar mesmo hash')
    assert(h1 !== h3, 'Vacinas distintas devem gerar hashes diferentes')
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
