import pb from '@/lib/pocketbase/client'

export interface ImportProgressRecord {
  id: string
  file_name: string
  total_file_rows?: number
  last_processed_line: number
  last_range_start?: number
  last_range_end?: number
  completed_at: string
  summary?: {
    tutorsCreated?: number
    patientsCreated?: number
    clinicalEntriesCreated?: number
    vaccinesCreated?: number
    appointmentsCreated?: number
    failed?: number
  }
  created: string
  updated: string
}

const LOCAL_STORAGE_KEY = 'vet_access_import_progress'

export const importProgressService = {
  /**
   * Obtém o progresso salvo mais recente (PocketBase com fallback seguro para localStorage)
   */
  async getLatestProgress(fileName?: string): Promise<ImportProgressRecord | null> {
    try {
      if (pb.authStore.isValid) {
        let filter = ''
        if (fileName) {
          filter = `file_name = "${fileName.replace(/"/g, '\\"')}"`
        }
        const records = await pb.collection('import_progress').getList<ImportProgressRecord>(1, 1, {
          sort: '-updated',
          filter,
        })
        if (records.items.length > 0) {
          const item = records.items[0]
          // Salvar também localmente para garantir redundância
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(item))
          } catch {
            /* intentionally ignored */
          }
          return item
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar import_progress no PocketBase, usando cache local:', err)
    }

    // Fallback: localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ImportProgressRecord
        if (!fileName || parsed.file_name === fileName) {
          return parsed
        }
      }
    } catch {
      /* intentionally ignored */
    }

    return null
  },

  /**
   * Salva o progresso ao concluir uma faixa ou lote
   */
  async saveProgress(data: {
    fileName: string
    totalFileRows?: number
    lastProcessedLine: number
    lastRangeStart?: number
    lastRangeEnd?: number
    summary?: ImportProgressRecord['summary']
  }): Promise<ImportProgressRecord | null> {
    const completedAt = new Date().toISOString()
    const payload = {
      file_name: data.fileName,
      total_file_rows: data.totalFileRows || 0,
      last_processed_line: data.lastProcessedLine,
      last_range_start: data.lastRangeStart || 1,
      last_range_end: data.lastRangeEnd || data.lastProcessedLine,
      completed_at: completedAt,
      summary: data.summary || {},
    }

    let savedRecord: ImportProgressRecord | null = null

    try {
      if (pb.authStore.isValid) {
        // Tentar encontrar se já existe registro para esse arquivo
        const existing = await pb
          .collection('import_progress')
          .getList<ImportProgressRecord>(1, 1, {
            filter: `file_name = "${data.fileName.replace(/"/g, '\\"')}"`,
          })

        if (existing.items.length > 0) {
          savedRecord = await pb
            .collection('import_progress')
            .update<ImportProgressRecord>(existing.items[0].id, payload)
        } else {
          savedRecord = await pb.collection('import_progress').create<ImportProgressRecord>(payload)
        }
      }
    } catch (err) {
      console.warn('Falha ao persistir import_progress no PocketBase:', err)
    }

    // Fallback/Redundância no localStorage
    const localFallback: ImportProgressRecord = {
      id: savedRecord?.id || `local_${Date.now()}`,
      file_name: payload.file_name,
      total_file_rows: payload.total_file_rows,
      last_processed_line: payload.last_processed_line,
      last_range_start: payload.last_range_start,
      last_range_end: payload.last_range_end,
      completed_at: payload.completed_at,
      summary: payload.summary,
      created: savedRecord?.created || completedAt,
      updated: savedRecord?.updated || completedAt,
    }

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localFallback))
    } catch {
      /* intentionally ignored */
    }

    return savedRecord || localFallback
  },

  /**
   * Zera/limpa o progresso salvo (útil para reiniciar importação do zero)
   */
  async clearProgress(fileName?: string): Promise<void> {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY)
    } catch {
      /* intentionally ignored */
    }

    try {
      if (pb.authStore.isValid) {
        let filter = ''
        if (fileName) {
          filter = `file_name = "${fileName.replace(/"/g, '\\"')}"`
        }
        const records = await pb.collection('import_progress').getFullList({ filter })
        for (const r of records) {
          await pb.collection('import_progress').delete(r.id)
        }
      }
    } catch (err) {
      console.warn('Erro ao limpar import_progress no PocketBase:', err)
    }
  },
}
