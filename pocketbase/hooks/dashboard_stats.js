/**
 * pb_hooks/dashboard_stats.js
 *
 * GET /backend/v1/dashboard/stats
 *
 * Calcula em lote e de forma ultrarrápida (via queries diretas no SQLite)
 * os totais necessários para o Dashboard (/index):
 *  - totalPatients (COUNT em patients)
 *  - totalTutors (COUNT em tutors)
 *  - appointmentsToday (COUNT em appointments com data de hoje)
 *  - lowStockCount (COUNT em inventory com quantity < min_stock)
 *  - returnAlertsCount (COUNT de retornos pendentes de pacientes vivos)
 *  - recentAppointments (os 5 agendamentos mais recentes, com paciente e tutor pré-expandidos)
 *
 * Todas as variáveis e funções estão contidas dentro do callback conforme exigido pelo Skip Cloud JSVM.
 */

routerAdd('GET', '/backend/v1/dashboard/stats', (e) => {
  try {
    // 1. Data de hoje para filtro de atendimentos
    const todayDate = new Date()
    const todayStr = todayDate.toISOString().split('T')[0]
    const startOfDay = `${todayStr} 00:00:00.000Z`
    const endOfDay = `${todayStr} 23:59:59.999Z`

    // 2. Contagens diretas no SQLite via queries indexadas / diretas no DB
    // Contagem de Pacientes
    const rowPatients = $app.db().newQuery('SELECT COUNT(*) AS total FROM patients').one()
    const totalPatients = rowPatients ? Number(rowPatients.total || 0) : 0

    // Contagem de Tutores
    const rowTutors = $app.db().newQuery('SELECT COUNT(*) AS total FROM tutors').one()
    const totalTutors = rowTutors ? Number(rowTutors.total || 0) : 0

    // Agendamentos hoje
    const rowAppToday = $app
      .db()
      .newQuery(
        `SELECT COUNT(*) AS total FROM appointments WHERE date >= {:start} AND date <= {:end}`,
      )
      .bind({ start: startOfDay, end: endOfDay })
      .one()
    const appointmentsToday = rowAppToday ? Number(rowAppToday.total || 0) : 0

    // Itens em falta no estoque
    const rowInventory = $app
      .db()
      .newQuery('SELECT COUNT(*) AS total FROM inventory WHERE quantity < min_stock')
      .one()
    const lowStockCount = rowInventory ? Number(rowInventory.total || 0) : 0

    // Contagem rápida de Alertas de Retorno (vaccines pendentes de pacientes não falecidos)
    // Agrupados por paciente para bater com a contagem do returnAlerts
    const rowAlerts = $app
      .db()
      .newQuery(
        `SELECT COUNT(DISTINCT v.patient_id) AS total
         FROM vaccines v
         JOIN patients p ON v.patient_id = p.id
         WHERE v.date IS NOT NULL 
           AND TRIM(v.date) != ''
           AND (v.completed = 0 OR v.completed IS NULL)
           AND (p.deceased = 0 OR p.deceased IS NULL)`,
      )
      .one()
    const returnAlertsCount = rowAlerts ? Number(rowAlerts.total || 0) : 0

    // 3. Atendimentos recentes (últimos 5)
    // Filtramos apenas agendamentos com data até hoje (inclusive), descartando datas futuras corrompidas da importação,
    // e ordenamos pela data do atendimento (mais recente primeiro) e depois por id/created DESC.
    const recentRows = $app
      .db()
      .newQuery(
        `SELECT 
           a.id,
           a.date,
           a.type,
           a.status,
           a.notes,
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
           AND a.date <= {:maxDate}
         ORDER BY a.date DESC, a.created DESC
         LIMIT 5`,
      )
      .bind({ maxDate: endOfDay })
      .all()

    const recentAppointments = []
    for (let i = 0; i < recentRows.length; i++) {
      const r = recentRows[i]
      recentAppointments.push({
        id: String(r.id),
        date: String(r.date || ''),
        type: String(r.type || 'consultation'),
        status: String(r.status || 'scheduled'),
        notes: String(r.notes || ''),
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

    const result = {
      totalPatients,
      totalTutors,
      appointmentsToday,
      lowStockCount,
      returnAlertsCount,
      recentAppointments,
    }

    return e.json(200, result)
  } catch (err) {
    console.log('Erro ao calcular estatísticas do Dashboard:', err.message)
    return e.json(500, { error: 'Falha ao buscar estatísticas do dashboard: ' + err.message })
  }
})
