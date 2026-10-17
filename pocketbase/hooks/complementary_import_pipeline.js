/**
 * pb_hooks/complementary_import_pipeline.js
 *
 * Endpoint de backend para "Importação Complementar (TEL3 / Débito)"
 * Rota: POST /backend/v1/import/complementary-batch
 *
 * Regras estritas:
 * 1. Arquivo de entrada: DADOS.TXT (~21.296 linhas) processado em lotes
 * 2. Hierarquia de casamento do paciente/tutor:
 *    - NUME > import_key
 *    - NUNCA usar CTRL como referência de comparação (na base legado ele é basicamente 0)
 * 3. Preenchimento de campos do Tutor:
 *    - Preencher SOMENTE os campos vazios de:
 *      * tel3 (texto TEL3 do arquivo)
 *      * dbdt_flag (quando DBDT do arquivo tiver valor -1)
 *      * dbtx (texto DBTX do arquivo)
 *    - NUNCA sobrescrever campo já preenchido (protege edições feitas em produção)
 * 4. Linhas sem casamento:
 *    - Apenas contar e reportar como "não casados"
 *    - NÃO criar nenhum registro novo!
 * 5. Auditoria:
 *    - Cada preenchimento gera registro na coleção audit_logs (valor anterior -> novo)
 * 6. Totais de conferência retornados ao cliente:
 *    - linesRead (linhas lidas no lote)
 *    - tutorsMatched (tutores casados)
 *    - fieldsFilled (campos preenchidos)
 *    - notMatched (linhas sem casamento)
 *    - tel3Filled, dbdtFilled, dbtxFilled
 */

