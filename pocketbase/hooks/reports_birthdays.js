routerAdd('GET', '/backend/v1/reports/birthdays', (e) => {
  try {
    const query = e.requestInfo().query
    const month = parseInt(query.month || '0', 10) // 1 a 12 (0 = não informado)
    const species = query.species || ''
    const day = parseInt(query.day || '0', 10) // 1 a 31 (0 = qualquer dia)
    const search = (query.search || '').trim()
    const limit = parseInt(query.limit || '100', 10) || 100
    const page = parseInt(query.page || '1', 10) || 1
    const offset = (page - 1) * limit

    if (!month || month < 1 || month > 12) {
      return e.json(400, { error: 'O parâmetro month (1-12) é obrigatório.' })
    }

    const monthStr = String(month).padStart(2, '0')

    // Na base PocketBase/SQLite, birth_date é salvo no padrão ISO: 'YYYY-MM-DD ...' ou 'YYYY-MM-DDTHH:mm:ss.sssZ'
    // Ex: '2016-12-27 12:00:00.000Z'
    // Podemos filtrar strftime('%m', birth_date) = '05' ou substr(birth_date, 6, 2) = '05'
    // Note: substr(birth_date, 6, 2) funciona diretamente e é muito rápido no SQLite
    let whereClauses = [
      '(p.deceased = 0 OR p.deceased IS NULL)',
      "p.birth_date IS NOT NULL AND TRIM(p.birth_date) != ''",
      `substr(p.birth_date, 6, 2) = '${monthStr}'`,
    ]

    if (day && day >= 1 && day <= 31) {
      const dayStr = String(day).padStart(2, '0')
      whereClauses.push(`substr(p.birth_date, 9, 2) = '${dayStr}'`)
    }

    if (species && species !== 'all') {
      whereClauses.push(`p.species = '${species.replace(/'/g, "''")}'`)
    }

    if (search) {
      const cleanSearch = search.replace(/'/g, "''")
      whereClauses.push(
        `(p.name LIKE '%${cleanSearch}%' OR t.name LIKE '%${cleanSearch}%' OR p.ctrl LIKE '%${cleanSearch}%')`,
      )
    }

    const whereSql = whereClauses.join(' AND ')

    // Contagem total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      WHERE ${whereSql}
    `
    const countRow = $app.db().newQuery(countSql).one()
    const totalCount = Number(countRow.total || 0)

    // Busca paginada ordenada pelo dia do mês (substr(birth_date, 9, 2)) e nome
    const selectSql = `
      SELECT 
        p.id AS patient_id,
        p.name AS animal_name,
        p.species,
        p.breed,
        p.gender,
        p.ctrl,
        p.birth_date,
        p.last_visit,
        t.name AS tutor_name,
        t.phone AS tutor_phone,
        t.phone_secondary AS tutor_phone_secondary,
        substr(p.birth_date, 9, 2) AS b_day,
        substr(p.birth_date, 1, 4) AS b_year
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      WHERE ${whereSql}
      ORDER BY substr(p.birth_date, 9, 2) ASC, p.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `

    const rows = $app.db().newQuery(selectSql).all()

    const currentYear = new Date().getFullYear()
    const items = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const birthYear = parseInt(r.b_year, 10)
      const bDay = parseInt(r.b_day, 10)
      let turningAge = null
      if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= currentYear) {
        turningAge = currentYear - birthYear
      }

      items.push({
        id: String(r.patient_id),
        patientId: String(r.patient_id),
        animalName: String(r.animal_name || 'Sem nome'),
        species: String(r.species || ''),
        breed: String(r.breed || ''),
        gender: String(r.gender || ''),
        ctrl: String(r.ctrl || ''),
        birthDate: String(r.birth_date || ''),
        birthdayDay: isNaN(bDay) ? null : bDay,
        birthdayMonth: month,
        turningAge,
        tutorName: String(r.tutor_name || 'Não informado'),
        tutorPhone: String(r.tutor_phone || r.tutor_phone_secondary || ''),
      })
    }

    return e.json(200, {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      month,
      items,
    })
  } catch (err) {
    console.log('Error in reports_birthdays:', err.message)
    return e.json(500, { error: 'Falha ao buscar aniversariantes: ' + err.message })
  }
})
