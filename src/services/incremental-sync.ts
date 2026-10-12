/**
 * Serviço de Sincronização Incremental da Base Oficial Access -> Skip Cloud
 *
 * Princípios e Requisitos:
 * (1) Tutores e Pacientes: comparados por CTRL campo a campo (ou por chave de deduplicação).
 *     - Idêntico -> Pular
 *     - Existente com dados diferentes -> Atualizar com o valor do arquivo ("vale o do arquivo"),
 *       registrando na auditoria cada substituição com valor anterior e novo.
 *     - Não existente -> Importar completo.
 * (2) Ficha clínica, Agendamentos, Vacinações: comparados por hash do conteúdo da linha
 *     (paciente + data + conteúdo).
 *     - Hash idêntico -> Pular
 *     - Inexistente -> Importar completo
 *     - Registros existentes no banco mas ausentes no arquivo -> MANTIDOS e apenas contabilizados/listados (nunca apagar).
 * (3) Baixar apenas dados leves de comparação (páginas com campos de identificação)
 *     sem carregar coleções inteiras com todos os campos pesados.
 * (4) Throttling de gravação e retry progressivo em caso de Too Many Requests (429).
 * (5) Relatório de balanceamento prévio (antes de aplicar) e relatório do resultado final.
 * (6) Pausa e retomada sem perda de estado.
 */

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
import {
  generateClinicalRecordHash,
  generateAppointmentHash,
  generateVaccineHash,
} from '@/lib/sync-hash-utils'
import { auditService, FieldDiff } from '@/services/audit'
import {
  executeWithRateLimitRetry,
  DEFAULT_ITEM_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
} from './access-import'

export interface SyncBalanceSummary {
  // Tutores
  tutorsIdentical: number
  tutorsToUpdate: number
  tutorsNew: number
  tutorsOnlyInSystem: number

  // Pacientes
  patientsIdentical: number
  patientsToUpdate: number
  patientsNew: number
  patientsOnlyInSystem: number

  // Clínicos
  clinicalIdentical: number
  clinicalNew: number
  clinicalOnlyInSystem: number

  // Vacinas
  vaccinesIdentical: number
  vaccinesNew: number
  vaccinesOnlyInSystem: number

  // Agendamentos / Retornos
  appointmentsIdentical: number
  appointmentsNew: number
  appointmentsOnlyInSystem: number

  // Total de linhas analisadas
  totalRowsAnalyzed: number
}

export interface SyncProgress {
  phase: 'analyzing' | 'applying' | 'completed' | 'paused'
  current: number
  total: number
  percent: number
  statusMessage: string

  // Contadores de aplicação
  tutorsCreated: number
  tutorsUpdated: number
  tutorsSkipped: number

  patientsCreated: number
  patientsUpdated: number
  patientsSkipped: number

  clinicalCreated: number
  clinicalSkipped: number

  vaccinesCreated: number
  vaccinesSkipped: number

  appointmentsCreated: number
  appointmentsSkipped: number

  failed: number
  auditsLogged: number
}

export interface SyncFailureDetail {
  linha: number
  ctrl?: string
  tutor?: string
  animal?: string
  tipo: string
  erro: string
  trecho?: string
}

export interface SyncResultReport {
  success: boolean
  durationSeconds: number
  totalRows: number
  balance: SyncBalanceSummary
  applied: {
    tutorsCreated: number
    tutorsUpdated: number
    tutorsSkipped: number
    patientsCreated: number
    patientsUpdated: number
    patientsSkipped: number
    clinicalCreated: number
    clinicalSkipped: number
    vaccinesCreated: number
    vaccinesSkipped: number
    appointmentsCreated: number
    appointmentsSkipped: number
    auditsLogged: number
    failed: number
  }
  failures: SyncFailureDetail[]
}

export interface SyncOptions {
  batchSize?: number
  itemDelayMs?: number
  maxRetries?: number
  retryBackoffMs?: number[]
  startIndex?: number
  endIndex?: number
  onProgress?: (progress: SyncProgress) => void
  shouldPause?: () => boolean
}

// Chave para persistência local do progresso de sincronização
const SYNC_PROGRESS_STORAGE_KEY = 'vet_incremental_sync_state'

export interface PersistedSyncState {
  fileName: string
  totalRows: number
  lastProcessedLine: number
  balance: SyncBalanceSummary
  progress: SyncProgress
  timestamp: string
}

