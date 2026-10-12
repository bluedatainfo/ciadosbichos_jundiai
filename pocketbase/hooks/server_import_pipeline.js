/**
 * pb_hooks/server_import_pipeline.js
 *
 * Pipeline completo de servidor para:
 * 1. Wipe controlado (/backend/v1/import/wipe)
 *    - Zera completamente: patients, tutors, clinical_records, vaccines, appointments, audit_logs, import_progress, import_failures
 *    - Limpa tabelas de trabalho temporárias de dedup (_dedup_pairs_work, etc.)
 *    - Preserva APENAS o usuário admin bluedata@bluedatainfo.com.br com a senha atual (remove os demais)
 *    - Preserva: clinic_settings, business_hours, inventory e os schemas das coleções
 *
 * 2. Carga server-side em lotes de alta performance (/backend/v1/import/process-batch)
 *    - Recebe lotes de linhas enviadas da tela /importacao
 *    - Processa e grava tutores, pacientes, prontuários, vacinas, retornos e agendamentos no banco PocketBase ($app / SQLite)
 *    - Atribui campos nume, import_key e import_hash idênticos à carga de 12/10
 *    - Conta e retorna: pacientes criados com NUME preenchido vs NUME vazio (deve ser 0 para arquivo com NUME)
 */

routerAdd('POST', '/backend/v1/import/wipe', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Autenticação necessária para executar o wipe.' })
    }

    const wipeSummary = {
      patientsDeleted: 0,
      tutorsDeleted: 0,
      clinicalDeleted: 0,
      vaccinesDeleted: 0,
      appointmentsDeleted: 0,
      auditLogsDeleted: 0,
      importProgressDeleted: 0,
      importFailuresDeleted: 0,
      usersRemoved: 0,
      adminPreserved: false,
    }

    // 1. Contagens antes de apagar
    try {
      wipeSummary.patientsDeleted = $app.countRecords('patients')
      wipeSummary.tutorsDeleted = $app.countRecords('tutors')
      wipeSummary.clinicalDeleted = $app.countRecords('clinical_records')
      wipeSummary.vaccinesDeleted = $app.countRecords('vaccines')
      wipeSummary.appointmentsDeleted = $app.countRecords('appointments')
      wipeSummary.auditLogsDeleted = $app.countRecords('audit_logs')
      wipeSummary.importProgressDeleted = $app.countRecords('import_progress')
      wipeSummary.importFailuresDeleted = $app.countRecords('import_failures')
    } catch (countErr) {
      console.log('Aviso ao contar registros antes do wipe:', countErr.message)
    }

    // 2. Executar limpeza das tabelas em transação SQLite
    $app.runInTransaction((txApp) => {
      // Deletar registros das coleções clínicas e cadastrais
      txApp.db().newQuery('DELETE FROM clinical_records').execute()
      txApp.db().newQuery('DELETE FROM vaccines').execute()
      txApp.db().newQuery('DELETE FROM appointments').execute()
      txApp.db().newQuery('DELETE FROM patients').execute()
      txApp.db().newQuery('DELETE FROM tutors').execute()
      txApp.db().newQuery('DELETE FROM audit_logs').execute()
      txApp.db().newQuery('DELETE FROM import_progress').execute()
      txApp.db().newQuery('DELETE FROM import_failures').execute()

      // Limpar tabelas de trabalho residuais caso existam
      try {
        txApp.db().newQuery('DROP TABLE IF EXISTS _dedup_pairs_work').execute()
      } catch (_) {}
      try {
        txApp.db().newQuery('DROP TABLE IF EXISTS _cands').execute()
      } catch (_) {}
      try {
        txApp.db().newQuery('DROP TABLE IF EXISTS _batch_pairs').execute()
      } catch (_) {}

      // Limpar usuários preservando APENAS bluedata@bluedatainfo.com.br com a senha e dados atuais
      const usersCol = txApp.findCollectionByNameOrId('users')
      const allUsers = txApp.findRecordsByFilter('users', '', '', 1000, 0)
      for (let u = 0; u < allUsers.length; u++) {
        const user = allUsers[u]
        const email = (user.getString('email') || '').toLowerCase().trim()
        if (email === 'bluedata@bluedatainfo.com.br') {
          wipeSummary.adminPreserved = true
          // Preservar intocado
        } else {
          txApp.delete(user)
          wipeSummary.usersRemoved++
        }
      }
    })

    return e.json(200, {
      success: true,
      message:
        'Base de dados zerada com sucesso. Apenas o administrador bluedata@bluedatainfo.com.br foi preservado.',
      summary: wipeSummary,
    })
  } catch (err) {
    console.log('Erro ao executar wipe no servidor:', err.message)
    return e.json(500, {
      error: 'Falha ao executar wipe no servidor: ' + (err.message || 'Erro desconhecido'),
    })
  }
})

