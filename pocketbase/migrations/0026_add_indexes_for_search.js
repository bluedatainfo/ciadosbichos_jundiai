migrate(
  (app) => {
    const patients = app.findCollectionByNameOrId('patients')
    patients.addIndex('idx_patients_species', false, 'species', '')
    app.save(patients)

    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.addIndex('idx_tutors_phone', false, 'phone', '')
    app.save(tutors)
  },
  (app) => {
    const patients = app.findCollectionByNameOrId('patients')
    patients.removeIndex('idx_patients_species')
    app.save(patients)

    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.removeIndex('idx_tutors_phone')
    app.save(tutors)
  },
)
