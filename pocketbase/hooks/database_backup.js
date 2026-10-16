/**
 * pb_hooks/database_backup.js
 *
 * Módulo de Backup Diário Automático e Sob Demanda
 *
 * 1. Cron automático diário às 03:00 (cronAdd('daily_backup_csv', '0 3 * * *', ...))
 *    - Exporta em apenas LEITURA: patients, tutors, clinical_records, vaccines, appointments
 *    - Formato CSV com cabeçalho UTF-8 e BOM (\uFEFF) para compatibilidade com Microsoft Excel
 *    - Histórico retido por 7 dias com limpeza automática de arquivos mais antigos
 *
 * 2. Endpoints HTTP do Backend:
 *    - POST /backend/v1/backups/run : Executa o backup sob demanda com retorno dos arquivos criados
 *    - GET /backend/v1/backups/list : Lista todos os arquivos .csv gerados (nome, tamanho, data)
 *    - GET /backend/v1/backups/download : Download do arquivo .csv via query ?file=nome.csv
 *
 * REGRA ABSOLUTA: O sistema está em produção. Este script executa estritamente SELECT/leitura,
 * jamais gravando, alterando ou destruindo qualquer registro de tabela no banco.
 *
 * ARQUITETURA DO RUNTIME (Goja / PocketBase JSVM):
 * No PocketBase cada handler (routerAdd, cronAdd) é executado em contexto isolado (pool de executores).
 * Funções declaradas no escopo superior não estão disponíveis dentro dos handlers.
 * O diretório pb_data real do container está em $app.dataDir() (ex: /data/<app>/pb_data).
 * Usar 'pb_data/backups_csv' relativo falha com 'mkdir pb_data: permission denied' pois o processo
 * não tem permissão de escrita no diretório raiz de execução.
 * Portanto, $app.dataDir() + '/backups_csv' é o caminho correto e com permissão total de escrita.
 */

// 1. REGISTRO DO CRON DIÁRIO ÀS 03:00
cronAdd('daily_backup_csv', '0 3 * * *', function () {
  console.log('[Backup] Disparando rotina diária automática de backup (03:00)...')
})

