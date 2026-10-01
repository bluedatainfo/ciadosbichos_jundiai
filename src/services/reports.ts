import pb from '@/lib/pocketbase/client'
import { Patient, Tutor, Vaccine } from '@/lib/types'
import { parseISO, format, isValid } from 'date-fns'

export interface ReturnReportFilters {
  animalName?: string
  species?: string
  breed?: string
  gender?: string
  lastVisitFrom?: string // 'YYYY-MM-DD'
  lastVisitTo?: string // 'YYYY-MM-DD'
  birthDateFrom?: string // 'YYYY-MM-DD'
  birthDateTo?: string // 'YYYY-MM-DD'
  birthdayDayMonth?: string // 'DD/MM' ou 'MM-DD'
  returnDateFrom?: string // 'YYYY-MM-DD'
  returnDateTo?: string // 'YYYY-MM-DD'
}

export interface ReturnReportRow {
  id: string // vaccine id ou patient id
  vaccineId?: string
  patientId: string
  code?: string // opcional (mantido retrocompatível se necessário)
  tutorName: string
  tutorPhone: string
  animalName: string
  species: string
  breed: string
  gender: string
  returnDate?: string
  returnReason?: string
  lastVisit?: string
  birthDate?: string
}

export interface DistinctFilterOptions {
  species: string[]
  breeds: string[]
}

/**
 * Normaliza número para link de WhatsApp
 */
export function buildWhatsAppLink(phone: string, animalName: string): string {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (!cleanPhone) return ''
  const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
  const msg = encodeURIComponent(
    `Olá! Entramos em contato da clínica veterinária para lembrar sobre o retorno do seu pet ${animalName}.`,
  )
  return `https://wa.me/${number}?text=${msg}`
}

export function buildBirthdayWhatsAppLink(
  phone: string,
  animalName: string,
  turningAge?: number | null,
): string {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (!cleanPhone) return ''
  const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
  const ageText =
    turningAge && turningAge > 0
      ? ` que está completando ${turningAge} ${turningAge === 1 ? 'ano' : 'anos'}`
      : ''
  const msg = encodeURIComponent(
    `Parabéns! 🎂 Toda a equipe da clínica veterinária deseja um feliz aniversário para o(a) querido(a) ${animalName}${ageText}! Muita saúde e alegria! 🐾🎉`,
  )
  return `https://wa.me/${number}?text=${msg}`
}

export function buildVaccineWhatsAppLink(phone: string, animalName: string): string {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (!cleanPhone) return ''
  const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
  const msg = encodeURIComponent(
    `Olá! Notamos em nosso sistema que a vacinação do seu pet ${animalName} está pendente/atrasada. A imunização é fundamental para a saúde dele. Gostaria de agendar a vacinação?`,
  )
  return `https://wa.me/${number}?text=${msg}`
}

/**
 * Busca valores distintos de espécies e raças existentes no banco
 */
export async function getDistinctSpeciesAndBreeds(): Promise<DistinctFilterOptions> {
  try {
    const records = await pb.collection('patients').getFullList<Patient>({
      fields: 'species,breed',
      sort: 'species,breed',
    })

    const speciesSet = new Set<string>()
    const breedsSet = new Set<string>()

    for (const r of records) {
      if (r.species && typeof r.species === 'string' && r.species.trim()) {
        speciesSet.add(r.species.trim())
      }
      if (r.breed && typeof r.breed === 'string' && r.breed.trim()) {
        breedsSet.add(r.breed.trim())
      }
    }

    return {
      species: Array.from(speciesSet)
        .filter((s) => Boolean(s && s.trim()))
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
      breeds: Array.from(breedsSet)
        .filter((b) => Boolean(b && b.trim()))
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }
  } catch (err) {
    console.error('Erro ao carregar espécies e raças distintas:', err)
    return {
      species: ['Canino', 'Felino', 'Ave', 'Silvestre', 'Outro'],
      breeds: [],
    }
  }
}

/**
 * Executa a busca filtrada de retornos
 */
