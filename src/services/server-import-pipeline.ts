import pb from '@/lib/pocketbase/client'

export interface WipeSummary {
  patientsDeleted: number
  tutorsDeleted: number
  clinicalDeleted: number
  vaccinesDeleted: number
  appointmentsDeleted: number
  auditLogsDeleted: number
  importProgressDeleted: number
  importFailuresDeleted: number
  usersRemoved: number
  adminPreserved: boolean
}

export interface WipeResponse {
  success: boolean
  message: string
  summary: WipeSummary
}

export interface ServerBatchCounts {
  tutorsCreated: number
  tutorsReused: number
  patientsCreated: number
  patientsWithNume: number
  patientsWithoutNume: number
  clinicalCreated: number
  vaccinesCreated: number
  appointmentsCreated: number
  failed: number
}

export interface ServerBatchFailure {
  linha: number
  ctrl?: string
  tutor?: string
  animal?: string
  tipo: string
  erro: string
  trecho?: string
}

export interface ServerBatchResponse {
  success: boolean
  counts: ServerBatchCounts
  failures: ServerBatchFailure[]
  processedRows: number
}

export interface ServerImportProgress {
  phase: 'wiping' | 'importing' | 'completed' | 'error'
  current: number
  total: number
  percent: number
  statusMessage: string
  wipeSummary?: WipeSummary
  counts: ServerBatchCounts
}

export interface ServerImportFinalReport {
  success: boolean
  durationSeconds: number
  totalRows: number
  wipeSummary?: WipeSummary
  counts: ServerBatchCounts
  failures: ServerBatchFailure[]
}

export class ServerImportPipelineService {
  /**
   * Executa o wipe completo preservando apenas o admin bluedata@bluedatainfo.com.br
   */
  async executeWipe(): Promise<WipeResponse> {
    return pb.send<WipeResponse>('/backend/v1/import/wipe', {
      method: 'POST',
    })
  }

  /**
   * Executa a importação completa:
   * 1. Wipe automático primeiro
   * 2. Envio sequencial em lotes para o servidor
   * 3. Resumo final detalhado com conferência de NUME
   */
  async executeFullServerImport(
    rawRows: Record<string, string>[],
    options: {
      batchSize?: number
      onProgress?: (progress: ServerImportProgress) => void
    } = {},
  ): Promise<ServerImportFinalReport> {
    const startTime = Date.now()
    const batchSize = options.batchSize || 200
    const total = rawRows.length

    const aggregatedCounts: ServerBatchCounts = {
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

    const allFailures: ServerBatchFailure[] = []

    // 1. FASE DE WIPE
    if (options.onProgress) {
      options.onProgress({
        phase: 'wiping',
        current: 0,
        total,
        percent: 0,
        statusMessage:
          'Zerando a base de dados no servidor e preservando o usuário administrador...',
        counts: { ...aggregatedCounts },
      })
    }

    const wipeRes = await this.executeWipe()
    const wipeSummary = wipeRes.summary

    // 2. FASE DE IMPORTAÇÃO EM LOTES PELO SERVIDOR
    const totalBatches = Math.ceil(total / batchSize)
    let processedRows = 0

    for (let b = 0; b < totalBatches; b++) {
      const startIdx = b * batchSize
      const currentBatch = rawRows.slice(startIdx, startIdx + batchSize)
      const startLine = startIdx + 1

      if (options.onProgress) {
        options.onProgress({
          phase: 'importing',
          current: processedRows,
          total,
          percent: Math.round((processedRows / total) * 100),
          statusMessage: `Processando no servidor: linhas ${startLine} a ${startLine + currentBatch.length - 1} (${processedRows} de ${total})...`,
          wipeSummary,
          counts: { ...aggregatedCounts },
        })
      }

      try {
        const batchRes = await pb.send<ServerBatchResponse>('/backend/v1/import/process-batch', {
          method: 'POST',
          body: {
            rows: currentBatch,
            startLineNumber: startLine,
          },
        })

        if (batchRes.counts) {
          aggregatedCounts.tutorsCreated += batchRes.counts.tutorsCreated || 0
          aggregatedCounts.tutorsReused += batchRes.counts.tutorsReused || 0
          aggregatedCounts.patientsCreated += batchRes.counts.patientsCreated || 0
          aggregatedCounts.patientsWithNume += batchRes.counts.patientsWithNume || 0
          aggregatedCounts.patientsWithoutNume += batchRes.counts.patientsWithoutNume || 0
          aggregatedCounts.clinicalCreated += batchRes.counts.clinicalCreated || 0
          aggregatedCounts.vaccinesCreated += batchRes.counts.vaccinesCreated || 0
          aggregatedCounts.appointmentsCreated += batchRes.counts.appointmentsCreated || 0
        }

        if (batchRes.failures && batchRes.failures.length > 0) {
          allFailures.push(...batchRes.failures)
        }
      } catch (batchErr: any) {
        console.error('Erro no lote server-side:', batchErr)
        allFailures.push({
          linha: startLine,
          tipo: 'batch_server_error',
          erro: batchErr?.message || 'Erro de comunicação ao processar lote no servidor.',
          trecho: `Linhas ${startLine} a ${startLine + currentBatch.length - 1}`,
        })
      }

      processedRows += currentBatch.length

      if (options.onProgress) {
        options.onProgress({
          phase: 'importing',
          current: processedRows,
          total,
          percent: Math.round((processedRows / total) * 100),
          statusMessage: `Concluído lote de ${currentBatch.length} registros (${processedRows} de ${total}).`,
          wipeSummary,
          counts: { ...aggregatedCounts },
        })
      }
    }

    aggregatedCounts.failed = allFailures.length
    const durationSeconds = Math.round((Date.now() - startTime) / 1000)

    // Gravar o resumo em import_progress para histórico oficial
    try {
      await pb.collection('import_progress').create({
        file_name: 'RECARGA_OFICIAL_12_10',
        total_file_rows: total,
        last_processed_line: total,
        last_range_start: 1,
        last_range_end: total,
        completed_at: new Date().toISOString(),
        summary: {
          durationSeconds,
          wipeSummary,
          counts: aggregatedCounts,
          failuresCount: allFailures.length,
          numeVerification: {
            patientsWithNume: aggregatedCounts.patientsWithNume,
            patientsWithoutNume: aggregatedCounts.patientsWithoutNume,
            isZeroWithoutNume: aggregatedCounts.patientsWithoutNume === 0,
          },
        },
      })
    } catch (saveErr) {
      console.warn('Erro ao salvar import_progress da recarga oficial:', saveErr)
    }

    return {
      success: allFailures.length === 0,
      durationSeconds,
      totalRows: total,
      wipeSummary,
      counts: aggregatedCounts,
      failures: allFailures,
    }
  }
}

export const serverImportPipelineService = new ServerImportPipelineService()
