/**
 * pb_hooks/dedup_runner.js
 *
 * Endpoint administrativo interno para executar a deduplicação de setembro/outubro
 * em lotes controlados com transação SQLite ($app.runInTransaction) e registro de progresso.
 *
 * Regras:
 * 1. Base oficial é 12/10 (registros com NUME).
 * 2. Casamento de pares da tabela _dedup_work_pairs (18.269 pares únicos 1:1 já validados).
 * 3. Análise de histórico por conteúdo (import_hash / descrição):
 *    - Migra para o paciente de outubro APENAS o que ainda não existe lá;
 *    - Descarta o que já existe no destino;
 *    - Registra auditoria individual em audit_logs (delete patient + details).
 * 4. Remove o paciente de setembro.
 */

routerAdd('POST', '/backend/v1/dedup/run-batch', (e) => {
  try {
    const authRecord = e.auth
    // Permitir requisição autenticada ou se chamada internamente com chave ou pelo admin
    let adminId = ''
    let adminName = 'Admin'
    let adminEmail = 'bluedata@bluedatainfo.com.br'
    let adminRole = 'admin'

    if (authRecord && authRecord.id) {
      adminId = authRecord.id
      adminName = authRecord.getString('name') || authRecord.getString('email') || 'Admin'
      adminEmail = authRecord.getString('email') || 'bluedata@bluedatainfo.com.br'
      adminRole = authRecord.getString('role') || 'admin'
    } else {
      try {
        const u = $app.findFirstRecordByData('users', 'role', 'admin')
        adminId = u.id
        adminName = u.getString('name') || 'Admin'
        adminEmail = u.getString('email') || 'bluedata@bluedatainfo.com.br'
        adminRole = u.getString('role') || 'admin'
      } catch (_) {}
    }

    const body = e.requestInfo().body || {}
    const batchSize = Math.min(parseInt(body.batchSize || '1000', 10) || 1000, 3000)

    let processedThisRun = 0
    let pendingRemaining = 0
    let totalPairs = 0
    let totalDone = 0

    $app.runInTransaction((txApp) => {
      // 1. Selecionar próximo lote de pendentes
      txApp
        .db()
        .newQuery(`
        CREATE TEMP TABLE IF NOT EXISTS _batch_curr (
          out_id TEXT,
          set_id TEXT,
          out_name TEXT,
          out_nume TEXT,
          tutor_id TEXT
        )
      `)
        .execute()

      txApp.db().newQuery('DELETE FROM _batch_curr').execute()

      txApp
        .db()
        .newQuery(`
        INSERT INTO _batch_curr (out_id, set_id, out_name, out_nume, tutor_id)
        SELECT out_id, set_id, out_name, out_nume, tutor_id
        FROM _dedup_pairs_work
        WHERE status = 'pending'
        LIMIT {:limit}
      `)
        .bind({ limit: batchSize })
        .execute()

      // 2. Fichas Clínicas:
      // Identificar as que NÃO existem no destino
      txApp
        .db()
        .newQuery(`
        CREATE TEMP TABLE IF NOT EXISTS _clin_to_mig (
          id TEXT,
          out_id TEXT
        )
      `)
        .execute()
      txApp.db().newQuery('DELETE FROM _clin_to_mig').execute()

      txApp
        .db()
        .newQuery(`
        INSERT INTO _clin_to_mig (id, out_id)
        SELECT c_set.id, b.out_id
        FROM clinical_records c_set
        JOIN _batch_curr b ON c_set.patient_id = b.set_id
        WHERE NOT EXISTS (
          SELECT 1 FROM clinical_records c_out
          WHERE c_out.patient_id = b.out_id
            AND (
              (c_set.import_hash IS NOT NULL AND c_set.import_hash != '' AND c_out.import_hash = c_set.import_hash)
              OR (TRIM(c_out.description) = TRIM(c_set.description))
            )
        )
      `)
        .execute()

      // Reatribuir para o destino
      txApp
        .db()
        .newQuery(`
        UPDATE clinical_records
        SET patient_id = (SELECT m.out_id FROM _clin_to_mig m WHERE m.id = clinical_records.id),
            updated = datetime('now')
        WHERE id IN (SELECT id FROM _clin_to_mig)
      `)
        .execute()

      // Deletar fichas duplicadas restantes de setembro
      txApp
        .db()
        .newQuery(`
        DELETE FROM clinical_records
        WHERE patient_id IN (SELECT set_id FROM _batch_curr)
      `)
        .execute()

      // 3. Agendamentos / Retornos:
      txApp
        .db()
        .newQuery(`
        CREATE TEMP TABLE IF NOT EXISTS _app_to_mig (
          id TEXT,
          out_id TEXT
        )
      `)
        .execute()
      txApp.db().newQuery('DELETE FROM _app_to_mig').execute()

      txApp
        .db()
        .newQuery(`
        INSERT INTO _app_to_mig (id, out_id)
        SELECT a_set.id, b.out_id
        FROM appointments a_set
        JOIN _batch_curr b ON a_set.patient_id = b.set_id
        WHERE NOT EXISTS (
          SELECT 1 FROM appointments a_out
          WHERE a_out.patient_id = b.out_id
            AND (
              (a_set.import_hash IS NOT NULL AND a_set.import_hash != '' AND a_out.import_hash = a_set.import_hash)
              OR (
                COALESCE(SUBSTR(a_out.date, 1, 10), '') = COALESCE(SUBSTR(a_set.date, 1, 10), '')
                AND COALESCE(a_out.type, '') = COALESCE(a_set.type, '')
                AND TRIM(COALESCE(a_out.notes, '')) = TRIM(COALESCE(a_set.notes, ''))
              )
            )
        )
      `)
        .execute()

      txApp
        .db()
        .newQuery(`
        UPDATE appointments
        SET patient_id = (SELECT m.out_id FROM _app_to_mig m WHERE m.id = appointments.id),
            updated = datetime('now')
        WHERE id IN (SELECT id FROM _app_to_mig)
      `)
        .execute()

      txApp
        .db()
        .newQuery(`
        DELETE FROM appointments
        WHERE patient_id IN (SELECT set_id FROM _batch_curr)
      `)
        .execute()

      // 4. Vacinas:
      txApp
        .db()
        .newQuery(`
        CREATE TEMP TABLE IF NOT EXISTS _vac_to_mig (
          id TEXT,
          out_id TEXT
        )
      `)
        .execute()
      txApp.db().newQuery('DELETE FROM _vac_to_mig').execute()

      txApp
        .db()
        .newQuery(`
        INSERT INTO _vac_to_mig (id, out_id)
        SELECT v_set.id, b.out_id
        FROM vaccines v_set
        JOIN _batch_curr b ON v_set.patient_id = b.set_id
        WHERE NOT EXISTS (
          SELECT 1 FROM vaccines v_out
          WHERE v_out.patient_id = b.out_id
            AND (
              (v_set.import_hash IS NOT NULL AND v_set.import_hash != '' AND v_out.import_hash = v_set.import_hash)
              OR (
                LOWER(TRIM(v_out.name)) = LOWER(TRIM(v_set.name))
                AND COALESCE(SUBSTR(v_out.date, 1, 10), '') = COALESCE(SUBSTR(v_set.date, 1, 10), '')
              )
            )
        )
      `)
        .execute()

      txApp
        .db()
        .newQuery(`
        UPDATE vaccines
        SET patient_id = (SELECT m.out_id FROM _vac_to_mig m WHERE m.id = vaccines.id),
            updated = datetime('now')
        WHERE id IN (SELECT id FROM _vac_to_mig)
      `)
        .execute()

      txApp
        .db()
        .newQuery(`
        DELETE FROM vaccines
        WHERE patient_id IN (SELECT set_id FROM _batch_curr)
      `)
        .execute()

      // 5. Auditoria individual dos pacientes removidos
      txApp
        .db()
        .newQuery(`
        INSERT INTO audit_logs (
          id, user_id, user_name, user_email, user_role, action, module, record_id, record_label, patient_name, tutor_name, details, changes, created, updated
        )
        SELECT 
          LOWER(HEX(RANDOMBLOB(8))),
          {:userId},
          {:userName},
          {:userEmail},
          {:userRole},
          'delete',
          'patients',
          b.set_id,
          b.out_name,
          b.out_name,
          COALESCE(t.name, ''),
          'Deduplicação de carga legada: registro duplicado de setembro removido e unificado no registro oficial de outubro (NUME: ' || COALESCE(b.out_nume, '') || ', ID: ' || b.out_id || ').',
          json_object(
            'unified_into', json_object(
              'destination_patient_id', b.out_id,
              'destination_nume', b.out_nume,
              'name', b.out_name
            ),
            'deleted_duplicate_record', json_object(
              'id', p_set.id,
              'name', p_set.name,
              'ctrl', p_set.ctrl,
              'nume', p_set.nume,
              'import_key', p_set.import_key,
              'created', p_set.created
            )
          ),
          datetime('now'),
          datetime('now')
        FROM _batch_curr b
        JOIN patients p_set ON b.set_id = p_set.id
        LEFT JOIN tutors t ON b.tutor_id = t.id
      `)
        .bind({
          userId: adminId,
          userName: adminName,
          userEmail: adminEmail,
          userRole: adminRole,
        })
        .execute()

      // 6. Deletar os pacientes duplicados de setembro
      txApp
        .db()
        .newQuery(`
        DELETE FROM patients
        WHERE id IN (SELECT set_id FROM _batch_curr)
      `)
        .execute()

      // 7. Marcar como 'done'
      txApp
        .db()
        .newQuery(`
        UPDATE _dedup_pairs_work
        SET status = 'processed'
        WHERE set_id IN (SELECT set_id FROM _batch_curr)
      `)
        .execute()

      // Limpar temps
      txApp.db().newQuery('DROP TABLE IF EXISTS _batch_curr').execute()
      txApp.db().newQuery('DROP TABLE IF EXISTS _clin_to_mig').execute()
      txApp.db().newQuery('DROP TABLE IF EXISTS _app_to_mig').execute()
      txApp.db().newQuery('DROP TABLE IF EXISTS _vac_to_mig').execute()
    })

    // Atualizar import_progress com o estado atual
    $app
      .db()
      .newQuery(`
      INSERT OR REPLACE INTO import_progress (id, file_name, total_file_rows, last_processed_line, completed_at, summary, created, updated)
      VALUES (
        'dedup_progress_status',
        'DEDUPLICACAO_PARES_PROGRESSO',
        (SELECT COUNT(*) FROM _dedup_pairs_work),
        (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
        CASE WHEN (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending') = 0 THEN datetime('now') ELSE '' END,
        json_object(
          'total_pairs', (SELECT COUNT(*) FROM _dedup_pairs_work),
          'done_pairs', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
          'pending_pairs', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending'),
          'patients_count', (SELECT COUNT(*) FROM patients),
          'timestamp', datetime('now')
        ),
        datetime('now'),
        datetime('now')
      )
    `)
      .execute()

    // Ler status para retornar
    const statusRec = $app.findFirstRecordByData('import_progress', 'id', 'dedup_progress_status')
    totalPairs = statusRec.getInt('total_file_rows')
    totalDone = statusRec.getInt('last_processed_line')
    pendingRemaining = totalPairs - totalDone

    return e.json(200, {
      success: true,
      batchSize: batchSize,
      totalPairs: totalPairs,
      totalDone: totalDone,
      pendingRemaining: pendingRemaining,
      isFinished: pendingRemaining === 0,
    })
  } catch (err) {
    console.log('Error in dedup_runner:', err.message)
    return e.json(500, { error: err.message || 'Erro ao executar lote de deduplicação' })
  }
})

// Endpoint para consultar status atual da deduplicação
routerAdd('GET', '/backend/v1/dedup/status', (e) => {
  try {
    let summary = {}
    try {
      const statusRec = $app.findFirstRecordByData('import_progress', 'id', 'dedup_progress_status')
      summary = {
        totalPairs: statusRec.getInt('total_file_rows'),
        totalDone: statusRec.getInt('last_processed_line'),
        pendingRemaining:
          statusRec.getInt('total_file_rows') - statusRec.getInt('last_processed_line'),
        completedAt: statusRec.getString('completed_at'),
        summary: JSON.parse(statusRec.getString('summary') || '{}'),
      }
    } catch (_) {}

    return e.json(200, {
      success: true,
      status: summary,
    })
  } catch (err) {
    return e.json(500, { error: err.message })
  }
})
