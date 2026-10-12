/**
 * Funções utilitárias e geradores de Hash Estável para a Sincronização Incremental
 */
import { sanitizeText, normalizeDate } from './access-migration-utils'

/**
 * Algoritmo FNV-1a de 32 bits em string hexadecimal estável.
 * Rápido, determinístico e não requer bibliotecas de terceiros.
 */
export function stringHash(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Normaliza um texto para cálculo de hash independente de pontuações fúteis ou espaços múltiplos.
 */
export function normalizeForHash(val: string | null | undefined): string {
  if (!val) return ''
  return sanitizeText(val).replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Gera um hash estável e determinístico para uma entrada de ficha clínica.
 * Considera: patient_id + descrição normalizada
 */
export function generateClinicalRecordHash(patientId: string, description: string): string {
  const normDesc = normalizeForHash(description)
  return stringHash(`clin:${patientId}:${normDesc}`)
}

/**
 * Gera um hash estável e determinístico para um agendamento / retorno.
 * Considera: patient_id + data (YYYY-MM-DD) + tipo + notas resumidas
 */
export function generateAppointmentHash(
  patientId: string,
  date: string,
  type: string,
  notes: string,
): string {
  const normDate = date.slice(0, 10)
  const normNotes = normalizeForHash(notes)
  const normType = (type || 'consultation').toLowerCase()
  return stringHash(`app:${patientId}:${normDate}:${normType}:${normNotes}`)
}

/**
 * Gera um hash estável e determinístico para uma vacinação.
 * Considera: patient_id + data (YYYY-MM-DD se houver) + nome normalizado da vacina
 */
export function generateVaccineHash(patientId: string, name: string, date?: string | null): string {
  const normName = normalizeForHash(name)
  const normDate = date ? date.slice(0, 10) : ''
  return stringHash(`vac:${patientId}:${normName}:${normDate}`)
}
