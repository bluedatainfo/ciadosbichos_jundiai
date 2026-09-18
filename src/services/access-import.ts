import pb from '@/lib/pocketbase/client'
import {
  sanitizeText,
  normalizeDate,
  normalizeSpecies,
  normalizeGender,
  normalizeDeceased,
  extractClinicalHistory,
  extractVaccinesFromRow,
  getTutorDedupeKey,
  getPatientCompositeBaseKey,
  buildPatientImportKey,
} from '@/lib/access-migration-utils'

export interface AccessImportProgress {
  current: number
  total: number
  percent: number
  currentBatch: number
  totalBatches: number
  tutorsCreated: number
  patientsCreated: number
  clinicalEntriesCreated: number
  vaccinesCreated: number
  failed: number
  statusMessage: string
}

export interface AccessBatchError {
  row: number
  ctrl?: string
  tutorName?: string
  animalName?: string
  error: string
}

export interface AccessImportReport {
  success: boolean
  totalProcessed: number
  tutorsCreated: number
  tutorsReused: number
  patientsCreated: number
  patientsSkipped: number
  clinicalEntriesCreated: number
  vaccinesCreated: number
  failed: number
  errors: AccessBatchError[]
  durationSeconds: number
}

export interface AccessImportOptions {
  batchSize?: number
  limit?: number // Para testar com lote pequeno (~50 registros)
  onProgress?: (progress: AccessImportProgress) => void
}

/**
 * Processa linhas do arquivo Access delimitado em lotes com tratamento de dados,
 * desduplicação de tutores (por Nome/CPF) e desduplicação de pacientes (por CTRL e tutor_id + nome).
 */
