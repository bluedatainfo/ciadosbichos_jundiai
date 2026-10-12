/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Verificar quantos set_id têm mais de um out_id associado, e quantos out_id têm mais de um set_id associado
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _pairs_raw AS
      SELECT 
        p_out.id as out_id,
        p_out.nume as out_nume,
        p_set.id as set_id,
        p_set.created as set_created,
        p_out.created as out_created
      FROM patients p_out
      JOIN patients p_set ON 
        p_out.tutor_id = p_set.tutor_id
        AND LOWER(TRIM(p_out.name)) = LOWER(TRIM(p_set.name))
        AND COALESCE(SUBSTR(p_out.birth_date, 1, 10), '') = COALESCE(SUBSTR(p_set.birth_date, 1, 10), '')
        AND p_out.id != p_set.id
      WHERE (p_out.nume IS NOT NULL AND p_out.nume != '' AND p_out.nume != '0')
        AND (p_set.nume IS NULL OR p_set.nume = '' OR p_set.nume = '0')
        AND p_set.created < '2026-10-01'
    `)
      .execute()

    // Como desambiguar quando há múltiplos?
    // Ex: Se o mesmo tutor tem dois animais com mesmo nome e mesma data de nascimento (ex: duas ninhadas ou dois animais sem data)
    // Se compararmos a espécie ou a pelagem/import_key?
    // Vamos verificar quantos pares têm espécie idêntica:
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _pairs_refined AS
      SELECT 
        p_out.id as out_id,
        p_set.id as set_id
      FROM patients p_out
      JOIN patients p_set ON 
        p_out.tutor_id = p_set.tutor_id
        AND LOWER(TRIM(p_out.name)) = LOWER(TRIM(p_set.name))
        AND COALESCE(SUBSTR(p_out.birth_date, 1, 10), '') = COALESCE(SUBSTR(p_set.birth_date, 1, 10), '')
        AND LOWER(TRIM(p_out.species)) = LOWER(TRIM(p_set.species))
        AND p_out.id != p_set.id
      WHERE (p_out.nume IS NOT NULL AND p_out.nume != '' AND p_out.nume != '0')
        AND (p_set.nume IS NULL OR p_set.nume = '' OR p_set.nume = '0')
        AND p_set.created < '2026-10-01'
    `)
      .execute()

    // Verificar múltiplos out_id por set_id
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _multi_out AS
      SELECT set_id, COUNT(*) as cnt
      FROM _pairs_refined
      GROUP BY set_id
      HAVING COUNT(*) > 1
    `)
      .execute()

    // Verificar múltiplos set_id por out_id
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _multi_set AS
      SELECT out_id, COUNT(*) as cnt
      FROM _pairs_refined
      GROUP BY out_id
      HAVING COUNT(*) > 1
    `)
      .execute()

    // Salvar em import_progress
    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_03',
        'DIAG_PAIRS_AMBIGUITY',
        (SELECT COUNT(*) FROM _pairs_refined),
        0,
        datetime('now'),
        json_object(
          'pairs_refined_count', (SELECT COUNT(*) FROM _pairs_refined),
          'distinct_out', (SELECT COUNT(DISTINCT out_id) FROM _pairs_refined),
          'distinct_set', (SELECT COUNT(DISTINCT set_id) FROM _pairs_refined),
          'multi_out_count', (SELECT COUNT(*) FROM _multi_out),
          'multi_set_count', (SELECT COUNT(*) FROM _multi_set)
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    app.db().newQuery('DROP TABLE _pairs_raw').execute()
    app.db().newQuery('DROP TABLE _pairs_refined').execute()
    app.db().newQuery('DROP TABLE _multi_out').execute()
    app.db().newQuery('DROP TABLE _multi_set').execute()
  },
  (app) => {
    try {
      app.db().newQuery("DELETE FROM import_progress WHERE id = 'diag_pairs_03'").execute()
    } catch (_) {}
  },
)