routerAdd('POST', '/backend/v1/import/process-batch', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Autenticação necessária para importar dados.' })
    }

    const body = e.requestInfo().body || {}
    const rows = body.rows || []
    const startLineNumber = parseInt(body.startLineNumber || '1', 10) || 1

    if (!Array.isArray(rows) || rows.length === 0) {
      return e.json(200, {
        success: true,
        counts: {
          tutorsCreated: 0,
          tutorsReused: 0,
          patientsCreated: 0,
          patientsWithNume: 0,
          patientsWithoutNume: 0,
          clinicalCreated: 0,
          vaccinesCreated: 0,
          appointmentsCreated: 0,
          failed: 0,
        },
        failures: [],
        processedRows: 0,
      })
    }

    // --- HELPERS INTERNOS DE NORMALIZAÇÃO E EXTRAÇÃO ---
    function sanitizeText(val) {
      if (!val) return ''
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

    function stringHash(str) {
      let h = 0x811c9dc5
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = (h * 0x01000193) >>> 0
      }
      return ('0000000' + h.toString(16)).slice(-8)
    }

    function normalizeForHash(val) {
      if (!val) return ''
      return sanitizeText(val).replace(/\s+/g, ' ').trim().toLowerCase()
    }

    function generateClinicalRecordHash(patientId, description) {
      const normDesc = normalizeForHash(description)
      return stringHash('clin:' + patientId + ':' + normDesc)
    }

    function generateAppointmentHash(patientId, date, type, notes) {
      const normDate = (date || '').slice(0, 10)
      const normNotes = normalizeForHash(notes)
      const normType = (type || 'consultation').toLowerCase()
      return stringHash('app:' + patientId + ':' + normDate + ':' + normType + ':' + normNotes)
    }

    function generateVaccineHash(patientId, name, date) {
      const normName = normalizeForHash(name)
      const normDate = date ? String(date).slice(0, 10) : ''
      return stringHash('vac:' + patientId + ':' + normName + ':' + normDate)
    }

    function normalizeDate(val) {
      if (!val) return null
      const clean = sanitizeText(val)
      if (!clean) return null

      if (/^\d{2}\.\d{3}-\d{3}/.test(clean) || /^\d{5}-\d{3}/.test(clean)) {
        return null
      }

      const dmyMatch = clean.match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2,4})/)
      if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10)
        const month = parseInt(dmyMatch[2], 10)
        let year = parseInt(dmyMatch[3], 10)

        if (year < 100) {
          year = year >= 30 ? 1900 + year : 2000 + year
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
          if (!isNaN(d.getTime())) {
            return d.toISOString()
          }
        }
      }

      const ymdMatch = clean.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10)
        const month = parseInt(ymdMatch[2], 10)
        const day = parseInt(ymdMatch[3], 10)
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
          if (!isNaN(d.getTime())) {
            return d.toISOString()
          }
        }
      }

      const parsed = Date.parse(clean)
      if (!isNaN(parsed)) {
        const d = new Date(parsed)
        const year = d.getUTCFullYear()
        if (year >= 1930 && year <= 2100) {
          return d.toISOString()
        }
      }

      return null
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

    function normalizeGender(raw) {
      const clean = sanitizeText(raw).toUpperCase()
      if (clean === 'F' || clean.indexOf('FEM') === 0 || clean.indexOf('FÊM') === 0) {
        return 'Fêmea'
      }
      return 'Macho'
    }

    function normalizeDeceased(vivoRaw, dbtxRaw) {
      const vivo = sanitizeText(vivoRaw).toUpperCase()
      const dbtx = sanitizeText(dbtxRaw).toUpperCase()
      if (vivo === '0' || vivo === 'N' || vivo === 'NAO' || vivo === 'NÃO' || vivo === 'FALSE') {
        return true
      }
      if (
        dbtx.indexOf('OBIT') !== -1 ||
        dbtx.indexOf('ÓBIT') !== -1 ||
        dbtx.indexOf('FALEC') !== -1
      ) {
        return true
      }
      return false
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

    function buildPatientImportKey(baseKey, occurrenceNumber) {
      return baseKey + '#' + (occurrenceNumber || 1)
    }

    function extractClinicalHistory(rawText) {
      const clean = sanitizeText(rawText)
      if (!clean) return []

      const datePattern =
        /(?:^|\r?\n|\s{2,}|[-_.~;:*]{2,}\s*|[.!?]\s+)(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})(?:[.:\-\s_~*/=]*)/g
      const rawMatches = []
      let m

      while ((m = datePattern.exec(clean)) !== null) {
        const fullMatch = m[0]
        const dateStr = m[1]
        const dateIndexInMatch = fullMatch.indexOf(dateStr)
        const matchStart = m.index + (dateIndexInMatch >= 0 ? dateIndexInMatch : 0)
        const contentStart = m.index + fullMatch.length

        const parts = dateStr.split(/[./-]/)
        if (parts.length === 3) {
          const d = parseInt(parts[0], 10)
          const mo = parseInt(parts[1], 10)
          if (d < 1 || d > 31 || mo < 1 || mo > 12) {
            continue
          }
        }

        rawMatches.push({
          dateStr: dateStr,
          matchStart: matchStart,
          contentStart: contentStart,
        })
      }

      const entries = []

      if (rawMatches.length === 0) {
        entries.push({
          date: null,
          rawDateStr: '',
          text: clean,
          timestamp: 0,
        })
        return entries
      }

      if (rawMatches[0].matchStart > 0) {
        const preText = clean.substring(0, rawMatches[0].matchStart).trim()
        const sanitizedPre = preText.replace(/^[-_.:;\s]+|[-_.:;\s]+$/g, '').trim()
        if (sanitizedPre) {
          entries.push({
            date: null,
            rawDateStr: '',
            text: '[Sem data] ' + sanitizedPre,
            timestamp: 0,
          })
        }
      }

      for (let i = 0; i < rawMatches.length; i++) {
        const current = rawMatches[i]
        const nextStart = i + 1 < rawMatches.length ? rawMatches[i + 1].matchStart : clean.length
        let content = clean.substring(current.contentStart, nextStart).trim()
        content = content
          .replace(/^[-_.:;\s]+/, '')
          .replace(/[-_.:;\s]+$/, '')
          .trim()

        const isoDate = normalizeDate(current.dateStr)
        const timestamp = isoDate ? new Date(isoDate).getTime() : 0

        if (!isoDate) {
          const fullText = content
            ? '[Sem data - ref: ' + current.dateStr + '] ' + content
            : '[Sem data - ref: ' + current.dateStr + ']'
          entries.push({
            date: null,
            rawDateStr: current.dateStr,
            text: fullText,
            timestamp: 0,
          })
          continue
        }

        const fullEntryText = content
          ? '[' + current.dateStr + '] ' + content
          : '[' + current.dateStr + ']'
        entries.push({
          date: isoDate,
          rawDateStr: current.dateStr,
          text: fullEntryText,
          timestamp: timestamp,
        })
      }

      entries.sort(function (a, b) {
        if (a.timestamp === 0 && b.timestamp === 0) return 0
        if (a.timestamp === 0) return 1
        if (b.timestamp === 0) return -1
        return a.timestamp - b.timestamp
      })

      return entries
    }

    function detectAppointmentType(text) {
      const upper = (text || '').toUpperCase()
      if (
        upper.indexOf('CIRURG') !== -1 ||
        upper.indexOf('EUTAN') !== -1 ||
        upper.indexOf('CASTRA') !== -1
      ) {
        return 'surgery'
      }
      if (
        upper.indexOf('RET') !== -1 ||
        upper.indexOf('RETORNO') !== -1 ||
        upper.indexOf('REVISAO') !== -1 ||
        upper.indexOf('REVISÃO') !== -1
      ) {
        return 'return'
      }
      if (
        upper.indexOf('VACIN') !== -1 ||
        upper.indexOf('REVACIN') !== -1 ||
        upper.indexOf('TRIPLICE') !== -1 ||
        upper.indexOf('TRÍPLICE') !== -1 ||
        upper.indexOf('RAIVA') !== -1
      ) {
        return 'vaccine'
      }
      return 'consultation'
    }

    function extractAppointments(row, clinicalEntries) {
      const appointments = []
      const recordedDates = {}

      for (let i = 0; i < clinicalEntries.length; i++) {
        const entry = clinicalEntries[i]
        if (!entry.date) continue
        const dateKey = entry.date.slice(0, 10)
        if (recordedDates[dateKey]) continue
        recordedDates[dateKey] = true

        const appType = detectAppointmentType(entry.text)
        const cleanNotes = entry.text.slice(0, 250)
        appointments.push({
          date: entry.date,
          type: appType,
          status: 'completed',
          notes: '[Migração Access] ' + cleanNotes,
          source: 'internal',
        })
      }

      const ultvRaw = sanitizeText(row.ULTV || row.ultv)
      if (ultvRaw) {
        const ultvIso = normalizeDate(ultvRaw)
        if (ultvIso) {
          const ultvKey = ultvIso.slice(0, 10)
          if (!recordedDates[ultvKey]) {
            recordedDates[ultvKey] = true
            appointments.push({
              date: ultvIso,
              type: 'return',
              status: 'completed',
              notes: '[Migração Access] Registro de última visita (ULTV: ' + ultvRaw + ')',
              source: 'internal',
            })
          }
        }
      }

      return appointments
    }

    function extractVaccines(row) {
      const vaccines = []
      for (let i = 1; i <= 5; i++) {
        const dateVal = sanitizeText(row['VAC' + i] || row['vac' + i])
        const textVal = sanitizeText(row['VTX' + i] || row['vtx' + i])
        if (!dateVal && !textVal) continue

        const isoDate = normalizeDate(dateVal)
        const name = textVal || (dateVal ? 'Vacina VAC' + i : 'Vacina')
        vaccines.push({
          date: isoDate,
          rawDate: dateVal,
          name: name,
          notes: dateVal && !isoDate ? 'Data original: ' + dateVal : '',
        })
      }
      return vaccines
    }

    // --- COLEÇÕES E CONTADORES ---
    const tutorsCol = $app.findCollectionByNameOrId('tutors')
    const patientsCol = $app.findCollectionByNameOrId('patients')
    const clinicalCol = $app.findCollectionByNameOrId('clinical_records')
    const vaccinesCol = $app.findCollectionByNameOrId('vaccines')
    const appointmentsCol = $app.findCollectionByNameOrId('appointments')

    const counts = {
      tutorsCreated: 0,
      tutorsReused: 0,
      patientsCreated: 0,
      patientsWithNume: 0,
      patientsWithoutNume: 0,
      clinicalCreated: 0,
      vaccinesCreated: 0,
      appointmentsCreated: 0,
      failed: 0,
    }

    const failures = []
    const processedPatientsThisBatch = {}
    const runOccurrenceCounters = {}
    const todayStartMs = new Date().setHours(0, 0, 0, 0)

    // Execução em transação SQLite atômica
    $app.runInTransaction((txApp) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const fileLineNumber = startLineNumber + i

        const ctrl = sanitizeText(row.CTRL || row.ctrl)
        const nomeTutor = sanitizeText(row.NOME || row.nome)
        const animNome = sanitizeText(row.ANIM || row.anim)

        if (!nomeTutor && !animNome && !ctrl) {
          continue
        }

        try {
          // 1. TUTOR: Busca existente por CPF ou Nome (desduplicação de tutores)
          const cpfRaw = sanitizeText(row.CPF || row.cpf)
          const cleanCpf = (cpfRaw || '').replace(/\D/g, '')
          const tutorDedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)

          let tutorRecord = null
          if (cleanCpf && cleanCpf.length === 11) {
            try {
              tutorRecord = txApp.findFirstRecordByData('tutors', 'cpf', cpfRaw)
            } catch (_) {}
          }
          if (!tutorRecord && nomeTutor) {
            try {
              tutorRecord = txApp.findFirstRecordByData('tutors', 'name', nomeTutor)
            } catch (_) {}
          }

          if (!tutorRecord) {
            const rawEmail = sanitizeText(row.EMAIL || row.email).toLowerCase()
            const validEmail =
              rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ''
            const rawCep = sanitizeText(row.CEP || row.cep)
            const cleanCep = rawCep.replace(/[^\d-]/g, '').slice(0, 9)
            const tel1 = sanitizeText(row.TEL1 || row.tel1)
            const tel2 = sanitizeText(row.TEL2 || row.tel2)
            const tel3 = sanitizeText(row.TEL3 || row.tel3)
            const inst = sanitizeText(row.INST || row.inst)

            const notes = []
            if (tel3) notes.push('Tel 3 / Contato: ' + tel3)
            if (inst) notes.push('Indicação: ' + inst)

            tutorRecord = new Record(tutorsCol)
            tutorRecord.set('name', nomeTutor || 'Tutor Não Informado')
            tutorRecord.set('phone', tel1 || tel2 || '')
            tutorRecord.set('phone_secondary', tel1 && tel2 ? tel2 : '')
            tutorRecord.set('email', validEmail)
            tutorRecord.set('cpf', cpfRaw)
            tutorRecord.set('rg', sanitizeText(row.RG || row.rg))
            tutorRecord.set('address', sanitizeText(row.ENDE || row.ende) || '')
            tutorRecord.set('neighborhood', sanitizeText(row.BAIR || row.bair))
            tutorRecord.set('cep', cleanCep)
            tutorRecord.set('city', sanitizeText(row.CIDA || row.cida))
            tutorRecord.set('state', sanitizeText(row.ESTA || row.esta).slice(0, 2))
            tutorRecord.set('indication', inst)
            tutorRecord.set('additional_info', notes.join(' | '))

            txApp.saveNoValidate(tutorRecord)
            counts.tutorsCreated++
          } else {
            counts.tutorsReused++
          }

          const tutorId = tutorRecord.id

          // 2. PACIENTE: Chave composta, import_key e preenchimento de NUME
          const animalName = animNome || 'Sem nome'
          const espeRaw = row.ESPE || row.espe
          const racaRaw = sanitizeText(row.RACA || row.raca)
          const pelaRaw = sanitizeText(row.PELA || row.pela)
          const sexoRaw = row.SEXO || row.sexo
          const nascRaw = row.NASC || row.nasc
          const chipRaw = sanitizeText(row.CHIP || row.chip)
          const vivoRaw = row.VIVO || row.vivo
          const dbtxRaw = row.DBTX || row.dbtx
          const ultvRaw = row.ULTV || row.ultv
          const dtrgRaw = row.DTRG || row.dtrg
          const nume = sanitizeText(row.NUME || row.nume)

          const baseKey = getPatientCompositeBaseKey({
            tutorDedupeKey: tutorDedupeKey,
            anim: animalName,
            espe: espeRaw,
            nasc: nascRaw,
            pela: pelaRaw,
          })
          const occCount = (runOccurrenceCounters[baseKey] || 0) + 1
          runOccurrenceCounters[baseKey] = occCount
          const importKey = buildPatientImportKey(baseKey, occCount)

          const patientRecord = new Record(patientsCol)
          patientRecord.set('name', animalName)
          patientRecord.set('species', normalizeSpecies(espeRaw))
          patientRecord.set('breed', racaRaw || 'SRD')
          patientRecord.set('gender', normalizeGender(sexoRaw))
          patientRecord.set('birth_date', normalizeDate(nascRaw) || '')
          patientRecord.set('pelagem', pelaRaw)
          patientRecord.set('tutor_id', tutorId)
          patientRecord.set('weight', 0)
          patientRecord.set('ctrl', ctrl || '')
          patientRecord.set('nume', nume || '')
          patientRecord.set('import_key', importKey)
          patientRecord.set('microchip', chipRaw)
          patientRecord.set('deceased', normalizeDeceased(vivoRaw, dbtxRaw))
          patientRecord.set('status_notes', dbtxRaw ? sanitizeText(dbtxRaw) : '')
          patientRecord.set('last_visit', normalizeDate(ultvRaw) || '')
          patientRecord.set('registration_date', normalizeDate(dtrgRaw) || '')

          txApp.saveNoValidate(patientRecord)
          counts.patientsCreated++

          if (nume && nume !== '' && nume !== '0') {
            counts.patientsWithNume++
          } else {
            counts.patientsWithoutNume++
          }

          const patientId = patientRecord.id

          // 3. FICHAS CLÍNICAS, VACINAS E AGENDAMENTOS (com import_hash)
          if (patientId && !processedPatientsThisBatch[patientId]) {
            processedPatientsThisBatch[patientId] = true

            // Fichas Clínicas
            const textoRaw = row.TEXTO || row.texto
            const clinicalEntries = textoRaw ? extractClinicalHistory(textoRaw) : []

            for (let cIdx = 0; cIdx < clinicalEntries.length; cIdx++) {
              const entry = clinicalEntries[cIdx]
              const hash = generateClinicalRecordHash(patientId, entry.text)

              try {
                const clinRec = new Record(clinicalCol)
                clinRec.set('patient_id', patientId)
                clinRec.set('description', entry.text)
                clinRec.set('diagnosis', '')
                clinRec.set('treatment', '')
                clinRec.set('import_hash', hash)
                txApp.saveNoValidate(clinRec)
                counts.clinicalCreated++
              } catch (clinErr) {
                failures.push({
                  linha: fileLineNumber,
                  ctrl: ctrl,
                  tutor: nomeTutor,
                  animal: animNome,
                  tipo: 'clinical_entry',
                  erro: clinErr.message || 'Falha ao gravar ficha clínica',
                  trecho: entry.text.slice(0, 200),
                })
              }
            }

            // Vacinas
            const vaccines = extractVaccines(row)
            for (let vIdx = 0; vIdx < vaccines.length; vIdx++) {
              const vac = vaccines[vIdx]
              const vHash = generateVaccineHash(patientId, vac.name, vac.date)

              try {
                let isCompleted = true
                if (vac.date) {
                  const vacTime = new Date(vac.date).getTime()
                  if (!isNaN(vacTime)) {
                    isCompleted = vacTime < todayStartMs
                  }
                }

                const vacRec = new Record(vaccinesCol)
                vacRec.set('patient_id', patientId)
                vacRec.set('name', vac.name)
                vacRec.set('date', vac.date || '')
                vacRec.set('notes', vac.notes || '')
                vacRec.set('completed', isCompleted)
                vacRec.set('import_hash', vHash)
                txApp.saveNoValidate(vacRec)
                counts.vaccinesCreated++
              } catch (vacErr) {
                failures.push({
                  linha: fileLineNumber,
                  ctrl: ctrl,
                  tutor: nomeTutor,
                  animal: animNome,
                  tipo: 'vaccine',
                  erro: vacErr.message || 'Falha ao gravar vacina',
                  trecho: (vac.name + ' ' + (vac.date || '')).trim(),
                })
              }
            }

            // Agendamentos e Retornos
            const appointments = extractAppointments(row, clinicalEntries)
            for (let aIdx = 0; aIdx < appointments.length; aIdx++) {
              const appItem = appointments[aIdx]
              const aHash = generateAppointmentHash(
                patientId,
                appItem.date,
                appItem.type,
                appItem.notes,
              )

              try {
                const appRec = new Record(appointmentsCol)
                appRec.set('patient_id', patientId)
                appRec.set('date', appItem.date)
                appRec.set('type', appItem.type)
                appRec.set('status', appItem.status)
                appRec.set('notes', appItem.notes)
                appRec.set('source', appItem.source)
                appRec.set('import_hash', aHash)
                txApp.saveNoValidate(appRec)
                counts.appointmentsCreated++
              } catch (appErr) {
                failures.push({
                  linha: fileLineNumber,
                  ctrl: ctrl,
                  tutor: nomeTutor,
                  animal: animNome,
                  tipo: 'appointment',
                  erro: appErr.message || 'Falha ao gravar agendamento',
                  trecho: (appItem.date + ' ' + appItem.notes).slice(0, 200),
                })
              }
            }
          }
        } catch (rowErr) {
          failures.push({
            linha: fileLineNumber,
            ctrl: ctrl,
            tutor: nomeTutor,
            animal: animNome,
            tipo: 'geral',
            erro: rowErr.message || 'Erro ao processar linha',
          })
        }
      }
    })

    counts.failed = failures.length

    return e.json(200, {
      success: failures.length === 0,
      counts: counts,
      failures: failures,
      processedRows: rows.length,
    })
  } catch (err) {
    console.log('Error in process-batch:', err.message)
    return e.json(500, {
      error:
        'Erro no processamento do lote de importação no servidor: ' +
        (err.message || 'Erro desconhecido'),
    })
  }
})