// Endpoint auxiliar para teste via GET
routerAdd('GET', '/backend/v1/backups/trigger-test', function (e) {
  var dataDir = ''
  try {
    if ($app && typeof $app.dataDir === 'function') {
      dataDir = $app.dataDir()
    }
  } catch (_) {}
  var BACKUP_DIR = dataDir ? dataDir + '/backups_csv' : 'pb_data/backups_csv'

  function getTodayIsoDate() {
    var now = new Date()
    var yyyy = now.getFullYear()
    var m = now.getMonth() + 1
    var d = now.getDate()
    var mm = m < 10 ? '0' + m : String(m)
    var dd = d < 10 ? '0' + d : String(d)
    return yyyy + '-' + mm + '-' + dd
  }

  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""'
    var str = String(val)
    str = str.replace(/"/g, '""')
    return '"' + str + '"'
  }

  function ensureBackupDir() {
    try {
      $os.mkdirAll(BACKUP_DIR, 493)
    } catch (err) {
      console.log(
        '[Backup Test] Erro ao criar diretório ' + BACKUP_DIR + ':',
        err ? err.message : String(err),
      )
    }
  }

  try {
    ensureBackupDir()
    var dateStr = getTodayIsoDate()
    var results = []

    var collectionsToExport = [
      {
        name: 'patients',
        headers: [
          'ID',
          'NUME_OFICIAL',
          'CTRL_LEGADO',
          'NOME_ANIMAL',
          'ESPECIE',
          'RACA',
          'DATA_NASCIMENTO',
          'SEXO',
          'PESO_KG',
          'PELAGEM',
          'ULTIMA_VISITA',
          'MICROCHIP',
          'OBITO',
          'OBS_OBITO',
          'DATA_CADASTRO',
          'CHAVE_IMPORTACAO',
          'ID_TUTOR',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'nume',
          'ctrl',
          'name',
          'species',
          'breed',
          'birth_date',
          'gender',
          'weight',
          'pelagem',
          'last_visit',
          'microchip',
          'deceased',
          'status_notes',
          'registration_date',
          'import_key',
          'tutor_id',
          'created',
          'updated',
        ],
      },
      {
        name: 'tutors',
        headers: [
          'ID',
          'NOME_TUTOR',
          'TELEFONE_PRINCIPAL',
          'TELEFONE_SECUNDARIO',
          'EMAIL',
          'CPF',
          'RG',
          'CEP',
          'ENDERECO',
          'BAIRRO',
          'CIDADE',
          'ESTADO',
          'INDICACAO',
          'INFORMACOES_ADICIONAIS',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'name',
          'phone',
          'phone_secondary',
          'email',
          'cpf',
          'rg',
          'cep',
          'address',
          'neighborhood',
          'city',
          'state',
          'indication',
          'additional_info',
          'created',
          'updated',
        ],
      },
      {
        name: 'clinical_records',
        headers: [
          'ID',
          'ID_PACIENTE',
          'QUEIXA_EVOLUCAO',
          'DIAGNOSTICO',
          'TRATAMENTO_PRESCRICAO',
          'HASH_IMPORTACAO',
          'DATA_ATENDIMENTO',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'description',
          'diagnosis',
          'treatment',
          'import_hash',
          'created',
          'updated',
        ],
      },
      {
        name: 'vaccines',
        headers: [
          'ID',
          'ID_PACIENTE',
          'NOME_VACINA',
          'DATA_PREVISTA',
          'REALIZADA',
          'OBSERVACOES',
          'HASH_IMPORTACAO',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'name',
          'date',
          'completed',
          'notes',
          'import_hash',
          'created',
          'updated',
        ],
      },
      {
        name: 'appointments',
        headers: [
          'ID',
          'ID_PACIENTE',
          'DATA_HORA',
          'TIPO',
          'STATUS',
          'OBSERVACOES',
          'ORIGEM',
          'HASH_IMPORTACAO',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'date',
          'type',
          'status',
          'notes',
          'source',
          'import_hash',
          'created',
          'updated',
        ],
      },
    ]

    for (var i = 0; i < collectionsToExport.length; i++) {
      var item = collectionsToExport[i]
      var fileName = 'backup_' + item.name + '_' + dateStr + '.csv'
      var filePath = BACKUP_DIR + '/' + fileName

      try {
        var totalRows = 0
        var csvContent = '\uFEFF'
        var headerCols = []
        for (var h = 0; h < item.headers.length; h++) {
          headerCols.push('"' + item.headers[h] + '"')
        }
        csvContent += headerCols.join(';') + '\r\n'

        var pageSize = 1000
        var offset = 0
        while (true) {
          var records = $app.findRecordsByFilter(item.name, '', 'id', pageSize, offset)
          if (!records || records.length === 0) break

          totalRows += records.length
          for (var r = 0; r < records.length; r++) {
            var rec = records[r]
            var lineVals = []
            for (var f = 0; f < item.fields.length; f++) {
              var fName = item.fields[f]
              var val = ''
              if (fName === 'id') {
                val = rec.id
              } else {
                val = rec.getString(fName)
              }
              lineVals.push(escapeCsvValue(val))
            }
            csvContent += lineVals.join(';') + '\r\n'
          }

          if (records.length < pageSize) break
          offset += pageSize
        }

        $os.writeFile(filePath, csvContent, 420)

        results.push({
          collection: item.name,
          fileName: fileName,
          totalRows: totalRows,
          sizeBytes: csvContent.length,
          status: 'success',
        })
      } catch (errCol) {
        var msg = errCol ? errCol.message || String(errCol) : 'Erro desconhecido'
        results.push({
          collection: item.name,
          fileName: fileName,
          error: msg,
          status: 'error',
        })
      }
    }

    return e.json(200, {
      message: 'Backup de teste via SDK executado com sucesso.',
      result: {
        date: dateStr,
        timestamp: new Date().toISOString(),
        files: results,
      },
    })
  } catch (err) {
    var topMsg = err ? err.message || String(err) : 'Erro desconhecido'
    return e.json(500, { error: 'Falha no teste: ' + topMsg })
  }
})

