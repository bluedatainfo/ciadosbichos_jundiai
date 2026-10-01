routerAdd('GET', '/backend/v1/reports/species-stats', (e) => {
  // Retorna estatísticas consolidadas agregadas diretamente via SQLite
  try {
    // 1. Total de tutores
    let totalTutors = 0
    try {
      const tutRow = $app.db().newQuery('SELECT COUNT(*) AS total FROM tutors').one()
      totalTutors = Number(tutRow.total || 0)
    } catch (err) {
      console.log('Error counting tutors:', err.message)
    }

    // 2. Total de pacientes vivos e total geral
    let totalPatients = 0
    let totalAlivePatients = 0
    let totalDeceasedPatients = 0
    try {
      const patRow = $app
        .db()
        .newQuery(
          'SELECT COUNT(*) AS total, SUM(CASE WHEN deceased = 1 THEN 1 ELSE 0 END) AS deceased_count, SUM(CASE WHEN deceased = 0 OR deceased IS NULL THEN 1 ELSE 0 END) AS alive_count FROM patients',
        )
        .one()
      totalPatients = Number(patRow.total || 0)
      totalDeceasedPatients = Number(patRow.deceased_count || 0)
      totalAlivePatients = Number(patRow.alive_count || 0)
    } catch (err) {
      console.log('Error counting patients:', err.message)
    }

    // 3. Distribuição por espécie (apenas vivos)
    let speciesDistribution = []
    try {
      const rows = $app
        .db()
        .newQuery(
          `SELECT 
             COALESCE(NULLIF(TRIM(species), ''), 'Não informada') AS species,
             COUNT(*) AS count
           FROM patients
           WHERE deceased = 0 OR deceased IS NULL
           GROUP BY species
           ORDER BY count DESC`,
        )
        .all()

      for (let i = 0; i < rows.length; i++) {
        const c = Number(rows[i].count || 0)
        const pct = totalAlivePatients > 0 ? (c / totalAlivePatients) * 100 : 0
        speciesDistribution.push({
          species: String(rows[i].species || 'Não informada'),
          count: c,
          percentage: Number(pct.toFixed(1)),
        })
      }
    } catch (err) {
      console.log('Error fetching species distribution:', err.message)
    }

    // 4. Distribuição por sexo (apenas vivos)
    let genderDistribution = []
    try {
      const rows = $app
        .db()
        .newQuery(
          `SELECT 
             COALESCE(NULLIF(TRIM(gender), ''), 'Não informado') AS gender,
             COUNT(*) AS count
           FROM patients
           WHERE deceased = 0 OR deceased IS NULL
           GROUP BY gender
           ORDER BY count DESC`,
        )
        .all()

      for (let i = 0; i < rows.length; i++) {
        const c = Number(rows[i].count || 0)
        const pct = totalAlivePatients > 0 ? (c / totalAlivePatients) * 100 : 0
        genderDistribution.push({
          gender: String(rows[i].gender || 'Não informado'),
          count: c,
          percentage: Number(pct.toFixed(1)),
        })
      }
    } catch (err) {
      console.log('Error fetching gender distribution:', err.message)
    }

    // 5. Top raças por espécie (Top 5 caninos e Top 5 felinos, e geral)
    let topBreedsCanine = []
    try {
      const rows = $app
        .db()
        .newQuery(
          `SELECT 
             COALESCE(NULLIF(TRIM(breed), ''), 'Não informada') AS breed,
             COUNT(*) AS count
           FROM patients
           WHERE (deceased = 0 OR deceased IS NULL)
             AND LOWER(species) LIKE '%canin%'
           GROUP BY breed
           ORDER BY count DESC
           LIMIT 10`,
        )
        .all()

      for (let i = 0; i < rows.length; i++) {
        topBreedsCanine.push({
          breed: String(rows[i].breed),
          count: Number(rows[i].count || 0),
        })
      }
    } catch (err) {
      console.log('Error fetching top canine breeds:', err.message)
    }

    let topBreedsFeline = []
    try {
      const rows = $app
        .db()
        .newQuery(
          `SELECT 
             COALESCE(NULLIF(TRIM(breed), ''), 'Não informada') AS breed,
             COUNT(*) AS count
           FROM patients
           WHERE (deceased = 0 OR deceased IS NULL)
             AND LOWER(species) LIKE '%felin%'
           GROUP BY breed
           ORDER BY count DESC
           LIMIT 10`,
        )
        .all()

      for (let i = 0; i < rows.length; i++) {
        topBreedsFeline.push({
          breed: String(rows[i].breed),
          count: Number(rows[i].count || 0),
        })
      }
    } catch (err) {
      console.log('Error fetching top feline breeds:', err.message)
    }

    // 6. Total de vacinações na base
    let totalVaccines = 0
    try {
      const vacRow = $app.db().newQuery('SELECT COUNT(*) AS total FROM vaccines').one()
      totalVaccines = Number(vacRow.total || 0)
    } catch (err) {
      console.log('Error counting vaccines:', err.message)
    }

    return e.json(200, {
      totalTutors,
      totalPatients,
      totalAlivePatients,
      totalDeceasedPatients,
      totalVaccines,
      speciesDistribution,
      genderDistribution,
      topBreedsCanine,
      topBreedsFeline,
    })
  } catch (err) {
    console.log('General error in reports_species_stats:', err.message)
    return e.json(500, { error: 'Falha ao processar estatísticas' })
  }
})
