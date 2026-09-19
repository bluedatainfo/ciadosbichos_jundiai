/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------
    // Limpeza TOTAL (100%) dos dados clínicos e cadastrais:
    // Exclui TODOS os registros de:
    // - agendamentos (appointments)
    // - vacinas (vaccines)
    // - fichas/registros clínicos (clinical_records)
    // - pacientes (patients)
    // - tutores (tutors)
    // INCLUINDO todos os registros manuais (Thorpedo, Luna, Bidu,
    // Paulo Henrique, Edmilson L Correa, Maria Oliveira, agendamentos manuais e fichas manuais).
    //
    // PRESERVANDO INTEGRALMENTE:
    // - usuários (users / _pb_users_auth_)
    // - configurações (business_hours)
    // - estoque (inventory)
    // -------------------------------------------------------------

    // 1. Contagens pré-exclusão para auditoria/log
    let countAppointments = 0
    let countVaccines = 0
    let countClinicalRecords = 0
    let countPatients = 0
    let countTutors = 0

    try {
      countAppointments = app.countRecords('appointments')
    } catch (_) {}
    try {
      countVaccines = app.countRecords('vaccines')
    } catch (_) {}
    try {
      countClinicalRecords = app.countRecords('clinical_records')
    } catch (_) {}
    try {
      countPatients = app.countRecords('patients')
    } catch (_) {}
    try {
      countTutors = app.countRecords('tutors')
    } catch (_) {}

    console.log(
      `[0020_reset_clinical_and_cadastral_data] Iniciando limpeza total. Contagens atuais: ` +
        `appointments=${countAppointments}, vaccines=${countVaccines}, clinical_records=${countClinicalRecords}, ` +
        `patients=${countPatients}, tutors=${countTutors}`,
    )

    // 2. Exclusão em cascata das coleções dependentes até as entidades primárias
    // SQLite raw DELETE sem WHERE remove todas as linhas da tabela
    app.db().newQuery('DELETE FROM appointments').execute()
    app.db().newQuery('DELETE FROM vaccines').execute()
    app.db().newQuery('DELETE FROM clinical_records').execute()
    app.db().newQuery('DELETE FROM patients').execute()
    app.db().newQuery('DELETE FROM tutors').execute()

    console.log(
      `[0020_reset_clinical_and_cadastral_data] Limpeza concluída com sucesso. ` +
        `Foram excluídos: appointments=${countAppointments}, vaccines=${countVaccines}, ` +
        `clinical_records=${countClinicalRecords}, patients=${countPatients}, tutors=${countTutors}. ` +
        `Preservados: users, business_hours e inventory.`,
    )
  },
  (app) => {
    // Reversão de limpeza de banco não é restaurável via migration reversa
  },
)
