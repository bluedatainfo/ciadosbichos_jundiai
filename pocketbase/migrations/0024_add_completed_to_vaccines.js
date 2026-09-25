migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('vaccines')

    if (!col.fields.getByName('completed')) {
      col.fields.add(
        new BoolField({
          name: 'completed',
          required: false,
        }),
      )
    }

    app.save(col)

    // Retornos históricos legados já existentes no banco com data ou criados anteriormente
    // devem começar como realizados (completed = true), para não gerar alertas perpétuos.
    app
      .db()
      .newQuery('UPDATE vaccines SET completed = TRUE WHERE completed IS NULL OR completed = FALSE')
      .execute()

    // Index para consultas rápidas por status de realização
    try {
      col.addIndex('idx_vaccines_completed', false, 'completed', '')
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    const col = app.findCollectionByNameOrId('vaccines')
    try {
      col.removeIndex('idx_vaccines_completed')
    } catch (_) {}
    if (col.fields.getByName('completed')) {
      col.fields.removeByName('completed')
    }
    app.save(col)
  },
)