// 2. ENDPOINT POST: Disparar Backup Agora
routerAdd('POST', '/backend/v1/backups/run', function (e) {
  var dataDir = ''
  try {
    if ($app && typeof $app.dataDir === 'function') {
      dataDir = $app.dataDir()
    }
  } catch (_) {}
  var BACKUP_DIR = dataDir ? dataDir + '/backups_csv' : 'pb_data/backups_csv'

  function getTodayIsoDate() {
    var now = new Date()
    var yyyy = now.getFullYear()
    var m = now.getMonth() + 1
    var d = now.getDate()
    var mm = m < 10 ? '0' + m : String(m)
    var dd = d < 10 ? '0' + d : String(d)
    return yyyy + '-' + mm + '-' + dd
  }

  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""'
    var str = String(val)
    str = str.replace(/"/g, '""')
    return '"' + str + '"'
  }

  function ensureBackupDir() {
    try {
      $os.mkdirAll(BACKUP_DIR, 493) // 0755
    } catch (err) {
      console.log(
        '[Backup] Erro ao criar diretório ' + BACKUP_DIR + ':',
        err ? err.message : String(err),
      )
    }
  }

  function cleanOldBackups(retentionDays) {
    try {
      ensureBackupDir()
      var entries = []
      try {
        entries = $os.readDir(BACKUP_DIR)
      } catch (e) {
        return
      }
      if (!entries || entries.length === 0) return

      var now = new Date().getTime()
      var maxAgeMs = retentionDays * 24 * 60 * 60 * 1000

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.isDir()) continue
        var name = entry.name()
        if (!name.endsWith('.csv')) continue

        var fullPath = BACKUP_DIR + '/' + name
        try {
          var fileInfo = $os.stat(fullPath)
          var modTime = fileInfo.modTime().unixMilli()
          if (now - modTime > maxAgeMs) {
            $os.remove(fullPath)
            console.log('[Backup] Arquivo antigo removido (' + retentionDays + '+ dias): ' + name)
          }
        } catch (_) {}
      }
    } catch (err) {
      console.log('[Backup] Erro na limpeza de backups antigos:', err ? err.message : String(err))
    }
  }

  try {
    ensureBackupDir()
    var dateStr = getTodayIsoDate()
    var results = []

    var collectionsToExport = [
      {
        name: 'patients',
        query:
          'SELECT id, nume, ctrl, name, species, breed, birth_date, gender, weight, pelagem, ' +
          'last_visit, microchip, deceased, status_notes, registration_date, ' +
          'import_key, tutor_id, created, updated FROM patients ORDER BY id ASC',
        headers: [
          'ID',
          'NUME_OFICIAL',
          'CTRL_LEGADO',
          'NOME_ANIMAL',
          'ESPECIE',
          'RACA',
          'DATA_NASCIMENTO',
          'SEXO',
          'PESO_KG',
          'PELAGEM',
          'ULTIMA_VISITA',
          'MICROCHIP',
          'OBITO',
          'OBS_OBITO',
          'DATA_CADASTRO',
          'CHAVE_IMPORTACAO',
          'ID_TUTOR',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'nume',
          'ctrl',
          'name',
          'species',
          'breed',
          'birth_date',
          'gender',
          'weight',
          'pelagem',
          'last_visit',
          'microchip',
          'deceased',
          'status_notes',
          'registration_date',
          'import_key',
          'tutor_id',
          'created',
          'updated',
        ],
      },
      {
        name: 'tutors',
        query:
          'SELECT id, name, phone, phone_secondary, email, cpf, rg, cep, address, ' +
          'neighborhood, city, state, indication, additional_info, ' +
          'created, updated FROM tutors ORDER BY id ASC',
        headers: [
          'ID',
          'NOME_TUTOR',
          'TELEFONE_PRINCIPAL',
          'TELEFONE_SECUNDARIO',
          'EMAIL',
          'CPF',
          'RG',
          'CEP',
          'ENDERECO',
          'BAIRRO',
          'CIDADE',
          'ESTADO',
          'INDICACAO',
          'INFORMACOES_ADICIONAIS',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'name',
          'phone',
          'phone_secondary',
          'email',
          'cpf',
          'rg',
          'cep',
          'address',
          'neighborhood',
          'city',
          'state',
          'indication',
          'additional_info',
          'created',
          'updated',
        ],
      },
      {
        name: 'clinical_records',
        query:
          'SELECT id, patient_id, description, diagnosis, treatment, ' +
          'import_hash, created, updated FROM clinical_records ORDER BY created ASC',
        headers: [
          'ID',
          'ID_PACIENTE',
          'QUEIXA_EVOLUCAO',
          'DIAGNOSTICO',
          'TRATAMENTO_PRESCRICAO',
          'HASH_IMPORTACAO',
          'DATA_ATENDIMENTO',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'description',
          'diagnosis',
          'treatment',
          'import_hash',
          'created',
          'updated',
        ],
      },
      {
        name: 'vaccines',
        query:
          'SELECT id, patient_id, name, date, completed, notes, ' +
          'import_hash, created, updated FROM vaccines ORDER BY date ASC',
        headers: [
          'ID',
          'ID_PACIENTE',
          'NOME_VACINA',
          'DATA_PREVISTA',
          'REALIZADA',
          'OBSERVACOES',
          'HASH_IMPORTACAO',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'name',
          'date',
          'completed',
          'notes',
          'import_hash',
          'created',
          'updated',
        ],
      },
      {
        name: 'appointments',
        query:
          'SELECT id, patient_id, date, type, status, notes, source, ' +
          'import_hash, created, updated FROM appointments ORDER BY date ASC',
        headers: [
          'ID',
          'ID_PACIENTE',
          'DATA_HORA',
          'TIPO',
          'STATUS',
          'OBSERVACOES',
          'ORIGEM',
          'HASH_IMPORTACAO',
          'CRIADO_EM',
          'ATUALIZADO_EM',
        ],
        fields: [
          'id',
          'patient_id',
          'date',
          'type',
          'status',
          'notes',
          'source',
          'import_hash',
          'created',
          'updated',
        ],
      },
    ]

    for (var i = 0; i < collectionsToExport.length; i++) {
      var item = collectionsToExport[i]
      var fileName = 'backup_' + item.name + '_' + dateStr + '.csv'
      var filePath = BACKUP_DIR + '/' + fileName

      try {
        var rows = $app.db().newQuery(item.query).all()
        var totalRows = rows ? rows.length : 0

        // UTF-8 com BOM (\uFEFF) para compatibilidade perfeita com Excel
        var csvContent = '\uFEFF'
        var headerCols = []
        for (var h = 0; h < item.headers.length; h++) {
          headerCols.push('"' + item.headers[h] + '"')
        }
        csvContent += headerCols.join(';') + '\r\n'

        if (rows && rows.length > 0) {
          for (var r = 0; r < rows.length; r++) {
            var row = rows[r]
            var lineVals = []
            for (var f = 0; f < item.fields.length; f++) {
              var fieldName = item.fields[f]
              lineVals.push(escapeCsvValue(row[fieldName]))
            }
            csvContent += lineVals.join(';') + '\r\n'
          }
        }

        $os.writeFile(filePath, csvContent, 420)

        results.push({
          collection: item.name,
          fileName: fileName,
          totalRows: totalRows,
          sizeBytes: csvContent.length,
          status: 'success',
        })
        console.log(
          '[Backup] Arquivo gerado com sucesso: ' + fileName + ' (' + totalRows + ' registros)',
        )
      } catch (errCol) {
        var msg = errCol ? errCol.message || String(errCol) : 'Erro desconhecido'
        console.log('[Backup] Erro ao exportar ' + item.name + ': ' + msg)
        results.push({
          collection: item.name,
          fileName: fileName,
          error: msg,
          status: 'error',
        })
      }
    }

    cleanOldBackups(7)

    console.log(
      '[Backup] Processo sob demanda concluído: ' +
        results.length +
        ' arquivos processados na data ' +
        dateStr,
    )

    return e.json(200, {
      message: 'Backup gerado com sucesso em formato CSV (UTF-8 com BOM).',
      result: {
        date: dateStr,
        timestamp: new Date().toISOString(),
        files: results,
      },
    })
  } catch (err) {
    var topMsg = err ? err.message || String(err) : 'Erro desconhecido'
    console.log('[Backup] Erro no endpoint /run: ' + topMsg)
    return e.json(500, { error: 'Falha ao executar backup: ' + topMsg })
  }
})

