/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Verificar quantos dos 18.300 registros de setembro casam perfeitamente
    // Criando a tabela de pares única e definitiva:
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _candidates AS
      SELECT 
        p_out.id as out_id,
        p_out.name as out_name,
        p_out.nume as out_nume,
        p_out.tutor_id as out_tutor_id,
        p_set.id as set_id,
        p_set.name as set_name,
        CASE 
          WHEN INSTR(p_out.import_key, '#') > 0 THEN SUBSTR(p_out.import_key, INSTR(p_out.import_key, '#') + 1)
          ELSE '1'
        END as out_occ,
        CASE 
          WHEN INSTR(p_set.import_key, '#') > 0 THEN SUBSTR(p_set.import_key, INSTR(p_set.import_key, '#') + 1)
          ELSE '1'
        END as set_occ
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

    // 1º passo: pares com mesma ocorrência #N
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _dedup_pairs_def AS
      SELECT out_id, set_id
      FROM _candidates
      WHERE out_occ = set_occ
    `)
      .execute()

    // 2º passo: para os que sobraram (onde out_occ != set_occ), se for 1 para 1
    app
      .db()
      .newQuery(`
      INSERT INTO _dedup_pairs_def (out_id, set_id)
      SELECT c.out_id, c.set_id
      FROM _candidates c
      WHERE c.out_id NOT IN (SELECT out_id FROM _dedup_pairs_def)
        AND c.set_id NOT IN (SELECT set_id FROM _dedup_pairs_def)
      GROUP BY c.set_id
      HAVING COUNT(DISTINCT c.out_id) = 1
    `)
      .execute()

    // Verificar se existe algum par não 1:1
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _stats_def AS
      SELECT 
        (SELECT COUNT(*) FROM _dedup_pairs_def) as total_pairs,
        (SELECT COUNT(DISTINCT out_id) FROM _dedup_pairs_def) as dist_out,
        (SELECT COUNT(DISTINCT set_id) FROM _dedup_pairs_def) as dist_set,
        (SELECT COUNT(*) FROM patients WHERE created < '2026-10-01') as total_set_patients,
        (SELECT COUNT(*) FROM patients WHERE created < '2026-10-01' AND id NOT IN (SELECT set_id FROM _dedup_pairs_def)) as unmerged_set_patients
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_07',
        'DIAG_DEDUP_PAIRS_DEF',
        (SELECT total_pairs FROM _stats_def),
        (SELECT unmerged_set_patients FROM _stats_def),
        datetime('now'),
        json_object(
          'total_pairs', (SELECT total_pairs FROM _stats_def),
          'dist_out', (SELECT dist_out FROM _stats_def),
          'dist_set', (SELECT dist_set FROM _stats_def),
          'total_set_patients', (SELECT total_set_patients FROM _stats_def),
          'unmerged_set_patients', (SELECT unmerged_set_patients FROM _stats_def)
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    // Verificar uma amostra dos que não casaram (unmerged_set_patients)
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _unmerged_samples AS
      SELECT p.id, p.name, p.ctrl, p.nume, p.import_key, p.created, t.name as tutor_name
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      WHERE p.created < '2026-10-01'
        AND p.id NOT IN (SELECT set_id FROM _dedup_pairs_def)
      LIMIT 10
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_08',
        'DIAG_UNMERGED_SAMPLES',
        10,
        10,
        datetime('now'),
        (SELECT json_group_array(json_object(
          'id', id,
          'name', name,
          'ctrl', ctrl,
          'nume', nume,
          'import_key', import_key,
          'created', created,
          'tutor_name', tutor_name
        )) FROM _unmerged_samples),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    app.db().newQuery('DROP TABLE _candidates').execute()
    app.db().newQuery('DROP TABLE _dedup_pairs_def').execute()
    app.db().newQuery('DROP TABLE _stats_def').execute()
    app.db().newQuery('DROP TABLE _unmerged_samples').execute()
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM import_progress WHERE id IN ('diag_pairs_07', 'diag_pairs_08')")
        .execute()
    } catch (_) {}
  },
)
