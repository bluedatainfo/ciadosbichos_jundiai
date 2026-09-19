/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------
    // Limpeza de todos os dados gerados pelas importações de teste anteriores (Access legado)
    //
    // PRESERVANDO integralmente:
    // - Pacientes manuais: Thorpedo ('250i5a3f5pw9y6c'), Luna ('on8wwpbvm1w8v77'), Bidu ('68alb13kmhaxi3t')
    // - Tutores manuais: Edmilson L Correa ('4hjs77zli17kb9v'), Maria Oliveira ('s6syg4bvcn01ioz'), Paulo Henrique ('oj44gkdhuq8liec')
    // - Agendamentos manuais (pertencentes aos pacientes manuais, criados sem prefixo [Migração Access])
    // - Fichas/evoluções clínicas manuais (pertencentes aos pacientes manuais)
    // - Usuários do sistema, configurações de horários de funcionamento (business_hours) e estoque
    // -------------------------------------------------------------

    // 1. Deletar agendamentos criados por importação legada
    // (qualquer agendamento com prefixo [Migração Access] nas notas OU vinculado a pacientes não manuais)
    app
      .db()
      .newQuery(
        `DELETE FROM appointments 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR notes LIKE '%[Migração Access]%'`,
      )
      .execute()

    // 2. Deletar vacinas criadas pela importação legada
    // (qualquer vacina vinculada a pacientes criados em testes)
    app
      .db()
      .newQuery(
        `DELETE FROM vaccines 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 3. Deletar fichas/evoluções clínicas criadas pela importação
    // (qualquer registro clínico vinculado a pacientes importados OU iniciado com data entre colchetes [dd/mm/yy])
    app
      .db()
      .newQuery(
        `DELETE FROM clinical_records 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR description LIKE '[%'`,
      )
      .execute()

    // 4. Deletar pacientes importados
    // (qualquer paciente exceto Thorpedo, Luna e Bidu, ou com import_key preenchida)
    app
      .db()
      .newQuery(
        `DELETE FROM patients 
         WHERE id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR (import_key IS NOT NULL AND import_key != '')`,
      )
      .execute()

    // 5. Deletar tutores criados pela importação de testes
    // (qualquer tutor exceto Edmilson, Maria e Paulo Henrique)
    app
      .db()
      .newQuery(
        `DELETE FROM tutors 
         WHERE id NOT IN ('4hjs77zli17kb9v', 's6syg4bvcn01ioz', 'oj44gkdhuq8liec')`,
      )
      .execute()
  },
  (app) => {
    // Reversão não necessária para limpeza de dados de teste
  },
)
