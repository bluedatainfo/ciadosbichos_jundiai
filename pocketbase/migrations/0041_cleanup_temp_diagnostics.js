/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Remover tabela auxiliar _diag_results
    try {
      const diagCol = app.findCollectionByNameOrId('_diag_results')
      if (diagCol) {
        app.delete(diagCol)
      }
    } catch (_) {}

    // 2. Limpar registros de diagnósticos temporários gravados em import_progress
    try {
      app
        .db()
        .newQuery("DELETE FROM import_progress WHERE file_name LIKE 'DIAGNOSTICO_%'")
        .execute()
    } catch (_) {}
  },
  (app) => {},
)
