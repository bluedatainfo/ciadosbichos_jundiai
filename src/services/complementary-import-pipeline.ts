import pb from '@/lib/pocketbase/client'

export interface ComplementaryImportCounts {
  linesRead: number
  tutorsMatched: number
  fieldsFilled: number
  notMatched: number
  tel3Filled: number
  dbdtFilled: number
  dbtxFilled: number
  skippedAlreadyFilled: number
}

export interface ComplementaryBatchResponse {
  success: boolean
  counts: ComplementaryImportCounts
  processedRows: number
  error?: string
}

export interface ComplementaryImportProgress {
  current: number
  total: number
  percent: number
  statusMessage: string
  counts: ComplementaryImportCounts
}

export interface ComplementaryImportFinalReport {
  success: boolean
  counts: ComplementaryImportCounts
  durationMs: number
}

export class ComplementaryImportPipelineService {
  async executeComplementaryImport(
    rows: any[],
    options: {
      batchSize?: number
      onProgress?: (p: ComplementaryImportProgress) => void
    } = {},
  ): Promise<ComplementaryImportFinalReport> {
    const batchSize = options.batchSize || 200
    const total = rows.length
    const startTime = Date.now()

    const totalCounts: ComplementaryImportCounts = {
      linesRead: 0,
      tutorsMatched: 0,
      fieldsFilled: 0,
      notMatched: 0,
      tel3Filled: 0,
      dbdtFilled: 0,
      dbtxFilled: 0,
      skippedAlreadyFilled: 0,
    }

    if (total === 0) {
      return {
        success: true,
        counts: totalCounts,
        durationMs: 0,
      }
    }

    // Processar em lotes
    for (let i = 0; i < total; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)
      const startLineNumber = i + 1

      const currentProcessed = Math.min(i + chunk.length, total)
      const percent = Math.round((currentProcessed / total) * 100)

      options.onProgress?.({
        current: currentProcessed,
        total,
        percent,
        statusMessage: `Processando linhas ${startLineNumber.toLocaleString('pt-BR')} a ${currentProcessed.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}...`,
        counts: { ...totalCounts },
      })

      const res = await pb.send<ComplementaryBatchResponse>(
        '/backend/v1/import/complementary-batch',
        {
          method: 'POST',
          body: {
            rows: chunk,
            startLineNumber,
          },
        },
      )

      if (res && res.counts) {
        totalCounts.linesRead += res.counts.linesRead || chunk.length
        totalCounts.tutorsMatched += res.counts.tutorsMatched || 0
        totalCounts.fieldsFilled += res.counts.fieldsFilled || 0
        totalCounts.notMatched += res.counts.notMatched || 0
        totalCounts.tel3Filled += res.counts.tel3Filled || 0
        totalCounts.dbdtFilled += res.counts.dbdtFilled || 0
        totalCounts.dbtxFilled += res.counts.dbtxFilled || 0
        totalCounts.skippedAlreadyFilled += res.counts.skippedAlreadyFilled || 0
      }
    }

    const durationMs = Date.now() - startTime

    options.onProgress?.({
      current: total,
      total,
      percent: 100,
      statusMessage: `Importação Complementar concluída com sucesso em ${(durationMs / 1000).toFixed(1)}s!`,
      counts: { ...totalCounts },
    })

    return {
      success: true,
      counts: totalCounts,
      durationMs,
    }
  }
}

export const complementaryImportPipelineService = new ComplementaryImportPipelineService()
