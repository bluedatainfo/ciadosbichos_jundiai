/**
 * Helper / Serviço reutilizável de Busca Principal Tutor + Animal
 * Usado em /pacientes e preparado para reutilização em /receituario.
 *
 * Características:
 * - Resultado como dupla tutor + animais
 * - Busca multi-palavra (todas as palavras presentes em tutor e/ou animal, em qualquer ordem)
 * - Tolerante a acentuação e case-insensitive (buildFieldVariantsFilter / removeAccents)
 * - Relevância: correspondência exata e por início de nome primeiro; busca mista prioriza par onde ambos aparecem
 * - Filtros complementares: Espécie, Raça, Telefone do tutor (tolerante a pontuação)
 * - Carregamento em lotes (50) com suporte a paginação contínua ("Carregar mais")
 */

import pb from '@/lib/pocketbase/client'
import { Patient, Tutor } from '@/lib/types'
import { buildFieldVariantsFilter, removeAccents, escapePbFilter } from '@/lib/search-utils'

export interface TutorAnimalPair {
  tutor: Tutor
  /** Paciente em foco / correspondente diretamente à busca (se aplicável) */
  matchedPatient?: Patient
  /** Se o termo buscou principalmente o nome do animal */
  isAnimalMatch: boolean
  /** Todos os animais associados ao tutor carregados no contexto */
  associatedPatients: Patient[]
  /** Score de relevância calculado para ordenação */
  relevanceScore: number
}

export interface TutorAnimalSearchFilters {
  query?: string
  species?: string
  breed?: string
  phone?: string
  page?: number
  perPage?: number
}

export interface TutorAnimalSearchResult {
  items: TutorAnimalPair[]
  totalItems: number
  page: number
  perPage: number
  totalPages: number
  hasMore: boolean
}

/**
 * Constrói os fragmentos de busca para telefone tolerante a pontuação.
 * Ex: '99999-1111' -> apenas dígitos '999991111' ou com traço '99999-1111'
 */
export function buildPhoneSearchFilter(phoneTerm: string): string {
  const trimmed = phoneTerm.trim()
  if (!trimmed) return ''

  const digitsOnly = trimmed.replace(/\D/g, '')
  const variants = new Set<string>()
  variants.add(trimmed)
  if (digitsOnly) {
    variants.add(digitsOnly)
    // Se tiver 8 ou 9 dígitos, pode ser xxxx-xxxx ou xxxxx-xxxx
    if (digitsOnly.length === 8) {
      variants.add(`${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`)
    } else if (digitsOnly.length === 9) {
      variants.add(`${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`)
    } else if (digitsOnly.length === 10) {
      // (xx) xxxx-xxxx
      variants.add(`${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`)
      variants.add(digitsOnly.slice(2))
    } else if (digitsOnly.length === 11) {
      // (xx) xxxxx-xxxx
      variants.add(`${digitsOnly.slice(2, 7)}-${digitsOnly.slice(7)}`)
      variants.add(digitsOnly.slice(2))
    }
  }

  const parts: string[] = []
  for (const v of variants) {
    const esc = escapePbFilter(v)
    parts.push(`tutor_id.phone ~ "${esc}"`)
    parts.push(`tutor_id.phone_secondary ~ "${esc}"`)
    parts.push(`tutor_id.tel3 ~ "${esc}"`)
  }

  return parts.length > 0 ? `(${parts.join(' || ')})` : ''
}

/**
 * Constrói o filtro PocketBase para a busca multi-palavra em patients + tutor_id.
 * Cada palavra precisa aparecer em tutor_id.name OU em patient.name (ou nume/ctrl).
 */
