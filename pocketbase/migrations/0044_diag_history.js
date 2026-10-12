/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Diagnosticar histórico e mapeamento de import_key
    // Na carga de 12/10, o import_key tem: 'name:tutor|anim|espe|nasc:DDMMAA00000|pela:cor#1'
    // Na carga de 26/09, o import_key tem: 'name:tutor|anim|espe|nasc:DDMMAAAA0000|pela:cor#1'
    // Ou seja, a única diferença no import_key entre 26/09 e 12/10 era o formato do ano na data de nascimento (4 dígitos em set vs 2 dígitos em out).
    // Além disso, se nascimento for vazio:
    // 'name:tutor|anim|espe|pela:cor#1' ou similar.

    // Vamos verificar quantos pares têm import_key casado se normalizarmos a data do import_key:
    // Se extrairmos tutor_id + LOWER(name) + COALESCE(birth_date,'')
    // Quantos itens de histórico (clinical_records, appointments, vaccines) existem em registros de setembro
    // que casam com registros de outubro?
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _matched_pairs AS
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

    // Histórico de setembro:
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _hist_counts AS
      SELECT 
        (SELECT COUNT(*) FROM clinical_records WHERE patient_id IN (SELECT set_id FROM _matched_pairs)) as set_clin_total,
        (SELECT COUNT(*) FROM appointments WHERE patient_id IN (SELECT set_id FROM _matched_pairs)) as set_app_total,
        (SELECT COUNT(*) FROM vaccines WHERE patient_id IN (SELECT set_id FROM _matched_pairs)) as set_vac_total
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_04',
        'DIAG_PAIRS_HISTORY',
        (SELECT set_clin_total FROM _hist_counts),
        (SELECT set_app_total FROM _hist_counts),
        datetime('now'),
        json_object(
          'ambiguity_summary', (SELECT summary FROM import_progress WHERE id = 'diag_pairs_03'),
          'set_clin_total', (SELECT set_clin_total FROM _hist_counts),
          'set_app_total', (SELECT set_app_total FROM _hist_counts),
          'set_vac_total', (SELECT set_vac_total FROM _hist_counts)
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    app.db().newQuery('DROP TABLE _matched_pairs').execute()
    app.db().newQuery('DROP TABLE _hist_counts').execute()
  },
  (app) => {
    try {
      app.db().newQuery("DELETE FROM import_progress WHERE id = 'diag_pairs_04'").execute()
    } catch (_) {}
  },
)
