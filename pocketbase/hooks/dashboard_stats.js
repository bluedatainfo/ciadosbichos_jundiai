/**
 * pb_hooks/dashboard_stats.js
 *
 * GET /backend/v1/dashboard/stats
 *
 * Separação dos conceitos de:
 *  - ATENDIMENTO (realizado): fonte nas fichas clínicas (clinical_records) com data até hoje.
 *  - AGENDAMENTO (futuro): fonte nos agendamentos (appointments) com data futura posterior a hoje.
 *
 * Totais calculados:
 *  - totalPatients (COUNT em patients)
 *  - totalTutors (COUNT em tutors)
 *  - appointmentsToday (Atendimentos Hoje: clinical_records de hoje + appointments de hoje sem duplicar por paciente/horário)
 *  - lowStockCount (COUNT em inventory com quantity < min_stock)
 *  - returnAlertsCount (COUNT de retornos pendentes de pacientes vivos)
 *  - recentClinicalRecords (últimos atendimentos clínicos realizados, ordenados pela data DESC)
 *  - upcomingAppointments (próximos agendamentos futuros ordenados pela data ASC, filtrando datas corrompidas > hoje + 2 anos)
 *  - recentAppointments (mantido por retrocompatibilidade: próximos agendamentos ou appointments)
 */

