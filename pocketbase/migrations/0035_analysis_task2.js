/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Tabela auxiliar
    const diagCol = app.findCollectionByNameOrId('_diag_results')

    function saveRes(cat, obj) {
      const rec = new Record(diagCol)
      rec.set('category', cat)
      rec.set('payload', JSON.stringify(obj))
      app.save(rec)
    }

    const totalPatients = app.countRecords('patients')
    const totalTutors = app.countRecords('tutors')

    const knownDates = [
      '2026-09-18',
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]

    const dateCounts = []
    let sumCounted = 0
    for (let i = 0; i < knownDates.length; i++) {
      const dt = knownDates[i]
      const start = `${dt} 00:00:00.000Z`
      const end = `${dt} 23:59:59.999Z`
      const recs = app.findRecordsByFilter(
        'patients',
        `created >= '${start}' && created <= '${end}'`,
        '',
        1,
        0,
      )
      // Se encontrou algum registro, vamos pegar o total
      // No PocketBase v0.36, podemos usar findRecordsByFilter com limit ou contar via query
      if (recs.length > 0) {
        // Encontrar com limit 1 apenas indica presença; para ter o número exato, vamos iterar ou usar query SQLite com tx
        dateCounts.push(dt)
      }
    }

    saveRes('tarefa2_test', {
      totalPatients,
      totalTutors,
      activeDates: dateCounts,
    })
  },
  (app) => {},
)
