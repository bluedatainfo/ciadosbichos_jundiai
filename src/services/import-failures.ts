import pb from '@/lib/pocketbase/client'
import {
  sanitizeText,
  normalizeDate,
  extractClinicalHistoryWithDiagnostics,
  extractAppointmentsFromRow,
} from '@/lib/access-migration-utils'
import { isRateLimitError } from './access-import'

export interface ImportFailureRecord {
  id?: string
  linha: number
  ctrl: string
  tutor: string
  animal: string
  tipo:
    | 'clinical_entry'
    | 'appointment'
    | 'vaccine'
    | 'tutor'
    | 'patient'
    | 'database_error'
    | 'parser_warning'
    | 'geral'
  erro: string
  trecho: string
  status: 'pending' | 'resolved' | 'ignored'
  created?: string
  updated?: string
}

export interface ReprocessProgress {
  total: number
  current: number
  percent: number
  recovered: number
  remaining: number
  currentLine?: number
  statusMessage: string
  retrying?: boolean
  retryAttempt?: number
  retryWaitSec?: number
}

export interface ReprocessReport {
  total: number
  processed: number
  recovered: number
  remaining: number
  reasons: Record<string, number>
  failuresRemaining: ImportFailureRecord[]
  durationSeconds: number
}

export interface ReprocessOptions {
  itemDelayMs?: number
  maxRetries?: number
  retryBackoffMs?: number[]
  onProgress?: (progress: ReprocessProgress) => void
  shouldCancel?: () => boolean
}

const DEFAULT_REPROCESS_DELAY_MS = 200 // 150–300ms recomendado
const DEFAULT_REPROCESS_MAX_RETRIES = 5
const DEFAULT_REPROCESS_BACKOFF = [1000, 2000, 4000, 8000, 16000]

