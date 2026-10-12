/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Inserir agrupamento por padrão de import_key
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_keys AS
      SELECT 
        CASE 
          WHEN import_key IS NULL OR import_key = '' THEN 'sem_import_key'
          WHEN import_key LIKE 'name:tutor %|pet%' THEN 'teste_seed_pet_tutor'
          WHEN import_key LIKE 'ctrl:%' THEN 'ctrl_key'
          WHEN import_key LIKE 'name:%|%|canino|nasc:%' OR import_key LIKE 'name:%|%|felino|nasc:%' THEN 'oficial_com_nasc'
          WHEN import_key LIKE 'name:%|%|canino#%' OR import_key LIKE 'name:%|%|felino#%' THEN 'oficial_sem_nasc'
          WHEN import_key LIKE 'name:%' THEN 'name_outro'
          ELSE 'outro'
        END as pattern,
        COUNT(*) as c
      FROM patients
      GROUP BY pattern
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'kp_' || SUBSTR(HEX(RANDOMBLOB(6)), 1, 12),
        'tarefa2_key_patterns',
        '{"pattern":"' || pattern || '","count":' || c || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_keys
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_keys').execute()

    // 2. Cruzamento Data x Padrão de import_key
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_date_keys AS
      SELECT 
        SUBSTR(created, 1, 10) as dt,
        CASE 
          WHEN import_key IS NULL OR import_key = '' THEN 'sem_import_key'
          WHEN import_key LIKE 'name:tutor %|pet%' THEN 'teste_seed_pet_tutor'
          WHEN import_key LIKE 'ctrl:%' THEN 'ctrl_key'
          WHEN import_key LIKE 'name:%|%|canino|nasc:%' OR import_key LIKE 'name:%|%|felino|nasc:%' THEN 'oficial_com_nasc'
          WHEN import_key LIKE 'name:%|%|canino#%' OR import_key LIKE 'name:%|%|felino#%' THEN 'oficial_sem_nasc'
          WHEN import_key LIKE 'name:%' THEN 'name_outro'
          ELSE 'outro'
        END as pattern,
        COUNT(*) as c
      FROM patients
      GROUP BY dt, pattern
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dk_' || SUBSTR(HEX(RANDOMBLOB(6)), 1, 12),
        'tarefa2_date_key_cross',
        '{"date":"' || dt || '","pattern":"' || pattern || '","count":' || c || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_date_keys
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_date_keys').execute()

    // 3. Tarefa 3: Checagem de duplicidades
    // a) Mesmo NUME: total de grupos e total de pacientes
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_nume_dup AS
      SELECT nume, COUNT(*) as cnt
      FROM patients
      WHERE nume IS NOT NULL AND nume != '' AND nume != '0'
      GROUP BY nume
      HAVING COUNT(*) > 1
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dn_sum',
        'tarefa3_nume_summary',
        '{"total_grupos":' || COUNT(*) || ',"total_pacientes":' || COALESCE(SUM(cnt), 0) || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_nume_dup
    `)
      .execute()

    // Amostras de pacientes com mesmo NUME (até 20 registros)
    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dns_' || SUBSTR(p.id, 1, 9),
        'tarefa3_nume_sample',
        '{"id":"' || p.id || '","name":"' || REPLACE(COALESCE(p.name, ''), '"', '\"') || '","nume":"' || COALESCE(p.nume, '') || '","ctrl":"' || COALESCE(p.ctrl, '') || '","import_key":"' || REPLACE(COALESCE(p.import_key, ''), '"', '\"') || '","created":"' || p.created || '","tutor_name":"' || REPLACE(COALESCE(t.name, ''), '"', '\"') || '"}',
        datetime('now'),
        datetime('now')
      FROM patients p
      LEFT JOIN tutors t ON p.tutor_id = t.id
      WHERE p.nume IN (SELECT nume FROM _temp_nume_dup LIMIT 10)
      ORDER BY p.nume ASC, p.created ASC
      LIMIT 20
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_nume_dup').execute()

    // b) Mesmo tutor + mesmo animal
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_tutor_anim_dup AS
      SELECT tutor_id, LOWER(TRIM(name)) as pet_name, COUNT(*) as cnt
      FROM patients
      WHERE tutor_id IS NOT NULL AND tutor_id != '' AND name IS NOT NULL AND name != ''
      GROUP BY tutor_id, LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dta_sum',
        'tarefa3_tutor_anim_summary',
        '{"total_grupos":' || COUNT(*) || ',"total_pacientes":' || COALESCE(SUM(cnt), 0) || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_tutor_anim_dup
    `)
      .execute()

    // Amostras de pares tutor+animal duplicados (até 20 registros)
    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dtas_' || SUBSTR(p.id, 1, 8),
        'tarefa3_tutor_anim_sample',
        '{"id":"' || p.id || '","name":"' || REPLACE(COALESCE(p.name, ''), '"', '\"') || '","nume":"' || COALESCE(p.nume, '') || '","ctrl":"' || COALESCE(p.ctrl, '') || '","import_key":"' || REPLACE(COALESCE(p.import_key, ''), '"', '\"') || '","created":"' || p.created || '","tutor_name":"' || REPLACE(COALESCE(t.name, ''), '"', '\"') || '","tutor_id":"' || p.tutor_id || '"}',
        datetime('now'),
        datetime('now')
      FROM patients p
      JOIN (SELECT tutor_id, pet_name FROM _temp_tutor_anim_dup LIMIT 10) d
        ON p.tutor_id = d.tutor_id AND LOWER(TRIM(p.name)) = d.pet_name
      LEFT JOIN tutors t ON p.tutor_id = t.id
      ORDER BY t.name ASC, p.name ASC, p.created ASC
      LIMIT 20
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_tutor_anim_dup').execute()

    // c) Mesmo import_key repetido
    app
      .db()
      .newQuery(`
      CREATE TEMP TABLE _temp_key_dup AS
      SELECT import_key, COUNT(*) as cnt
      FROM patients
      WHERE import_key IS NOT NULL AND import_key != ''
      GROUP BY import_key
      HAVING COUNT(*) > 1
    `)
      .execute()

    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dk_sum',
        'tarefa3_key_summary',
        '{"total_grupos":' || COUNT(*) || ',"total_pacientes":' || COALESCE(SUM(cnt), 0) || '}',
        datetime('now'),
        datetime('now')
      FROM _temp_key_dup
    `)
      .execute()

    // Amostras de import_key repetidos (até 20 registros)
    app
      .db()
      .newQuery(`
      INSERT INTO _diag_results (id, category, payload, created, updated)
      SELECT 
        'dks_' || SUBSTR(p.id, 1, 9),
        'tarefa3_key_sample',
        '{"id":"' || p.id || '","name":"' || REPLACE(COALESCE(p.name, ''), '"', '\"') || '","nume":"' || COALESCE(p.nume, '') || '","ctrl":"' || COALESCE(p.ctrl, '') || '","import_key":"' || REPLACE(COALESCE(p.import_key, ''), '"', '\"') || '","created":"' || p.created || '","tutor_name":"' || REPLACE(COALESCE(t.name, ''), '"', '\"') || '"}',
        datetime('now'),
        datetime('now')
      FROM patients p
      JOIN (SELECT import_key FROM _temp_key_dup LIMIT 10) d
        ON p.import_key = d.import_key
      LEFT JOIN tutors t ON p.tutor_id = t.id
      ORDER BY p.import_key ASC, p.created ASC
      LIMIT 20
    `)
      .execute()

    app.db().newQuery('DROP TABLE _temp_key_dup').execute()
  },
  (app) => {},
)
