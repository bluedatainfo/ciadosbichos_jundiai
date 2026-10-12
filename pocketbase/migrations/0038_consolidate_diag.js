/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Vamos compactar os registros de _diag_results em um único json consolidadão
    // para podermos ler de forma simples
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _consolidated AS
      SELECT category, json_group_array(json(payload)) as items
      FROM _diag_results
      GROUP BY category
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'summary_all',
        'FULL_DIAGNOSTIC_SUMMARY',
        json_group_object(category, json(items)),
        datetime('now'),
        datetime('now')
      FROM _consolidated
    `)
      .execute()

    app.db().newQuery('DROP TABLE _consolidated').execute()
  },
  (app) => {},
)