routerAdd('GET', '/backend/v1/dashboard/stats', (e) => {
  console.log('[Dashboard Stats] Iniciando processamento de /backend/v1/dashboard/stats')
  try {
    // 1. Data de hoje para filtro de atendimentos
    const todayDate = new Date()
    const todayStr = todayDate.toISOString().split('T')[0]
    const startOfDay = `${todayStr} 00:00:00.000Z`
    const endOfDay = `${todayStr} 23:59:59.999Z`

    // Limite sanitário razoável para datas futuras (hoje + 2 anos)
    // Evita datas corrompidas de importações legadas (ex.: anos 2502, 5202 etc.)
    const twoYearsLaterDate = new Date(todayDate.getTime() + 2 * 365.25 * 24 * 60 * 60 * 1000)
    const maxFutureDateStr = `${twoYearsLaterDate.toISOString().split('T')[0]} 23:59:59.999Z`

    // 2. Contagens diretas no SQLite via queries indexadas / diretas no DB
    // Contagem de Pacientes
    let totalPatients = 0
    try {
      const rowsPatients = $app.db().newQuery('SELECT COUNT(*) AS total FROM patients').all()
      totalPatients =
        rowsPatients && rowsPatients.length > 0 && rowsPatients[0].total !== undefined
          ? Number(rowsPatients[0].total || 0)
          : 0
    } catch (err) {
      console.log('[Dashboard Stats] Erro ao contar pacientes:', err ? err.message : String(err))
    }

    // Contagem de Tutores
    let totalTutors = 0
    try {
      const rowsTutors = $app.db().newQuery('SELECT COUNT(*) AS total FROM tutors').all()
      totalTutors =
        rowsTutors && rowsTutors.length > 0 && rowsTutors[0].total !== undefined
          ? Number(rowsTutors[0].total || 0)
          : 0
    } catch (err) {
      console.log('[Dashboard Stats] Erro ao contar tutores:', err ? err.message : String(err))
    }

    // Contagem de Atendimentos Hoje:
    // Fichas clínicas (clinical_records) realizadas hoje + Agendamentos (appointments) de hoje,
    // garantindo contagem sem duplicidade caso o mesmo paciente tenha ficha clínica e agendamento no mesmo dia.
    let clinicalRecordsCountToday = 0
    const clinicalPatientIdsToday = {}
    try {
      const rowTodayClinical = $app
        .db()
        .newQuery(
          `SELECT DISTINCT patient_id 
           FROM clinical_records 
           WHERE created >= {:start} AND created <= {:end}`,
        )
        .bind({ start: startOfDay, end: endOfDay })
        .all()

      if (rowTodayClinical && rowTodayClinical.length > 0) {
        for (let i = 0; i < rowTodayClinical.length; i++) {
          const pid = rowTodayClinical[i].patient_id
          if (pid) {
            clinicalPatientIdsToday[String(pid)] = true
            clinicalRecordsCountToday++
          }
        }
      }
    } catch (err) {
      console.log(
        '[Dashboard Stats] Erro ao contar fichas clínicas de hoje:',
        err ? err.message : String(err),
      )
    }

    // Buscar agendamentos marcados para hoje
    let nonDuplicateAppointmentsToday = 0
    try {
      const rowTodayAppointments = $app
        .db()
        .newQuery(
          `SELECT id, patient_id 
           FROM appointments 
           WHERE date >= {:start} AND date <= {:end}`,
        )
        .bind({ start: startOfDay, end: endOfDay })
        .all()

      if (rowTodayAppointments && rowTodayAppointments.length > 0) {
        for (let i = 0; i < rowTodayAppointments.length; i++) {
          const row = rowTodayAppointments[i]
          const pid = row.patient_id ? String(row.patient_id) : ''
          // Se já temos ficha clínica deste paciente hoje, não duplicamos
          if (!pid || !clinicalPatientIdsToday[pid]) {
            nonDuplicateAppointmentsToday++
          }
        }
      }
    } catch (err) {
      console.log(
        '[Dashboard Stats] Erro ao contar agendamentos de hoje:',
        err ? err.message : String(err),
      )
    }

    const appointmentsToday = clinicalRecordsCountToday + nonDuplicateAppointmentsToday

    // Itens em falta no estoque
    let lowStockCount = 0
    try {
      const rowsInventory = $app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM inventory WHERE quantity < min_stock')
        .all()
      lowStockCount =
        rowsInventory && rowsInventory.length > 0 && rowsInventory[0].total !== undefined
          ? Number(rowsInventory[0].total || 0)
          : 0
    } catch (_) {
      lowStockCount = 0
    }

    // Contagem rápida de Alertas de Retorno (vaccines pendentes de pacientes não falecidos)
    let returnAlertsCount = 0
    try {
      // Subquery ou verificação otimizada para não varrer tabela sem necessidade
      const rowAlerts = $app
        .db()
        .newQuery(
          `SELECT COUNT(DISTINCT v.patient_id) AS total
           FROM vaccines v
           INNER JOIN patients p ON v.patient_id = p.id
           WHERE v.date IS NOT NULL 
             AND TRIM(v.date) != ''
             AND (v.completed = 0 OR v.completed IS NULL)
             AND (p.deceased = 0 OR p.deceased IS NULL)`,
        )
        .all()
      if (rowAlerts && rowAlerts.length > 0 && rowAlerts[0].total !== undefined) {
        returnAlertsCount = Number(rowAlerts[0].total || 0)
      }
    } catch (err) {
      console.log(
        '[Dashboard Stats] Erro ao contar alertas de retorno:',
        err ? err.message : String(err),
      )
    }

    // 3. ATENDIMENTOS RECENTES (Realizados)
    // Fonte nas fichas clínicas (clinical_records), com data até hoje (inclusive),
    // ordenados pela data do atendimento (mais recente primeiro: created DESC).
    // Exibindo paciente, tutor, data e veterinário (identificado no audit_log correspondente ou notas).
    const recentClinicalRecords = []
    try {
      const recentClinicalRows = $app
        .db()
        .newQuery(
          `SELECT 
             cr.id,
             cr.patient_id,
             cr.description,
             cr.diagnosis,
             cr.treatment,
             cr.created,
             cr.updated,
             p.name AS patient_name,
             t.id AS tutor_id,
             t.name AS tutor_name
           FROM clinical_records cr
           LEFT JOIN patients p ON cr.patient_id = p.id
           LEFT JOIN tutors t ON p.tutor_id = t.id
           WHERE cr.created <= {:maxDate}
           ORDER BY cr.created DESC
           LIMIT 6`,
        )
        .bind({ maxDate: endOfDay })
        .all()

      if (recentClinicalRows && recentClinicalRows.length > 0) {
        // Coletar recordIds para buscar veterinários em UMA ÚNICA query em lote
        const recordIds = []
        for (let i = 0; i < recentClinicalRows.length; i++) {
          if (recentClinicalRows[i].id) {
            recordIds.push(String(recentClinicalRows[i].id))
          }
        }

        const vetNameByRecordId = {}
        if (recordIds.length > 0) {
          try {
            const inPlaceholders = recordIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',')
            const auditRows = $app
              .db()
              .newQuery(
                `SELECT record_id, user_name 
                 FROM audit_logs 
                 WHERE module = 'clinical_records' 
                   AND record_id IN (${inPlaceholders})
                   AND user_name IS NOT NULL AND user_name != ''
                 ORDER BY created ASC`,
              )
              .all()

            if (auditRows && auditRows.length > 0) {
              for (let j = 0; j < auditRows.length; j++) {
                const aRow = auditRows[j]
                const rId = String(aRow.record_id || '')
                if (rId && !vetNameByRecordId[rId] && aRow.user_name) {
                  vetNameByRecordId[rId] = String(aRow.user_name)
                }
              }
            }
          } catch (auditErr) {
            console.log(
              '[Dashboard Stats] Aviso ao buscar auditoria em lote:',
              auditErr ? auditErr.message : String(auditErr),
            )
          }
        }

        for (let i = 0; i < recentClinicalRows.length; i++) {
          const cr = recentClinicalRows[i]
          const recordId = String(cr.id)

          // Buscar se há veterinário responsável registrado no lote do audit_log
          let vetName = vetNameByRecordId[recordId] || ''

          // Se ainda não encontrou no audit_log, tentar identificar assinatura conhecida no texto da descrição
          if (!vetName && cr.description) {
            const descUpper = String(cr.description).toUpperCase()
            if (descUpper.includes('PAOLA')) {
              vetName = 'Dra. Paola'
            } else if (descUpper.includes('HENRIQUE') || descUpper.includes('KIKE')) {
              vetName = 'Dr. Henrique'
            }
          }

          recentClinicalRecords.push({
            id: recordId,
            patient_id: String(cr.patient_id || ''),
            patient_name: String(cr.patient_name || 'Desconhecido'),
            tutor_id: String(cr.tutor_id || ''),
            tutor_name: String(cr.tutor_name || '-'),
            date: String(cr.created || ''),
            description: String(cr.description || ''),
            diagnosis: String(cr.diagnosis || ''),
            treatment: String(cr.treatment || ''),
            veterinarian: vetName,
          })
        }
      }
    } catch (err) {
      console.log(
        '[Dashboard Stats] Erro ao buscar atendimentos recentes:',
        err ? err.message : String(err),
      )
    }

    // 4. PRÓXIMOS AGENDAMENTOS (Futuros)
    // Fonte em appointments com data futura (posterior a hoje: date > endOfDay).
    // Ordenados pela data mais próxima primeiro (date ASC, created ASC).
    // Aplicando limite sanitário (date <= maxFutureDateStr) para descartar datas corrompidas (> 2 anos).
    const upcomingAppointments = []
    try {
      const upcomingRows = $app
        .db()
        .newQuery(
          `SELECT 
             a.id,
             a.date,
             a.type,
             a.status,
             a.notes,
             a.source,
             a.created,
             a.updated,
             p.id AS patient_id,
             p.name AS patient_name,
             t.id AS tutor_id,
             t.name AS tutor_name
           FROM appointments a
           LEFT JOIN patients p ON a.patient_id = p.id
           LEFT JOIN tutors t ON p.tutor_id = t.id
           WHERE a.date IS NOT NULL 
             AND TRIM(a.date) != ''
             AND a.date > {:minDate}
             AND a.date <= {:maxDate}
           ORDER BY a.date ASC, a.created ASC
           LIMIT 6`,
        )
        .bind({ minDate: endOfDay, maxDate: maxFutureDateStr })
        .all()

      if (upcomingRows && upcomingRows.length > 0) {
        for (let i = 0; i < upcomingRows.length; i++) {
          const r = upcomingRows[i]
          upcomingAppointments.push({
            id: String(r.id),
            date: String(r.date || ''),
            type: String(r.type || 'consultation'),
            status: String(r.status || 'scheduled'),
            notes: String(r.notes || ''),
            source: String(r.source || 'internal'),
            created: String(r.created || ''),
            updated: String(r.updated || ''),
            patient_id: String(r.patient_id || ''),
            expand: {
              patient_id: r.patient_id
                ? {
                    id: String(r.patient_id),
                    name: String(r.patient_name || ''),
                    expand: {
                      tutor_id: r.tutor_id
                        ? {
                            id: String(r.tutor_id),
                            name: String(r.tutor_name || ''),
                          }
                        : undefined,
                    },
                  }
                : undefined,
            },
          })
        }
      }
    } catch (err) {
      console.log(
        '[Dashboard Stats] Erro ao buscar próximos agendamentos:',
        err ? err.message : String(err),
      )
    }

    const result = {
      totalPatients,
      totalTutors,
      appointmentsToday,
      lowStockCount,
      returnAlertsCount,
      recentClinicalRecords,
      upcomingAppointments,
      // Mantido para compatibilidade com versões ou componentes legados
      recentAppointments: upcomingAppointments,
    }

    console.log(
      '[Dashboard Stats] Sucesso ao montar stats: totalPatients=' +
        totalPatients +
        ', appointmentsToday=' +
        appointmentsToday,
    )
    return e.json(200, result)
  } catch (err) {
    const errText = err
      ? err.stack
        ? String(err.stack)
        : err.message || String(err)
      : 'erro desconhecido'
    console.log('[Dashboard Stats] Erro geral capturado:', errText)
    return e.json(500, { error: 'Falha ao buscar estatísticas do dashboard: ' + errText })
  }
})
