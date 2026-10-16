/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('clinical_records')
    col.addIndex('idx_clinical_records_created', false, 'created', '')
    col.addIndex('idx_clinical_records_patient_id', false, 'patient_id', '')
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('clinical_records')
      col.removeIndex('idx_clinical_records_created')
      col.removeIndex('idx_clinical_records_patient_id')
      app.save(col)
    } catch (_) {}
  },
)
