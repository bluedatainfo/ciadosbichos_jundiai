/**
 * pb_hooks/database_backup.js
 *
 * Módulo de Backup Diário Automático e Sob Demanda
 *
 * 1. Cron automático diário às 03:00 (cronAdd('daily_backup', '0 3 * * *', ...))
 *    - Exporta em apenas LEITURA: patients, tutors, clinical_records, vaccines, appointments
 *    - Formato CSV com cabeçalho UTF-8 e BOM (\uFEFF) para compatibilidade perfeita com Microsoft Excel
 *    - Histórico retido por 7 dias com limpeza automática de arquivos mais antigos
 *
 * 2. Endpoints HTTP do Backend:
 *    - POST /backend/v1/backups/run : Executa o backup sob demanda com retorno dos arquivos criados
 *    - GET /backend/v1/backups/list : Lista todos os arquivos .csv gerados (nome, tamanho, data)
 *    - GET /backend/v1/backups/download : Download do arquivo .csv via query ?file=nome.csv
 *
 * REGRA ABSOLUTA: O sistema está em produção. Este script executa estritamente SELECT/leitura,
 * jamais gravando, alterando ou destruindo qualquer registro de tabela no banco.
 */

const BACKUP_DIR = 'pb_data/backups_csv'

// Helper para formatar data YYYY-MM-DD
function getTodayIsoDate() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Escapa valor para CSV padrão RFC 4180
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""'
  let str = String(val)
  // Substitui aspas duplas por par de aspas duplas
  str = str.replace(/"/g, '""')
  return `"${str}"`
}

// Garante que o diretório de backups exista
const ensureBackupDir = function () {
  try {
    $os.mkdirAll(BACKUP_DIR, 0o755)
  } catch (err) {
    console.log('[Backup] Erro ao criar diretório:', err.message)
  }
}

// Executa a geração de CSVs de todas as coleções solicitadas
const executeBackupProcess = function () {
  ensureBackupDir()
  const dateStr = getTodayIsoDate()
  const results = []

  const collectionsToExport = [
    {
      name: 'patients',
      table: 'patients',
      query: `SELECT id, nume, ctrl, name, species, breed, birth_date, gender, weight, pelagem, 
                     last_visit, microchip, deceased, status_notes, registration_date, 
                     import_key, tutor_id, created, updated FROM patients ORDER BY id ASC`,
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
      table: 'tutors',
      query: `SELECT id, name, phone, phone_secondary, email, cpf, rg, cep, address, 
                     neighborhood, city, state, indication, additional_info, 
                     created, updated FROM tutors ORDER BY id ASC`,
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
      table: 'clinical_records',
      query: `SELECT id, patient_id, description, diagnosis, treatment, 
                     import_hash, created, updated FROM clinical_records ORDER BY created ASC`,
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
      table: 'vaccines',
      query: `SELECT id, patient_id, name, date, completed, notes, 
                     import_hash, created, updated FROM vaccines ORDER BY date ASC`,
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
      table: 'appointments',
      query: `SELECT id, patient_id, date, type, status, notes, source, 
                     import_hash, created, updated FROM appointments ORDER BY date ASC`,
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

  for (let i = 0; i < collectionsToExport.length; i++) {
    const item = collectionsToExport[i]
    const fileName = `backup_${item.name}_${dateStr}.csv`
    const filePath = `${BACKUP_DIR}/${fileName}`

    try {
      const rows = $app.db().newQuery(item.query).all()
      const totalRows = rows ? rows.length : 0

      // UTF-8 com BOM (\uFEFF) para que o Excel abra com acentuação correta diretamente
      let csvContent = '\uFEFF'
      // Linha de cabeçalho
      csvContent += item.headers.map((h) => `"${h}"`).join(';') + '\r\n'

      // Linhas de dados
      if (rows && rows.length > 0) {
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r]
          const lineVals = []
          for (let f = 0; f < item.fields.length; f++) {
            const fieldName = item.fields[f]
            lineVals.push(escapeCsvValue(row[fieldName]))
          }
          csvContent += lineVals.join(';') + '\r\n'
        }
      }

      $os.writeFile(filePath, csvContent, 0o644)

      results.push({
        collection: item.name,
        fileName: fileName,
        totalRows: totalRows,
        sizeBytes: csvContent.length,
        status: 'success',
      })
      console.log(`[Backup] Arquivo gerado com sucesso: ${fileName} (${totalRows} registros)`)
    } catch (err) {
      console.log(`[Backup] Erro ao exportar ${item.name}:`, err.message)
      results.push({
        collection: item.name,
        fileName: fileName,
        error: err.message,
        status: 'error',
      })
    }
  }

  // Limpeza de arquivos com mais de 7 dias
  cleanOldBackups(7)

  // Log explícito para auditoria/monitoramento
  console.log(
    `[Backup] Processo concluído com sucesso: ${results.length} arquivos gerados na data ${dateStr}`,
  )

  return {
    date: dateStr,
    timestamp: new Date().toISOString(),
    files: results,
  }
}