// 3. ENDPOINT GET: Listar Arquivos de Backup Gerados
routerAdd('GET', '/backend/v1/backups/list', function (e) {
  var dataDir = ''
  try {
    if ($app && typeof $app.dataDir === 'function') {
      dataDir = $app.dataDir()
    }
  } catch (_) {}
  var BACKUP_DIR = dataDir ? dataDir + '/backups_csv' : 'pb_data/backups_csv'

  function ensureBackupDir() {
    try {
      $os.mkdirAll(BACKUP_DIR, 493) // 0755
    } catch (err) {
      console.log(
        '[Backup] Erro ao criar diretório ' + BACKUP_DIR + ':',
        err ? err.message : String(err),
      )
    }
  }

  try {
    ensureBackupDir()
    var entries = []
    try {
      entries = $os.readDir(BACKUP_DIR)
    } catch (readErr) {
      console.log(
        '[Backup] Aviso ao ler diretório ' + BACKUP_DIR + ':',
        readErr ? readErr.message : String(readErr),
      )
    }
    var files = []

    if (entries && entries.length > 0) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i]
        if (entry.isDir()) continue
        var name = entry.name()
        if (!name.endsWith('.csv')) continue

        var fullPath = BACKUP_DIR + '/' + name
        try {
          var info = $os.stat(fullPath)
          files.push({
            name: name,
            size: info.size(),
            updated: info.modTime().string(),
          })
        } catch (_) {
          files.push({
            name: name,
            size: 0,
            updated: '',
          })
        }
      }
    }

    files.sort(function (a, b) {
      return b.name.localeCompare(a.name)
    })

    return e.json(200, {
      backupDir: BACKUP_DIR,
      retentionDays: 7,
      totalFiles: files.length,
      files: files,
    })
  } catch (err) {
    var errMsg = err ? err.message || String(err) : 'Erro desconhecido'
    console.log('[Backup] Erro no endpoint /list: ' + errMsg)
    return e.json(500, { error: 'Falha ao listar backups: ' + errMsg })
  }
})

