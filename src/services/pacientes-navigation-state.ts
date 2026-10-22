/**
 * Gerenciador de Persistência de Estado de Navegação em /pacientes
 * Preserva o estado exato ao navegar para fichas clínicas, cadastros ou edição
 * e retornar (seja via botão do app ou Voltar do navegador).
 */

export interface MainSearchNavState {
  term: string
  scope: 'all' | 'tutor' | 'animal'
  species: string
  breed: string
  phone: string
  page: number
  drawerTutorId: string | null
}

export interface PatientsTabNavState {
  search: string
  species: string
  sortField: 'name' | 'tutor' | null
  sortDirection: 'asc' | 'desc'
  page: number
}

export interface TutorsTabNavState {
  search: string
  sortField: 'name' | null
  sortDirection: 'asc' | 'desc'
  page: number
  modalTutorId: string | null
}

export interface PacientesNavState {
  activeTab: 'patients' | 'tutors'
  mainSearch: MainSearchNavState
  patientsTab: PatientsTabNavState
  tutorsTab: TutorsTabNavState
}

const STORAGE_KEY = 'gestao_vet_pacientes_nav_state'

export const DEFAULT_PACIENTES_STATE: PacientesNavState = {
  activeTab: 'patients',
  mainSearch: {
    term: '',
    scope: 'all',
    species: 'all',
    breed: '',
    phone: '',
    page: 1,
    drawerTutorId: null,
  },
  patientsTab: {
    search: '',
    species: 'all',
    sortField: null,
    sortDirection: 'asc',
    page: 1,
  },
  tutorsTab: {
    search: '',
    sortField: null,
    sortDirection: 'asc',
    page: 1,
    modalTutorId: null,
  },
}

/**
 * Lê o estado salvo no sessionStorage (se houver)
 */
export function getSavedPacientesState(): PacientesNavState {
  if (typeof window === 'undefined') return DEFAULT_PACIENTES_STATE
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PACIENTES_STATE
    const parsed = JSON.parse(raw)
    return {
      activeTab: parsed.activeTab || DEFAULT_PACIENTES_STATE.activeTab,
      mainSearch: {
        ...DEFAULT_PACIENTES_STATE.mainSearch,
        ...(parsed.mainSearch || {}),
      },
      patientsTab: {
        ...DEFAULT_PACIENTES_STATE.patientsTab,
        ...(parsed.patientsTab || {}),
      },
      tutorsTab: {
        ...DEFAULT_PACIENTES_STATE.tutorsTab,
        ...(parsed.tutorsTab || {}),
      },
    }
  } catch (e) {
    console.warn('Erro ao ler estado de navegação de /pacientes:', e)
    return DEFAULT_PACIENTES_STATE
  }
}

/**
 * Grava o estado atual no sessionStorage e sincroniza com a URL do navegador
 */
export function persistPacientesState(
  updater: (prev: PacientesNavState) => PacientesNavState,
): PacientesNavState {
  if (typeof window === 'undefined') return DEFAULT_PACIENTES_STATE
  const current = getSavedPacientesState()
  const updated = updater(current)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.warn('Erro ao salvar estado de navegação:', e)
  }

  // Atualiza os parâmetros na URL de forma sutil sem recarregar a página
  syncStateToUrl(updated)
  return updated
}

/**
 * Monta os parâmetros de URL a partir do estado e atualiza com replaceState
 */
