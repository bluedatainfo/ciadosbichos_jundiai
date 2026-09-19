/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // -------------------------------------------------------------
    // Limpeza de todos os dados gerados pelas importações de teste anteriores (lote piloto)
    // PRESERVANDO integralmente:
    // - Pacientes manuais: Thorpedo ('250i5a3f5pw9y6c'), Luna ('on8wwpbvm1w8v77'), Bidu ('68alb13kmhaxi3t')
    // - Tutores manuais: Edmilson L Correa ('4hjs77zli17kb9v'), Maria Oliveira ('s6syg4bvcn01ioz'), Paulo Henrique ('oj44gkdhuq8liec')
    // - Agendamentos manuais (vinculados aos pacientes manuais e criados sem prefixo [Migração Access])
    // - Evoluções clínicas manuais (vinculadas aos pacientes manuais)
    // - Usuários do sistema, configurações de horários e itens de estoque
    // -------------------------------------------------------------

    // 1. Deletar agendamentos criados por importação (seja por vínculo a paciente importado ou por conter [Migração Access])
    app
      .db()
      .newQuery(
        `DELETE FROM appointments 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR notes LIKE '%[Migração Access]%'`,
      )
      .execute()

    // 2. Deletar vacinas criadas pela importação (qualquer vacina que não pertença aos pacientes manuais)
    app
      .db()
      .newQuery(
        `DELETE FROM vaccines 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')`,
      )
      .execute()

    // 3. Deletar fichas/evoluções clínicas criadas pela importação
    app
      .db()
      .newQuery(
        `DELETE FROM clinical_records 
         WHERE patient_id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR description LIKE '[%'`,
      )
      .execute()

    // 4. Deletar pacientes importados (qualquer paciente exceto Thorpedo, Luna e Bidu, ou com import_key preenchida)
    app
      .db()
      .newQuery(
        `DELETE FROM patients 
         WHERE id NOT IN ('250i5a3f5pw9y6c', 'on8wwpbvm1w8v77', '68alb13kmhaxi3t')
            OR (import_key IS NOT NULL AND import_key != '')`,
      )
      .execute()

    // 5. Deletar tutores criados pela importação (qualquer tutor exceto Edmilson, Maria e Paulo Henrique)
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
