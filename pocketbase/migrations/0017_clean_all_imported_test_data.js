/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------
    // Limpeza de todos os dados gerados pelas importações de teste anteriores
    // PRESERVANDO integralmente:
    // - Pacientes manuais: Thorpedo (250i5a3f5pw9y6c), Luna (on8wwpbvm1w8v77), Bidu (68alb13kmhaxi3t)
    // - Tutores manuais: Edmilson L Correa (4hjs77zli17kb9v), Maria Oliveira (s6syg4bvcn01ioz), Paulo Henrique (oj44gkdhuq8liec)
    // - Agendamentos manuais vinculados aos pacientes manuais
    // - Evoluções clínicas manuais vinculadas aos pacientes manuais
    // - Usuários, estoque e configurações do sistema
    // -------------------------------------------------------------

    // 1. Deletar agendamentos vinculados a pacientes importados (qualquer paciente exceto os manuais)
    app
      .db()
      .newQuery(
        `DELETE FROM appointments WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 2. Deletar vacinas vinculadas a pacientes importados (qualquer vacina vinculada a paciente que não seja manual)
    app
      .db()
      .newQuery(
        `DELETE FROM vaccines WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 3. Deletar fichas clínicas vinculadas a pacientes importados
    app
      .db()
      .newQuery(
        `DELETE FROM clinical_records WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 4. Deletar pacientes importados (qualquer paciente que não sejam os 3 manuais ou que possuam import_key)
    app
      .db()
      .newQuery(
        `DELETE FROM patients WHERE id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 5. Deletar tutores criados pela importação (qualquer tutor que não sejam os 3 manuais)
    app
      .db()
      .newQuery(
        `DELETE FROM tutors WHERE id NOT IN ('4hjs77zli17kb9v', 's6syg4bvcn01ioz', 'oj44gkdhuq8liec')`,
      )
      .execute()
  },
  (app) => {
    // Reversão não necessária para limpeza de dados de teste
  },
)
