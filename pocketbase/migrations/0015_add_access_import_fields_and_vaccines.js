/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Novos campos em tutors: rg, indication, city, state, neighborhood
    const tutors = app.findCollectionByNameOrId('tutors')
    if (!tutors.fields.getByName('rg')) {
      tutors.fields.add(new TextField({ name: 'rg' }))
    }
    if (!tutors.fields.getByName('indication')) {
      tutors.fields.add(new TextField({ name: 'indication' }))
    }
    if (!tutors.fields.getByName('city')) {
      tutors.fields.add(new TextField({ name: 'city' }))
    }
    if (!tutors.fields.getByName('state')) {
      tutors.fields.add(new TextField({ name: 'state' }))
    }
    if (!tutors.fields.getByName('neighborhood')) {
      tutors.fields.add(new TextField({ name: 'neighborhood' }))
    }
    app.save(tutors)

    // 2. Novos campos em patients: ctrl, microchip, deceased, status_notes, registration_date
    const patients = app.findCollectionByNameOrId('patients')
    if (!patients.fields.getByName('ctrl')) {
      patients.fields.add(new TextField({ name: 'ctrl' }))
    }
    if (!patients.fields.getByName('microchip')) {
      patients.fields.add(new TextField({ name: 'microchip' }))
    }
    if (!patients.fields.getByName('deceased')) {
      // PocketBase boolean field must not be required
      patients.fields.add(new BoolField({ name: 'deceased' }))
    }
    if (!patients.fields.getByName('status_notes')) {
      patients.fields.add(new TextField({ name: 'status_notes' }))
    }
    if (!patients.fields.getByName('registration_date')) {
      patients.fields.add(new DateField({ name: 'registration_date' }))
    }
    // Adicionar índice para ctrl em patients
    patients.addIndex('idx_patients_ctrl', false, 'ctrl', '')
    app.save(patients)

    // 3. Criar coleção vaccines (histórico de vacinação)
    let vaccinesCollection
    try {
      vaccinesCollection = app.findCollectionByNameOrId('vaccines')
    } catch (_) {
      vaccinesCollection = new Collection({
        name: 'vaccines',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'patient_id',
            type: 'relation',
            required: true,
            collectionId: patients.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'date', type: 'date' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_vaccines_patient_id ON vaccines (patient_id)',
          'CREATE INDEX idx_vaccines_date ON vaccines (date)',
        ],
      })
      app.save(vaccinesCollection)
    }
  },
  (app) => {
    try {
      const vaccines = app.findCollectionByNameOrId('vaccines')
      app.delete(vaccines)
    } catch (_) {}

    try {
      const patients = app.findCollectionByNameOrId('patients')
      patients.fields.removeByName('ctrl')
      patients.fields.removeByName('microchip')
      patients.fields.removeByName('deceased')
      patients.fields.removeByName('status_notes')
      patients.fields.removeByName('registration_date')
      patients.removeIndex('idx_patients_ctrl')
      app.save(patients)
    } catch (_) {}

    try {
      const tutors = app.findCollectionByNameOrId('tutors')
      tutors.fields.removeByName('rg')
      tutors.fields.removeByName('indication')
      tutors.fields.removeByName('city')
      tutors.fields.removeByName('state')
      tutors.fields.removeByName('neighborhood')
      app.save(tutors)
    } catch (_) {}
  },
)