routerAdd('POST', '/backend/v1/import/complementary-batch', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, {
        error: 'Autenticação necessária para executar importação complementar.',
      })
    }

    const body = e.requestInfo().body || {}
    const rows = body.rows || []
    const startLineNumber = parseInt(body.startLineNumber || '1', 10) || 1

    const currentUser = {
      id: authRecord.id,
      name: authRecord.getString('name') || authRecord.getString('email') || 'Usuário',
      email: authRecord.getString('email') || '',
      role: authRecord.getString('role') || 'admin',
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return e.json(200, {
        success: true,
        counts: {
          linesRead: 0,
          tutorsMatched: 0,
          fieldsFilled: 0,
          notMatched: 0,
          tel3Filled: 0,
          dbdtFilled: 0,
          dbtxFilled: 0,
          skippedAlreadyFilled: 0,
        },
        processedRows: 0,
      })
    }

    // --- HELPERS DE NORMALIZAÇÃO ---
    function sanitizeText(val) {
      if (val === undefined || val === null) return ''
      const str = String(val)
      let res = ''
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        if (code === 9 || code === 10 || code === 13) {
          res += str[i]
          continue
        }
        if (
          code < 32 ||
          code === 127 ||
          code === 0xfffd ||
          code === 0x25a1 ||
          code === 0x25a0 ||
          code === 0x25af
        ) {
          continue
        }
        res += str[i]
      }
      return res.trim()
    }

    function removeDiacritics(str) {
      if (!str) return ''
      try {
        if (typeof str.normalize === 'function') {
          return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        }
      } catch (_) {}
      return str
    }

    function normalizeSpecies(raw) {
      const clean = sanitizeText(raw).toUpperCase()
      if (!clean) return 'Canino'
      if (
        clean === 'CAN' ||
        clean.indexOf('CANIN') !== -1 ||
        clean === 'CAO' ||
        clean === 'CÃO' ||
        clean === 'CACHORRO'
      ) {
        return 'Canino'
      }
      if (
        clean === 'FEL' ||
        clean.indexOf('FELIN') !== -1 ||
        clean === 'GATO' ||
        clean === 'GATA'
      ) {
        return 'Felino'
      }
      if (clean === 'AVE' || clean === 'PASSARO' || clean === 'PÁSSARO') {
        return 'Ave'
      }
      if (clean === 'EQU' || clean.indexOf('EQUIN') !== -1 || clean === 'CAVALO') {
        return 'Equino'
      }
      if (clean === 'BOV' || clean.indexOf('BOVIN') !== -1) {
        return 'Bovino'
      }
      if (clean === 'ROEDOR' || clean === 'HAMSTER' || clean === 'COELHO') {
        return 'Silvestre'
      }
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
    }

    function getTutorDedupeKey(name, cpf) {
      const cleanCpf = (cpf || '').replace(/\D/g, '')
      if (cleanCpf && cleanCpf.length === 11) {
        return 'cpf:' + cleanCpf
      }
      const cleanName = removeDiacritics(sanitizeText(name).toLowerCase())
        .replace(/\s+/g, ' ')
        .trim()
      return 'name:' + cleanName
    }

    function normalizeKeyText(val) {
      return removeDiacritics(sanitizeText(val).toLowerCase())
        .replace(/[^a-z0-9]/g, '')
        .trim()
    }

    function getPatientCompositeBaseKey(params) {
      const tutorKey = params.tutorDedupeKey || 'tutor:none'
      const anim = normalizeKeyText(params.anim) || 'semnome'
      const espe = normalizeKeyText(normalizeSpecies(params.espe)) || 'canino'
      const parts = [tutorKey, anim, espe]
      const nascClean = normalizeKeyText(params.nasc)
      if (nascClean) parts.push('nasc:' + nascClean)
      const pelaClean = normalizeKeyText(params.pela)
      if (pelaClean) parts.push('pela:' + pelaClean)
      return parts.join('|')
    }

    const auditCol = $app.findCollectionByNameOrId('audit_logs')

    const counts = {
      linesRead: rows.length,
      tutorsMatched: 0,
      fieldsFilled: 0,
      notMatched: 0,
      tel3Filled: 0,
      dbdtFilled: 0,
      dbtxFilled: 0,
      skippedAlreadyFilled: 0,
    }

    const matchedTutorIdsInBatch = {}
    const runOccurrenceCounters = {}

    // Transação SQLite atômica
    $app.runInTransaction((txApp) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]

        const nomeTutor = sanitizeText(row.NOME || row.nome)
        const animNome = sanitizeText(row.ANIM || row.anim)
        const numeRaw = sanitizeText(row.NUME || row.nume)

        // Se linha estiver totalmente vazia
        if (!nomeTutor && !animNome && !numeRaw) {
          continue
        }

        let patientRecord = null

        // 1. Prioridade 1 de casamento: NUME oficial (se preenchido e != '0')
        if (numeRaw && numeRaw !== '0') {
          try {
            patientRecord = txApp.findFirstRecordByData('patients', 'nume', numeRaw)
          } catch (_) {}
        }

        // 2. Prioridade 2 de casamento: import_key (quando NUME não casou ou estava ausente)
        // NUNCA usar CTRL!
        if (!patientRecord) {
          const cpfRaw = sanitizeText(row.CPF || row.cpf)
          const tutorDedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)
          const animalName = animNome || 'Sem nome'
          const espeRaw = row.ESPE || row.espe
          const pelaRaw = sanitizeText(row.PELA || row.pela)
          const nascRaw = row.NASC || row.nasc

          const baseKey = getPatientCompositeBaseKey({
            tutorDedupeKey: tutorDedupeKey,
            anim: animalName,
            espe: espeRaw,
            nasc: nascRaw,
            pela: pelaRaw,
          })
          const occCount = (runOccurrenceCounters[baseKey] || 0) + 1
          runOccurrenceCounters[baseKey] = occCount
          const importKey = baseKey + '#' + occCount

          try {
            patientRecord = txApp.findFirstRecordByData('patients', 'import_key', importKey)
          } catch (_) {}
        }

        // Se não casou paciente
        if (!patientRecord) {
          counts.notMatched++
          continue
        }

        // Recuperar o tutor do paciente
        const tutorId = patientRecord.getString('tutor_id')
        if (!tutorId) {
          counts.notMatched++
          continue
        }

        let tutorRecord = null
        try {
          tutorRecord = txApp.findRecordById('tutors', tutorId)
        } catch (_) {}

        if (!tutorRecord) {
          counts.notMatched++
          continue
        }

        // Marcar casamento de tutor (contagem única por tutor ou por ocorrência)
        if (!matchedTutorIdsInBatch[tutorId]) {
          matchedTutorIdsInBatch[tutorId] = true
          counts.tutorsMatched++
        }

        // Extrair valores candidatos do arquivo
        const fileTel3 = sanitizeText(row.TEL3 || row.tel3)
        const fileDbdtRaw = sanitizeText(row.DBDT || row.dbdt)
        const fileDbtx = sanitizeText(row.DBTX || row.dbtx)

        // DBDT = -1 determina flag ticada de Débito
        const shouldSetDbdtFlag = fileDbdtRaw === '-1' || fileDbdtRaw === -1

        // Valores atuais no tutor
        const currentTel3 = (tutorRecord.getString('tel3') || '').trim()
        const currentDbdtFlag = tutorRecord.getBool('dbdt_flag')
        const currentDbtx = (tutorRecord.getString('dbtx') || '').trim()

        const changes = {}
        let tutorModified = false

        // 1. TEL3: Preencher SOMENTE se campo vazio no banco e com valor no arquivo
        if (!currentTel3 && fileTel3) {
          tutorRecord.set('tel3', fileTel3)
          changes.tel3 = {
            label: 'Telefone 3',
            oldValue: '',
            newValue: fileTel3,
          }
          counts.tel3Filled++
          counts.fieldsFilled++
          tutorModified = true
        } else if (fileTel3 && currentTel3) {
          counts.skippedAlreadyFilled++
        }

        // 2. dbdt_flag: Preencher SOMENTE se DBDT=-1 no arquivo e ainda falso no banco
        if (shouldSetDbdtFlag && !currentDbdtFlag) {
          tutorRecord.set('dbdt_flag', true)
          changes.dbdt_flag = {
            label: 'Débito (Flag)',
            oldValue: false,
            newValue: true,
          }
          counts.dbdtFilled++
          counts.fieldsFilled++
          tutorModified = true
        } else if (shouldSetDbdtFlag && currentDbdtFlag) {
          counts.skippedAlreadyFilled++
        }

        // 3. dbtx: Preencher SOMENTE se campo vazio no banco e com texto no arquivo
        if (!currentDbtx && fileDbtx) {
          tutorRecord.set('dbtx', fileDbtx)
          changes.dbtx = {
            label: 'Texto de Débito',
            oldValue: '',
            newValue: fileDbtx,
          }
          counts.dbtxFilled++
          counts.fieldsFilled++
          tutorModified = true
        } else if (fileDbtx && currentDbtx) {
          counts.skippedAlreadyFilled++
        }

        if (tutorModified) {
          txApp.saveNoValidate(tutorRecord)

          // Registrar na auditoria
          try {
            const tutorName = tutorRecord.getString('name') || nomeTutor || 'Tutor'
            const auditRec = new Record(auditCol)
            auditRec.set('user_id', currentUser.id)
            auditRec.set('user_name', currentUser.name)
            auditRec.set('user_email', currentUser.email)
            auditRec.set('user_role', currentUser.role)
            auditRec.set('action', 'update')
            auditRec.set('module', 'tutors')
            auditRec.set('record_id', tutorRecord.id)
            auditRec.set('record_label', tutorName)
            auditRec.set('tutor_name', tutorName)
            auditRec.set('patient_name', patientRecord.getString('name') || animNome)
            auditRec.set('changes', JSON.stringify(changes))
            auditRec.set(
              'details',
              'Importação Complementar (DADOS.TXT): preenchimento de campos vazios (TEL3 / Débito) com preservação de dados existentes.',
            )
            txApp.saveNoValidate(auditRec)
          } catch (auditErr) {
            console.log('Aviso ao gravar log de auditoria complementar:', auditErr.message)
          }
        }
      }
    })

    return e.json(200, {
      success: true,
      counts: counts,
      processedRows: rows.length,
    })
  } catch (err) {
    console.log('Erro em complementary-batch:', err.message)
    return e.json(500, {
      error:
        'Erro no processamento da importação complementar no servidor: ' +
        (err.message || 'Erro desconhecido'),
    })
  }
})
