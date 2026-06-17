migrate(
  (app) => {
    const tutors = new Collection({
      name: 'tutors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'cpf', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(tutors)

    const patients = new Collection({
      name: 'patients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'species', type: 'text' },
        { name: 'breed', type: 'text' },
        { name: 'birth_date', type: 'date' },
        { name: 'gender', type: 'select', values: ['Macho', 'Fêmea'], maxSelect: 1 },
        { name: 'weight', type: 'number' },
        {
          name: 'tutor_id',
          type: 'relation',
          collectionId: tutors.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(patients)

    const clinical_records = new Collection({
      name: 'clinical_records',
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
          collectionId: patients.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'description', type: 'text' },
        { name: 'diagnosis', type: 'text' },
        { name: 'treatment', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(clinical_records)

    const appointments = new Collection({
      name: 'appointments',
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
          collectionId: patients.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'date', type: 'date', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['return', 'vaccine', 'surgery', 'consultation'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          values: ['scheduled', 'completed', 'cancelled'],
          maxSelect: 1,
        },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(appointments)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('appointments'))
    app.delete(app.findCollectionByNameOrId('clinical_records'))
    app.delete(app.findCollectionByNameOrId('patients'))
    app.delete(app.findCollectionByNameOrId('tutors'))
  },
)
