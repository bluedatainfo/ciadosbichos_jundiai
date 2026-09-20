/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------
    // Limpeza TOTAL para início de nova importação da base Access do zero:
    // Exclui TODOS os registros de:
    // 1. appointments (agendamentos)
    // 2. vaccines (vacinas)
    // 3. clinical_records (fichas clínicas)
    // 4. patients (pacientes)
    // 5. tutors (tutores)
    // 6. import_progress (progresso de importações por faixa)
    //
    // PRESERVANDO INTEGRALMENTE:
    // - users (_pb_users_auth_)
    // - business_hours (configurações de horários de funcionamento)
    // - inventory (estoque)
    // -------------------------------------------------------------

    // 1. Contagens pré-exclusão para auditoria e relatório
    let countAppointments = 0
    let countVaccines = 0
    let countClinicalRecords = 0
    let countPatients = 0
    let countTutors = 0
    let countImportProgress = 0

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
    try {
      countImportProgress = app.countRecords('import_progress')
    } catch (_) {}

    console.log(
      `[0022_clean_all_data_for_fresh_access_import] Iniciando limpeza total. Contagens atuais: ` +
        `appointments=${countAppointments}, vaccines=${countVaccines}, clinical_records=${countClinicalRecords}, ` +
        `patients=${countPatients}, tutors=${countTutors}, import_progress=${countImportProgress}`,
    )

    // 2. Exclusão em cascata das coleções dependentes até as entidades primárias
    // e limpeza de import_progress
    app.db().newQuery('DELETE FROM appointments').execute()
    app.db().newQuery('DELETE FROM vaccines').execute()
    app.db().newQuery('DELETE FROM clinical_records').execute()
    app.db().newQuery('DELETE FROM patients').execute()
    app.db().newQuery('DELETE FROM tutors').execute()
    app.db().newQuery('DELETE FROM import_progress').execute()

    // 3. Contagens pós-exclusão para confirmação
    let afterAppointments = 0
    let afterVaccines = 0
    let afterClinicalRecords = 0
    let afterPatients = 0
    let afterTutors = 0
    let afterImportProgress = 0

    try {
      afterAppointments = app.countRecords('appointments')
    } catch (_) {}
    try {
      afterVaccines = app.countRecords('vaccines')
    } catch (_) {}
    try {
      afterClinicalRecords = app.countRecords('clinical_records')
    } catch (_) {}
    try {
      afterPatients = app.countRecords('patients')
    } catch (_) {}
    try {
      afterTutors = app.countRecords('tutors')
    } catch (_) {}
    try {
      afterImportProgress = app.countRecords('import_progress')
    } catch (_) {}

    console.log(
      `[0022_clean_all_data_for_fresh_access_import] Limpeza concluída com sucesso. ` +
        `Registros excluídos: appointments=${countAppointments}, vaccines=${countVaccines}, ` +
        `clinical_records=${countClinicalRecords}, patients=${countPatients}, tutors=${countTutors}, import_progress=${countImportProgress}. ` +
        `Registros restantes nas coleções limpas: appointments=${afterAppointments}, vaccines=${afterVaccines}, ` +
        `clinical_records=${afterClinicalRecords}, patients=${afterPatients}, tutors=${afterTutors}, import_progress=${afterImportProgress}. ` +
        `Coleções preservadas intactas: users, business_hours e inventory.`,
    )
  },
  (app) => {
    // Reversão de limpeza de banco não é restaurável via migration reversa
  },
)
