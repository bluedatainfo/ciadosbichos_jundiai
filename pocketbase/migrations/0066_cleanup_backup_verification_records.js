migrate(
  (app) => {
    // 0066: Limpeza de registros de verificação/diagnóstico transitórios inseridos em import_failures
    try {
      const records = app.findRecordsByFilter(
        'import_failures',
        "ctrl = 'BACKUP_VERIFY'",
        '',
        100,
        0,
      )
      for (let i = 0; i < records.length; i++) {
        app.delete(records[i])
      }
      console.log('[Migration 0066] Registros de verificação BACKUP_VERIFY removidos com sucesso.')
    } catch (err) {
      console.log('[Migration 0066] Erro ao limpar import_failures:', err)
    }
  },
  (app) => {},
)