export function buildMultiWordSearchFilter(
  query: string,
  species?: string,
  breed?: string,
  phone?: string,
): string {
  const filterParts: string[] = []

  const words = query
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)

  if (words.length > 0) {
    // Para cada palavra, constrói condição OR entre campos de tutor e paciente
    const wordConditions: string[] = []

    for (const word of words) {
      const tutorNamePart = buildFieldVariantsFilter('tutor_id.name', word)
      const patientNamePart = buildFieldVariantsFilter('name', word)
      const cleanWord = escapePbFilter(word)
      const patientCodePart = `nume ~ "${cleanWord}" || ctrl ~ "${cleanWord}"`

      const orTerms = [tutorNamePart, patientNamePart, patientCodePart].filter(Boolean)
      if (orTerms.length > 0) {
        wordConditions.push(`(${orTerms.join(' || ')})`)
      }
    }

    if (wordConditions.length > 0) {
      // Todas as palavras devem ser satisfeitas (AND)
      filterParts.push(`(${wordConditions.join(' && ')})`)
    }
  }

  // Filtro de espécie
  if (species && species !== 'all' && species.trim()) {
    const cleanSpecies = escapePbFilter(species.trim())
    if (cleanSpecies.toLowerCase() === 'outro' || cleanSpecies.toLowerCase() === 'outros') {
      filterParts.push(
        `species != "Canino" && species != "Cão" && species != "Felino" && species != "Gato"`,
      )
    } else {
      filterParts.push(`species = "${cleanSpecies}"`)
    }
  }

  // Filtro de raça
  if (breed && breed !== 'all' && breed.trim()) {
    const cleanBreed = escapePbFilter(breed.trim())
    filterParts.push(`breed ~ "${cleanBreed}"`)
  }

  // Filtro de telefone
  if (phone && phone.trim()) {
    const phoneFilter = buildPhoneSearchFilter(phone)
    if (phoneFilter) {
      filterParts.push(phoneFilter)
    }
  }

  return filterParts.join(' && ')
}

/**
 * Normaliza string removendo acentos, pontuação e convertendo para lowercase
 */
export function normalizeSearchStr(str: string): string {
  return removeAccents(str || '')
    .toLowerCase()
    .trim()
}

/**
 * Calcula a relevância de um paciente / tutor para o termo buscado.
 * Pontuação maior = mais relevante.
 * - Correspondência exata de tutor ou animal = 1000+
 * - Início de nome = 500+
 * - Palavras presentes em ambos tutor E animal = bônus 300
 * - Ambas as palavras encontradas no tutor = bônus 200
 */
export function calculateRelevance(
  patient: Patient,
  tutor: Tutor | undefined,
  query: string,
): { score: number; isAnimalMatch: boolean } {
  const normQuery = normalizeSearchStr(query)
  if (!normQuery) {
    return { score: 10, isAnimalMatch: false }
  }

  const queryWords = normQuery.split(/\s+/).filter(Boolean)
  const normPatientName = normalizeSearchStr(patient.name || '')
  const normTutorName = normalizeSearchStr(tutor?.name || '')

  let score = 0
  let animalHits = 0
  let tutorHits = 0

  // 1. Checagem de correspondência exata da query completa
  if (normTutorName === normQuery) {
    score += 1200
  } else if (normPatientName === normQuery) {
    score += 1000
  }

  // 2. Checagem de início de nome
  if (normTutorName.startsWith(normQuery)) {
    score += 600
  }
  if (normPatientName.startsWith(normQuery)) {
    score += 550
  }

  // 3. Checagem palavra por palavra
  for (const word of queryWords) {
    let wordHitPatient = false
    let wordHitTutor = false

    if (normPatientName === word) {
      score += 250
      wordHitPatient = true
    } else if (normPatientName.startsWith(word)) {
      score += 180
      wordHitPatient = true
    } else if (normPatientName.includes(word)) {
      score += 100
      wordHitPatient = true
    }

    if (normTutorName === word) {
      score += 260
      wordHitTutor = true
    } else if (normTutorName.startsWith(word)) {
      score += 190
      wordHitTutor = true
    } else if (normTutorName.includes(word)) {
      score += 110
      wordHitTutor = true
    }

    if (wordHitPatient) animalHits++
    if (wordHitTutor) tutorHits++
  }

  // 4. Bônus quando as palavras aparecem divididas ou presentes em ambos (ex: "FRANCISCO MARIA")
  if (animalHits > 0 && tutorHits > 0) {
    score += 350
  } else if (tutorHits >= queryWords.length && queryWords.length > 1) {
    score += 250
  } else if (animalHits >= queryWords.length && queryWords.length > 1) {
    score += 200
  }

  // Código oficial NUME exato
  if (patient.nume && patient.nume.trim() === normQuery) {
    score += 1500
  }

  // Define se o destaque principal deve ser o animal
  // (se o nome do animal tiver correspondência mais forte com os termos)
  const isAnimalMatch = animalHits > tutorHits || normPatientName.includes(normQuery)

  return { score, isAnimalMatch }
}

