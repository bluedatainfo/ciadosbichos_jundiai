migrate(
  (app) => {
    const collection = new Collection({
      name: 'import_failures',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'linha', type: 'number', required: true },
        { name: 'ctrl', type: 'text' },
        { name: 'tutor', type: 'text' },
        { name: 'animal', type: 'text' },
        {
          name: 'tipo',
          type: 'select',
          values: [
            'clinical_entry',
            'appointment',
            'vaccine',
            'tutor',
            'patient',
            'database_error',
            'parser_warning',
            'geral',
          ],
          maxSelect: 1,
        },
        { name: 'erro', type: 'text', required: true },
        { name: 'trecho', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'resolved', 'ignored'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_import_failures_linha ON import_failures (linha)',
        'CREATE INDEX idx_import_failures_ctrl ON import_failures (ctrl)',
        'CREATE INDEX idx_import_failures_status ON import_failures (status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('import_failures')
    app.delete(collection)
  },
)
