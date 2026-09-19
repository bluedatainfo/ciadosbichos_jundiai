import pb from '@/lib/pocketbase/client'
import {
  sanitizeText,
  normalizeDate,
  normalizeSpecies,
  normalizeGender,
  normalizeDeceased,
  extractClinicalHistoryWithDiagnostics,
  extractVaccinesFromRow,
  extractAppointmentsFromRow,
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
  appointmentsCreated: number
  failed: number
  statusMessage: string
}

export interface AccessBatchError {
  row: number
  ctrl?: string
  tutorName?: string
  animalName?: string
  error: string
  problematicSnippet?: string
  type?: 'database_error' | 'parser_warning' | 'validation_error'
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
  appointmentsCreated: number
  failed: number
  errors: AccessBatchError[]
  durationSeconds: number
}

export interface AccessImportOptions {
  batchSize?: number
  limit?: number // Para testar com lote pequeno (~50 registros)
  itemDelayMs?: number // Intervalo sequencial entre cada gravação no banco (padrão: 120ms)
  maxRetries?: number // Número máximo de tentativas em caso de erro 429 Too Many Requests (padrão: 3)
  retryBackoffMs?: number[] // Tempos de backoff para retries (padrão: [500, 1000, 2000])
  onProgress?: (progress: AccessImportProgress) => void
}

/**
 * Constantes de ritmo e retry para blindagem contra Too Many Requests (PocketBase HTTP 429)
 */
export const DEFAULT_ITEM_DELAY_MS = 120
export const DEFAULT_MAX_RETRIES = 3
export const DEFAULT_RETRY_BACKOFF_MS = [500, 1000, 2000]

/**
 * Verifica se um erro retornado pelo PocketBase ou pela rede é indicativo de rate limit (429 Too Many Requests).
 */
export function isRateLimitError(err: any): boolean {
  if (!err) return false
  if (err.status === 429) return true
  if (err.response?.status === 429) return true
  if (err.statusCode === 429) return true
  const msg = (err.message || '').toLowerCase()
  return msg.includes('too many requests') || msg.includes('rate limit') || msg.includes('429')
}

/**
 * Executa uma operação assíncrona com enfileiramento sequencial ritmado
 * e retry com backoff exponencial específico para HTTP 429 (Too Many Requests).
 *
 * @param operation Função que executa a gravação
 * @param options Configurações de delay, retries e backoff
 */
