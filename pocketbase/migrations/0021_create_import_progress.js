migrate(
  (app) => {
    const collection = new Collection({
      name: 'import_progress',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'file_name', type: 'text', required: true },
        { name: 'total_file_rows', type: 'number' },
        { name: 'last_processed_line', type: 'number', required: true },
        { name: 'last_range_start', type: 'number' },
        { name: 'last_range_end', type: 'number' },
        { name: 'completed_at', type: 'text' },
        { name: 'summary', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_import_progress_file ON import_progress (file_name)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('import_progress')
    app.delete(collection)
  },
)
