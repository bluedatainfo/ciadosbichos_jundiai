migrate(
  (app) => {
    // 1. Coleção prescriptions para histórico simples dos receituários gerados
    try {
      app.findCollectionByNameOrId('prescriptions')
    } catch (_) {
      const collection = new Collection({
        name: 'prescriptions',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != '' && @request.auth.role != 'attendant'",
        fields: [
          {
            name: 'patient_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('patients').id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'patient_name', type: 'text', required: true },
          { name: 'tutor_name', type: 'text', required: false },
          { name: 'date', type: 'text', required: true },
          { name: 'content', type: 'text', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_prescriptions_patient_id ON prescriptions (patient_id)',
          'CREATE INDEX idx_prescriptions_created ON prescriptions (created DESC)',
        ],
      })
      app.save(collection)
    }

    // 2. Adicionar 'prescriptions' aos valores permitidos no campo select 'module' de audit_logs se ainda não constar
    try {
      const auditCol = app.findCollectionByNameOrId('audit_logs')
      const moduleField = auditCol.fields.getByName('module')
      if (moduleField && Array.isArray(moduleField.values)) {
        if (!moduleField.values.includes('prescriptions')) {
          moduleField.values.push('prescriptions')
          app.save(auditCol)
        }
      }
    } catch (e) {
      console.log('Aviso ao atualizar valores de audit_logs module:', e)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('prescriptions')
      app.delete(col)
    } catch (_) {}
  },
)
