routerAdd('GET', '/backend/v1/reports/pending-vaccines', (e) => {
  try {
    const query = e.requestInfo().query
    const species = query.species || ''
    const intervalMonths = parseInt(query.interval_months || '12', 10) || 12
    const statusFilter = query.status || 'all' // 'all', 'overdue', 'no_record'
    const limit = parseInt(query.limit || '100', 10) || 100
    const page = parseInt(query.page || '1', 10) || 1
    const offset = (page - 1) * limit
    const search = (query.search || '').trim()

    // 1. Data de corte para considerar atrasada: hoje - intervalMonths meses
    // Ex: hoje = 2026-10-01, intervalo = 12 meses -> limite = 2025-10-01
    // Registros de vacina anteriores a essa data ou sem vacina são considerados atrasados.
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - intervalMonths)
    const cutoffIso = cutoffDate.toISOString()

    // Usaremos uma query agregada sobre patients e vaccines via SQLite
    // LEFT JOIN com subquery da última vacinação por paciente
    let whereClauses = ['(p.deceased = 0 OR p.deceased IS NULL)']

    if (species && species !== 'all') {
      whereClauses.push(`p.species = '${species.replace(/'/g, "''")}'`)
    }

    if (search) {
      const cleanSearch = search.replace(/'/g, "''")
      whereClauses.push(
        `(p.name LIKE '%${cleanSearch}%' OR t.name LIKE '%${cleanSearch}%' OR p.ctrl LIKE '%${cleanSearch}%')`,
      )
    }

    if (statusFilter === 'overdue') {
      whereClauses.push(
        `v_latest.last_vaccine_date IS NOT NULL AND v_latest.last_vaccine_date < '${cutoffIso}'`,
      )
    } else if (statusFilter === 'no_record') {
      whereClauses.push(`v_latest.last_vaccine_date IS NULL`)
    } else {
      // all pendentes: atrasada OU sem registro
      whereClauses.push(
        `(v_latest.last_vaccine_date IS NULL OR v_latest.last_vaccine_date < '${cutoffIso}')`,
      )
    }

    const whereSql = whereClauses.join(' AND ')

    // Subquery para obter a data mais recente de vacinação de cada paciente
    const subqueryVaccines = `
      SELECT patient_id, MAX(date) AS last_vaccine_date, COUNT(*) as vac_count
      FROM vaccines
      WHERE date IS NOT NULL AND TRIM(date) != ''
      GROUP BY patient_id
    `

    // Contagem total para paginação
    const countSql = `
      SELECT COUNT(*) AS total
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      LEFT JOIN (${subqueryVaccines}) v_latest ON p.id = v_latest.patient_id
      WHERE ${whereSql}
    `
    const countRow = $app.db().newQuery(countSql).one()
    const totalCount = Number(countRow.total || 0)

    // Busca paginada dos registros
    const selectSql = `
      SELECT 
        p.id AS patient_id,
        p.name AS animal_name,
        p.species,
        p.breed,
        p.gender,
        p.ctrl,
        p.last_visit,
        p.birth_date,
        t.name AS tutor_name,
        t.phone AS tutor_phone,
        t.phone_secondary AS tutor_phone_secondary,
        v_latest.last_vaccine_date,
        v_latest.vac_count
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      LEFT JOIN (${subqueryVaccines}) v_latest ON p.id = v_latest.patient_id
      WHERE ${whereSql}
      ORDER BY 
        CASE WHEN v_latest.last_vaccine_date IS NULL THEN 1 ELSE 0 END,
        v_latest.last_vaccine_date ASC,
        p.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const rows = $app.db().newQuery(selectSql).all()

    const items = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const lastDate = r.last_vaccine_date ? String(r.last_vaccine_date) : null
      const status = !lastDate ? 'no_record' : 'overdue'

      items.push({
        id: String(r.patient_id),
        patientId: String(r.patient_id),
        animalName: String(r.animal_name || 'Sem nome'),
        species: String(r.species || ''),
        breed: String(r.breed || ''),
        gender: String(r.gender || ''),
        ctrl: String(r.ctrl || ''),
        lastVisit: r.last_visit ? String(r.last_visit) : null,
        birthDate: r.birth_date ? String(r.birth_date) : null,
        tutorName: String(r.tutor_name || 'Não informado'),
        tutorPhone: String(r.tutor_phone || r.tutor_phone_secondary || ''),
        lastVaccineDate: lastDate,
        situation: status === 'overdue' ? 'Atrasada' : 'Sem registro',
        status,
        vaccineCount: Number(r.vac_count || 0),
      })
    }

    return e.json(200, {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      cutoffDate: cutoffIso,
      intervalMonths,
      items,
    })
  } catch (err) {
    console.log('Error in reports_pending_vaccines:', err.message)
    return e.json(500, { error: 'Falha ao buscar vacinas pendentes: ' + err.message })
  }
})