/**
 * Executa uma operação no banco com throttling e retry exponencial agressivo para 429
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: {
    itemDelayMs: number
    maxRetries: number
    retryBackoffMs: number[]
    onRetry?: (attempt: number, delayMs: number) => void
  },
): Promise<T> {
  const { itemDelayMs, maxRetries, retryBackoffMs, onRetry } = options
  let attempt = 0

  while (true) {
    try {
      const res = await operation()
      if (itemDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, itemDelayMs))
      }
      return res
    } catch (err: any) {
      if (isRateLimitError(err) && attempt < maxRetries) {
        const delay = retryBackoffMs[attempt] || 1000 * Math.pow(2, attempt)
        attempt++
        if (onRetry) {
          onRetry(attempt, delay)
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw err
    }
  }
}

export const importFailuresService = {
  /**
   * Retorna o total de falhas pendentes cadastradas no banco
   */
  async getPendingCount(): Promise<number> {
    try {
      const res = await pb.collection('import_failures').getList(1, 1, {
        filter: "status = 'pending'",
      })
      return res.totalItems
    } catch (e) {
      console.warn('Erro ao obter contagem de falhas:', e)
      return 0
    }
  },

  /**
   * Lista falhas com paginação ou filtro
   */
  async getFailures(
    options: {
      page?: number
      perPage?: number
      status?: 'pending' | 'resolved' | 'ignored'
    } = {},
  ): Promise<{ items: ImportFailureRecord[]; totalItems: number }> {
    const { page = 1, perPage = 50, status = 'pending' } = options
    const filter = status ? `status = '${status}'` : ''
    try {
      const res = await pb.collection('import_failures').getList(page, perPage, {
        filter,
        sort: 'linha',
      })
      return {
        items: res.items.map((it: any) => ({
          id: it.id,
          linha: it.linha,
          ctrl: it.ctrl || '',
          tutor: it.tutor || '',
          animal: it.animal || '',
          tipo: it.tipo || 'geral',
          erro: it.erro || '',
          trecho: it.trecho || '',
          status: it.status || 'pending',
          created: it.created,
          updated: it.updated,
        })),
        totalItems: res.totalItems,
      }
    } catch (e) {
      console.warn('Erro ao listar falhas:', e)
      return { items: [], totalItems: 0 }
    }
  },

  /**
   * Obtém todas as falhas pendentes (com paginação automática para pegar até todas as 3.335)
   */
  async getAllPendingFailures(): Promise<ImportFailureRecord[]> {
    try {
      const records = await pb.collection('import_failures').getFullList({
        filter: "status = 'pending'",
        sort: 'linha',
        requestKey: null,
      })
      return records.map((it: any) => ({
        id: it.id,
        linha: it.linha,
        ctrl: it.ctrl || '',
        tutor: it.tutor || '',
        animal: it.animal || '',
        tipo: it.tipo || 'geral',
        erro: it.erro || '',
        trecho: it.trecho || '',
        status: it.status || 'pending',
        created: it.created,
        updated: it.updated,
      }))
    } catch (e) {
      console.warn('Erro ao buscar todas as falhas:', e)
      return []
    }
  },

  /**
   * Popula a collection import_failures a partir das linhas de um CSV de pendências baixado previamente
   * Formato padrão: Linha,CTRL,Tutor,Animal,Tipo,Erro,Trecho Problemático
   */
  async importFailuresFromCSV(csvText: string): Promise<{ imported: number; errors: number }> {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length <= 1) return { imported: 0, errors: 0 }

    // Parse do cabeçalho
    // Procuramos índices das colunas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let curr = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            curr += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (c === ',' && !inQuotes) {
          result.push(curr)
          curr = ''
        } else {
          curr += c
        }
      }
      result.push(curr)
      return result
    }

    const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
    const linhaIdx = header.findIndex((h) => h.includes('linha'))
    const ctrlIdx = header.findIndex((h) => h.includes('ctrl'))
    const tutorIdx = header.findIndex((h) => h.includes('tutor'))
    const animalIdx = header.findIndex((h) => h.includes('animal'))
    const tipoIdx = header.findIndex((h) => h.includes('tipo'))
    const erroIdx = header.findIndex((h) => h.includes('erro'))
    const trechoIdx = header.findIndex((h) => h.includes('trecho'))

    let imported = 0
    let errors = 0

    // Para evitar saturação durante a carga das 3.335 falhas, inserimos em lotes com pequeno delay
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 2) continue

      const linhaNum = parseInt(cols[linhaIdx >= 0 ? linhaIdx : 0], 10)
      if (isNaN(linhaNum)) continue

      const ctrl = cols[ctrlIdx >= 0 ? ctrlIdx : 1] || ''
      const tutor = cols[tutorIdx >= 0 ? tutorIdx : 2] || ''
      const animal = cols[animalIdx >= 0 ? animalIdx : 3] || ''
      const rawTipo = (cols[tipoIdx >= 0 ? tipoIdx : 4] || '').toLowerCase()
      const erro = cols[erroIdx >= 0 ? erroIdx : 5] || 'Too Many Requests'
      const trecho = cols[trechoIdx >= 0 ? trechoIdx : 6] || ''

      // Normaliza tipo
      let tipo: ImportFailureRecord['tipo'] = 'geral'
      if (
        rawTipo.includes('clinical') ||
        erro.toLowerCase().includes('clínica') ||
        erro.toLowerCase().includes('clinica')
      ) {
        tipo = 'clinical_entry'
      } else if (rawTipo.includes('appointment') || erro.toLowerCase().includes('agendamento')) {
        tipo = 'appointment'
      } else if (rawTipo.includes('vaccine') || erro.toLowerCase().includes('vacina')) {
        tipo = 'vaccine'
      } else if (rawTipo.includes('parser') || rawTipo.includes('aviso')) {
        tipo = 'parser_warning'
      } else if (rawTipo.includes('database')) {
        tipo = 'database_error'
      }

      try {
        await executeWithRetry(
          () =>
            pb.collection('import_failures').create({
              linha: linhaNum,
              ctrl,
              tutor,
              animal,
              tipo,
              erro,
              trecho,
              status: 'pending',
            }),
          {
            itemDelayMs: 25,
            maxRetries: 3,
            retryBackoffMs: [500, 1000, 2000],
          },
        )
        imported++
      } catch (e) {
        errors++
      }
    }

    return { imported, errors }
  },

  /**
   * Reprocessa as falhas lendo as linhas correspondentes do arquivo original da base
   */
  async reprocessFailures(
    failures: ImportFailureRecord[],
    rawRows: Record<string, string>[],
    options: ReprocessOptions = {},
  ): Promise<ReprocessReport> {
    const startTime = Date.now()
    const {
      itemDelayMs = DEFAULT_REPROCESS_DELAY_MS,
      maxRetries = DEFAULT_REPROCESS_MAX_RETRIES,
      retryBackoffMs = DEFAULT_REPROCESS_BACKOFF,
      onProgress,
      shouldCancel,
    } = options

    let recovered = 0
    let remaining = 0
    const reasons: Record<string, number> = {}
    const failuresRemaining: ImportFailureRecord[] = []

    // Cache em memória para resolução ágil de paciente por CTRL / Tutor + Animal
    // Pacientes já importados na base (podem ter ctrl ou import_key)
    const patientCacheByCtrl = new Map<string, string>() // ctrl -> patientId
    const patientCacheByName = new Map<string, string>() // "tutor|animal" -> patientId

    // Carregar cache inicial de pacientes para evitar buscas excessivas
    try {
      const existingPatients = await pb.collection('patients').getFullList({
        fields: 'id,ctrl,name,tutor_id',
        requestKey: null,
      })
      for (const p of existingPatients) {
        if (p.ctrl && p.ctrl.trim() !== '') {
          // CTRL pode ser "0", mas se for diferente de 0 é unívoco
          if (p.ctrl !== '0') {
            patientCacheByCtrl.set(p.ctrl.trim(), p.id)
          }
        }
        if (p.name) {
          patientCacheByName.set(p.name.trim().toUpperCase(), p.id)
        }
      }
    } catch (e) {
      console.warn('Erro ao pré-carregar cache de pacientes:', e)
    }

    const total = failures.length

    for (let i = 0; i < failures.length; i++) {
      if (shouldCancel && shouldCancel()) {
        break
      }

      const failure = failures[i]
      const fileLineNumber = failure.linha
      // rawRows é 0-based, enquanto a linha no relatório original é 1-based (linha 1 = cabeçalho, ou linha N)
      // No parser CSV, a linha 1 dos dados corresponde ao índice 0 se não contar header,
      // mas no AccessImport fileLineNumber foi calculado como: fileOffset + batchItemIdx + 1
      // onde fileOffset + 0 + 1 = 1 para a linha 0 de rawRows!
      // Portanto, o índice em rawRows é: fileLineNumber - 1.
      const rowIndex = fileLineNumber - 1
      const row = rowIndex >= 0 && rowIndex < rawRows.length ? rawRows[rowIndex] : null

      if (onProgress) {
        onProgress({
          total,
          current: i + 1,
          percent: Math.round(((i + 1) / total) * 100),
          recovered,
          remaining,
          currentLine: fileLineNumber,
          statusMessage: `Reprocessando linha ${fileLineNumber} (${i + 1} de ${total})...`,
        })
      }

      if (!row) {
        // Linha não encontrada no arquivo enviado
        remaining++
        const reason = 'Linha não encontrada no arquivo da base fornecido'
        reasons[reason] = (reasons[reason] || 0) + 1
        failuresRemaining.push({
          ...failure,
          erro: reason,
        })
        continue
      }

      // Resolver o paciente para esta linha
      const ctrl = sanitizeText(row.CTRL || row.ctrl || failure.ctrl)
      const nomeTutor = sanitizeText(row.NOME || row.nome || failure.tutor)
      const animNome = sanitizeText(row.ANIM || row.anim || failure.animal)

      let patientId: string | null = null

      if (ctrl && ctrl !== '0' && patientCacheByCtrl.has(ctrl)) {
        patientId = patientCacheByCtrl.get(ctrl) || null
      }

      // Se não achou por CTRL (ou CTRL era "0"), busca no banco por tutor e nome
      if (!patientId) {
        try {
          // Tentar encontrar tutor primeiro
          if (nomeTutor) {
            const tutors = await pb.collection('tutors').getList(1, 1, {
              filter: `name ~ "${nomeTutor.replace(/"/g, '')}"`,
              requestKey: null,
            })
            if (tutors.items.length > 0) {
              const tutorId = tutors.items[0].id
              const patients = await pb.collection('patients').getList(1, 1, {
                filter: `tutor_id = "${tutorId}" && name ~ "${(animNome || '').replace(/"/g, '')}"`,
                requestKey: null,
              })
              if (patients.items.length > 0) {
                patientId = patients.items[0].id
              }
            }
          }
        } catch (_) {
          // ignore
        }
      }

      // Fallback: se ainda não encontrou, busca paciente diretamente pelo nome
      if (!patientId && animNome) {
        try {
          const directPatients = await pb.collection('patients').getList(1, 1, {
            filter: `name = "${animNome.replace(/"/g, '')}"`,
            requestKey: null,
          })
          if (directPatients.items.length > 0) {
            patientId = directPatients.items[0].id
          }
        } catch (_) {
          // ignore
        }
      }

      if (!patientId) {
        remaining++
        const reason = 'Paciente/Tutor não localizado na base atual para vinculação'
        reasons[reason] = (reasons[reason] || 0) + 1
        failuresRemaining.push({
          ...failure,
          erro: reason,
        })
        continue
      }

      // Paciente localizado! Agora identificar o que falhou (clinical_entry ou appointment)
      let recordSaved = false
      let realError: string | null = null

      const isClinical =
        failure.tipo === 'clinical_entry' ||
        failure.erro.toLowerCase().includes('clínica') ||
        failure.erro.toLowerCase().includes('clinica')

      const isAppointment =
        failure.tipo === 'appointment' || failure.erro.toLowerCase().includes('agendamento')

      try {
        if (isClinical) {
          // Re-extrair entradas do texto desta linha
          const textoRaw = row.TEXTO || row.texto
          const extraction = textoRaw
            ? extractClinicalHistoryWithDiagnostics(textoRaw)
            : { entries: [] }
          const clinicalEntries = extraction.entries

          // Tentar localizar a entrada específica pelo trecho falhado, ou gravar se não existir idêntica
          let textToSave = failure.trecho ? failure.trecho.replace(/^Trecho:\s*/i, '').trim() : ''

          // Se o trecho falhado estiver no formato "[DD/MM/YY] ...", podemos achar o item exato em clinicalEntries
          if (clinicalEntries.length > 0) {
            const matched = clinicalEntries.find((e) =>
              textToSave
                ? e.text.includes(textToSave) || textToSave.includes(e.text.slice(0, 50))
                : false,
            )
            if (matched) {
              textToSave = matched.text
            } else if (!textToSave) {
              textToSave = clinicalEntries[0].text
            }
          }

          if (!textToSave && clinicalEntries.length > 0) {
            textToSave = clinicalEntries[0].text
          }

          if (!textToSave) {
            textToSave = `[Migração Access - Reprocesso] ${failure.trecho || 'Histórico clínico recuperado'}`
          }

          // Gravação no banco com throttling e retry
          await executeWithRetry(
            () =>
              pb.collection('clinical_records').create({
                patient_id: patientId,
                description: textToSave,
                diagnosis: '',
                treatment: '',
              }),
            {
              itemDelayMs,
              maxRetries,
              retryBackoffMs,
              onRetry: (att, delay) => {
                if (onProgress) {
                  onProgress({
                    total,
                    current: i + 1,
                    percent: Math.round(((i + 1) / total) * 100),
                    recovered,
                    remaining,
                    currentLine: fileLineNumber,
                    retrying: true,
                    retryAttempt: att,
                    retryWaitSec: Math.round(delay / 1000),
                    statusMessage: `Rate limit (429) no reprocesso da linha ${fileLineNumber}. Tentativa ${att}/${maxRetries} aguardando ${Math.round(delay / 1000)}s...`,
                  })
                }
              },
            },
          )

          recordSaved = true
        } else if (isAppointment) {
          // Re-extrair agendamentos da linha
          const textoRaw = row.TEXTO || row.texto
          const extraction = textoRaw
            ? extractClinicalHistoryWithDiagnostics(textoRaw)
            : { entries: [] }
          const appointments = extractAppointmentsFromRow(row, extraction.entries)

          let appToSave = appointments.length > 0 ? appointments[0] : null
          if (failure.trecho) {
            const matched = appointments.find(
              (a) =>
                failure.trecho.includes(a.date.slice(0, 10)) ||
                (a.notes && failure.trecho.includes(a.notes.slice(0, 30))),
            )
            if (matched) appToSave = matched
          }

          const dateToSave =
            appToSave?.date || normalizeDate(row.ULTV || row.ultv) || new Date().toISOString()
          const notesToSave = appToSave?.notes || failure.trecho || '[Migração Access - Reprocesso]'

          await executeWithRetry(
            () =>
              pb.collection('appointments').create({
                patient_id: patientId,
                date: dateToSave,
                type: appToSave?.type || 'consultation',
                status: 'completed',
                notes: notesToSave,
                source: 'internal',
              }),
            {
              itemDelayMs,
              maxRetries,
              retryBackoffMs,
              onRetry: (att, delay) => {
                if (onProgress) {
                  onProgress({
                    total,
                    current: i + 1,
                    percent: Math.round(((i + 1) / total) * 100),
                    recovered,
                    remaining,
                    currentLine: fileLineNumber,
                    retrying: true,
                    retryAttempt: att,
                    retryWaitSec: Math.round(delay / 1000),
                    statusMessage: `Rate limit (429) na linha ${fileLineNumber}. Tentativa ${att}/${maxRetries} aguardando ${Math.round(delay / 1000)}s...`,
                  })
                }
              },
            },
          )

          recordSaved = true
        } else {
          // Fallback para outros tipos: tenta gravar como registro clínico
          const textToSave = failure.trecho || `[Reprocesso] ${failure.erro}`
          await executeWithRetry(
            () =>
              pb.collection('clinical_records').create({
                patient_id: patientId,
                description: textToSave,
                diagnosis: '',
                treatment: '',
              }),
            {
              itemDelayMs,
              maxRetries,
              retryBackoffMs,
            },
          )
          recordSaved = true
        }
      } catch (err: any) {
        realError = err?.message || 'Erro durante a gravação'
      }

      if (recordSaved) {
        recovered++
        // Atualizar status no banco para 'resolved' se tiver id persistido
        if (failure.id) {
          try {
            await pb.collection('import_failures').update(failure.id, {
              status: 'resolved',
            })
          } catch (_) {
            // ignore
          }
        }
      } else {
        remaining++
        const reason = realError || 'Falha persistente após esgotamento de retries'
        reasons[reason] = (reasons[reason] || 0) + 1
        failuresRemaining.push({
          ...failure,
          erro: reason,
        })
      }
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    return {
      total,
      processed: recovered + remaining,
      recovered,
      remaining,
      reasons,
      failuresRemaining,
      durationSeconds,
    }
  },
}