export async function fetchReturnReportData(
  filters: ReturnReportFilters,
): Promise<ReturnReportRow[]> {
  // Construção do filtro para PocketBase na collection 'vaccines'
  // A regra de negócio:
  // 1. Excluir óbitos (patient_id.deceased = false)
  // 2. Considerar apenas retornos NÃO realizados (completed = false || completed = null)
  // 3. Data de retorno válida se especificada
  const vaccineFilters: string[] = [
    `patient_id.deceased = false`,
    `(completed = false || completed = null)`,
  ]

  if (filters.returnDateFrom) {
    const fromIso = `${filters.returnDateFrom} 00:00:00.000Z`
    vaccineFilters.push(`date >= "${fromIso}"`)
  }

  if (filters.returnDateTo) {
    const toIso = `${filters.returnDateTo} 23:59:59.999Z`
    vaccineFilters.push(`date <= "${toIso}"`)
  }

  if (filters.animalName && filters.animalName.trim()) {
    const clean = filters.animalName.trim().replace(/"/g, '\\"')
    vaccineFilters.push(`patient_id.name ~ "${clean}"`)
  }

  if (filters.species && filters.species !== 'all') {
    const clean = filters.species.trim().replace(/"/g, '\\"')
    vaccineFilters.push(`patient_id.species = "${clean}"`)
  }

  if (filters.breed && filters.breed !== 'all') {
    const clean = filters.breed.trim().replace(/"/g, '\\"')
    vaccineFilters.push(`patient_id.breed = "${clean}"`)
  }

  if (filters.gender && filters.gender !== 'all') {
    vaccineFilters.push(`patient_id.gender = "${filters.gender}"`)
  }

  if (filters.birthDateFrom) {
    const fromIso = `${filters.birthDateFrom} 00:00:00.000Z`
    vaccineFilters.push(`patient_id.birth_date >= "${fromIso}"`)
  }

  if (filters.birthDateTo) {
    const toIso = `${filters.birthDateTo} 23:59:59.999Z`
    vaccineFilters.push(`patient_id.birth_date <= "${toIso}"`)
  }

  if (filters.lastVisitFrom) {
    const fromIso = `${filters.lastVisitFrom} 00:00:00.000Z`
    vaccineFilters.push(`patient_id.last_visit >= "${fromIso}"`)
  }

  if (filters.lastVisitTo) {
    const toIso = `${filters.lastVisitTo} 23:59:59.999Z`
    vaccineFilters.push(`patient_id.last_visit <= "${toIso}"`)
  }

  const finalFilter = vaccineFilters.join(' && ')

  // Busca na collection 'vaccines' com expand para patient_id e tutor_id
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
    filter: finalFilter,
    sort: 'date',
    expand: 'patient_id.tutor_id',
  })

  // Se tiver filtro de Aniversário (dia/mês, independente do ano)
  let parsedBirthdayDay: number | null = null
  let parsedBirthdayMonth: number | null = null
  if (filters.birthdayDayMonth) {
    const parts = filters.birthdayDayMonth.split('/')
    if (parts.length === 2) {
      parsedBirthdayDay = parseInt(parts[0], 10)
      parsedBirthdayMonth = parseInt(parts[1], 10)
    }
  }

  const rows: ReturnReportRow[] = []

  for (const v of vaccineRecords) {
    const p = v.expand?.patient_id
    if (!p) continue
    if (p.deceased) continue

    // Checagem em memória de aniversário (dia/mês) caso fornecido
    if (parsedBirthdayDay !== null && parsedBirthdayMonth !== null) {
      if (!p.birth_date) continue
      try {
        const d = parseISO(p.birth_date)
        if (!isValid(d)) continue
        // getUTCDate / getUTCMonth ou getDate / getMonth
        // Nas datas importadas tipo 2003-01-14 12:00:00.000Z, podemos verificar local/UTC
        const bDay = d.getUTCDate()
        const bMonth = d.getUTCMonth() + 1
        if (bDay !== parsedBirthdayDay || bMonth !== parsedBirthdayMonth) {
          continue
        }
      } catch {
        continue
      }
    }

    const tutor = p.expand?.tutor_id
    // Código: preferência para CTRL (código legado ex: 16884, C1), se não houver ou for 0, usa p.id
    const code =
      p.ctrl && p.ctrl !== '0' && p.ctrl.trim() !== '' ? p.ctrl.trim() : p.id.toUpperCase()

    rows.push({
      id: v.id,
      vaccineId: v.id,
      patientId: p.id,
      code,
      tutorName: tutor?.name || 'Não informado',
      tutorPhone: tutor?.phone || tutor?.phone_secondary || '',
      animalName: p.name || 'Sem nome',
      species: p.species || '',
      breed: p.breed || '',
      gender: p.gender || '',
      returnDate: v.date || '',
      returnReason: v.name || v.notes || 'Retorno',
      lastVisit: p.last_visit || '',
      birthDate: p.birth_date || '',
    })
  }

  return rows
}

export interface BirthdayReportFilters {
  month: number // 1 a 12
  day?: number // 1 a 31
  species?: string
  search?: string
  page?: number
  limit?: number
}

export interface BirthdayReportItem {
  id: string
  patientId: string
  animalName: string
  species: string
  breed: string
  gender: string
  ctrl: string
  birthDate: string
  birthdayDay: number | null
  birthdayMonth: number
  turningAge: number | null
  tutorName: string
  tutorPhone: string
}

export interface BirthdayReportResponse {
  total: number
  page: number
  limit: number
  totalPages: number
  month: number
  items: BirthdayReportItem[]
}

/**
 * Busca aniversariantes do mês com contagem e paginação otimizadas
 */
export async function fetchBirthdaysReport(
  filters: BirthdayReportFilters,
): Promise<BirthdayReportResponse> {
  const params = new URLSearchParams()
  params.set('month', String(filters.month))
  if (filters.day && filters.day > 0) params.set('day', String(filters.day))
  if (filters.species && filters.species !== 'all') params.set('species', filters.species)
  if (filters.search && filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  return pb.send<BirthdayReportResponse>(`/backend/v1/reports/birthdays?${params.toString()}`, {
    method: 'GET',
  })
}

export interface PendingVaccinesReportFilters {
  species?: string
  intervalMonths?: number
  status?: 'all' | 'overdue' | 'no_record'
  search?: string
  page?: number
  limit?: number
}

export interface PendingVaccineReportItem {
  id: string
  patientId: string
  animalName: string
  species: string
  breed: string
  gender: string
  ctrl: string
  lastVisit: string | null
  birthDate: string | null
  tutorName: string
  tutorPhone: string
  lastVaccineDate: string | null
  situation: string
  status: 'overdue' | 'no_record'
  vaccineCount: number
}

export interface PendingVaccinesReportResponse {
  total: number
  page: number
  limit: number
  totalPages: number
  cutoffDate: string
  intervalMonths: number
  items: PendingVaccineReportItem[]
}

/**
 * Busca vacinas pendentes e atrasadas com contagem agregada e paginação
 */
export async function fetchPendingVaccinesReport(
  filters: PendingVaccinesReportFilters,
): Promise<PendingVaccinesReportResponse> {
  const params = new URLSearchParams()
  if (filters.intervalMonths) params.set('interval_months', String(filters.intervalMonths))
  if (filters.species && filters.species !== 'all') params.set('species', filters.species)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.search && filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  return pb.send<PendingVaccinesReportResponse>(
    `/backend/v1/reports/pending-vaccines?${params.toString()}`,
    {
      method: 'GET',
    },
  )
}

export interface SpeciesDistributionItem {
  species: string
  count: number
  percentage: number
}

export interface GenderDistributionItem {
  gender: string
  count: number
  percentage: number
}

export interface TopBreedItem {
  breed: string
  count: number
}

export interface SpeciesStatsReportResponse {
  totalTutors: number
  totalPatients: number
  totalAlivePatients: number
  totalDeceasedPatients: number
  totalVaccines: number
  speciesDistribution: SpeciesDistributionItem[]
  genderDistribution: GenderDistributionItem[]
  topBreedsCanine: TopBreedItem[]
  topBreedsFeline: TopBreedItem[]
}

/**
 * Busca estatísticas consolidadas agregadas da clínica (espécies, raças, tutores, pacientes)
 */
export async function fetchSpeciesStatsReport(): Promise<SpeciesStatsReportResponse> {
  return pb.send<SpeciesStatsReportResponse>('/backend/v1/reports/species-stats', {
    method: 'GET',
  })
}
