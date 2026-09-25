migrate(
  (app) => {
    // Correção no ciclo de retornos:
    // Retornos com data futura (hoje ou adiante) que foram indevidamente marcados como
    // realizados devem voltar a ficar pendentes (completed = false) para entrarem nos alertas.
    // Retornos com data no passado permanecem realizados (completed = true).
    // Registros sem data reconhecível não devem ser alterados.
    //
    // No SQLite / PocketBase, date('now', 'start of day') representa o início do dia corrente UTC.
    // Para comparar com segurança: registros com data não nula e não vazia >= hoje às 00:00:00 UTC.
    const todayIso = new Date().toISOString().slice(0, 10) + ' 00:00:00.000Z'

    app
      .db()
      .newQuery(
        `UPDATE vaccines
         SET completed = FALSE
         WHERE date IS NOT NULL
           AND date != ''
           AND date >= {:today}
           AND completed = TRUE`,
      )
      .bind({ today: todayIso })
      .execute()
  },
  (app) => {
    // Reversão defensiva (caso necessário reverter a migração)
    const todayIso = new Date().toISOString().slice(0, 10) + ' 00:00:00.000Z'
    app
      .db()
      .newQuery(
        `UPDATE vaccines
         SET completed = TRUE
         WHERE date IS NOT NULL
           AND date != ''
           AND date >= {:today}`,
      )
      .bind({ today: todayIso })
      .execute()
  },
)