export async function executeWithRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: {
    itemDelayMs?: number
    maxRetries?: number
    retryBackoffMs?: number[]
    onRetry?: (attempt: number, delayMs: number, error: any) => void
  } = {},
): Promise<T> {
  const itemDelayMs = options.itemDelayMs ?? DEFAULT_ITEM_DELAY_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryBackoffMs = options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS

  let attempt = 0

  while (true) {
    try {
      const result = await operation()

      // Ritmo sequencial: pequeno intervalo após cada gravação bem-sucedida para não saturar o servidor
      if (itemDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, itemDelayMs))
      }

      return result
    } catch (err: any) {
      if (isRateLimitError(err) && attempt < maxRetries) {
        const backoffDelay = retryBackoffMs[attempt] || 1000 * Math.pow(2, attempt)
        attempt++
        if (options.onRetry) {
          options.onRetry(attempt, backoffDelay, err)
        }
        await new Promise((resolve) => setTimeout(resolve, backoffDelay))
        continue
      }

      // Se não for 429 ou esgotou as tentativas, propaga o erro
      throw err
    }
  }
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
  const {
    batchSize = 25,
    limit,
    itemDelayMs = DEFAULT_ITEM_DELAY_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
    onProgress,
  } = options

  // Helper local para executar gravações com o ritmo e retry configurados
  const safeDbWrite = <T>(op: () => Promise<T>) =>
    executeWithRateLimitRetry(op, {
      itemDelayMs,
      maxRetries,
      retryBackoffMs,
    })

  // Se limit for especificado, cortar o conjunto para teste rápido (~50)
  const rowsToProcess = limit && limit > 0 ? rawRows.slice(0, limit) : rawRows
  const total = rowsToProcess.length

  let tutorsCreated = 0
  let tutorsReused = 0
  let patientsCreated = 0
  let patientsSkipped = 0
  let clinicalEntriesCreated = 0
  let vaccinesCreated = 0
  let appointmentsCreated = 0
  const errors: AccessBatchError[] = []

  // Cache em memória para resolução rápida de desduplicação durante a importação
  // key -> tutor record id
  const tutorIdCache = new Map<string, string>()
  // key (import_key persistida) -> patient record id
  // ATENÇÃO: NÃO reaproveitar pacientes de importações legadas anteriores
  // se o objetivo for garantir isolamento estrito por linha.
  // Indexamos por import_key apenas os pacientes criados ou carregados nesta execução.
  const patientIdCache = new Map<string, string>()

  // Conjunto de IDs de pacientes que já receberam histórico nesta execução,
  // garantindo blindagem contra inserção duplicada acidental.
  const processedPatientIdsThisRun = new Set<string>()

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
          appointmentsCreated,
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

          const tutorRecord = await safeDbWrite(() =>
            pb.collection('tutors').create({
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
            }),
          )
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

          const patientRecord = await safeDbWrite(() =>
            pb.collection('patients').create({
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
            }),
          )

          patientId = patientRecord.id
          patientIdCache.set(importKey, patientId)
          patientsCreated++
        } else {
          patientsSkipped++
        }

        // -------------------------------------------------------------
        // 3. HISTÓRICO CLÍNICO (TEXTO separado em entradas individuais)
        // Cada entrada do TEXTO é vinculada EXCLUSIVAMENTE ao paciente
        // desta linha (rowPatientId). Se o paciente já existia antes
        // da execução atual, não duplicamos as fichas.
        // Entradas sem data reconhecível são gravadas como 'sem data',
        // nunca descartadas. Falhas e trechos problemáticos são
        // registrados no relatório de erros com o trecho e a linha.
        // -------------------------------------------------------------
        const rowPatientId = patientId
        const textoRaw = row.TEXTO || row.texto
        const extraction = textoRaw
          ? extractClinicalHistoryWithDiagnostics(textoRaw)
          : { entries: [], warnings: [] }
        const clinicalEntries = extraction.entries

        // Registrar avisos de parsing no relatório para visibilidade do operador
        if (extraction.warnings.length > 0) {
          for (const warning of extraction.warnings) {
            errors.push({
              row: globalRowIdx + 1,
              ctrl,
              tutorName: nomeTutor,
              animalName: animNome,
              error: `Aviso no histórico clínico: ${warning}`,
              problematicSnippet: warning,
              type: 'parser_warning',
            })
          }
        }

        if (rowPatientId && !processedPatientIdsThisRun.has(rowPatientId)) {
          processedPatientIdsThisRun.add(rowPatientId)

          if (clinicalEntries.length > 0) {
            for (const entry of clinicalEntries) {
              try {
                await safeDbWrite(() =>
                  pb.collection('clinical_records').create({
                    patient_id: rowPatientId,
                    description: entry.text,
                    diagnosis: '',
                    treatment: '',
                  }),
                )
                clinicalEntriesCreated++
              } catch (recErr: any) {
                console.warn('Erro ao criar registro clínico após retries:', recErr)
                errors.push({
                  row: globalRowIdx + 1,
                  ctrl,
                  tutorName: nomeTutor,
                  animalName: animNome,
                  error: `Falha ao gravar entrada clínica: ${recErr?.message || 'Erro desconhecido'}`,
                  problematicSnippet: entry.text.slice(0, 150),
                  type: 'database_error',
                })
              }
            }
          }

          // -------------------------------------------------------------
          // 4. HISTÓRICO DE VACINAÇÃO (VAC1-VAC5 + VTX1-VTX5)
          // Vinculado estritamente a rowPatientId
          // -------------------------------------------------------------
          const vaccines = extractVaccinesFromRow(row)
          for (const vac of vaccines) {
            try {
              await safeDbWrite(() =>
                pb.collection('vaccines').create({
                  patient_id: rowPatientId,
                  name: vac.name,
                  date: vac.date || '',
                  notes: vac.notes || '',
                }),
              )
              vaccinesCreated++
            } catch (vacErr: any) {
              console.warn('Erro ao criar vacina após retries:', vacErr)
              errors.push({
                row: globalRowIdx + 1,
                ctrl,
                tutorName: nomeTutor,
                animalName: animNome,
                error: `Falha ao gravar vacina: ${vacErr?.message || 'Erro desconhecido'}`,
                problematicSnippet: `${vac.name} ${vac.date || ''}`.trim(),
                type: 'database_error',
              })
            }
          }

          // -------------------------------------------------------------
          // 5. RETORNOS E AGENDAMENTOS HISTÓRICOS (appointments)
          // Extraídos a partir das datas do TEXTO e ULTV da linha atual,
          // vinculados estritamente ao paciente rowPatientId desta linha.
          // -------------------------------------------------------------
          const legacyAppointments = extractAppointmentsFromRow(row, clinicalEntries)
          for (const appItem of legacyAppointments) {
            try {
              await safeDbWrite(() =>
                pb.collection('appointments').create({
                  patient_id: rowPatientId,
                  date: appItem.date,
                  type: appItem.type,
                  status: appItem.status,
                  notes: appItem.notes,
                  source: appItem.source,
                }),
              )
              appointmentsCreated++
            } catch (appErr: any) {
              console.warn('Erro ao criar agendamento legado após retries:', appErr)
              errors.push({
                row: globalRowIdx + 1,
                ctrl,
                tutorName: nomeTutor,
                animalName: animNome,
                error: `Falha ao gravar agendamento: ${appErr?.message || 'Erro desconhecido'}`,
                problematicSnippet: `${appItem.date} ${appItem.notes}`.slice(0, 150),
                type: 'database_error',
              })
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
    appointmentsCreated,
    failed: errors.length,
    errors,
    durationSeconds,
  }
}
