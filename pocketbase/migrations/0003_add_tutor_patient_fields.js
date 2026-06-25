migrate(
  (app) => {
    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.fields.add(new TextField({ name: 'phone_secondary' }))
    tutors.fields.add(new TextField({ name: 'cep' }))
    tutors.fields.add(new TextField({ name: 'additional_info' }))
    app.save(tutors)

    const patients = app.findCollectionByNameOrId('patients')
    patients.fields.add(new TextField({ name: 'pelagem' }))
    patients.fields.add(new DateField({ name: 'last_visit' }))
    patients.addIndex('idx_patients_last_visit', false, 'last_visit', '')
    app.save(patients)
  },
  (app) => {
    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.fields.removeByName('phone_secondary')
    tutors.fields.removeByName('cep')
    tutors.fields.removeByName('additional_info')
    app.save(tutors)

    const patients = app.findCollectionByNameOrId('patients')
    patients.fields.removeByName('pelagem')
    patients.fields.removeByName('last_visit')
    patients.removeIndex('idx_patients_last_visit')
    app.save(patients)
  },
)
