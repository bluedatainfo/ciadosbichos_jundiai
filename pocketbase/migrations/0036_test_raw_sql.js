/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Teste com newQuery e execute()
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_counts AS
      SELECT SUBSTR(created, 1, 10) as dt, COUNT(*) as c
      FROM patients
      GROUP BY SUBSTR(created, 1, 10)
    `)
      .execute()

    // Agora transferir para _diag_results via INSERT INTO
    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dt_' || SUBSTR(REPLACE(dt, '-', ''), 1, 12),
        'tarefa2_date_counts',
        '{"date":"' || dt || '","count":' || c || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_counts
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_counts').execute()
  },
  (app) => {},
)