export function syncStateToUrl(state: PacientesNavState) {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)

    // Aba ativa
    if (state.activeTab === 'tutors') {
      params.set('tab', 'tutors')
    } else {
      params.delete('tab')
    }

    // Busca principal
    if (state.mainSearch.term.trim()) {
      params.set('q', state.mainSearch.term.trim())
    } else {
      params.delete('q')
    }

    if (state.mainSearch.scope && state.mainSearch.scope !== 'all') {
      params.set('escopo', state.mainSearch.scope)
    } else {
      params.delete('escopo')
    }

    if (state.mainSearch.species && state.mainSearch.species !== 'all') {
      params.set('sp', state.mainSearch.species)
    } else {
      params.delete('sp')
    }

    if (state.mainSearch.breed.trim()) {
      params.set('br', state.mainSearch.breed.trim())
    } else {
      params.delete('br')
    }

    if (state.mainSearch.phone.trim()) {
      params.set('ph', state.mainSearch.phone.trim())
    } else {
      params.delete('ph')
    }

    if (state.mainSearch.page > 1) {
      params.set('page', String(state.mainSearch.page))
    } else {
      params.delete('page')
    }

    if (state.mainSearch.drawerTutorId) {
      params.set('drawerTutor', state.mainSearch.drawerTutorId)
    } else {
      params.delete('drawerTutor')
    }

    // Aba de tutores - modal aberto
    if (state.tutorsTab.modalTutorId) {
      params.set('tutorModal', state.tutorsTab.modalTutorId)
    } else {
      params.delete('tutorModal')
    }

    // Aba de tutores - busca
    if (state.tutorsTab.search.trim()) {
      params.set('t_q', state.tutorsTab.search.trim())
    } else {
      params.delete('t_q')
    }

    // Aba de pacientes - busca
    if (state.patientsTab.search.trim()) {
      params.set('p_q', state.patientsTab.search.trim())
    } else {
      params.delete('p_q')
    }

    const newQuery = params.toString()
    const newUrl = newQuery ? `${window.location.pathname}?${newQuery}` : window.location.pathname
    window.history.replaceState(null, '', newUrl)
  } catch (e) {
    console.warn('Erro ao sincronizar URL:', e)
  }
}

/**
 * Lê o estado combinando parâmetros da URL com o sessionStorage
 */
export function resolveInitialPacientesState(): PacientesNavState {
  if (typeof window === 'undefined') return DEFAULT_PACIENTES_STATE

  const saved = getSavedPacientesState()
  const params = new URLSearchParams(window.location.search)

  // Prioriza o que está na URL se presente
  const tabParam = params.get('tab')
  const activeTab: 'patients' | 'tutors' =
    tabParam === 'tutors' ? 'tutors' : tabParam === 'patients' ? 'patients' : saved.activeTab

  const qParam = params.get('q')
  const escopoParam = params.get('escopo')
  const spParam = params.get('sp')
  const brParam = params.get('br')
  const phParam = params.get('ph')
  const pageParam = params.get('page')
  const drawerTutorParam = params.get('drawerTutor')

  const tutorModalParam = params.get('tutorModal')
  const tqParam = params.get('t_q')
  const pqParam = params.get('p_q')

  const mainSearch: MainSearchNavState = {
    term: qParam !== null ? qParam : saved.mainSearch.term,
    scope:
      escopoParam === 'tutor' || escopoParam === 'animal' || escopoParam === 'all'
        ? escopoParam
        : saved.mainSearch.scope || 'all',
    species: spParam !== null ? spParam : saved.mainSearch.species,
    breed: brParam !== null ? brParam : saved.mainSearch.breed,
    phone: phParam !== null ? phParam : saved.mainSearch.phone,
    page: pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : saved.mainSearch.page,
    drawerTutorId: drawerTutorParam !== null ? drawerTutorParam : saved.mainSearch.drawerTutorId,
  }

  const tutorsTab: TutorsTabNavState = {
    ...saved.tutorsTab,
    search: tqParam !== null ? tqParam : saved.tutorsTab.search,
    modalTutorId: tutorModalParam !== null ? tutorModalParam : saved.tutorsTab.modalTutorId,
  }

  const patientsTab: PatientsTabNavState = {
    ...saved.patientsTab,
    search: pqParam !== null ? pqParam : saved.patientsTab.search,
  }

  return {
    activeTab,
    mainSearch,
    patientsTab,
    tutorsTab,
  }
}