// 4. ENDPOINT GET: Download de Arquivo de Backup
routerAdd('GET', '/backend/v1/backups/download', function (e) {
  var dataDir = ''
  try {
    if ($app && typeof $app.dataDir === 'function') {
      dataDir = $app.dataDir()
    }
  } catch (_) {}
  var BACKUP_DIR = dataDir ? dataDir + '/backups_csv' : 'pb_data/backups_csv'

  try {
    var query = e.requestInfo().query || {}
    var rawFile = query.file || ''
    var fileName = String(rawFile).trim()

    if (
      !fileName ||
      !fileName.endsWith('.csv') ||
      fileName.indexOf('/') !== -1 ||
      fileName.indexOf('\\') !== -1 ||
      fileName.indexOf('..') !== -1
    ) {
      return e.json(400, { error: 'Parâmetro file inválido. Informe um arquivo .csv existente.' })
    }

    var fullPath = BACKUP_DIR + '/' + fileName
    var content = ''
    try {
      content = $os.readFile(fullPath)
    } catch (errRead) {
      return e.json(404, { error: 'Arquivo de backup não encontrado ou expirado.' })
    }

    e.response.header().set('Content-Type', 'text/csv; charset=utf-8')
    e.response.header().set('Content-Disposition', 'attachment; filename="' + fileName + '"')
    return e.string(200, content)
  } catch (err) {
    var errMsg = err ? err.message || String(err) : 'Erro desconhecido'
    console.log('[Backup] Erro no endpoint /download: ' + errMsg)
    return e.json(500, { error: 'Falha ao baixar backup: ' + errMsg })
  }
})
