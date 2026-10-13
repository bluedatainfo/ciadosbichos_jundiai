/**
 * pb_hooks/patient_nume_generator.js
 *
 * 1. GET /backend/v1/patients/next-nume
 *    Retorna o próximo número oficial disponível para exibição prévia no formulário do frontend.
 *
 * 2. onRecordCreateRequest((e) => { ... }, 'patients')
 *    Intercepta a criação de qualquer paciente pela API REST do PocketBase:
 *    Se 'nume' não foi informado, estiver vazio ou for "0", calcula atomicamente
 *    o próximo número consecutivo (MAX(CAST(nume AS INTEGER)) + 1) e grava no registro.
 *
 * 3. onRecordUpdateRequest((e) => { ... }, 'patients')
 *    Impede que 'nume' seja apagado ou alterado para vazio / "0" indevidamente.
 */

// Endpoint para consulta do próximo número disponível
routerAdd('GET', '/backend/v1/patients/next-nume', (e) => {
  try {
    const row = $app
      .db()
      .newQuery(
        `SELECT MAX(CAST(nume AS INTEGER)) AS max_nume
         FROM patients
         WHERE nume IS NOT NULL AND nume != '' AND nume != '0' AND nume GLOB '[0-9]*'`,
      )
      .one()

    const maxVal = row && row.max_nume ? Number(row.max_nume) : 0
    const nextNume = String(maxVal + 1)

    return e.json(200, {
      nextNume: nextNume,
    })
  } catch (err) {
    console.log('Erro ao calcular próximo NUME:', err.message)
    return e.json(500, { error: 'Falha ao obter próximo número oficial: ' + err.message })
  }
})

// Hook onRecordCreateRequest para a collection 'patients'
onRecordCreateRequest((e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  const currentNume = (record.getString('nume') || '').trim()

  // Se o NUME estiver vazio, não preenchido ou for '0', gera automaticamente o próximo
  if (!currentNume || currentNume === '0') {
    const row = $app
      .db()
      .newQuery(
        `SELECT MAX(CAST(nume AS INTEGER)) AS max_nume
         FROM patients
         WHERE nume IS NOT NULL AND nume != '' AND nume != '0' AND nume GLOB '[0-9]*'`,
      )
      .one()

    const maxVal = row && row.max_nume ? Number(row.max_nume) : 0
    const nextVal = String(maxVal + 1)

    console.log(
      'Atribuindo novo NUME oficial gerado automaticamente:',
      nextVal,
      'ao paciente:',
      record.getString('name'),
    )
    record.set('nume', nextVal)
  }

  e.next()
}, 'patients')

// Hook onRecordUpdateRequest para a collection 'patients'
onRecordUpdateRequest((e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  const newNume = (record.getString('nume') || '').trim()
  const oldNume = (record.original().getString('nume') || '').trim()

  // Se o registro já possuía um NUME e alguém tentou limpar para vazio ou "0", preserva o antigo
  if ((!newNume || newNume === '0') && oldNume && oldNume !== '0') {
    console.log(
      'Preservando NUME oficial',
      oldNume,
      'do paciente:',
      record.getString('name'),
      'contra remoção indevida',
    )
    record.set('nume', oldNume)
  }

  e.next()
}, 'patients')
