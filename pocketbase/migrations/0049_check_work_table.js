/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Escrever o resumo em import_progress de diag
    app
      .db()
      .newQuery(`
      INSERT OR REPLACE INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'diag_pairs_09',
        'DIAG_WORK_TABLE_CHECK',
        (SELECT COUNT(*) FROM _dedup_pairs_work),
        (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending'),
        datetime('now'),
        json_object(
          'total_in_work', (SELECT COUNT(*) FROM _dedup_pairs_work),
          'pending', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending')
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()
  },
  (app) => {},
)
