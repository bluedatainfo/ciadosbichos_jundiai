routerAdd('POST', '/api/public-booking/create', (e) => {
  console.log('Receiving request on POST /api/public-booking/create')
  const data = e.requestInfo().body

  // Validação básica dos dados recebidos
  const tutorName = (data.tutor_name || '').trim()
  const tutorPhone = (data.tutor_phone || '').trim()
  const tutorEmail = (data.tutor_email || '').trim()
  const petName = (data.pet_name || '').trim()
  const petSpecies = (data.pet_species || 'Cão').trim()
  const petBreed = (data.pet_breed || '').trim()
  const dateStr = (data.date || '').trim() // YYYY-MM-DD
  const timeStr = (data.time || '').trim() // HH:mm
  const notes = (data.notes || '').trim()

  if (!tutorName) {
    return e.json(400, { error: 'Nome do tutor é obrigatório.' })
  }
  if (!tutorPhone) {
    return e.json(400, { error: 'Telefone do tutor é obrigatório.' })
  }
  if (!petName) {
    return e.json(400, { error: 'Nome do animal é obrigatório.' })
  }
  if (!dateStr || !timeStr) {
    return e.json(400, { error: 'Data e horário são obrigatórios.' })
  }

  // 1. Verificar se o dia e horário são válidos segundo business_hours
  const parts = dateStr.split('-').map((p) => parseInt(p, 10))
  const targetDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
  const dayOfWeek = targetDate.getUTCDay()

  let bhRecord = null
  try {
    const bhRecords = $app.findRecordsByFilter('business_hours', 'day_of_week = {:dow}', '', 1, 0, {
      dow: dayOfWeek,
    })
    if (bhRecords && bhRecords.length > 0) {
      bhRecord = bhRecords[0]
    }
  } catch (err) {
    console.log('Error checking business hours in create hook:', err.message)
  }

  if (!bhRecord || !bhRecord.getBool('is_open')) {
    return e.json(400, { error: 'A clínica não realiza atendimentos nesta data.' })
  }

  // 2. Verificar conflito de horário no mesmo timestamp
  const timeParts = timeStr.split(':').map((p) => parseInt(p, 10))
  const appointmentDate = new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2], timeParts[0], timeParts[1], 0),
  )
  const appointmentIso = appointmentDate.toISOString()

  // Buscar se já existe agendamento ativo nesse horário exato
  try {
    const conflictRecords = $app.findRecordsByFilter(
      'appointments',
      'date = {:appIso} && status != "cancelled"',
      '',
      1,
      0,
      { appIso: appointmentIso },
    )
    if (conflictRecords && conflictRecords.length > 0) {
      return e.json(409, {
        error:
          'Este horário acabou de ser preenchido por outro agendamento. Por favor, escolha outro horário.',
      })
    }
  } catch (err) {
    console.log('Error checking appointment conflicts:', err.message)
  }

  // 3. Localizar ou Criar Tutor
  let tutorRecord = null

  try {
    let filter = ''
    const filterParams = {}

    if (tutorPhone) {
      filter = 'phone ~ {:phone}'
      filterParams.phone = tutorPhone
    }
    if (tutorEmail) {
      filter = filter ? filter + ' || email = {:email}' : 'email = {:email}'
      filterParams.email = tutorEmail
    }

    if (filter) {
      const existingTutors = $app.findRecordsByFilter(
        'tutors',
        filter,
        '-created',
        1,
        0,
        filterParams,
      )
      if (existingTutors && existingTutors.length > 0) {
        tutorRecord = existingTutors[0]
      }
    }
  } catch (err) {
    console.log('Error searching existing tutor:', err.message)
  }

  if (!tutorRecord) {
    try {
      const tutorsCol = $app.findCollectionByNameOrId('tutors')
      tutorRecord = new Record(tutorsCol)
      tutorRecord.set('name', tutorName)
      tutorRecord.set('phone', tutorPhone)
      if (tutorEmail) tutorRecord.set('email', tutorEmail)
      tutorRecord.set('additional_info', 'Cadastrado via Agendamento Online')
      $app.saveNoValidate(tutorRecord)
    } catch (err) {
      return e.json(500, { error: 'Erro ao cadastrar tutor: ' + err.message })
    }
  }

  // 4. Localizar ou Criar Paciente (Animal)
  let patientRecord = null
  try {
    const existingPatients = $app.findRecordsByFilter(
      'patients',
      'tutor_id = {:tutorId} && name ~ {:petName}',
      '-created',
      1,
      0,
      { tutorId: tutorRecord.id, petName: petName },
    )
    if (existingPatients && existingPatients.length > 0) {
      patientRecord = existingPatients[0]
    }
  } catch (err) {
    console.log('Error searching existing patient:', err.message)
  }

  if (!patientRecord) {
    try {
      const patientsCol = $app.findCollectionByNameOrId('patients')
      patientRecord = new Record(patientsCol)
      patientRecord.set('name', petName)
      patientRecord.set('species', petSpecies || 'Cão')
      if (petBreed) patientRecord.set('breed', petBreed)
      patientRecord.set('tutor_id', tutorRecord.id)
      patientRecord.set('gender', 'Macho') // default
      $app.saveNoValidate(patientRecord)
    } catch (err) {
      return e.json(500, { error: 'Erro ao cadastrar paciente: ' + err.message })
    }
  }

  // 5. Criar o agendamento vinculado com source = 'public'
  let appointmentRecord = null
  try {
    const appointmentsCol = $app.findCollectionByNameOrId('appointments')
    appointmentRecord = new Record(appointmentsCol)
    appointmentRecord.set('patient_id', patientRecord.id)
    appointmentRecord.set('date', appointmentIso)
    appointmentRecord.set('type', 'consultation')
    appointmentRecord.set('status', 'scheduled')
    appointmentRecord.set('source', 'public')
    appointmentRecord.set(
      'notes',
      notes ? 'Agendamento Online: ' + notes : 'Agendamento Online pelo Tutor',
    )
    $app.saveNoValidate(appointmentRecord)
  } catch (err) {
    return e.json(500, { error: 'Erro ao criar agendamento: ' + err.message })
  }

  return e.json(201, {
    success: true,
    appointment_id: appointmentRecord.id,
    date: appointmentIso,
    time: timeStr,
    tutor_name: tutorRecord.getString('name'),
    tutor_phone: tutorRecord.getString('phone'),
    pet_name: patientRecord.getString('name'),
    species: patientRecord.getString('species'),
    notes: notes,
  })
})
