/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Tabela permanente dos pares para desduplicação
    // Prioridade 1: Mesmo tutor_id + Mesmo LOWER(name) + Mesma data de nascimento (YYYY-MM-DD) + Mesma espécie
    // Prioridade 2: Desambiguação de ocorrência (#N) do import_key
    app
      .db()
      .newQuery(`
      CREATE TABLE IF NOT EXISTS _dedup_pairs_work (
        pair_num INTEGER PRIMARY KEY AUTOINCREMENT,
        out_id TEXT NOT NULL,
        set_id TEXT NOT NULL UNIQUE,
        out_name TEXT,
        out_nume TEXT,
        tutor_id TEXT,
        status TEXT DEFAULT 'pending', -- pending, processed, error
        migrated_clin INTEGER DEFAULT 0,
        skipped_clin INTEGER DEFAULT 0,
        migrated_app INTEGER DEFAULT 0,
        skipped_app INTEGER DEFAULT 0,
        migrated_vac INTEGER DEFAULT 0,
        skipped_vac INTEGER DEFAULT 0,
        error_msg TEXT
      )
    `)
      .execute()

    // Criar índice
    app
      .db()
      .newQuery(
        'CREATE INDEX IF NOT EXISTS idx_dedup_work_status ON _dedup_pairs_work (status, pair_num)',
      )
      .execute()
    app
      .db()
      .newQuery('CREATE INDEX IF NOT EXISTS idx_dedup_work_out ON _dedup_pairs_work (out_id)')
      .execute()
    app
      .db()
      .newQuery('CREATE INDEX IF NOT EXISTS idx_dedup_work_set ON _dedup_pairs_work (set_id)')
      .execute()

    // Povoar _dedup_pairs_work se ainda estiver vazia
    const countCheck = app.db().newQuery('SELECT COUNT(*) as c FROM _dedup_pairs_work').execute()

    // Inserção dos candidatos
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _cands AS
      SELECT 
        p_out.id as out_id,
        p_out.name as out_name,
        p_out.nume as out_nume,
        p_out.tutor_id as tutor_id,
        p_set.id as set_id,
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

    // Inserir primeiro os de mesma ocorrência (#1 com #1, etc.)
    app
      .db()
      .newQuery(`
      INSERT OR IGNORE INTO _dedup_pairs_work (out_id, set_id, out_name, out_nume, tutor_id, status)
      SELECT out_id, set_id, out_name, out_nume, tutor_id, 'pending'
      FROM _cands
      WHERE out_occ = set_occ
    `)
      .execute()

    // Em seguida, para qualquer set_id que não tenha sido inserido, se tiver correspondente único
    app
      .db()
      .newQuery(`
      INSERT OR IGNORE INTO _dedup_pairs_work (out_id, set_id, out_name, out_nume, tutor_id, status)
      SELECT c.out_id, c.set_id, c.out_name, c.out_nume, c.tutor_id, 'pending'
      FROM _cands c
      WHERE c.set_id NOT IN (SELECT set_id FROM _dedup_pairs_work)
        AND c.out_id NOT IN (SELECT out_id FROM _dedup_pairs_work)
      GROUP BY c.set_id
      HAVING COUNT(DISTINCT c.out_id) = 1
    `)
      .execute()

    app.db().newQuery('DROP TABLE _cands').execute()

    // Registrar total inicial em import_progress
    app
      .db()
      .newQuery(`
      INSERT OR REPLACE INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'dedup_progress_status',
        'DEDUPLICACAO_PARES_PROGRESSO',
        (SELECT COUNT(*) FROM _dedup_pairs_work),
        0,
        '',
        json_object(
          'total_pairs_identified', (SELECT COUNT(*) FROM _dedup_pairs_work),
          'pending', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending'),
          'processed', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
          'error', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'error'),
          'total_migrated_clin', 0,
          'total_skipped_clin', 0,
          'total_migrated_app', 0,
          'total_skipped_app', 0,
          'total_migrated_vac', 0,
          'total_skipped_vac', 0,
          'total_set_removed', 0
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()
  },
  (app) => {
    try {
      app.db().newQuery('DROP TABLE IF EXISTS _dedup_pairs_work').execute()
      app.db().newQuery("DELETE FROM import_progress WHERE id = 'dedup_progress_status'").execute()
    } catch (_) {}
  },
)
