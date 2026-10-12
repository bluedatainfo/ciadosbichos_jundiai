/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Pegar o resumo de _diag_results
    const row = app.findFirstRecordByData('_diag_results', 'id', 'summary_all')
    const fullJson = row.getString('payload')

    // Salvar em import_progress como um log seguro
    const ipCol = app.findCollectionByNameOrId('import_progress')
    const rec = new Record(ipCol)
    rec.set('file_name', 'DIAGNOSTICO_TAREFAS_2_E_3')
    rec.set('total_file_rows', 39730)
    rec.set('last_processed_line', 39730)
    rec.set('completed_at', new Date().toISOString())
    rec.set('summary', JSON.parse(fullJson))
    app.save(rec)
  },
  (app) => {},
)
