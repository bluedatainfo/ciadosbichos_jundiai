/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Obter usuário admin para auditoria
    let adminUserId = ''
    try {
      const u = app.findFirstRecordByData('users', 'role', 'admin')
      adminUserId = u.id
    } catch (_) {}

    // 2. Normalizar import_hash em registros de clinical_records de setembro que estavam sem hash
    // (conforme constatamos, os registros criados em 26/09 não tinham import_hash preenchido)
    // Para podermos comparar com o registro de outubro instantaneamente via SQL e index idx_clinical_records_import_hash:
    // A fórmula de hash do incremental_sync_batch é:
    // stringHash('clin:' + patientId + ':' + normDesc)
    // Se recalcularmos import_hash com patient_id de OUTUBRO, poderemos saber exatamente se já existe no destino!

    // SQLite puro pode calcular correspondência por conteúdo:
    // Para clinical_records:
    // Um registro de setembro para o paciente set_id é considerado IDÊNTICO ao de outubro (out_id) se:
    // TRIM(c_set.description) = TRIM(c_out.description)
    // (ou se ambas as descrições limpas forem iguais)

    // Vamos testar e executar a unificação em um bloco de 500 pares para validar!
    // Usamos tabelas temporárias e SQL em lote de alta performance:

    // a) Identificar quais itens de clinical_records de setembro JÁ EXISTEM no paciente de outubro correspondente
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _batch_pairs AS
      SELECT pair_num, out_id, set_id, out_name, out_nume, tutor_id
      FROM _dedup_pairs_work
      WHERE status = 'pending'
      ORDER BY pair_num ASC
      LIMIT 1000
    `)
      .execute()

    // Para cada lote de 1000 pares:
    // 1) Identificar clinical_records repetidos (já existem em out_id)
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _clin_existing AS
      SELECT c_set.id as set_clin_id, b.pair_num
      FROM clinical_records c_set
      JOIN _batch_pairs b ON c_set.patient_id = b.set_id
      JOIN clinical_records c_out ON c_out.patient_id = b.out_id
        AND (
          (c_set.import_hash IS NOT NULL AND c_set.import_hash != '' AND c_set.import_hash = c_out.import_hash)
          OR (TRIM(c_set.description) = TRIM(c_out.description))
        )
    `)
      .execute()

    // Os que NÃO existem em out_id devem ser migrados (patient_id atualizado de set_id para out_id)
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _clin_to_migrate AS
      SELECT c_set.id as set_clin_id, b.pair_num, b.out_id
      FROM clinical_records c_set
      JOIN _batch_pairs b ON c_set.patient_id = b.set_id
      WHERE c_set.id NOT IN (SELECT set_clin_id FROM _clin_existing)
    `)
      .execute()

    // 2) Identificar appointments repetidos (já existem em out_id por data + tipo + notes)
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _app_existing AS
      SELECT a_set.id as set_app_id, b.pair_num
      FROM appointments a_set
      JOIN _batch_pairs b ON a_set.patient_id = b.set_id
      JOIN appointments a_out ON a_out.patient_id = b.out_id
        AND (
          (a_set.import_hash IS NOT NULL AND a_set.import_hash != '' AND a_set.import_hash = a_out.import_hash)
          OR (
            COALESCE(SUBSTR(a_set.date, 1, 10), '') = COALESCE(SUBSTR(a_out.date, 1, 10), '')
            AND COALESCE(a_set.type, '') = COALESCE(a_out.type, '')
            AND TRIM(COALESCE(a_set.notes, '')) = TRIM(COALESCE(a_out.notes, ''))
          )
        )
    `)
      .execute()

    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _app_to_migrate AS
      SELECT a_set.id as set_app_id, b.pair_num, b.out_id
      FROM appointments a_set
      JOIN _batch_pairs b ON a_set.patient_id = b.set_id
      WHERE a_set.id NOT IN (SELECT set_app_id FROM _app_existing)
    `)
      .execute()

    // 3) Identificar vaccines repetidas (já existem em out_id por nome + data)
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _vac_existing AS
      SELECT v_set.id as set_vac_id, b.pair_num
      FROM vaccines v_set
      JOIN _batch_pairs b ON v_set.patient_id = b.set_id
      JOIN vaccines v_out ON v_out.patient_id = b.out_id
        AND (
          (v_set.import_hash IS NOT NULL AND v_set.import_hash != '' AND v_set.import_hash = v_out.import_hash)
          OR (
            LOWER(TRIM(v_set.name)) = LOWER(TRIM(v_out.name))
            AND COALESCE(SUBSTR(v_set.date, 1, 10), '') = COALESCE(SUBSTR(v_out.date, 1, 10), '')
          )
        )
    `)
      .execute()

    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _vac_to_migrate AS
      SELECT v_set.id as set_vac_id, b.pair_num, b.out_id
      FROM vaccines v_set
      JOIN _batch_pairs b ON v_set.patient_id = b.set_id
      WHERE v_set.id NOT IN (SELECT set_vac_id FROM _vac_existing)
    `)
      .execute()

    // Executar migrações dos não repetidos:
    app
      .db()
      .newQuery(`
      UPDATE clinical_records
      SET patient_id = (SELECT out_id FROM _clin_to_migrate WHERE _clin_to_migrate.set_clin_id = clinical_records.id)
      WHERE id IN (SELECT set_clin_id FROM _clin_to_migrate)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE appointments
      SET patient_id = (SELECT out_id FROM _app_to_migrate WHERE _app_to_migrate.set_app_id = appointments.id)
      WHERE id IN (SELECT set_app_id FROM _app_to_migrate)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE vaccines
      SET patient_id = (SELECT out_id FROM _vac_to_migrate WHERE _vac_to_migrate.set_vac_id = vaccines.id)
      WHERE id IN (SELECT set_vac_id FROM _vac_to_migrate)
    `)
      .execute()

    // Deletar os repetidos de setembro (já existem em outubro no registro oficial)
    app
      .db()
      .newQuery(`
      DELETE FROM clinical_records WHERE id IN (SELECT set_clin_id FROM _clin_existing)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      DELETE FROM appointments WHERE id IN (SELECT set_app_id FROM _app_existing)
    `)
      .execute()

    app
      .db()
      .newQuery(`
      DELETE FROM vaccines WHERE id IN (SELECT set_vac_id FROM _vac_existing)
    `)
      .execute()

    // Gravar auditoria para cada paciente de setembro unificado e removido
    const nowIso = new Date().toISOString()
    app
      .db()
      .newQuery(`
      INSERT INTO audit_logs (
        id, user_id, user_name, user_email, user_role,
        action, module, record_id, record_label,
        patient_name, tutor_name, details, changes,
        created, updated
      )
      SELECT 
        'aud_' || SUBSTR(HEX(RANDOMBLOB(7)), 1, 11),
        {:userId},
        'Sistema / Deduplicação',
        'bluedata@bluedatainfo.com.br',
        'admin',
        'delete',
        'patients',
        b.set_id,
        b.out_name,
        b.out_name,
        COALESCE(t.name, ''),
        'Deduplicação da carga de 26/09: paciente sem NUME unificado ao registro oficial de 12/10 (NUME: ' || b.out_nume || ', ID destino: ' || b.out_id || '). Histórico comparado e deduplicado.',
        json_object(
          'action', 'deduplicated_and_merged',
          'source_patient_id', b.set_id,
          'target_patient_id', b.out_id,
          'nume', b.out_nume,
          'patient_name', b.out_name,
          'migrated_clinical', (SELECT COUNT(*) FROM _clin_to_migrate m WHERE m.pair_num = b.pair_num),
          'discarded_duplicate_clinical', (SELECT COUNT(*) FROM _clin_existing e WHERE e.pair_num = b.pair_num),
          'migrated_appointments', (SELECT COUNT(*) FROM _app_to_migrate m WHERE m.pair_num = b.pair_num),
          'discarded_duplicate_appointments', (SELECT COUNT(*) FROM _app_existing e WHERE e.pair_num = b.pair_num),
          'migrated_vaccines', (SELECT COUNT(*) FROM _vac_to_migrate m WHERE m.pair_num = b.pair_num),
          'discarded_duplicate_vaccines', (SELECT COUNT(*) FROM _vac_existing e WHERE e.pair_num = b.pair_num)
        ),
        {:nowIso},
        {:nowIso}
      FROM _batch_pairs b
      LEFT JOIN tutors t ON b.tutor_id = t.id
    `)
      .bind({ userId: adminUserId, nowIso: nowIso })
      .execute()

    // Deletar os pacientes de setembro do lote
    app
      .db()
      .newQuery(`
      DELETE FROM patients WHERE id IN (SELECT set_id FROM _batch_pairs)
    `)
      .execute()

    // Atualizar _dedup_pairs_work
    app
      .db()
      .newQuery(`
      UPDATE _dedup_pairs_work
      SET status = 'processed',
          migrated_clin = (SELECT COUNT(*) FROM _clin_to_migrate m WHERE m.pair_num = _dedup_pairs_work.pair_num),
          skipped_clin = (SELECT COUNT(*) FROM _clin_existing e WHERE e.pair_num = _dedup_pairs_work.pair_num),
          migrated_app = (SELECT COUNT(*) FROM _app_to_migrate m WHERE m.pair_num = _dedup_pairs_work.pair_num),
          skipped_app = (SELECT COUNT(*) FROM _app_existing e WHERE e.pair_num = _dedup_pairs_work.pair_num),
          migrated_vac = (SELECT COUNT(*) FROM _vac_to_migrate m WHERE m.pair_num = _dedup_pairs_work.pair_num),
          skipped_vac = (SELECT COUNT(*) FROM _vac_existing e WHERE e.pair_num = _dedup_pairs_work.pair_num)
      WHERE pair_num IN (SELECT pair_num FROM _batch_pairs)
    `)
      .execute()

    // Atualizar progresso geral
    app
      .db()
      .newQuery(`
      UPDATE import_progress
      SET last_processed_line = (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
          summary = json_object(
            'total_pairs_identified', (SELECT COUNT(*) FROM _dedup_pairs_work),
            'pending', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'pending'),
            'processed', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_migrated_clin', (SELECT COALESCE(SUM(migrated_clin), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_skipped_clin', (SELECT COALESCE(SUM(skipped_clin), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_migrated_app', (SELECT COALESCE(SUM(migrated_app), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_skipped_app', (SELECT COALESCE(SUM(skipped_app), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_migrated_vac', (SELECT COALESCE(SUM(migrated_vac), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_skipped_vac', (SELECT COALESCE(SUM(skipped_vac), 0) FROM _dedup_pairs_work WHERE status = 'processed'),
            'total_set_removed', (SELECT COUNT(*) FROM _dedup_pairs_work WHERE status = 'processed'),
            'current_patients_total', (SELECT COUNT(*) FROM patients)
          ),
          updated = datetime('now')
      WHERE id = 'dedup_progress_status'
    `)
      .execute()

    // Limpar tabelas temporárias
    app.db().newQuery('DROP TABLE _batch_pairs').execute()
    app.db().newQuery('DROP TABLE _clin_existing').execute()
    app.db().newQuery('DROP TABLE _clin_to_migrate').execute()
    app.db().newQuery('DROP TABLE _app_existing').execute()
    app.db().newQuery('DROP TABLE _app_to_migrate').execute()
    app.db().newQuery('DROP TABLE _vac_existing').execute()
    app.db().newQuery('DROP TABLE _vac_to_migrate').execute()
  },
  (app) => {},
)
