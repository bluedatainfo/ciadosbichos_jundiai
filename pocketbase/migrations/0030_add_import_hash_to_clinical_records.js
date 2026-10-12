migrate(
  (app) => {
    // Adicionar campo import_hash e índice nas collections dependentes para sincronização ultra-rápida
    const collections = ['clinical_records', 'appointments', 'vaccines']

    collections.forEach((colName) => {
      const col = app.findCollectionByNameOrId(colName)
      if (!col.fields.getByName('import_hash')) {
        col.fields.add(
          new TextField({
            name: 'import_hash',
            required: false,
          }),
        )
        app.save(col)
      }

      // Adicionar índice em import_hash
      const idxName = `idx_${colName}_import_hash`
      try {
        col.addIndex(idxName, false, 'import_hash', '')
        app.save(col)
      } catch (e) {
        console.log(`Aviso ao criar índice ${idxName}:`, e)
      }
    })
  },
  (app) => {
    const collections = ['clinical_records', 'appointments', 'vaccines']
    collections.forEach((colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        const idxName = `idx_${colName}_import_hash`
        try {
          col.removeIndex(idxName)
        } catch (_) {}
        if (col.fields.getByName('import_hash')) {
          col.fields.removeByName('import_hash')
        }
        app.save(col)
      } catch (_) {}
    })
  },
)
