migrate(
  (app) => {
    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.addIndex('idx_tutors_name', false, 'name', '')
    tutors.addIndex('idx_tutors_cpf', false, 'cpf', '')
    app.save(tutors)

    const patients = app.findCollectionByNameOrId('patients')
    patients.addIndex('idx_patients_name', false, 'name', '')
    patients.addIndex('idx_patients_breed', false, 'breed', '')
    app.save(patients)

    const appointments = app.findCollectionByNameOrId('appointments')
    appointments.addIndex('idx_appointments_date', false, 'date', '')
    appointments.addIndex('idx_appointments_status', false, 'status', '')
    appointments.addIndex('idx_appointments_type', false, 'type', '')
    app.save(appointments)
  },
  (app) => {
    const tutors = app.findCollectionByNameOrId('tutors')
    tutors.removeIndex('idx_tutors_name')
    tutors.removeIndex('idx_tutors_cpf')
    app.save(tutors)

    const patients = app.findCollectionByNameOrId('patients')
    patients.removeIndex('idx_patients_name')
    patients.removeIndex('idx_patients_breed')
    app.save(patients)

    const appointments = app.findCollectionByNameOrId('appointments')
    appointments.removeIndex('idx_appointments_date')
    appointments.removeIndex('idx_appointments_status')
    appointments.removeIndex('idx_appointments_type')
    app.save(appointments)
  },
)
