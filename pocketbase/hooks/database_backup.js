/**
 * pb_hooks/database_backup.js
 *
 * Módulo de Backup Diário Automático e Sob Demanda
 *
 * 1. Cron automático diário às 03:00 (cronAdd('daily_backup_csv', '0 3 * * *', ...))
 *    - Exporta em apenas LEITURA: patients, tutors, clinical_records, vaccines, appointments
 *    - Formato CSV com cabeçalho UTF-8 e BOM (\uFEFF) para compatibilidade com Microsoft Excel
 *    - Delimitador ';' e campos escapados com aspas duplas ("...")
 *    - Histórico retido por 7 dias com limpeza automática de arquivos mais antigos
 *
 * 2. Endpoints HTTP do Backend:
 *    - POST /backend/v1/backups/run : Executa o backup sob demanda com retorno dos arquivos criados
 *    - GET /backend/v1/backups/list : Lista todos os arquivos .csv gerados (nome, tamanho, data)
 *    - GET /backend/v1/backups/download : Download do arquivo .csv via query ?file=nome.csv
 *
 * REGRA ABSOLUTA: O sistema está em produção com dados reais. Este script executa estritamente
 * leitura via findRecordsByFilter, jamais gravando, alterando ou destruindo qualquer registro de tabela.
 *
 * ATENÇÃO AO AMBIENTE GOJA / POCKETBASE:
 * Cada callback registrado (cronAdd / routerAdd) executa em seu próprio contexto / pool de VM Goja.
 * Portanto, NENHUMA função ou variável do escopo raiz pode ser compartilhada ou referenciada dentro
 * dos callbacks. Toda a lógica, helpers de escape e tabelas de configuração devem ser declarados
 * inteiramente DENTRO do corpo de cada callback.
 */

