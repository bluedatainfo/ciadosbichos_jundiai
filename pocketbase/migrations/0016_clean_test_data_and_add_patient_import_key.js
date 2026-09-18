/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Limpeza dos dados das importações de teste anteriores:
    // - 18 vacinas criadas no teste
    // - clinical_records com patient_id = 'kvjxnvjavogjofo' (MINIE)
    // - paciente kvjxnvjavogjofo (MINIE)
    // - 9 tutores criados na importação de teste (com ID nascidos em 2026-09-18 ou criados pela importação)
    // Mantendo estritamente os tutores manuais (Edmilson, Maria, Paulo Henrique) e pacientes manuais (Thorpedo, Luna, Bidu).

    // Deletar vacinas criadas pelo teste (todas as vacinas atuais pertenciam a kvjxnvjavogjofo)
    app.db().newQuery("DELETE FROM vaccines WHERE patient_id = 'kvjxnvjavogjofo'").execute()

    // Deletar evoluções clínicas vinculadas a kvjxnvjavogjofo
    app.db().newQuery("DELETE FROM clinical_records WHERE patient_id = 'kvjxnvjavogjofo'").execute()

    // Deletar paciente MINIE (kvjxnvjavogjofo)
    app.db().newQuery("DELETE FROM patients WHERE id = 'kvjxnvjavogjofo'").execute()

    // Deletar os tutores criados exclusivamente na importação de teste:
    // IDs confirmados: 'jck4hncyshl1dmq', 'gk8u2lbo6gad8cg', 'qmw5o1kkhj59e0a', '6zfa4l6k1sof5cc',
    // '49reg7lkn9rebyk', 'hbtmu7ihekkuqzb', 'ny27jdbuuno4w7g', 's5fhxj2oi3heztn', 'j1kqgapug7yb08r'
    app
      .db()
      .newQuery(`
      DELETE FROM tutors WHERE id IN (
        'jck4hncyshl1dmq', 'gk8u2lbo6gad8cg', 'qmw5o1kkhj59e0a', '6zfa4l6k1sof5cc',
        '49reg7lkn9rebyk', 'hbtmu7ihekkuqzb', 'ny27jdbuuno4w7g', 's5fhxj2oi3heztn', 'j1kqgapug7yb08r'
      )
    `)
      .execute()

    // 2. Adicionar campo import_key na collection patients para persistir a chave de importação
    const patients = app.findCollectionByNameOrId('patients')
    if (!patients.fields.getByName('import_key')) {
      patients.fields.add(new TextField({ name: 'import_key' }))
    }
    patients.addIndex('idx_patients_import_key', false, 'import_key', '')
    app.save(patients)
  },
  (app) => {
    try {
      const patients = app.findCollectionByNameOrId('patients')
      patients.removeIndex('idx_patients_import_key')
      patients.fields.removeByName('import_key')
      app.save(patients)
    } catch (_) {}
  },
)