/**
 * Executa a busca paginada em lote (50) trazendo pares tutor + animais
 */
export async function searchTutorAnimalPairs(
  filters: TutorAnimalSearchFilters,
): Promise<TutorAnimalSearchResult> {
  const page = filters.page || 1
  const perPage = filters.perPage || 50
  const query = filters.query?.trim() || ''

  const pbFilter = buildMultiWordSearchFilter(query, filters.species, filters.breed, filters.phone)

  // Realiza a busca paginada na collection 'patients' com expand em 'tutor_id'
  const res = await pb.collection('patients').getList<Patient>(page, perPage, {
    filter: pbFilter,
    expand: 'tutor_id',
    sort: '-created',
  })

  // Para enriquecer a visualização de "dupla tutor com animais associados ao lado",
  // agrupamos os tutores encontrados e garantimos seus animais carregados
  const tutorIdsToFetch = new Set<string>()
  for (const patient of res.items) {
    if (patient.tutor_id) {
      tutorIdsToFetch.add(patient.tutor_id)
    }
  }

  // Se houver tutores no lote, buscar os outros animais desses tutores em paralelo
  // para que a dupla mostre todos os animais do tutor
  const tutorPatientsMap = new Map<string, Patient[]>()
  if (tutorIdsToFetch.size > 0) {
    try {
      const tutorIdsList = Array.from(tutorIdsToFetch).slice(0, 50)
      const tutorFilter = tutorIdsList.map((id) => `tutor_id = "${id}"`).join(' || ')
      const allTutorPatients = await pb.collection('patients').getFullList<Patient>({
        filter: tutorFilter,
        sort: 'name',
      })
      for (const p of allTutorPatients) {
        if (p.tutor_id) {
          const list = tutorPatientsMap.get(p.tutor_id) || []
          list.push(p)
          tutorPatientsMap.set(p.tutor_id, list)
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar animais associados dos tutores:', e)
    }
  }

  // Monta a lista de pares
  const pairs: TutorAnimalPair[] = res.items.map((patient) => {
    const tutor: Tutor = patient.expand?.tutor_id || {
      id: patient.tutor_id || '',
      name: 'Tutor não identificado',
      phone: '',
      email: '',
      cpf: '',
      address: '',
    }

    const { score, isAnimalMatch } = calculateRelevance(patient, tutor, query)

    // Lista de animais associados ao tutor (garantindo que o paciente atual esteja incluído)
    let associated = tutorPatientsMap.get(tutor.id) || []
    if (!associated.some((p) => p.id === patient.id)) {
      associated = [patient, ...associated]
    }

    return {
      tutor,
      matchedPatient: patient,
      isAnimalMatch,
      associatedPatients: associated,
      relevanceScore: score,
    }
  })

  // Se houver busca textual, ordena por relevância dentro do lote
  if (query) {
    pairs.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }

  return {
    items: pairs,
    totalItems: res.totalItems,
    page: res.page,
    perPage: res.perPage,
    totalPages: res.totalPages,
    hasMore: res.page < res.totalPages,
  }
}