// 1. REGISTRO DO CRON DIÁRIO ÀS 03:00
cronAdd('daily_backup_csv', '0 3 * * *', function () {
  console.log('[Backup Cron] Disparando rotina diária automática de backup (03:00)...')

  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""'
    var str = String(val)
    str = str.replace(/"/g, '""')
    return '"' + str + '"'
  }

  var appInstance = typeof $app !== 'undefined' ? $app : null
  var resolvedDir = ''
  try {
    if (appInstance && typeof appInstance.dataDir === 'function') {
      resolvedDir = appInstance.dataDir()
    }
  } catch (_) {}
  var backupDir = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

  try {
    $os.mkdirAll(backupDir, 493) // 0755
  } catch (errDir) {
    console.log('[Backup Cron] Erro ao criar diretório ' + backupDir + ':', errDir)
  }

  var now = new Date()
  var yyyy = now.getFullYear()
  var m = now.getMonth() + 1
  var d = now.getDate()
  var mm = m < 10 ? '0' + m : String(m)
  var dd = d < 10 ? '0' + d : String(d)
  var dateStr = yyyy + '-' + mm + '-' + dd

  var collections = [
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
  var dirRoot = null
  try {
    dirRoot = $os.openRoot(backupDir)
  } catch (errOpenRoot) {
    console.log('[Backup Cron] Erro ao abrir backupDir como root:', errOpenRoot)
  }

  for (var i = 0; i < collections.length; i++) {
    var item = collections[i]
    var fileName = 'backup_' + item.name + '_' + dateStr + '.csv'
    var filePath = backupDir + '/' + fileName
    var fileHandle = null

    try {
      var totalRows = 0
      if (!dirRoot) {
        dirRoot = $os.openRoot(backupDir)
      }
      fileHandle = dirRoot.create(fileName)

      // Escreve o BOM UTF-8 e o cabeçalho imediatamente no arquivo
      var headerCols = []
      for (var h = 0; h < item.headers.length; h++) {
        headerCols.push('"' + item.headers[h] + '"')
      }
      fileHandle.writeString('\uFEFF' + headerCols.join(';') + '\r\n')

      var pageSize = 1000
      var lastId = ''
      var pageCount = 0

      while (true) {
        var filter = lastId ? 'id > "' + lastId + '"' : ''
        var records = appInstance
          ? appInstance.findRecordsByFilter(item.name, filter, 'id', pageSize, 0)
          : $app.findRecordsByFilter(item.name, filter, 'id', pageSize, 0)
        if (!records || records.length === 0) break

        var chunkLines = []
        for (var r = 0; r < records.length; r++) {
          var rec = records[r]
          var lineVals = []
          for (var f = 0; f < item.fields.length; f++) {
            var fName = item.fields[f]
            var val = ''
            if (fName === 'id') {
              val = rec.id
            } else if (fName === 'deceased' || fName === 'completed') {
              val = rec.getBool(fName) ? 'true' : 'false'
            } else if (fName === 'weight') {
              val = rec.getFloat(fName)
            } else {
              val = rec.getString(fName)
            }
            lineVals.push(escapeCsvValue(val))
          }
          chunkLines.push(lineVals.join(';') + '\r\n')
        }

        fileHandle.writeString(chunkLines.join(''))
        totalRows += records.length
        pageCount++

        // Log de progresso a cada 10 páginas (10.000 registros)
        if (pageCount % 10 === 0) {
          console.log('[Backup Cron] ' + item.name + ': ' + totalRows + ' registros gravados...')
        }

        if (records.length < pageSize) break
        lastId = records[records.length - 1].id
      }

      // Fecha o arquivo e obtém tamanho
      try {
        fileHandle.close()
        fileHandle = null
      } catch (_) {}

      var fileSize = 0
      try {
        var statInfo = $os.stat(filePath)
        fileSize = statInfo.size()
      } catch (_) {}

      console.log(
        '[Backup Cron] Arquivo ' +
          fileName +
          ' gerado com ' +
          totalRows +
          ' registros (' +
          fileSize +
          ' bytes).',
      )
    } catch (errCol) {
      if (fileHandle) {
        try {
          fileHandle.close()
        } catch (_) {}
        fileHandle = null
      }
      console.log(
        '[Backup Cron] Erro ao exportar ' + item.name + ':',
        errCol ? errCol.message || String(errCol) : String(errCol),
      )
    }
  }

  if (dirRoot && typeof dirRoot.close === 'function') {
    try {
      dirRoot.close()
    } catch (_) {}
  }

  // Limpeza de backups antigos (> 7 dias)
  try {
    var entries = $os.readDir(backupDir)
    if (entries && entries.length > 0) {
      var nowMs = new Date().getTime()
      var maxAgeMs = 7 * 24 * 60 * 60 * 1000
      for (var eIdx = 0; eIdx < entries.length; eIdx++) {
        var entry = entries[eIdx]
        if (entry.isDir()) continue
        var fName = entry.name()
        if (!fName.endsWith('.csv')) continue
        var fullP = backupDir + '/' + fName
        try {
          var info = $os.stat(fullP)
          if (nowMs - info.modTime().unixMilli() > maxAgeMs) {
            $os.remove(fullP)
            console.log('[Backup Cron] Arquivo antigo removido (> 7 dias): ' + fName)
          }
        } catch (_) {}
      }
    }
  } catch (errClean) {
    console.log('[Backup Cron] Erro na limpeza de backups antigos:', errClean)
  }
})

// 2. ENDPOINT POST: Disparar Backup Agora (Sob Demanda)
routerAdd('POST', '/backend/v1/backups/run', function (e) {
  return runBackupExport(e)
})

function runBackupExport(e) {
  function escapeCsvValue(val) {
    if (val === null || val === undefined) return '""'
    var str = String(val)
    str = str.replace(/"/g, '""')
    return '"' + str + '"'
  }

  var appInstance = e && e.app ? e.app : typeof $app !== 'undefined' ? $app : null
  var resolvedDir = ''
  try {
    if (e && e.app && typeof e.app.dataDir === 'function') {
      resolvedDir = e.app.dataDir()
    }
  } catch (_) {}
  if (!resolvedDir) {
    try {
      if (typeof $app !== 'undefined' && $app && typeof $app.dataDir === 'function') {
        resolvedDir = $app.dataDir()
      }
    } catch (_) {}
  }
  var BACKUP_DIR = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

  var collectionsToExport = [
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

  function getTodayIsoDate() {
    var now = new Date()
    var yyyy = now.getFullYear()
    var m = now.getMonth() + 1
    var d = now.getDate()
    var mm = m < 10 ? '0' + m : String(m)
    var dd = d < 10 ? '0' + d : String(d)
    return yyyy + '-' + mm + '-' + dd
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
      } catch (_) {
        return
      }
      if (!entries || entries.length === 0) return

      var nowMs = new Date().getTime()
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
          if (nowMs - modTime > maxAgeMs) {
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

    var dirRoot = null
    try {
      dirRoot = $os.openRoot(BACKUP_DIR)
    } catch (errOpenRoot) {
      console.log('[Backup] Erro ao abrir BACKUP_DIR como root:', errOpenRoot)
    }

    for (var i = 0; i < collectionsToExport.length; i++) {
      var item = collectionsToExport[i]
      var fileName = 'backup_' + item.name + '_' + dateStr + '.csv'
      var filePath = BACKUP_DIR + '/' + fileName
      var fileHandle = null

      try {
        var totalRows = 0
        if (!dirRoot) {
          dirRoot = $os.openRoot(BACKUP_DIR)
        }
        fileHandle = dirRoot.create(fileName)

        // UTF-8 com BOM (\uFEFF) para compatibilidade perfeita com Microsoft Excel
        // Gravado diretamente no início do arquivo em disco
        var headerCols = []
        for (var h = 0; h < item.headers.length; h++) {
          headerCols.push('"' + item.headers[h] + '"')
        }
        fileHandle.writeString('\uFEFF' + headerCols.join(';') + '\r\n')

        var pageSize = 1000
        var lastId = ''
        var pageCount = 0

        while (true) {
          // Busca paginada estritamente somente leitura via SDK nativo com id > lastId
          var filter = lastId ? 'id > "' + lastId + '"' : ''
          var records = appInstance
            ? appInstance.findRecordsByFilter(item.name, filter, 'id', pageSize, 0)
            : $app.findRecordsByFilter(item.name, filter, 'id', pageSize, 0)
          if (!records || records.length === 0) break

          var chunkLines = []
          for (var r = 0; r < records.length; r++) {
            var rec = records[r]
            var lineVals = []
            for (var f = 0; f < item.fields.length; f++) {
              var fName = item.fields[f]
              var val = ''
              if (fName === 'id') {
                val = rec.id
              } else if (fName === 'deceased' || fName === 'completed') {
                val = rec.getBool(fName) ? 'true' : 'false'
              } else if (fName === 'weight') {
                val = rec.getFloat(fName)
              } else {
                val = rec.getString(fName)
              }
              lineVals.push(escapeCsvValue(val))
            }
            chunkLines.push(lineVals.join(';') + '\r\n')
          }

          // Gravação direta no arquivo por página para liberar memória de forma incremental
          fileHandle.writeString(chunkLines.join(''))
          totalRows += records.length
          pageCount++

          // Log de progresso a cada 10 páginas (10.000 registros)
          if (pageCount % 10 === 0) {
            console.log('[Backup] ' + item.name + ': ' + totalRows + ' registros gravados...')
          }

          if (records.length < pageSize) break
          lastId = records[records.length - 1].id
        }

        // Fechar arquivo em disco
        try {
          fileHandle.close()
          fileHandle = null
        } catch (_) {}

        var fileSize = 0
        try {
          var statInfo = $os.stat(filePath)
          fileSize = statInfo.size()
        } catch (_) {}

        results.push({
          collection: item.name,
          fileName: fileName,
          totalRows: totalRows,
          sizeBytes: fileSize,
          status: 'success',
        })
        console.log(
          '[Backup] Arquivo gerado com sucesso: ' +
            fileName +
            ' (' +
            totalRows +
            ' registros, ' +
            fileSize +
            ' bytes)',
        )
      } catch (errCol) {
        if (fileHandle) {
          try {
            fileHandle.close()
          } catch (_) {}
          fileHandle = null
        }
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

    if (dirRoot && typeof dirRoot.close === 'function') {
      try {
        dirRoot.close()
      } catch (_) {}
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
}

// 3. ENDPOINT GET: Listar Arquivos de Backup Gerados
routerAdd('GET', '/backend/v1/backups/list', function (e) {
  var appInstance = e && e.app ? e.app : typeof $app !== 'undefined' ? $app : null
  var resolvedDir = ''
  try {
    if (e && e.app && typeof e.app.dataDir === 'function') {
      resolvedDir = e.app.dataDir()
    }
  } catch (_) {}
  if (!resolvedDir) {
    try {
      if (typeof $app !== 'undefined' && $app && typeof $app.dataDir === 'function') {
        resolvedDir = $app.dataDir()
      }
    } catch (_) {}
  }
  var BACKUP_DIR = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

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
      var rootHandle = $os.openRoot(BACKUP_DIR)
      try {
        var statDir = rootHandle.stat('.')
        if (statDir) {
          entries = $os.readDir(BACKUP_DIR)
        }
      } finally {
        if (rootHandle && typeof rootHandle.close === 'function') {
          try {
            rootHandle.close()
          } catch (_) {}
        }
      }
    } catch (readErr) {
      // Se a pasta não existe ainda ou erro na leitura, tenta $os.readDir ou retorna lista vazia
      try {
        entries = $os.readDir(BACKUP_DIR)
      } catch (_) {
        return e.json(200, {
          backupDir: BACKUP_DIR,
          retentionDays: 7,
          totalFiles: 0,
          files: [],
        })
      }
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
  var appInstance = e && e.app ? e.app : typeof $app !== 'undefined' ? $app : null
  var resolvedDir = ''
  try {
    if (e && e.app && typeof e.app.dataDir === 'function') {
      resolvedDir = e.app.dataDir()
    }
  } catch (_) {}
  if (!resolvedDir) {
    try {
      if (typeof $app !== 'undefined' && $app && typeof $app.dataDir === 'function') {
        resolvedDir = $app.dataDir()
      }
    } catch (_) {}
  }
  var BACKUP_DIR = resolvedDir ? resolvedDir + '/backups_csv' : 'pb_data/backups_csv'

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

    // Verifica existência do arquivo
    try {
      $os.stat(fullPath)
    } catch (errStat) {
      return e.json(404, { error: 'Arquivo de backup não encontrado ou expirado.' })
    }

    e.response.header().set('Content-Type', 'text/csv; charset=utf-8')
    e.response.header().set('Content-Disposition', 'attachment; filename="' + fileName + '"')

    // Tenta servir diretamente do filesystem de forma eficiente e sem carregar tudo em memória
    // 1) e.fileFS com $os.dirFS
    try {
      if (typeof e.fileFS === 'function' && typeof $os.dirFS === 'function') {
        return e.fileFS($os.dirFS(BACKUP_DIR), fileName)
      }
    } catch (errFileFS) {
      console.log('[Backup Download] fileFS falhou, tentando fallback: ' + String(errFileFS))
    }

    var rawBytes = $os.readFile(fullPath)
    var textContent = ''

    // 3.1) toString nativo global do PocketBase (converte bytes slice Go para UTF-8 string)
    if (typeof toString === 'function') {
      try {
        textContent = toString(rawBytes)
      } catch (errToString) {
        textContent = ''
      }
    }

    // 3.2) Buffer do Node/Goja se disponível
    if (!textContent && typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
      try {
        textContent = Buffer.from(rawBytes).toString('utf-8')
      } catch (errBuf) {
        textContent = ''
      }
    }

    // 3.3) Decodificador chunk a chunk de bytes UTF-8 puro em JS (garantia de decodificação correta)
    if (!textContent && rawBytes) {
      var len = rawBytes.length || 0
      var chunks = []
      var chunkSize = 8192
      var chunkChars = []

      for (var idx = 0; idx < len; ) {
        var b1 = rawBytes[idx++]
        var codePoint = 0

        if (b1 < 0x80) {
          codePoint = b1
        } else if (b1 >> 5 === 0x06) {
          var b2 = idx < len ? rawBytes[idx++] : 0
          codePoint = ((b1 & 0x1f) << 6) | (b2 & 0x3f)
        } else if (b1 >> 4 === 0x0e) {
          var b2_3 = idx < len ? rawBytes[idx++] : 0
          var b3 = idx < len ? rawBytes[idx++] : 0
          codePoint = ((b1 & 0x0f) << 12) | ((b2_3 & 0x3f) << 6) | (b3 & 0x3f)
        } else if (b1 >> 3 === 0x1e) {
          var b2_4 = idx < len ? rawBytes[idx++] : 0
          var b3_4 = idx < len ? rawBytes[idx++] : 0
          var b4 = idx < len ? rawBytes[idx++] : 0
          codePoint =
            ((b1 & 0x07) << 18) | ((b2_4 & 0x3f) << 12) | ((b3_4 & 0x3f) << 6) | (b4 & 0x3f)
        } else {
          codePoint = b1
        }

        if (codePoint <= 0xffff) {
          chunkChars.push(String.fromCharCode(codePoint))
        } else {
          codePoint -= 0x10000
          chunkChars.push(
            String.fromCharCode((codePoint >> 10) + 0xd800),
            String.fromCharCode((codePoint % 0x400) + 0xdc00),
          )
        }

        if (chunkChars.length >= chunkSize) {
          chunks.push(chunkChars.join(''))
          chunkChars = []
        }
      }

      if (chunkChars.length > 0) {
        chunks.push(chunkChars.join(''))
      }
      textContent = chunks.join('')
    }

    return e.string(200, textContent)
  } catch (err) {
    var errMsg = err ? err.message || String(err) : 'Erro desconhecido'
    console.log('[Backup] Erro no endpoint /download: ' + errMsg)
    return e.json(500, { error: 'Falha ao baixar backup: ' + errMsg })
  }
})
