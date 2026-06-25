onRecordAfterCreateSuccess((e) => {
  const patientId = e.record.getString('patient_id')
  if (!patientId) return e.next()

  try {
    const records = $app.findRecordsByFilter(
      'appointments',
      "patient_id = {:patientId} && status = 'completed'",
      '-date',
      1,
      0,
      { patientId },
    )

    const patient = $app.findRecordById('patients', patientId)
    const newDate = records && records.length > 0 ? records[0].getString('date') : ''

    if (patient.getString('last_visit') !== newDate) {
      patient.set('last_visit', newDate)
      $app.saveNoValidate(patient)
    }
  } catch (err) {
    console.log('Error recalculating last visit on create', err.message)
  }

  return e.next()
}, 'appointments')

onRecordAfterUpdateSuccess((e) => {
  const patientId = e.record.getString('patient_id')
  if (!patientId) return e.next()

  try {
    const records = $app.findRecordsByFilter(
      'appointments',
      "patient_id = {:patientId} && status = 'completed'",
      '-date',
      1,
      0,
      { patientId },
    )

    const patient = $app.findRecordById('patients', patientId)
    const newDate = records && records.length > 0 ? records[0].getString('date') : ''

    if (patient.getString('last_visit') !== newDate) {
      patient.set('last_visit', newDate)
      $app.saveNoValidate(patient)
    }
  } catch (err) {
    console.log('Error recalculating last visit on update', err.message)
  }

  return e.next()
}, 'appointments')

onRecordAfterDeleteSuccess((e) => {
  const patientId = e.record.getString('patient_id')
  if (!patientId) return e.next()

  try {
    const records = $app.findRecordsByFilter(
      'appointments',
      "patient_id = {:patientId} && status = 'completed'",
      '-date',
      1,
      0,
      { patientId },
    )

    const patient = $app.findRecordById('patients', patientId)
    const newDate = records && records.length > 0 ? records[0].getString('date') : ''

    if (patient.getString('last_visit') !== newDate) {
      patient.set('last_visit', newDate)
      $app.saveNoValidate(patient)
    }
  } catch (err) {
    console.log('Error recalculating last visit on delete', err.message)
  }

  return e.next()
}, 'appointments')
