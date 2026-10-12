/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('_diag_results')

    function saveRes(cat, obj) {
      const rec = new Record(col)
      rec.set('category', cat)
      rec.set('payload', JSON.stringify(obj))
      app.save(rec)
    }

    // 1. Inspecionar vínculos clínicos e agendamentos dos Pet 1..50
    const p1Clinical = app.findRecordsByFilter(
      'clinical_records',
      "patient_id = '8nwgbswhg3ehul2'",
      '-created',
      10,
      0,
    )
    const p1ClinicalSamples = p1Clinical.map((c) => ({
      id: c.id,
      description: c.getString('description'),
      created: c.getString('created'),
      import_hash: c.getString('import_hash'),
    }))

    const p1Appos = app.findRecordsByFilter(
      'appointments',
      "patient_id = '8nwgbswhg3ehul2'",
      '-created',
      10,
      0,
    )
    const p1AppoSamples = p1Appos.map((a) => ({
      id: a.id,
      notes: a.getString('notes'),
      date: a.getString('date'),
      type: a.getString('type'),
      status: a.getString('status'),
      created: a.getString('created'),
    }))

    // Verificar tutores 'Tutor %' que têm outros pacientes além dos Pet 1..50
    const testPatients = app.findRecordsByFilter('patients', "name ~ 'Pet '", 'ctrl', 100, 0)
    const testPatientIds = new Set(testPatients.map((p) => p.id))

    const testTutors = app.findRecordsByFilter('tutors', "name ~ 'Tutor '", 'name', 100, 0)
    const tutorsWithRealPatients = []
    for (let i = 0; i < testTutors.length; i++) {
      const t = testTutors[i]
      const pets = app.findRecordsByFilter('patients', `tutor_id = '${t.id}'`, '', 50, 0)
      const realPets = pets.filter((p) => !testPatientIds.has(p.id))
      if (realPets.length > 0) {
        tutorsWithRealPatients.push({
          tutorId: t.id,
          tutorName: t.getString('name'),
          realPets: realPets.map((p) => ({
            id: p.id,
            name: p.getString('name'),
            ctrl: p.getString('ctrl'),
          })),
        })
      }
    }

    saveRes('tarefa1_detalhes_vinculos', {
      p1ClinicalSamples,
      p1AppoSamples,
      tutorsWithRealPatients,
    })
  },
  (app) => {},
)
