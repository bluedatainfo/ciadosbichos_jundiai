/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar tabela auxiliar
    try {
      const existing = app.findCollectionByNameOrId('_diag_results')
      if (existing) app.delete(existing)
    } catch (_) {}

    const col = new Collection({
      name: '_diag_results',
      type: 'base',
      listRule: '',
      viewRule: '',
      fields: [
        { name: 'category', type: 'text' },
        { name: 'payload', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(col)

    function saveRes(cat, obj) {
      const rec = new Record(col)
      rec.set('category', cat)
      rec.set('payload', JSON.stringify(obj))
      app.save(rec)
    }

    // A. Contagens e Tarefa 1: Identificar alvos
    // Pacientes de teste: 'Pet %' com ctrl 'C%' ou import_key de seed
    // No SQLite via PocketBase migrations podemos usar app.findRecordsByFilter ou app.countRecords
    const testPatients = app.findRecordsByFilter('patients', "name ~ 'Pet '", 'ctrl', 100, 0)
    const testPatientList = []
    let totalClinical = 0
    let totalVaccines = 0
    let totalAppointments = 0

    for (let i = 0; i < testPatients.length; i++) {
      const p = testPatients[i]
      const pid = p.id
      testPatientList.push({
        id: pid,
        name: p.getString('name'),
        ctrl: p.getString('ctrl'),
        nume: p.getString('nume'),
        import_key: p.getString('import_key'),
        tutor_id: p.getString('tutor_id'),
      })

      const cr = app.findRecordsByFilter('clinical_records', `patient_id = '${pid}'`, '', 100, 0)
      const vac = app.findRecordsByFilter('vaccines', `patient_id = '${pid}'`, '', 100, 0)
      const appo = app.findRecordsByFilter('appointments', `patient_id = '${pid}'`, '', 100, 0)
      totalClinical += cr.length
      totalVaccines += vac.length
      totalAppointments += appo.length
    }

    // Tutores de teste: 'Tutor %'
    const testTutors = app.findRecordsByFilter('tutors', "name ~ 'Tutor '", 'name', 100, 0)
    const testTutorList = []
    for (let i = 0; i < testTutors.length; i++) {
      testTutorList.push({
        id: testTutors[i].id,
        name: testTutors[i].getString('name'),
      })
    }

    // Tutores 'Não Informado'
    const unkRecords = app.findRecordsByFilter(
      'tutors',
      "name ~ 'Não Informado' || name ~ 'Nao Informado'",
      'name',
      500,
      0,
    )
    const unkOrphans = []
    for (let i = 0; i < unkRecords.length; i++) {
      const tid = unkRecords[i].id
      const linkedP = app.findRecordsByFilter('patients', `tutor_id = '${tid}'`, '', 1, 0)
      if (linkedP.length === 0) {
        unkOrphans.push({
          id: tid,
          name: unkRecords[i].getString('name'),
        })
      }
    }

    saveRes('tarefa1_diagnostico', {
      totalPatients: app.countRecords('patients'),
      totalTutors: app.countRecords('tutors'),
      testPatientsCount: testPatientList.length,
      testPatientsSample: testPatientList.slice(0, 5),
      testPatientsLinks: {
        totalClinical,
        totalVaccines,
        totalAppointments,
      },
      testTutorsCount: testTutorList.length,
      testTutorsSample: testTutorList.slice(0, 5),
      tutorsUnknownTotal: unkRecords.length,
      tutorsUnknownOrphansCount: unkOrphans.length,
      tutorsUnknownOrphans: unkOrphans,
    })
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('_diag_results')
      app.delete(c)
    } catch (_) {}
  },
)
