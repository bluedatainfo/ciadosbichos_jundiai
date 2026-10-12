/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Verificar pares múltiplos
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _all_pairs AS
      SELECT 
        p_out.id as out_id,
        p_out.name as out_name,
        p_out.nume as out_nume,
        p_out.import_key as out_import_key,
        p_set.id as set_id,
        p_set.name as set_name,
        p_set.import_key as set_import_key
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

    // 2. Extrair sufixo #N dos import_keys
    // out_import_key ex: '...#1', set_import_key ex: '...#1'
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _key_suff AS
      SELECT 
        out_id,
        set_id,
        CASE 
          WHEN INSTR(out_import_key, '#') > 0 THEN SUBSTR(out_import_key, INSTR(out_import_key, '#') + 1)
          ELSE '1'
        END as out_occ,
        CASE 
          WHEN INSTR(set_import_key, '#') > 0 THEN SUBSTR(set_import_key, INSTR(set_import_key, '#') + 1)
          ELSE '1'
        END as set_occ
      FROM _all_pairs
    `)
      .execute()

    // Quantos casam out_occ = set_occ?
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _occ_matches AS
      SELECT 
        out_id,
        set_id
      FROM _key_suff
      WHERE out_occ = set_occ
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_05',
        'DIAG_OCCURRENCE_CHECK',
        (SELECT COUNT(*) FROM _all_pairs),
        (SELECT COUNT(*) FROM _occ_matches),
        datetime('now'),
        json_object(
          'total_pairs', (SELECT COUNT(*) FROM _all_pairs),
          'occ_matches', (SELECT COUNT(*) FROM _occ_matches),
          'distinct_out_occ', (SELECT COUNT(DISTINCT out_id) FROM _occ_matches),
          'distinct_set_occ', (SELECT COUNT(DISTINCT set_id) FROM _occ_matches)
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    // Verificar se existe algum hash em comum entre clinical_records do set_id e do out_id
    // Pegar uma amostra de 10 pares
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _hash_overlap AS
      SELECT 
        p.out_id,
        p.set_id,
        (SELECT COUNT(*) FROM clinical_records c WHERE c.patient_id = p.out_id) as out_clin_cnt,
        (SELECT COUNT(*) FROM clinical_records c WHERE c.patient_id = p.set_id) as set_clin_cnt,
        (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.out_id) as out_app_cnt,
        (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.set_id) as set_app_cnt,
        (SELECT COUNT(*) FROM vaccines v WHERE v.patient_id = p.out_id) as out_vac_cnt,
        (SELECT COUNT(*) FROM vaccines v WHERE v.patient_id = p.set_id) as set_vac_cnt
      FROM _occ_matches p
      LIMIT 10
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_06',
        'DIAG_HASH_OVERLAP_SAMPLES',
        10,
        10,
        datetime('now'),
        (SELECT json_group_array(json_object(
          'out_id', out_id,
          'set_id', set_id,
          'out_clin_cnt', out_clin_cnt,
          'set_clin_cnt', set_clin_cnt,
          'out_app_cnt', out_app_cnt,
          'set_app_cnt', set_app_cnt,
          'out_vac_cnt', out_vac_cnt,
          'set_vac_cnt', set_vac_cnt
        )) FROM _hash_overlap),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    app.db().newQuery('DROP TABLE _all_pairs').execute()
    app.db().newQuery('DROP TABLE _key_suff').execute()
    app.db().newQuery('DROP TABLE _occ_matches').execute()
    app.db().newQuery('DROP TABLE _hash_overlap').execute()
  },
  (app) => {
    try {
      app
        .db()
        .newQuery("DELETE FROM import_progress WHERE id IN ('diag_pairs_05', 'diag_pairs_06')")
        .execute()
    } catch (_) {}
  },
)
