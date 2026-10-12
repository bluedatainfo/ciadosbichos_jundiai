/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Contagens gerais de pacientes
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _p_stats AS
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN created < '2026-10-01' THEN 1 ELSE 0 END) as set_count,
        SUM(CASE WHEN created >= '2026-10-01' THEN 1 ELSE 0 END) as out_count,
        SUM(CASE WHEN nume IS NOT NULL AND nume != '' AND nume != '0' THEN 1 ELSE 0 END) as com_nume,
        SUM(CASE WHEN nume IS NULL OR nume = '' OR nume = '0' THEN 1 ELSE 0 END) as sem_nume
      FROM patients
    `)
      .execute()

    // 2. Análise de pares tutor + nome do pet + nascimento
    // Formato de nascimento: birth_date no PocketBase é 'YYYY-MM-DD HH:MM:SS.SSSZ' ou vazio
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _pairs_analysis AS
      SELECT 
        p_out.id as out_id,
        p_out.name as out_name,
        p_out.nume as out_nume,
        p_out.tutor_id as out_tutor_id,
        p_out.birth_date as out_birth,
        p_set.id as set_id,
        p_set.name as set_name,
        p_set.nume as set_nume,
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

    // 3. Salvar diagnósticos em import_progress
    const statsRow = app
      .db()
      .newQuery('SELECT total, set_count, out_count, com_nume, sem_nume FROM _p_stats')
      .execute()
    // execute() não retorna linhas diretamente no pocketbase goja newQuery a não ser com Row/Rows, mas podemos gravar em tabela existente
    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_01',
        'DIAG_PAIRS_CHECK',
        (SELECT COUNT(*) FROM _pairs_analysis),
        (SELECT COUNT(DISTINCT set_id) FROM _pairs_analysis),
        datetime('now'),
        json_object(
          'total', (SELECT total FROM _p_stats),
          'set_count', (SELECT set_count FROM _p_stats),
          'out_count', (SELECT out_count FROM _p_stats),
          'com_nume', (SELECT com_nume FROM _p_stats),
          'sem_nume', (SELECT sem_nume FROM _p_stats),
          'total_pairs', (SELECT COUNT(*) FROM _pairs_analysis),
          'distinct_out', (SELECT COUNT(DISTINCT out_id) FROM _pairs_analysis),
          'distinct_set', (SELECT COUNT(DISTINCT set_id) FROM _pairs_analysis)
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    // Amostras de pares
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _pairs_samples AS
      SELECT 
        p.out_id,
        p.out_name,
        p.out_nume,
        p.set_id,
        p.set_name,
        p.out_birth,
        t.name as tutor_name
      FROM _pairs_analysis p
      LEFT JOIN tutors t ON p.out_tutor_id = t.id
      LIMIT 5
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_02',
        'DIAG_PAIRS_SAMPLES',
        5,
        5,
        datetime('now'),
        (SELECT json_group_array(json_object(
          'out_id', out_id,
          'out_name', out_name,
          'out_nume', out_nume,
          'set_id', set_id,
          'set_name', set_name,
          'out_birth', out_birth,
          'tutor_name', tutor_name
        )) FROM _pairs_samples),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    app.db().newQuery('DROP TABLE _p_stats').execute()
    app.db().newQuery('DROP TABLE _pairs_analysis').execute()
    app.db().newQuery('DROP TABLE _pairs_samples').execute()
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM import_progress WHERE id IN ('diag_pairs_01', 'diag_pairs_02')")
        .execute()
    } catch (_) {}
  },
)