export class IncrementalSyncService {
  /**
   * Obtém o estado persistido de sincronização salva no navegador
   */
  getPersistedState(fileName?: string): PersistedSyncState | null {
    try {
      const data = localStorage.getItem(SYNC_PROGRESS_STORAGE_KEY)
      if (!data) return null
      const parsed = JSON.parse(data) as PersistedSyncState
      if (!fileName || parsed.fileName === fileName) {
        return parsed
      }
    } catch (_) {
      /* ignore */
    }
    return null
  }

  /**
   * Salva o estado atual de sincronização para retomada
   */
  savePersistedState(state: PersistedSyncState): void {
    try {
      localStorage.setItem(SYNC_PROGRESS_STORAGE_KEY, JSON.stringify(state))
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * Limpa o estado persistido
   */
  clearPersistedState(): void {
    try {
      localStorage.removeItem(SYNC_PROGRESS_STORAGE_KEY)
    } catch (_) {
      /* ignore */
    }
  }

  /**
   * ETAPA 1: Análise e Geração do Relatório de Balanceamento
   * Baixa dados leves do banco e compara registro a registro em memória
   */
  async analyzeBalance(
    rawRows: Record<string, string>[],
    options: {
      startIndex?: number
      endIndex?: number
      onProgress?: (percent: number, message: string) => void
    } = {},
  ): Promise<SyncBalanceSummary> {
    const { startIndex = 1, endIndex = rawRows.length, onProgress } = options

    const sliceStart = Math.max(0, startIndex - 1)
    const sliceEnd = Math.min(rawRows.length, endIndex)
    const rows = rawRows.slice(sliceStart, sliceEnd)

    if (onProgress) onProgress(5, 'Carregando índices de tutores e pacientes do banco...')

    // 1. Carregar do banco apenas campos identificadores necessários para comparação
    const dbTutorsByDedupe = new Map<string, any>()
    const dbTutorsById = new Map<string, any>()
    const dbTutorsMatched = new Set<string>()

    try {
      // Paged list para não estourar memória
      const tutors = await pb.collection('tutors').getFullList({
        fields:
          'id,name,cpf,phone,phone_secondary,email,rg,address,neighborhood,cep,city,state,indication,additional_info',
        requestKey: null,
      })
      for (const t of tutors) {
        dbTutorsById.set(t.id, t)
        const key = getTutorDedupeKey(t.name, t.cpf)
        dbTutorsByDedupe.set(key, t)
      }
    } catch (e) {
      console.warn('Erro ao carregar tutores para análise:', e)
    }

    if (onProgress) onProgress(20, 'Carregando índices de pacientes do banco...')

    const dbPatientsByCtrl = new Map<string, any>()
    const dbPatientsByImportKey = new Map<string, any>()
    const dbPatientsMatched = new Set<string>()

    try {
      const patients = await pb.collection('patients').getFullList({
        fields:
          'id,ctrl,import_key,name,species,breed,gender,birth_date,pelagem,microchip,deceased,status_notes,last_visit,registration_date,tutor_id',
        requestKey: null,
      })
      for (const p of patients) {
        if (p.ctrl && p.ctrl !== '0' && p.ctrl.trim() !== '') {
          dbPatientsByCtrl.set(p.ctrl.trim(), p)
        }
        if (p.import_key && p.import_key.trim() !== '') {
          dbPatientsByImportKey.set(p.import_key.trim(), p)
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar pacientes para análise:', e)
    }

    if (onProgress)
      onProgress(40, 'Carregando histórico de hashes de fichas, vacinas e retornos...')

    // Carregar hashes existentes ou calcular a partir dos campos leves
    const dbClinicalHashes = new Set<string>()
    try {
      const records = await pb.collection('clinical_records').getFullList({
        fields: 'id,patient_id,description,import_hash',
        requestKey: null,
      })
      for (const r of records) {
        const hash = r.import_hash || generateClinicalRecordHash(r.patient_id, r.description || '')
        dbClinicalHashes.add(hash)
      }
    } catch (e) {
      console.warn('Erro ao carregar registros clínicos para análise:', e)
    }

    const dbVaccineHashes = new Set<string>()
    try {
      const vList = await pb.collection('vaccines').getFullList({
        fields: 'id,patient_id,name,date,import_hash',
        requestKey: null,
      })
      for (const v of vList) {
        const hash = v.import_hash || generateVaccineHash(v.patient_id, v.name || '', v.date)
        dbVaccineHashes.add(hash)
      }
    } catch (e) {
      console.warn('Erro ao carregar vacinas para análise:', e)
    }

    const dbAppointmentHashes = new Set<string>()
    try {
      const aList = await pb.collection('appointments').getFullList({
        fields: 'id,patient_id,date,type,notes,import_hash',
        requestKey: null,
      })
      for (const a of aList) {
        const hash =
          a.import_hash ||
          generateAppointmentHash(a.patient_id, a.date || '', a.type || '', a.notes || '')
        dbAppointmentHashes.add(hash)
      }
    } catch (e) {
      console.warn('Erro ao carregar agendamentos para análise:', e)
    }

    if (onProgress) onProgress(60, 'Comparando registros do arquivo com o banco de dados...')

    let tutorsIdentical = 0
    let tutorsToUpdate = 0
    let tutorsNew = 0

    let patientsIdentical = 0
    let patientsToUpdate = 0
    let patientsNew = 0

    let clinicalIdentical = 0
    let clinicalNew = 0

    let vaccinesIdentical = 0
    let vaccinesNew = 0

    let appointmentsIdentical = 0
    let appointmentsNew = 0

    const runOccurrenceCounters = new Map<string, number>()
    const processedPatientsThisFile = new Set<string>()

    const totalRows = rows.length
    for (let i = 0; i < totalRows; i++) {
      if (i % 200 === 0 && onProgress) {
        const p = Math.round(60 + (i / totalRows) * 35)
        onProgress(p, `Comparando linha ${i + 1} de ${totalRows}...`)
      }

      const row = rows[i]
      const ctrl = sanitizeText(row.CTRL || row.ctrl)
      const nomeTutor = sanitizeText(row.NOME || row.nome)
      const animNome = sanitizeText(row.ANIM || row.anim)

      if (!nomeTutor && !animNome && !ctrl) {
        continue
      }

      // 1. TUTOR
      const cpfRaw = sanitizeText(row.CPF || row.cpf)
      const tutorDedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)
      const existingTutor = dbTutorsByDedupe.get(tutorDedupeKey)

      if (!existingTutor) {
        tutorsNew++
      } else {
        dbTutorsMatched.add(existingTutor.id)
        // Comparar campo a campo
        const diff = this.computeTutorDiff(existingTutor, row)
        if (Object.keys(diff).length > 0) {
          tutorsToUpdate++
        } else {
          tutorsIdentical++
        }
      }

      // 2. PACIENTE
      const animalName = animNome || 'Sem nome'
      const espeRaw = row.ESPE || row.espe
      const pelaRaw = sanitizeText(row.PELA || row.pela)
      const nascRaw = row.NASC || row.nasc

      const baseKey = getPatientCompositeBaseKey({
        tutorDedupeKey,
        anim: animalName,
        espe: espeRaw,
        nasc: nascRaw,
        pela: pelaRaw,
      })
      const count = (runOccurrenceCounters.get(baseKey) || 0) + 1
      runOccurrenceCounters.set(baseKey, count)
      const importKey = buildPatientImportKey(baseKey, count)

      let existingPatient =
        (ctrl && ctrl !== '0' && dbPatientsByCtrl.get(ctrl)) || dbPatientsByImportKey.get(importKey)

      let patientIdForHash = existingPatient ? existingPatient.id : `new_patient_${i}`

      if (!existingPatient) {
        patientsNew++
      } else {
        dbPatientsMatched.add(existingPatient.id)
        const diff = this.computePatientDiff(existingPatient, row)
        if (Object.keys(diff).length > 0) {
          patientsToUpdate++
        } else {
          patientsIdentical++
        }
      }

      // 3. FICHAS CLÍNICAS, VACINAS, RETORNOS (apenas 1x por paciente nesta execução)
      if (!processedPatientsThisFile.has(patientIdForHash)) {
        processedPatientsThisFile.add(patientIdForHash)

        // Fichas Clínicas
        const textoRaw = row.TEXTO || row.texto
        const extraction = textoRaw
          ? extractClinicalHistoryWithDiagnostics(textoRaw)
          : { entries: [] }
        for (const entry of extraction.entries) {
          const hash = generateClinicalRecordHash(patientIdForHash, entry.text)
          if (dbClinicalHashes.has(hash)) {
            clinicalIdentical++
          } else {
            clinicalNew++
          }
        }

        // Vacinas
        const vaccines = extractVaccinesFromRow(row)
        for (const vac of vaccines) {
          const hash = generateVaccineHash(patientIdForHash, vac.name, vac.date)
          if (dbVaccineHashes.has(hash)) {
            vaccinesIdentical++
          } else {
            vaccinesNew++
          }
        }

        // Agendamentos / Retornos
        const appointments = extractAppointmentsFromRow(row, extraction.entries)
        for (const appItem of appointments) {
          const hash = generateAppointmentHash(
            patientIdForHash,
            appItem.date,
            appItem.type,
            appItem.notes,
          )
          if (dbAppointmentHashes.has(hash)) {
            appointmentsIdentical++
          } else {
            appointmentsNew++
          }
        }
      }
    }

    if (onProgress) onProgress(100, 'Balanceamento concluído com sucesso!')

    const tutorsOnlyInSystem = Math.max(0, dbTutorsById.size - dbTutorsMatched.size)
    const patientsOnlyInSystem = Math.max(
      0,
      dbPatientsByCtrl.size + dbPatientsByImportKey.size - dbPatientsMatched.size,
    )
    const clinicalOnlyInSystem = Math.max(0, dbClinicalHashes.size - clinicalIdentical)
    const vaccinesOnlyInSystem = Math.max(0, dbVaccineHashes.size - vaccinesIdentical)
    const appointmentsOnlyInSystem = Math.max(0, dbAppointmentHashes.size - appointmentsIdentical)

    return {
      tutorsIdentical,
      tutorsToUpdate,
      tutorsNew,
      tutorsOnlyInSystem,

      patientsIdentical,
      patientsToUpdate,
      patientsNew,
      patientsOnlyInSystem,

      clinicalIdentical,
      clinicalNew,
      clinicalOnlyInSystem,

      vaccinesIdentical,
      vaccinesNew,
      vaccinesOnlyInSystem,

      appointmentsIdentical,
      appointmentsNew,
      appointmentsOnlyInSystem,

      totalRowsAnalyzed: totalRows,
    }
  }

  /**
   * ETAPA 2: Aplicação da Sincronização Incremental
   * Grava apenas diferenças/novos com throttling, auditoria ("vale o do arquivo")
   * e controle de parada/retomada.
   */
  async applySync(
    rawRows: Record<string, string>[],
    balance: SyncBalanceSummary,
    options: SyncOptions = {},
  ): Promise<SyncResultReport> {
    const startTime = Date.now()
    const {
      batchSize = 25,
      itemDelayMs = DEFAULT_ITEM_DELAY_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
      retryBackoffMs = DEFAULT_RETRY_BACKOFF_MS,
      startIndex = 1,
      endIndex = rawRows.length,
      onProgress,
      shouldPause,
    } = options

    const safeDbWrite = <T>(op: () => Promise<T>) =>
      executeWithRateLimitRetry(op, {
        itemDelayMs,
        maxRetries,
        retryBackoffMs,
      })

    const sliceStart = Math.max(0, startIndex - 1)
    const sliceEnd = Math.min(rawRows.length, endIndex)
    const rowsToProcess = rawRows.slice(sliceStart, sliceEnd)
    const total = rowsToProcess.length

    let tutorsCreated = 0
    let tutorsUpdated = 0
    let tutorsSkipped = 0

    let patientsCreated = 0
    let patientsUpdated = 0
    let patientsSkipped = 0

    let clinicalCreated = 0
    let clinicalSkipped = 0

    let vaccinesCreated = 0
    let vaccinesSkipped = 0

    let appointmentsCreated = 0
    let appointmentsSkipped = 0

    let auditsLogged = 0
    const failures: SyncFailureDetail[] = []

    // Caches em memória para agilidade
    const tutorIdCache = new Map<string, string>() // dedupeKey -> tutorId
    const tutorDataCache = new Map<string, any>() // tutorId -> tutorRecord
    const patientIdCache = new Map<string, string>() // importKey/ctrl -> patientId
    const patientDataCache = new Map<string, any>() // patientId -> patientRecord

    const processedPatientsThisRun = new Set<string>()
    const runOccurrenceCounters = new Map<string, number>()

    // Pré-carregar tutores existentes
    try {
      const existingTutors = await pb.collection('tutors').getFullList({
        fields:
          'id,name,cpf,phone,phone_secondary,email,rg,address,neighborhood,cep,city,state,indication,additional_info',
        requestKey: null,
      })
      for (const t of existingTutors) {
        const key = getTutorDedupeKey(t.name, t.cpf)
        tutorIdCache.set(key, t.id)
        tutorDataCache.set(t.id, t)
      }
    } catch (e) {
      console.warn('Erro ao pré-carregar tutores para sincronização:', e)
    }

    // Pré-carregar pacientes existentes
    try {
      const existingPatients = await pb.collection('patients').getFullList({
        fields:
          'id,ctrl,import_key,name,species,breed,gender,birth_date,pelagem,microchip,deceased,status_notes,last_visit,registration_date,tutor_id',
        requestKey: null,
      })
      for (const p of existingPatients) {
        if (p.ctrl && p.ctrl !== '0' && p.ctrl.trim() !== '') {
          patientIdCache.set(p.ctrl.trim(), p.id)
        }
        if (p.import_key && p.import_key.trim() !== '') {
          patientIdCache.set(p.import_key.trim(), p.id)
        }
        patientDataCache.set(p.id, p)
      }
    } catch (e) {
      console.warn('Erro ao pré-carregar pacientes para sincronização:', e)
    }

    // Hashes já gravados no banco
    const existingClinicalHashes = new Set<string>()
    try {
      const cl = await pb.collection('clinical_records').getFullList({
        fields: 'id,patient_id,description,import_hash',
        requestKey: null,
      })
      for (const c of cl) {
        const h = c.import_hash || generateClinicalRecordHash(c.patient_id, c.description || '')
        existingClinicalHashes.add(h)
      }
    } catch {
      /* intentionally ignored */
    }

    const existingVaccineHashes = new Set<string>()
    try {
      const vc = await pb.collection('vaccines').getFullList({
        fields: 'id,patient_id,name,date,import_hash',
        requestKey: null,
      })
      for (const v of vc) {
        const h = v.import_hash || generateVaccineHash(v.patient_id, v.name || '', v.date)
        existingVaccineHashes.add(h)
      }
    } catch {
      /* intentionally ignored */
    }

    const existingAppointmentHashes = new Set<string>()
    try {
      const ap = await pb.collection('appointments').getFullList({
        fields: 'id,patient_id,date,type,notes,import_hash',
        requestKey: null,
      })
      for (const a of ap) {
        const h =
          a.import_hash ||
          generateAppointmentHash(a.patient_id, a.date || '', a.type || '', a.notes || '')
        existingAppointmentHashes.add(h)
      }
    } catch {
      /* intentionally ignored */
    }

    const totalBatches = Math.ceil(total / batchSize)

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      if (shouldPause && shouldPause()) {
        break
      }

      const startRowIdx = batchIdx * batchSize
      const currentBatch = rowsToProcess.slice(startRowIdx, startRowIdx + batchSize)

      for (let i = 0; i < currentBatch.length; i++) {
        if (shouldPause && shouldPause()) {
          break
        }

        const batchItemIdx = startRowIdx + i
        const fileLineNumber = sliceStart + batchItemIdx + 1
        const row = currentBatch[i]

        if (onProgress) {
          onProgress({
            phase: 'applying',
            current: batchItemIdx + 1,
            total,
            percent: Math.round(((batchItemIdx + 1) / total) * 100),
            statusMessage: `Sincronizando linha ${fileLineNumber} (${batchItemIdx + 1} de ${total})...`,
            tutorsCreated,
            tutorsUpdated,
            tutorsSkipped,
            patientsCreated,
            patientsUpdated,
            patientsSkipped,
            clinicalCreated,
            clinicalSkipped,
            vaccinesCreated,
            vaccinesSkipped,
            appointmentsCreated,
            appointmentsSkipped,
            failed: failures.length,
            auditsLogged,
          })
        }

        const ctrl = sanitizeText(row.CTRL || row.ctrl)
        const nomeTutor = sanitizeText(row.NOME || row.nome)
        const animNome = sanitizeText(row.ANIM || row.anim)

        if (!nomeTutor && !animNome && !ctrl) {
          continue
        }

        try {
          // -------------------------------------------------------------
          // 1. TUTOR: Comparação e Atualização com "Vale o do arquivo" + Auditoria
          // -------------------------------------------------------------
          const cpfRaw = sanitizeText(row.CPF || row.cpf)
          const dedupeKey = getTutorDedupeKey(nomeTutor || 'Tutor Não Informado', cpfRaw)
          let tutorId = tutorIdCache.get(dedupeKey)

          const fileTutorData = this.mapTutorFromRow(row, nomeTutor, cpfRaw)

          if (!tutorId) {
            // Criar novo tutor
            const tutorRecord = await safeDbWrite(() =>
              pb.collection('tutors').create(fileTutorData),
            )
            tutorId = tutorRecord.id
            tutorIdCache.set(dedupeKey, tutorId)
            tutorDataCache.set(tutorId, tutorRecord)
            tutorsCreated++
          } else {
            // Tutor já existe: comparar campo a campo
            const existingTutor = tutorDataCache.get(tutorId)
            const diff = this.computeTutorDiff(existingTutor, row)

            if (Object.keys(diff).length > 0) {
              // Atualizar tutor com dados do arquivo
              const updatedTutor = await safeDbWrite(() =>
                pb.collection('tutors').update(tutorId!, fileTutorData),
              )
              tutorDataCache.set(tutorId, updatedTutor)
              tutorsUpdated++

              // Registrar na auditoria
              await auditService.log({
                action: 'update',
                module: 'tutors',
                recordId: tutorId,
                recordLabel: nomeTutor || 'Tutor',
                tutorName: nomeTutor,
                changes: diff,
                details: `Sincronização incremental: dados restaurados da base oficial ("vale o do arquivo").`,
              })
              auditsLogged++
            } else {
              tutorsSkipped++
            }
          }

          // -------------------------------------------------------------
          // 2. PACIENTE: Comparação e Atualização com "Vale o do arquivo" + Auditoria
          // -------------------------------------------------------------
          const animalName = animNome || 'Sem nome'
          const espeRaw = row.ESPE || row.espe
          const pelaRaw = sanitizeText(row.PELA || row.pela)
          const nascRaw = row.NASC || row.nasc

          const baseKey = getPatientCompositeBaseKey({
            tutorDedupeKey: dedupeKey,
            anim: animalName,
            espe: espeRaw,
            nasc: nascRaw,
            pela: pelaRaw,
          })
          const currentCount = (runOccurrenceCounters.get(baseKey) || 0) + 1
          runOccurrenceCounters.set(baseKey, currentCount)
          const importKey = buildPatientImportKey(baseKey, currentCount)

          let patientId =
            (ctrl && ctrl !== '0' && patientIdCache.get(ctrl)) || patientIdCache.get(importKey)

          const filePatientData = this.mapPatientFromRow(row, animalName, tutorId, importKey, ctrl)

          if (!patientId) {
            // Criar novo paciente
            const patientRecord = await safeDbWrite(() =>
              pb.collection('patients').create(filePatientData),
            )
            patientId = patientRecord.id
            patientIdCache.set(importKey, patientId)
            if (ctrl && ctrl !== '0') patientIdCache.set(ctrl, patientId)
            patientDataCache.set(patientId, patientRecord)
            patientsCreated++
          } else {
            // Paciente já existe: comparar campo a campo
            const existingPatient = patientDataCache.get(patientId)
            const diff = this.computePatientDiff(existingPatient, row)

            if (Object.keys(diff).length > 0) {
              const updatedPatient = await safeDbWrite(() =>
                pb.collection('patients').update(patientId!, filePatientData),
              )
              patientDataCache.set(patientId, updatedPatient)
              patientsUpdated++

              // Registrar na auditoria
              await auditService.log({
                action: 'update',
                module: 'patients',
                recordId: patientId,
                recordLabel: animalName,
                patientName: animalName,
                tutorName: nomeTutor,
                changes: diff,
                details: `Sincronização incremental: dados restaurados da base oficial ("vale o do arquivo").`,
              })
              auditsLogged++
            } else {
              patientsSkipped++
            }
          }

          // -------------------------------------------------------------
          // 3. FICHAS CLÍNICAS, VACINAS E RETORNOS (por hash)
          // -------------------------------------------------------------
          if (patientId && !processedPatientsThisRun.has(patientId)) {
            processedPatientsThisRun.add(patientId)

            // Ficha Clínica
            const textoRaw = row.TEXTO || row.texto
            const extraction = textoRaw
              ? extractClinicalHistoryWithDiagnostics(textoRaw)
              : { entries: [] }

            for (const entry of extraction.entries) {
              const hash = generateClinicalRecordHash(patientId, entry.text)
              if (existingClinicalHashes.has(hash)) {
                clinicalSkipped++
              } else {
                try {
                  await safeDbWrite(() =>
                    pb.collection('clinical_records').create({
                      patient_id: patientId,
                      description: entry.text,
                      diagnosis: '',
                      treatment: '',
                      import_hash: hash,
                    }),
                  )
                  existingClinicalHashes.add(hash)
                  clinicalCreated++
                } catch (recErr: any) {
                  failures.push({
                    linha: fileLineNumber,
                    ctrl,
                    tutor: nomeTutor,
                    animal: animNome,
                    tipo: 'clinical_entry',
                    erro: recErr?.message || 'Falha ao gravar entrada clínica na sincronização',
                    trecho: entry.text.slice(0, 200),
                  })
                }
              }
            }

            // Vacinas
            const vaccines = extractVaccinesFromRow(row)
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)

            for (const vac of vaccines) {
              const hash = generateVaccineHash(patientId, vac.name, vac.date)
              if (existingVaccineHashes.has(hash)) {
                vaccinesSkipped++
              } else {
                try {
                  let isCompleted = true
                  if (vac.date) {
                    const vacTime = new Date(vac.date).getTime()
                    if (!isNaN(vacTime)) {
                      isCompleted = vacTime < todayStart.getTime()
                    }
                  }

                  await safeDbWrite(() =>
                    pb.collection('vaccines').create({
                      patient_id: patientId,
                      name: vac.name,
                      date: vac.date || '',
                      notes: vac.notes || '',
                      completed: isCompleted,
                      import_hash: hash,
                    }),
                  )
                  existingVaccineHashes.add(hash)
                  vaccinesCreated++
                } catch (vacErr: any) {
                  failures.push({
                    linha: fileLineNumber,
                    ctrl,
                    tutor: nomeTutor,
                    animal: animNome,
                    tipo: 'vaccine',
                    erro: vacErr?.message || 'Falha ao gravar vacina na sincronização',
                    trecho: `${vac.name} ${vac.date || ''}`.trim(),
                  })
                }
              }
            }

            // Agendamentos / Retornos
            const appointments = extractAppointmentsFromRow(row, extraction.entries)
            for (const appItem of appointments) {
              const hash = generateAppointmentHash(
                patientId,
                appItem.date,
                appItem.type,
                appItem.notes,
              )
              if (existingAppointmentHashes.has(hash)) {
                appointmentsSkipped++
              } else {
                try {
                  await safeDbWrite(() =>
                    pb.collection('appointments').create({
                      patient_id: patientId,
                      date: appItem.date,
                      type: appItem.type,
                      status: appItem.status,
                      notes: appItem.notes,
                      source: appItem.source,
                      import_hash: hash,
                    }),
                  )
                  existingAppointmentHashes.add(hash)
                  appointmentsCreated++
                } catch (appErr: any) {
                  failures.push({
                    linha: fileLineNumber,
                    ctrl,
                    tutor: nomeTutor,
                    animal: animNome,
                    tipo: 'appointment',
                    erro: appErr?.message || 'Falha ao gravar agendamento na sincronização',
                    trecho: `${appItem.date} ${appItem.notes}`.slice(0, 200),
                  })
                }
              }
            }
          }
        } catch (err: any) {
          failures.push({
            linha: fileLineNumber,
            ctrl,
            tutor: nomeTutor,
            animal: animNome,
            tipo: 'geral',
            erro: err?.message || 'Erro inesperado na sincronização da linha',
          })
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    return {
      success: failures.length === 0,
      durationSeconds,
      totalRows: total,
      balance,
      applied: {
        tutorsCreated,
        tutorsUpdated,
        tutorsSkipped,
        patientsCreated,
        patientsUpdated,
        patientsSkipped,
        clinicalCreated,
        clinicalSkipped,
        vaccinesCreated,
        vaccinesSkipped,
        appointmentsCreated,
        appointmentsSkipped,
        auditsLogged,
        failed: failures.length,
      },
      failures,
    }
  }

  // --- HELPERS INTERNOS DE MAPEAMENTO E COMPARAÇÃO ---

  private mapTutorFromRow(row: Record<string, string>, nomeTutor: string, cpfRaw: string) {
    const rg = sanitizeText(row.RG || row.rg)
    const rawEmail = sanitizeText(row.EMAIL || row.email).toLowerCase()
    const validEmail = rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ''
    const ende = sanitizeText(row.ENDE || row.ende)
    const nume = sanitizeText(row.NUME || row.nume)
    const address = ende ? (nume ? `${ende}, ${nume}` : ende) : nume || ''
    const bair = sanitizeText(row.BAIR || row.bair)
    const rawCep = sanitizeText(row.CEP || row.cep)
    const cleanCep = rawCep.replace(/[^\d-]/g, '').slice(0, 9)
    const cida = sanitizeText(row.CIDA || row.cida)
    const esta = sanitizeText(row.ESTA || row.esta).slice(0, 2)
    const tel1 = sanitizeText(row.TEL1 || row.tel1)
    const tel2 = sanitizeText(row.TEL2 || row.tel2)
    const tel3 = sanitizeText(row.TEL3 || row.tel3)
    const inst = sanitizeText(row.INST || row.inst)

    const tutorNotes: string[] = []
    if (tel3) tutorNotes.push(`Tel 3 / Contato: ${tel3}`)
    if (inst) tutorNotes.push(`Indicação: ${inst}`)
    const additionalInfo = tutorNotes.join(' | ')

    return {
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
    }
  }

  private mapPatientFromRow(
    row: Record<string, string>,
    animalName: string,
    tutorId: string,
    importKey: string,
    ctrl: string,
  ) {
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

    const species = normalizeSpecies(espeRaw)
    const gender = normalizeGender(sexoRaw)
    const birthDate = normalizeDate(nascRaw)
    const deceased = normalizeDeceased(vivoRaw, dbtxRaw)
    const lastVisit = normalizeDate(ultvRaw)
    const registrationDate = normalizeDate(dtrgRaw)

    return {
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
    }
  }

  private computeTutorDiff(existing: any, row: Record<string, string>): Record<string, FieldDiff> {
    const diff: Record<string, FieldDiff> = {}
    if (!existing) return diff

    const nomeTutor = sanitizeText(row.NOME || row.nome)
    const cpfRaw = sanitizeText(row.CPF || row.cpf)
    const fileData = this.mapTutorFromRow(row, nomeTutor, cpfRaw)

    const checkField = (field: string, label: string) => {
      const oldVal = (existing[field] || '').toString().trim()
      const newVal = ((fileData as any)[field] || '').toString().trim()
      if (oldVal !== newVal) {
        diff[field] = {
          label,
          oldValue: existing[field] || '',
          newValue: (fileData as any)[field] || '',
        }
      }
    }

    checkField('name', 'Nome')
    checkField('phone', 'Telefone Principal')
    checkField('phone_secondary', 'Telefone Secundário')
    checkField('email', 'E-mail')
    checkField('cpf', 'CPF')
    checkField('rg', 'RG')
    checkField('address', 'Endereço')
    checkField('neighborhood', 'Bairro')
    checkField('cep', 'CEP')
    checkField('city', 'Cidade')
    checkField('state', 'UF')
    checkField('indication', 'Indicação')
    checkField('additional_info', 'Informações Adicionais')

    return diff
  }

  private computePatientDiff(
    existing: any,
    row: Record<string, string>,
  ): Record<string, FieldDiff> {
    const diff: Record<string, FieldDiff> = {}
    if (!existing) return diff

    const animalName = sanitizeText(row.ANIM || row.anim) || 'Sem nome'
    const fileData = this.mapPatientFromRow(
      row,
      animalName,
      existing.tutor_id,
      existing.import_key,
      existing.ctrl,
    )

    const checkField = (field: string, label: string) => {
      let oldVal = (existing[field] || '').toString().trim()
      let newVal = ((fileData as any)[field] || '').toString().trim()

      // Normalização de data para evitar falsos positivos por fuso horário
      if (field.includes('date') || field === 'last_visit' || field === 'registration_date') {
        if (oldVal) oldVal = oldVal.slice(0, 10)
        if (newVal) newVal = newVal.slice(0, 10)
      }

      if (field === 'deceased') {
        const oldBool = Boolean(existing.deceased)
        const newBool = Boolean(fileData.deceased)
        if (oldBool !== newBool) {
          diff[field] = {
            label,
            oldValue: oldBool ? 'Sim (Óbito)' : 'Não (Vivo)',
            newValue: newBool ? 'Sim (Óbito)' : 'Não (Vivo)',
          }
        }
        return
      }

      if (oldVal !== newVal) {
        diff[field] = {
          label,
          oldValue: existing[field] || '',
          newValue: (fileData as any)[field] || '',
        }
      }
    }

    checkField('name', 'Nome do Animal')
    checkField('species', 'Espécie')
    checkField('breed', 'Raça')
    checkField('gender', 'Sexo')
    checkField('birth_date', 'Data de Nascimento')
    checkField('pelagem', 'Pelagem')
    checkField('microchip', 'Microchip')
    checkField('deceased', 'Óbito')
    checkField('status_notes', 'Observações de Status')
    checkField('last_visit', 'Última Visita')
    checkField('registration_date', 'Data de Registro')

    return diff
  }
}

export const incrementalSyncService = new IncrementalSyncService()
