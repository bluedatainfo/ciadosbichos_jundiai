migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'bluedata@bluedatainfo.com.br')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('bluedata@bluedatainfo.com.br')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Admin')
      app.save(record)
    }

    const tutors = app.findCollectionByNameOrId('tutors')
    let tutor1, tutor2
    try {
      tutor1 = app.findFirstRecordByData('tutors', 'email', 'joao.silva@exemplo.com')
    } catch (_) {
      tutor1 = new Record(tutors)
      tutor1.set('name', 'João Silva')
      tutor1.set('phone', '11 99999-1111')
      tutor1.set('email', 'joao.silva@exemplo.com')
      tutor1.set('cpf', '111.111.111-11')
      tutor1.set('address', 'Rua das Flores, 123')
      app.save(tutor1)
    }

    try {
      tutor2 = app.findFirstRecordByData('tutors', 'email', 'maria.oliveira@exemplo.com')
    } catch (_) {
      tutor2 = new Record(tutors)
      tutor2.set('name', 'Maria Oliveira')
      tutor2.set('phone', '11 98888-2222')
      tutor2.set('email', 'maria.oliveira@exemplo.com')
      tutor2.set('cpf', '222.222.222-22')
      tutor2.set('address', 'Av. Brasil, 456')
      app.save(tutor2)
    }

    const patients = app.findCollectionByNameOrId('patients')
    let pat1, pat2
    try {
      pat1 = app.findFirstRecordByData('patients', 'name', 'Thor')
    } catch (_) {
      pat1 = new Record(patients)
      pat1.set('name', 'Thor')
      pat1.set('species', 'Cão')
      pat1.set('breed', 'Golden Retriever')
      pat1.set('birth_date', '2020-05-10 12:00:00.000Z')
      pat1.set('gender', 'Macho')
      pat1.set('weight', 32.5)
      pat1.set('tutor_id', tutor1.id)
      app.save(pat1)
    }

    try {
      pat2 = app.findFirstRecordByData('patients', 'name', 'Luna')
    } catch (_) {
      pat2 = new Record(patients)
      pat2.set('name', 'Luna')
      pat2.set('species', 'Gato')
      pat2.set('breed', 'Siamês')
      pat2.set('birth_date', '2021-08-20 12:00:00.000Z')
      pat2.set('gender', 'Fêmea')
      pat2.set('weight', 4.2)
      pat2.set('tutor_id', tutor2.id)
      app.save(pat2)
    }

    const appointments = app.findCollectionByNameOrId('appointments')
    try {
      app.findFirstRecordByData('appointments', 'notes', 'Retorno cirurgia ortopédica')
    } catch (_) {
      const d1 = new Date()
      d1.setDate(d1.getDate() + 2)
      const app1 = new Record(appointments)
      app1.set('patient_id', pat1.id)
      app1.set('date', d1.toISOString().replace('T', ' '))
      app1.set('type', 'return')
      app1.set('status', 'scheduled')
      app1.set('notes', 'Retorno cirurgia ortopédica')
      app.save(app1)
    }

    try {
      app.findFirstRecordByData('appointments', 'notes', 'Vacina V10 anual')
    } catch (_) {
      const d2 = new Date()
      d2.setDate(d2.getDate() + 5)
      const app2 = new Record(appointments)
      app2.set('patient_id', pat1.id)
      app2.set('date', d2.toISOString().replace('T', ' '))
      app2.set('type', 'vaccine')
      app2.set('status', 'scheduled')
      app2.set('notes', 'Vacina V10 anual')
      app.save(app2)
    }

    try {
      app.findFirstRecordByData('appointments', 'notes', 'Consulta de rotina felina')
    } catch (_) {
      const d3 = new Date()
      d3.setDate(d3.getDate() + 1)
      const app3 = new Record(appointments)
      app3.set('patient_id', pat2.id)
      app3.set('date', d3.toISOString().replace('T', ' '))
      app3.set('type', 'consultation')
      app3.set('status', 'scheduled')
      app3.set('notes', 'Consulta de rotina felina')
      app.save(app3)
    }
  },
  (app) => {},
)
