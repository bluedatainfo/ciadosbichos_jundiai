/**
 * pb_hooks/incremental_sync_batch.js
 *
 * Endpoint de backend para aplicação rápida e atômica de lotes da Sincronização Incremental.
 * Executa as comparações e gravações diretamente no banco PocketBase ($app / SQLite),
 * eliminando as centenas de requisições HTTP individuais por registro, livrando-se
 * dos erros 429 ("Too Many Requests") e backoffs do navegador.
 *
 * Regras de negócio preservadas integralmente:
 * 1. "Vale o do arquivo":
 *    - Tutor ou Paciente já existente com dados diferentes -> atualizado com dados oficiais
 *    - Gera registro na tabela `audit_logs` com diff de campo a campo (anterior -> novo)
 * 2. Correspondência estrita de paciente:
 *    - NUME > CTRL (ignora '0') > import_key
 * 3. Fichas clínicas, vacinas e agendamentos:
 *    - Comparados por hash de conteúdo (import_hash)
 *    - Hash idêntico -> pula
 *    - Inexistente -> grava
 * 4. Deduplicação e proteção:
 *    - Reexecução após interrupção pula registros já gravados sem duplicar nada
 *    - Registros apenas no sistema são mantidos intactos
 */

routerAdd('POST', '/backend/v1/sync/apply-batch', (e) => {
  try {
    const authRecord = e.auth
    if (!authRecord || !authRecord.id) {
      return e.json(401, { error: 'Autenticação necessária para executar sincronização.' })
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
          tutorsCreated: 0,
          tutorsUpdated: 0,
          tutorsSkipped: 0,
          patientsCreated: 0,
          patientsUpdated: 0,
          patientsSkipped: 0,
          clinicalCreated: 0,
          clinicalSkipped: 0,
          vaccinesCreated: 0,
          vaccinesSkipped: 0,
          appointmentsCreated: 0,
          appointmentsSkipped: 0,
          auditsLogged: 0,
          failed: 0,
        },
        failures: [],
      })
    }

    // --- HELPERS INTERNOS GOJA-COMPATÍVEIS ---

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

    function mapTutorFromRow(row, nomeTutor, cpfRaw) {
      const rg = sanitizeText(row.RG || row.rg)
      const rawEmail = sanitizeText(row.EMAIL || row.email).toLowerCase()
      const validEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ''
      const address = sanitizeText(row.ENDE || row.ende) || ''
      const neighborhood = sanitizeText(row.BAIR || row.bair)
      const rawCep = sanitizeText(row.CEP || row.cep)
      const cleanCep = rawCep.replace(/[^\d-]/g, '').slice(0, 9)
      const city = sanitizeText(row.CIDA || row.cida)
      const state = sanitizeText(row.ESTA || row.esta).slice(0, 2)
      const tel1 = sanitizeText(row.TEL1 || row.tel1)
      const tel2 = sanitizeText(row.TEL2 || row.tel2)
      const tel3 = sanitizeText(row.TEL3 || row.tel3)
      const indication = sanitizeText(row.INST || row.inst)

      const notes = []
      if (tel3) notes.push('Tel 3 / Contato: ' + tel3)
      if (indication) notes.push('Indicação: ' + indication)

      return {
        name: nomeTutor || 'Tutor Não Informado',
        phone: tel1 || tel2 || '',
        phone_secondary: tel1 && tel2 ? tel2 : '',
        email: validEmail,
        cpf: cpfRaw,
        rg: rg,
        address: address,
        neighborhood: neighborhood,
        cep: cleanCep,
        city: city,
        state: state,
        indication: indication,
        additional_info: notes.join(' | '),
      }
    }

    function mapPatientFromRow(row, animalName, tutorId, importKey, ctrl, existingNume) {
      const nume = sanitizeText(row.NUME || row.nume) || existingNume || ''
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

      return {
        name: animalName,
        species: normalizeSpecies(espeRaw),
        breed: racaRaw || 'SRD',
        gender: normalizeGender(sexoRaw),
        birth_date: normalizeDate(nascRaw) || '',
        pelagem: pelaRaw,
        tutor_id: tutorId,
        weight: 0,
        ctrl: ctrl || '',
        nume: nume,
        import_key: importKey,
        microchip: chipRaw,
        deceased: normalizeDeceased(vivoRaw, dbtxRaw),
        status_notes: dbtxRaw ? sanitizeText(dbtxRaw) : '',
        last_visit: normalizeDate(ultvRaw) || '',
        registration_date: normalizeDate(dtrgRaw) || '',
      }
    }

    function computeTutorDiff(existingTutor, fileData) {
      const diff = {}
      const labels = {
        name: 'Nome',
        phone: 'Telefone Principal',
        phone_secondary: 'Telefone Secundário',
        email: 'E-mail',
        cpf: 'CPF',
        rg: 'RG',
        address: 'Endereço',
        neighborhood: 'Bairro',
        cep: 'CEP',
        city: 'Cidade',
        state: 'UF',
        indication: 'Indicação',
        additional_info: 'Informações Adicionais',
      }
      for (const field in labels) {
        const oldVal = (existingTutor.getString(field) || '').trim()
        const newVal = (fileData[field] || '').trim()
        if (oldVal !== newVal) {
          diff[field] = {
            label: labels[field],
            oldValue: oldVal,
            newValue: newVal,
          }
        }
      }
      return diff
    }

    function computePatientDiff(existingPatient, fileData) {
      const diff = {}
      const labels = {
        name: 'Nome do Animal',
        nume: 'Nº Oficial (NUME)',
        ctrl: 'Código CTRL',
        species: 'Espécie',
        breed: 'Raça',
        gender: 'Sexo',
        birth_date: 'Data de Nascimento',
        pelagem: 'Pelagem',
        microchip: 'Microchip',
        deceased: 'Óbito',
        status_notes: 'Observações de Status',
        last_visit: 'Última Visita',
        registration_date: 'Data de Registro',
      }

      for (const field in labels) {
        if (field === 'deceased') {
          const oldBool = Boolean(existingPatient.getBool('deceased'))
          const newBool = Boolean(fileData.deceased)
          if (oldBool !== newBool) {
            diff[field] = {
              label: labels[field],
              oldValue: oldBool ? 'Sim (Óbito)' : 'Não (Vivo)',
              newValue: newBool ? 'Sim (Óbito)' : 'Não (Vivo)',
            }
          }
          continue
        }

        let oldVal = (existingPatient.getString(field) || '').trim()
        let newVal = (fileData[field] || '').trim()

        if (
          field.indexOf('date') !== -1 ||
          field === 'last_visit' ||
          field === 'registration_date'
        ) {
          if (oldVal) oldVal = oldVal.slice(0, 10)
          if (newVal) newVal = newVal.slice(0, 10)
        }

        if (oldVal !== newVal) {
          diff[field] = {
            label: labels[field],
            oldValue: oldVal,
            newValue: newVal,
          }
        }
      }
      return diff
    }

    // --- EXECUÇÃO DO LOTE COM ATOMICIDADE E EFICIÊNCIA ---

    const tutorsCol = $app.findCollectionByNameOrId('tutors')
    const patientsCol = $app.findCollectionByNameOrId('patients')
    const clinicalCol = $app.findCollectionByNameOrId('clinical_records')
    const vaccinesCol = $app.findCollectionByNameOrId('vaccines')
    const appointmentsCol = $app.findCollectionByNameOrId('appointments')
    const auditCol = $app.findCollectionByNameOrId('audit_logs')

    const counts = {
      tutorsCreated: 0,
      tutorsUpdated: 0,
      tutorsSkipped: 0,
      patientsCreated: 0,
      patientsUpdated: 0,
      patientsSkipped: 0,
      clinicalCreated: 0,
      clinicalSkipped: 0,
      vaccinesCreated: 0,
      vaccinesSkipped: 0,
      appointmentsCreated: 0,
      appointmentsSkipped: 0,
      auditsLogged: 0,
      failed: 0,
    }

    const failures = []
    const processedPatientsThisBatch = {}
    const runOccurrenceCounters = {}
    const todayStartMs = new Date().setHours(0, 0, 0, 0)

    // Executar todo o lote em uma transação do SQLite para máxima velocidade
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
          // -------------------------------------------------------------
          // 1. TUTOR: "Vale o do arquivo" + Auditoria
          // -------------------------------------------------------------
          const cpfRaw = sanitizeText(row.CPF || row.cpf)
          const tutorDedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)
          const fileTutorData = mapTutorFromRow(row, nomeTutor, cpfRaw)

          let tutorRecord = null
          const cleanCpf = (cpfRaw || '').replace(/\D/g, '')

          // Buscar tutor existente: por CPF (se 11 dígitos) ou por Nome
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
            tutorRecord = new Record(tutorsCol)
            for (const f in fileTutorData) {
              tutorRecord.set(f, fileTutorData[f])
            }
            txApp.saveNoValidate(tutorRecord)
            counts.tutorsCreated++
          } else {
            const diff = computeTutorDiff(tutorRecord, fileTutorData)
            if (Object.keys(diff).length > 0) {
              for (const f in fileTutorData) {
                tutorRecord.set(f, fileTutorData[f])
              }
              txApp.saveNoValidate(tutorRecord)
              counts.tutorsUpdated++

              // Gerar log de auditoria
              const auditRec = new Record(auditCol)
              auditRec.set('user_id', currentUser.id)
              auditRec.set('user_name', currentUser.name)
              auditRec.set('user_email', currentUser.email)
              auditRec.set('user_role', currentUser.role)
              auditRec.set('action', 'update')
              auditRec.set('module', 'tutors')
              auditRec.set('record_id', tutorRecord.id)
              auditRec.set('record_label', nomeTutor || 'Tutor')
              auditRec.set('tutor_name', nomeTutor)
              auditRec.set('changes', JSON.stringify(diff))
              auditRec.set(
                'details',
                'Sincronização incremental: dados restaurados da base oficial ("vale o do arquivo").',
              )
              txApp.saveNoValidate(auditRec)
              counts.auditsLogged++
            } else {
              counts.tutorsSkipped++
            }
          }

          const tutorId = tutorRecord.id

          // -------------------------------------------------------------
          // 2. PACIENTE: "Vale o do arquivo" + Auditoria
          // Ordem de correspondência estrita: NUME > CTRL (ignora '0') > import_key
          // -------------------------------------------------------------
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
          const importKey = buildPatientImportKey(baseKey, occCount)

          const nume = sanitizeText(row.NUME || row.nume)
          let patientRecord = null

          // Prioridade 1: NUME
          if (nume) {
            try {
              patientRecord = txApp.findFirstRecordByData('patients', 'nume', nume)
            } catch (_) {}
          }
          // Prioridade 2: CTRL (ignorando '0')
          if (!patientRecord && ctrl && ctrl !== '0') {
            try {
              patientRecord = txApp.findFirstRecordByData('patients', 'ctrl', ctrl)
            } catch (_) {}
          }
          // Prioridade 3: import_key
          if (!patientRecord && importKey) {
            try {
              patientRecord = txApp.findFirstRecordByData('patients', 'import_key', importKey)
            } catch (_) {}
          }

          const existingNume = patientRecord ? patientRecord.getString('nume') : ''
          const filePatientData = mapPatientFromRow(
            row,
            animalName,
            tutorId,
            importKey,
            ctrl,
            existingNume,
          )

          if (!patientRecord) {
            patientRecord = new Record(patientsCol)
            for (const pf in filePatientData) {
              patientRecord.set(pf, filePatientData[pf])
            }
            txApp.saveNoValidate(patientRecord)
            counts.patientsCreated++
          } else {
            const pDiff = computePatientDiff(patientRecord, filePatientData)
            if (Object.keys(pDiff).length > 0) {
              for (const pf in filePatientData) {
                patientRecord.set(pf, filePatientData[pf])
              }
              txApp.saveNoValidate(patientRecord)
              counts.patientsUpdated++

              // Gerar log de auditoria do paciente
              const auditPRec = new Record(auditCol)
              auditPRec.set('user_id', currentUser.id)
              auditPRec.set('user_name', currentUser.name)
              auditPRec.set('user_email', currentUser.email)
              auditPRec.set('user_role', currentUser.role)
              auditPRec.set('action', 'update')
              auditPRec.set('module', 'patients')
              auditPRec.set('record_id', patientRecord.id)
              auditPRec.set('record_label', animalName)
              auditPRec.set('patient_name', animalName)
              auditPRec.set('tutor_name', nomeTutor)
              auditPRec.set('changes', JSON.stringify(pDiff))
              auditPRec.set(
                'details',
                'Sincronização incremental: dados restaurados da base oficial ("vale o do arquivo").',
              )
              txApp.saveNoValidate(auditPRec)
              counts.auditsLogged++
            } else {
              counts.patientsSkipped++
            }
          }

          const patientId = patientRecord.id

          // -------------------------------------------------------------
          // 3. FICHAS CLÍNICAS, VACINAS E RETORNOS (por import_hash)
          // -------------------------------------------------------------
          if (patientId && !processedPatientsThisBatch[patientId]) {
            processedPatientsThisBatch[patientId] = true

            // Fichas Clínicas
            const textoRaw = row.TEXTO || row.texto
            const clinicalEntries = textoRaw ? extractClinicalHistory(textoRaw) : []

            for (let cIdx = 0; cIdx < clinicalEntries.length; cIdx++) {
              const entry = clinicalEntries[cIdx]
              const hash = generateClinicalRecordHash(patientId, entry.text)

              let existingClin = null
              try {
                existingClin = txApp.findFirstRecordByData('clinical_records', 'import_hash', hash)
              } catch (_) {}

              if (existingClin) {
                counts.clinicalSkipped++
              } else {
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
            }

            // Vacinas
            const vaccines = extractVaccines(row)
            for (let vIdx = 0; vIdx < vaccines.length; vIdx++) {
              const vac = vaccines[vIdx]
              const vHash = generateVaccineHash(patientId, vac.name, vac.date)

              let existingVac = null
              try {
                existingVac = txApp.findFirstRecordByData('vaccines', 'import_hash', vHash)
              } catch (_) {}

              if (existingVac) {
                counts.vaccinesSkipped++
              } else {
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
            }

            // Agendamentos / Retornos
            const appointments = extractAppointments(row, clinicalEntries)
            for (let aIdx = 0; aIdx < appointments.length; aIdx++) {
              const appItem = appointments[aIdx]
              const aHash = generateAppointmentHash(
                patientId,
                appItem.date,
                appItem.type,
                appItem.notes,
              )

              let existingApp = null
              try {
                existingApp = txApp.findFirstRecordByData('appointments', 'import_hash', aHash)
              } catch (_) {}

              if (existingApp) {
                counts.appointmentsSkipped++
              } else {
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
    console.log('Error in incremental_sync_batch:', err.message)
    return e.json(500, {
      error: 'Erro no processamento do lote no servidor: ' + (err.message || 'Erro desconhecido'),
    })
  }
})
