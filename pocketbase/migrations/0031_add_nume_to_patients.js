migrate(
  (app) => {
    const patients = app.findCollectionByNameOrId('patients')

    // 1. Adicionar campo 'nume' na collection patients se não existir
    if (!patients.fields.getByName('nume')) {
      patients.fields.add(
        new TextField({
          name: 'nume',
          required: false,
        }),
      )
      app.save(patients)
    }

    // 2. Adicionar índice em nume para buscas rápidas
    try {
      patients.addIndex('idx_patients_nume', false, 'nume', '')
      app.save(patients)
    } catch (e) {
      console.log('Aviso ao criar índice idx_patients_nume:', e)
    }
  },
  (app) => {
    try {
      const patients = app.findCollectionByNameOrId('patients')
      try {
        patients.removeIndex('idx_patients_nume')
      } catch (_) {}
      if (patients.fields.getByName('nume')) {
        patients.fields.removeByName('nume')
      }
      app.save(patients)
    } catch (e) {
      console.log('Erro ao reverter migration 0031:', e)
    }
  },
)
