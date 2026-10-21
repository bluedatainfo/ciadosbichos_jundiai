migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('prescriptions')

    // 1. Adicionar attached_to_record (bool, opcional, padrão false)
    if (!col.fields.getByName('attached_to_record')) {
      col.fields.add(
        new BoolField({
          name: 'attached_to_record',
          required: false,
        }),
      )
    }

    // 2. Adicionar attached_record_id (relation para clinical_records, opcional/nulo)
    if (!col.fields.getByName('attached_record_id')) {
      const clinicalCol = app.findCollectionByNameOrId('clinical_records')
      col.fields.add(
        new RelationField({
          name: 'attached_record_id',
          collectionId: clinicalCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }

    app.save(col)

    // Backfill defensivo idempotente: registros existentes ficam com false/null
    app
      .db()
      .newQuery(`
      UPDATE prescriptions
      SET attached_to_record = 0
      WHERE attached_to_record IS NULL
    `)
      .execute()
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('prescriptions')
      if (col.fields.getByName('attached_record_id')) {
        col.fields.removeByName('attached_record_id')
      }
      if (col.fields.getByName('attached_to_record')) {
        col.fields.removeByName('attached_to_record')
      }
      app.save(col)
    } catch (_) {}
  },
)
