/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar tabela temporária com o maior NUME
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_max_nume AS
      SELECT CAST(nume AS INTEGER) AS max_nume
      FROM patients
      WHERE nume IS NOT NULL AND nume != '' AND nume != '0' AND nume GLOB '[0-9]*'
      ORDER BY CAST(nume AS INTEGER) DESC
      LIMIT 1
    `)
      .execute()

    // 2. Atualizar marie (5ke2aidcuherjkx) com max_nume + 1
    app
      .db()
      .newQuery(`
      UPDATE patients
      SET nume = CAST((SELECT max_nume + 1 FROM _temp_max_nume) AS TEXT),
          updated = datetime('now')
      WHERE id = '5ke2aidcuherjkx'
    `)
      .execute()

    // 3. Atualizar luna (q6py4x5eqhyq4f8) com max_nume + 2
    app
      .db()
      .newQuery(`
      UPDATE patients
      SET nume = CAST((SELECT max_nume + 2 FROM _temp_max_nume) AS TEXT),
          updated = datetime('now')
      WHERE id = 'q6py4x5eqhyq4f8'
    `)
      .execute()

    // Limpar tabela temporária
    app.db().newQuery('DROP TABLE _temp_max_nume').execute()
  },
  (app) => {
    try {
      app
        .db()
        .newQuery(
          `UPDATE patients
           SET nume = ''
           WHERE id IN ('5ke2aidcuherjkx', 'q6py4x5eqhyq4f8')`,
        )
        .execute()
    } catch (_) {}
  },
)
