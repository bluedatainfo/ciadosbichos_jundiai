import pb from '@/lib/pocketbase/client'
import { Patient, Tutor, Vaccine } from '@/lib/types'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'

export type ReturnAlertStatus = 'overdue' | 'due_soon'

export interface ReturnAlert {
  id: string
  vaccineId?: string
  patientId: string
  patientName: string
  patientSpecies: string
  patientBreed: string
  deceased?: boolean
  tutorName?: string
  tutorPhone?: string
  returnDate: string // ISO string
  description: string
  status: ReturnAlertStatus
  daysDifference: number // < 0 vencido, >= 0 próximo
}

/**
 * Busca e calcula todos os alertas de retorno com base nos registros da collection `vaccines`
 * e/ou `last_visit` de pacientes.
 * Ignora pacientes marcados como óbito (deceased = true).
 * Categoriza em:
 *  - 'overdue' (vencido: retorno com data < hoje)
 *  - 'due_soon' (próximo: retorno entre hoje e os próximos N dias, padrão 30 dias)
 */
export async function getReturnAlerts(options?: { daysAhead?: number; limit?: number }): Promise<{
  alerts: ReturnAlert[]
  overdueCount: number
  dueSoonCount: number
}> {
  const daysAhead = options?.daysAhead ?? 30
  const today = startOfDay(new Date())

  // Carrega vacinas/retornos com data cadastrada e expande o paciente e seu tutor
  // Na collection vaccines: patient_id é relation com patients
  const vaccineRecords = await pb.collection('vaccines').getFullList<
    Vaccine & {
      expand?: {
        patient_id?: Patient & {
          expand?: {
            tutor_id?: Tutor
          }
        }
      }
    }
  >({
    filter: `date != ''`,
    sort: 'date',
    expand: 'patient_id.tutor_id',
  })

  // Agrupa os retornos por paciente para pegar a data de retorno mais relevante (ou mais recente/próxima)
  // Ou avalia cada retorno com data.
  // No caso de múltiplos retornos para um mesmo animal, queremos priorizar o retorno mais recente ou futuro pendente.
  const alerts: ReturnAlert[] = []

  // Agrupamento por paciente
  const patientReturnsMap = new Map<
    string,
    Array<{ record: (typeof vaccineRecords)[0]; parsedDate: Date }>
  >()

  for (const rec of vaccineRecords) {
    if (!rec.date) continue
    const p = rec.expand?.patient_id
    if (!p) continue
    // Se o animal estiver em óbito, não deve gerar alerta de retorno
    if (p.deceased) continue

    try {
      const parsedDate = parseISO(rec.date)
      if (isNaN(parsedDate.getTime())) continue

      const list = patientReturnsMap.get(p.id) || []
      list.push({ record: rec, parsedDate })
      patientReturnsMap.set(p.id, list)
    } catch {
      // Ignora datas inválidas
    }
  }

  // Para cada paciente, determina a situação de retorno:
  // Se houver algum retorno futuro (>= hoje) dentro de daysAhead: status = 'due_soon'
  // Se só houver retornos passados (< hoje): o mais recente deles é avaliado como 'overdue'
  patientReturnsMap.forEach((returns, patientId) => {
    // Ordena do mais recente ao mais antigo
    returns.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())

    // Procura o próximo retorno futuro mais próximo de hoje
    const futureReturns = returns.filter((r) => r.parsedDate >= today)
    // Se tem retornos futuros, o retorno pendente é o menor deles (o mais próximo a vencer)
    if (futureReturns.length > 0) {
      futureReturns.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
      const nextReturn = futureReturns[0]
      const diff = differenceInCalendarDays(nextReturn.parsedDate, today)

      if (diff <= daysAhead) {
        const p = nextReturn.record.expand?.patient_id!
        const tutor = p.expand?.tutor_id
        alerts.push({
          id: `${patientId}-${nextReturn.record.id}`,
          vaccineId: nextReturn.record.id,
          patientId: p.id,
          patientName: p.name,
          patientSpecies: p.species,
          patientBreed: p.breed,
          deceased: p.deceased,
          tutorName: tutor?.name,
          tutorPhone: tutor?.phone,
          returnDate: nextReturn.record.date!,
          description: nextReturn.record.name || nextReturn.record.notes || 'Retorno',
          status: 'due_soon',
          daysDifference: diff,
        })
      }
    } else {
      // Todos os retornos deste paciente estão no passado -> pega o mais recente como vencido
      const lastReturn = returns[0]
      const diff = differenceInCalendarDays(lastReturn.parsedDate, today) // negativo
      const p = lastReturn.record.expand?.patient_id!
      const tutor = p.expand?.tutor_id

      alerts.push({
        id: `${patientId}-${lastReturn.record.id}`,
        vaccineId: lastReturn.record.id,
        patientId: p.id,
        patientName: p.name,
        patientSpecies: p.species,
        patientBreed: p.breed,
        deceased: p.deceased,
        tutorName: tutor?.name,
        tutorPhone: tutor?.phone,
        returnDate: lastReturn.record.date!,
        description: lastReturn.record.name || lastReturn.record.notes || 'Retorno',
        status: 'overdue',
        daysDifference: diff,
      })
    }
  })

  // Ordenação dos alertas:
  // 1. Vencidos primeiro (mais recentemente vencidos ou mais atrasados? Geralmente vencidos primeiro, ordenados por proximidade ou urgência)
  // Deixamos 'overdue' ordenados por data decrescente (do mais recente para o mais antigo) ou 'due_soon' ordenados pelos dias restantes (mais perto primeiro)
  alerts.sort((a, b) => {
    if (a.status === 'overdue' && b.status === 'due_soon') return -1
    if (a.status === 'due_soon' && b.status === 'overdue') return 1
    if (a.status === 'due_soon') {
      return a.daysDifference - b.daysDifference // 0 dias antes de 10 dias
    }
    return b.daysDifference - a.daysDifference // -1 dia antes de -300 dias (mais recentes)
  })

  const overdueCount = alerts.filter((a) => a.status === 'overdue').length
  const dueSoonCount = alerts.filter((a) => a.status === 'due_soon').length

  const finalAlerts = options?.limit ? alerts.slice(0, options.limit) : alerts

  return {
    alerts: finalAlerts,
    overdueCount,
    dueSoonCount,
  }
}