// Exclui arquivos de backup com mais de N dias (apaga SOMENTE arquivos .csv de backup antigos, nunca dados de coleções)
function cleanOldBackups(retentionDays) {
  try {
    ensureBackupDir()
    const entries = $os.readDir(BACKUP_DIR)
    if (!entries || entries.length === 0) return

    const now = new Date().getTime()
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.isDir()) continue
      const name = entry.name()
      if (!name.endsWith('.csv')) continue

      const fullPath = `${BACKUP_DIR}/${name}`
      try {
        const fileInfo = $os.stat(fullPath)
        const modTime = fileInfo.modTime().unixMilli()
        if (now - modTime > maxAgeMs) {
          $os.remove(fullPath)
          console.log(`[Backup] Arquivo antigo removido (${retentionDays}+ dias): ${name}`)
        }
      } catch (e) {
        // Ignora erro individual ao verificar data do arquivo
      }
    }
  } catch (err) {
    console.log('[Backup] Erro na limpeza de backups antigos:', err.message)
  }
}

// 1. REGISTRO DO CRON DIÁRIO ÀS 03:00
cronAdd('daily_backup_csv', '0 3 * * *', () => {
  console.log('[Backup] Disparando rotina diária automática de backup (03:00)...')
  try {
    executeBackupProcess()
    console.log('[Backup] Rotina diária automática concluída com sucesso.')
  } catch (err) {
    console.log('[Backup] Falha na execução da rotina diária:', err.message)
  }
})

// 2. ENDPOINT POST: Disparar Backup Agora
routerAdd('POST', '/backend/v1/backups/run', (e) => {
  try {
    const result = executeBackupProcess()
    return e.json(200, {
      message: 'Backup gerado com sucesso em formato CSV (UTF-8 com BOM).',
      result: result,
    })
  } catch (err) {
    console.log('[Backup] Erro no endpoint /run:', err.message)
    return e.json(500, { error: 'Falha ao executar backup: ' + err.message })
  }
})

// 3. ENDPOINT GET: Listar Arquivos de Backup Gerados
routerAdd('GET', '/backend/v1/backups/list', (e) => {
  try {
    ensureBackupDir()
    const entries = $os.readDir(BACKUP_DIR)
    const files = []

    if (entries && entries.length > 0) {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        if (entry.isDir()) continue
        const name = entry.name()
        if (!name.endsWith('.csv')) continue

        const fullPath = `${BACKUP_DIR}/${name}`
        try {
          const info = $os.stat(fullPath)
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

    // Ordena do mais recente para o mais antigo pelo nome/data
    files.sort((a, b) => b.name.localeCompare(a.name))

    return e.json(200, {
      backupDir: BACKUP_DIR,
      retentionDays: 7,
      totalFiles: files.length,
      files: files,
    })
  } catch (err) {
    console.log('[Backup] Erro no endpoint /list:', err.message)
    return e.json(500, { error: 'Falha ao listar backups: ' + err.message })
  }
})

// 4. ENDPOINT GET: Download de Arquivo de Backup
routerAdd('GET', '/backend/v1/backups/download', (e) => {
  try {
    const query = e.requestInfo().query
    const fileName = (query.file || '').trim()

    if (
      !fileName ||
      !fileName.endsWith('.csv') ||
      fileName.includes('/') ||
      fileName.includes('..')
    ) {
      return e.json(400, { error: 'Parâmetro file inválido. Informe um arquivo .csv existente.' })
    }

    const fullPath = `${BACKUP_DIR}/${fileName}`
    let content = ''
    try {
      content = $os.readFile(fullPath)
    } catch (err) {
      return e.json(404, { error: 'Arquivo de backup não encontrado ou expirado.' })
    }

    e.response.header().set('Content-Type', 'text/csv; charset=utf-8')
    e.response.header().set('Content-Disposition', `attachment; filename="${fileName}"`)
    return e.string(200, content)
  } catch (err) {
    console.log('[Backup] Erro no endpoint /download:', err.message)
    return e.json(500, { error: 'Falha ao baixar backup: ' + err.message })
  }
})