export async function processAccessImport(
  rawRows: Record<string, string>[],
  options: AccessImportOptions = {},
): Promise<AccessImportReport> {
  const startTime = Date.now()
  const { batchSize = 25, limit, onProgress } = options

  // Se limit for especificado, cortar o conjunto para teste rápido (~50)
  const rowsToProcess = limit && limit > 0 ? rawRows.slice(0, limit) : rawRows
  const total = rowsToProcess.length

  let tutorsCreated = 0
  let tutorsReused = 0
  let patientsCreated = 0
  let patientsSkipped = 0
  let clinicalEntriesCreated = 0
  let vaccinesCreated = 0
  const errors: AccessBatchError[] = []

  // Cache em memória para resolução rápida de desduplicação durante a importação
  // key -> tutor record id
  const tutorIdCache = new Map<string, string>()
  // key (import_key persistida) -> patient record id
  const patientIdCache = new Map<string, string>()

  // Contador de ocorrências por baseKey para a execução atual
  // Ex: baseKey -> número de vezes que essa combinação já apareceu nesta execução (1, 2, 3...)
  const runOccurrenceCounters = new Map<string, number>()

  // Pré-popular cache com tutores existentes no banco (se existirem)
  try {
    const existingTutors = await pb.collection('tutors').getFullList({
      fields: 'id,name,cpf',
    })
    for (const t of existingTutors) {
      const key = getTutorDedupeKey(t.name, t.cpf)
      tutorIdCache.set(key, t.id)
    }
  } catch (err) {
    console.warn('Não foi possível pré-carregar tutores:', err)
  }

  // Pré-popular cache com pacientes existentes indexados por import_key
  try {
    const existingPatients = await pb.collection('patients').getFullList({
      fields: 'id,import_key,name,tutor_id',
    })
    for (const p of existingPatients) {
      const cleanKey = p.import_key ? p.import_key.trim() : ''
      if (cleanKey) {
        patientIdCache.set(cleanKey, p.id)
      }
    }
  } catch (err) {
    console.warn('Não foi possível pré-carregar pacientes:', err)
  }

  const totalBatches = Math.ceil(total / batchSize)

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const startRowIdx = batchIdx * batchSize
    const currentBatch = rowsToProcess.slice(startRowIdx, startRowIdx + batchSize)

    for (let i = 0; i < currentBatch.length; i++) {
      const globalRowIdx = startRowIdx + i
      const row = currentBatch[i]

      // Notificar progresso
      if (onProgress) {
        onProgress({
          current: globalRowIdx + 1,
          total,
          percent: Math.round(((globalRowIdx + 1) / total) * 100),
          currentBatch: batchIdx + 1,
          totalBatches,
          tutorsCreated,
          patientsCreated,
          clinicalEntriesCreated,
          vaccinesCreated,
          failed: errors.length,
          statusMessage: `Processando linha ${globalRowIdx + 1} de ${total}...`,
        })
      }

      const ctrl = sanitizeText(row.CTRL || row.ctrl)
      const nomeTutor = sanitizeText(row.NOME || row.nome)
      const animNome = sanitizeText(row.ANIM || row.anim)

      // Se a linha estiver completamente vazia (sem tutor, sem animal e sem CTRL), registrar no relatório de erros
      if (!nomeTutor && !animNome && !ctrl) {
        errors.push({
          row: globalRowIdx + 1,
          ctrl: undefined,
          tutorName: undefined,
          animalName: undefined,
          error: 'Linha vazia ou sem identificadores (NOME, ANIM e CTRL ausentes).',
        })
        continue
      }

      try {
        // -------------------------------------------------------------
        // 1. TUTOR: Desduplicação por NOME e/ou CPF
        // -------------------------------------------------------------
        const cpfRaw = sanitizeText(row.CPF || row.cpf)
        const rg = sanitizeText(row.RG || row.rg)
        const email = sanitizeText(row.EMAIL || row.email).toLowerCase()
        const ende = sanitizeText(row.ENDE || row.ende)
        const nume = sanitizeText(row.NUME || row.nume)
        const address = ende ? (nume ? `${ende}, ${nume}` : ende) : nume || ''
        const bair = sanitizeText(row.BAIR || row.bair)
        const rawCep = sanitizeText(row.CEP || row.cep)
        // Limpar CEP caso venha sujo ou com letras
        const cleanCep = rawCep.replace(/[^\d-]/g, '').slice(0, 9)
        const cida = sanitizeText(row.CIDA || row.cida)
        const esta = sanitizeText(row.ESTA || row.esta).slice(0, 2)
        const tel1 = sanitizeText(row.TEL1 || row.tel1)
        const tel2 = sanitizeText(row.TEL2 || row.tel2)
        const tel3 = sanitizeText(row.TEL3 || row.tel3)
        const inst = sanitizeText(row.INST || row.inst)

        // Anotações adicionais do tutor (TEL3, observações de contato, indicação)
        const tutorNotes: string[] = []
        if (tel3) tutorNotes.push(`Tel 3 / Contato: ${tel3}`)
        if (inst) tutorNotes.push(`Indicação: ${inst}`)
        const additionalInfo = tutorNotes.join(' | ')

        const dedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)
        let tutorId = tutorIdCache.get(dedupeKey)

        if (!tutorId) {
          // Criar novo tutor
          // Se email for inválido, não enviar para não quebrar validação de email do PB
          const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''

          const tutorRecord = await pb.collection('tutors').create({
            name: nomeTutor || 'Tutor Não Informado',
            phone: tel1 || tel2 || '',
            phone_secondary: tel1 && tel2 ? tel2 : '',
            email: validEmail,
            cpf: cpfRaw,
            rg,
            address,
            neighborhood: bair,
            cep: cleanCep,
            city: cida,
            state: esta,
            indication: inst,
            additional_info: additionalInfo,
          })
          tutorId = tutorRecord.id
          tutorIdCache.set(dedupeKey, tutorId)
          tutorsCreated++
        } else {
          tutorsReused++
        }

        // -------------------------------------------------------------
        // 2. PACIENTE (ANIMAL): Desduplicação por Chave Composta
        // Chave: tutor + ANIM + ESPE (+ NASC e PELA quando existirem)
        // com contador de ocorrências sequencial por linha.
        // Colisões exatas no arquivo criam pacientes separados (#1, #2, ...),
        // e reimportar o mesmo lote reconhece a chave exata (#1, #2, ...) já gravada,
        // evitando duplicatas.
        // -------------------------------------------------------------
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

        // Montar a base da chave composta
        const baseKey = getPatientCompositeBaseKey({
          tutorDedupeKey: dedupeKey,
          anim: animalName,
          espe: espeRaw,
          nasc: nascRaw,
          pela: pelaRaw,
        })

        // Incrementar o contador de ocorrências desta baseKey na execução atual
        const currentCount = (runOccurrenceCounters.get(baseKey) || 0) + 1
        runOccurrenceCounters.set(baseKey, currentCount)

        // Chave composta final com o contador de ocorrência (ex: "name:joao|mel|canino|nasc:01021990#1")
        const importKey = buildPatientImportKey(baseKey, currentCount)

        let patientId = patientIdCache.get(importKey)

        if (!patientId) {
          const species = normalizeSpecies(espeRaw)
          const gender = normalizeGender(sexoRaw)
          const birthDate = normalizeDate(nascRaw)
          const deceased = normalizeDeceased(vivoRaw, dbtxRaw)
          const lastVisit = normalizeDate(ultvRaw)
          const registrationDate = normalizeDate(dtrgRaw)

          const patientRecord = await pb.collection('patients').create({
            name: animalName,
            species,
            breed: racaRaw || 'SRD',
            gender,
            birth_date: birthDate || '',
            pelagem: pelaRaw,
            tutor_id: tutorId,
            weight: 0,
            ctrl,
            import_key: importKey,
            microchip: chipRaw,
            deceased,
            status_notes: dbtxRaw ? sanitizeText(dbtxRaw) : '',
            last_visit: lastVisit || '',
            registration_date: registrationDate || '',
          })

          patientId = patientRecord.id
          patientIdCache.set(importKey, patientId)
          patientsCreated++
        } else {
          patientsSkipped++
        }

        // -------------------------------------------------------------
        // 3. HISTÓRICO CLÍNICO (TEXTO separado em entradas individuais)
        // -------------------------------------------------------------
        const textoRaw = row.TEXTO || row.texto
        if (textoRaw && patientId) {
          const clinicalEntries = extractClinicalHistory(textoRaw)
          for (const entry of clinicalEntries) {
            try {
              // PocketBase created date can be passed or we set description com a data
              await pb.collection('clinical_records').create({
                patient_id: patientId,
                description: entry.text,
                diagnosis: '',
                treatment: '',
              })
              clinicalEntriesCreated++
            } catch (recErr) {
              console.warn('Erro ao criar registro clínico:', recErr)
            }
          }
        }

        // -------------------------------------------------------------
        // 4. HISTÓRICO DE VACINAÇÃO (VAC1-VAC5 + VTX1-VTX5)
        // -------------------------------------------------------------
        if (patientId) {
          const vaccines = extractVaccinesFromRow(row)
          for (const vac of vaccines) {
            try {
              await pb.collection('vaccines').create({
                patient_id: patientId,
                name: vac.name,
                date: vac.date || '',
                notes: vac.notes || '',
              })
              vaccinesCreated++
            } catch (vacErr) {
              console.warn('Erro ao criar vacina:', vacErr)
            }
          }
        }
      } catch (err: any) {
        const errMsg = err?.response?.data
          ? Object.entries(err.response.data)
              .map(([k, v]: [string, any]) => `${k}: ${v.message || JSON.stringify(v)}`)
              .join('; ')
          : err?.message || 'Erro desconhecido'

        errors.push({
          row: globalRowIdx + 1,
          ctrl,
          tutorName: nomeTutor,
          animalName: animNome,
          error: errMsg,
        })
      }
    }

    // Pequena pausa assíncrona entre lotes para não congelar o browser UI thread
    await new Promise((resolve) => setTimeout(resolve, 30))
  }

  const durationSeconds = Math.round((Date.now() - startTime) / 1000)

  return {
    success: errors.length === 0,
    totalProcessed: total,
    tutorsCreated,
    tutorsReused,
    patientsCreated,
    patientsSkipped,
    clinicalEntriesCreated,
    vaccinesCreated,
    failed: errors.length,
    errors,
    durationSeconds,
  }
}
