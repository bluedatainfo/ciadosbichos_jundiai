/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Obter usuário admin para os registros de auditoria
    let adminUser = null
    try {
      adminUser = app.findFirstRecordByData('users', 'role', 'admin')
    } catch (_) {}

    const auditCol = app.findCollectionByNameOrId('audit_logs')
    const nowIso = new Date().toISOString()

    function createAuditRecord(opts) {
      const rec = new Record(auditCol)
      if (adminUser) {
        rec.set('user_id', adminUser.id)
        rec.set('user_name', adminUser.getString('name') || 'Admin')
        rec.set('user_email', adminUser.getString('email') || 'bluedata@bluedatainfo.com.br')
        rec.set('user_role', adminUser.getString('role') || 'admin')
      } else {
        rec.set('user_name', 'Sistema / Migração')
        rec.set('user_role', 'admin')
      }
      rec.set('action', 'delete')
      rec.set('module', opts.module)
      rec.set('record_id', opts.recordId)
      rec.set('record_label', opts.recordLabel || '')
      rec.set('patient_name', opts.patientName || '')
      rec.set('tutor_name', opts.tutorName || '')
      rec.set('details', opts.details || '')
      rec.set('changes', opts.changes || null)
      rec.set('created', nowIso)
      rec.set('updated', nowIso)
      app.save(rec)
    }

    // 2. Identificar os 50 pacientes de teste ("Pet 1".."Pet 50", CTRL C1..C50)
    // Usamos findRecordsByFilter com padrão "name ~ 'Pet '" e import_key ~ 'name:tutor '
    const testPatients = app.findRecordsByFilter(
      'patients',
      "name ~ 'Pet ' && import_key ~ 'name:tutor '",
      'ctrl',
      100,
      0,
    )

    // Mapa de nomes de tutores para preenchimento de log
    const tutorNamesMap = {}
    const allTutors = app.findRecordsByFilter('tutors', '', '', 100000, 0)
    for (let i = 0; i < allTutors.length; i++) {
      tutorNamesMap[allTutors[i].id] = allTutors[i].getString('name')
    }

    let deletedClinicalCount = 0
    let deletedAppointmentCount = 0
    let deletedPatientCount = 0
    let auditLogsCount = 0

    // Para cada paciente de teste:
    // a) Excluir e auditar clinical_records vinculados
    // b) Excluir e auditar appointments vinculados
    // c) Excluir e auditar o próprio paciente
    for (let i = 0; i < testPatients.length; i++) {
      const patient = testPatients[i]
      const pid = patient.id
      const pName = patient.getString('name')
      const pCtrl = patient.getString('ctrl')
      const pNume = patient.getString('nume')
      const pImportKey = patient.getString('import_key')
      const pTutorId = patient.getString('tutor_id')
      const tName = tutorNamesMap[pTutorId] || ''

      // a) clinical_records
      const clinRecs = app.findRecordsByFilter(
        'clinical_records',
        `patient_id = '${pid}'`,
        '',
        500,
        0,
      )
      for (let c = 0; c < clinRecs.length; c++) {
        const cr = clinRecs[c]
        createAuditRecord({
          module: 'clinical_records',
          recordId: cr.id,
          recordLabel: cr.getString('description') || `Evolução de ${pName}`,
          patientName: pName,
          tutorName: tName,
          details: `Exclusão de evolução clínica legada de teste vinculada ao paciente ${pName} (${pCtrl}): ${cr.getString('description')}`,
          changes: {
            deleted_record: {
              id: cr.id,
              description: cr.getString('description'),
              patient_id: pid,
              patient_name: pName,
              ctrl: pCtrl,
            },
          },
        })
        app.delete(cr)
        deletedClinicalCount++
        auditLogsCount++
      }

      // b) appointments
      const appos = app.findRecordsByFilter('appointments', `patient_id = '${pid}'`, '', 500, 0)
      for (let a = 0; a < appos.length; a++) {
        const ap = appos[a]
        createAuditRecord({
          module: 'returns', // appointments/retornos
          recordId: ap.id,
          recordLabel: ap.getString('notes') || `Consulta de ${pName}`,
          patientName: pName,
          tutorName: tName,
          details: `Exclusão de agendamento/consulta legada de teste vinculado ao paciente ${pName} (${pCtrl}): ${ap.getString('notes')}`,
          changes: {
            deleted_record: {
              id: ap.id,
              notes: ap.getString('notes'),
              type: ap.getString('type'),
              status: ap.getString('status'),
              date: ap.getString('date'),
              patient_id: pid,
              patient_name: pName,
              ctrl: pCtrl,
            },
          },
        })
        app.delete(ap)
        deletedAppointmentCount++
        auditLogsCount++
      }

      // c) paciente
      createAuditRecord({
        module: 'patients',
        recordId: pid,
        recordLabel: pName,
        patientName: pName,
        tutorName: tName,
        details: `Exclusão definitiva de paciente de teste ${pName} (CTRL: ${pCtrl}, NUME: '${pNume}', import_key: ${pImportKey})`,
        changes: {
          deleted_record: {
            id: pid,
            name: pName,
            ctrl: pCtrl,
            nume: pNume,
            import_key: pImportKey,
            tutor_id: pTutorId,
            tutor_name: tName,
            species: patient.getString('species'),
            breed: patient.getString('breed'),
          },
        },
      })
      app.delete(patient)
      deletedPatientCount++
      auditLogsCount++
    }

    // 3. Excluir tutores de teste ("Tutor 1".."Tutor 50") que não têm pacientes reais
    // e o tutor órfão 'Tutor Não Informado' (id yt0tkyh3jr37zky) PRESERVANDO os 3 que têm pacientes ativos.
    const testTutors = app.findRecordsByFilter('tutors', "name ~ 'Tutor '", 'name', 100, 0)
    let deletedTutorCount = 0

    for (let i = 0; i < testTutors.length; i++) {
      const tutor = testTutors[i]
      const tid = tutor.id
      const tName = tutor.getString('name')

      // Verificar se o tutor é um dos 3 'Tutor Não Informado' protegidos
      if (tid === 'elamnispfgv3eyh' || tid === '71enzekxrnrq35n' || tid === 'oprvkhxmrydkovj') {
        // Preservar tutores que têm pacientes reais ativos!
        continue
      }

      // Verificar se ainda resta algum paciente associado a este tutor
      const remainingPets = app.findRecordsByFilter('patients', `tutor_id = '${tid}'`, '', 1, 0)
      if (remainingPets.length === 0) {
        createAuditRecord({
          module: 'tutors',
          recordId: tid,
          recordLabel: tName,
          patientName: '',
          tutorName: tName,
          details: `Exclusão definitiva de tutor de teste/órfão sem pacientes ativos: ${tName} (id: ${tid})`,
          changes: {
            deleted_record: {
              id: tid,
              name: tName,
              email: tutor.getString('email'),
              phone: tutor.getString('phone'),
              cpf: tutor.getString('cpf'),
            },
          },
        })
        app.delete(tutor)
        deletedTutorCount++
        auditLogsCount++
      }
    }

    // Salvar resumo da execução de limpeza na tabela de progresso/auditoria para conferência
    try {
      const ipCol = app.findCollectionByNameOrId('import_progress')
      const cleanupLog = new Record(ipCol)
      cleanupLog.set('file_name', 'LIMPEZA_TAREFA_1_DEFINITIVA')
      cleanupLog.set('total_file_rows', deletedPatientCount)
      cleanupLog.set('last_processed_line', deletedPatientCount)
      cleanupLog.set('completed_at', new Date().toISOString())
      cleanupLog.set('summary', {
        deletedPatientCount,
        deletedTutorCount,
        deletedClinicalCount,
        deletedAppointmentCount,
        auditLogsCount,
        timestamp: new Date().toISOString(),
      })
      app.save(cleanupLog)
    } catch (_) {}
  },
  (app) => {},
)
