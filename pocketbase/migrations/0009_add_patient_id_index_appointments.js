migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')
    col.addIndex('idx_appointments_patient_id', false, 'patient_id', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')
    col.removeIndex('idx_appointments_patient_id')
    app.save(col)
  },
)
