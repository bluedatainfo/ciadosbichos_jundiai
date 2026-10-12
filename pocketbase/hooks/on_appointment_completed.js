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
    let patient = null
    try {
      patient = $app.findRecordById('patients', patientId)
    } catch (_) {
      // Paciente já foi removido ou não existe mais — nada a recalcular
      return e.next()
    }

    if (!patient) return e.next()

    const records = $app.findRecordsByFilter(
      'appointments',
      "patient_id = {:patientId} && status = 'completed'",
      '-date',
      1,
      0,
      { patientId },
    )

    const newDate = records && records.length > 0 ? records[0].getString('date') : ''

    if (patient.getString('last_visit') !== newDate) {
      patient.set('last_visit', newDate)
      $app.saveNoValidate(patient)
    }
  } catch (err) {
    // Silencioso se o paciente não existir
  }

  return e.next()
}, 'appointments')
