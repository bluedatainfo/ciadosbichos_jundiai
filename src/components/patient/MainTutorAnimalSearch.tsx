import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Filter,
  X,
  Phone,
  MessageCircle,
  ChevronRight,
  Loader2,
  PawPrint,
  User,
  Sparkles,
  ArrowRight,
  BadgeAlert,
  ExternalLink,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  searchTutorAnimalPairs,
  TutorAnimalPair,
  TutorAnimalSearchFilters,
  SearchScope,
} from '@/services/tutor-animal-search'
import { Patient, Tutor } from '@/lib/types'
import { MainSearchNavState, persistPacientesState } from '@/services/pacientes-navigation-state'

interface MainTutorAnimalSearchProps {
  /** Callback opcional quando o usuário seleciona um paciente ou tutor */
  onSelectPatient?: (patient: Patient) => void
  onSelectTutor?: (tutor: Tutor) => void
  /** Se deve renderizar links diretos para /pacientes/:id (padrão true) */
  enableNavigation?: boolean
  /** Se o componente deve disparar abertura de modal de animais do tutor */
  onOpenTutorPatients?: (tutor: Tutor) => void
  /** Espécies pré-carregadas para o filtro (opcional) */
  speciesOptions?: string[]
  /** Estado inicial vindo da persistência de navegação */
  initialState?: MainSearchNavState
  /** Callback quando o estado interno da busca muda para persistência */
  onStateChange?: (state: MainSearchNavState) => void
  /**
   * Modo de seleção (ex: /receituario):
   * Exibe botão de ação principal "Selecionar" no destaque e no drawer lateral
   */
  selectionMode?: boolean
  /** Texto customizado para o botão de seleção (padrão: "Selecionar") */
  selectActionLabel?: string
  /** Se deve fechar o drawer automaticamente ao selecionar o animal (padrão: true quando selectionMode=true) */
  closeDrawerOnSelect?: boolean
  /** Se deve fechar o painel de resultados da busca ao selecionar o animal (padrão: false) */
  closeResultsOnSelect?: boolean
  /** Se deve sincronizar o estado da busca com o histórico da URL via popstate (padrão: true) */
  syncWithUrl?: boolean
}

const DEFAULT_SPECIES = ['Canino', 'Felino', 'Cão', 'Gato', 'Ave', 'Silvestre', 'Outro']

export function MainTutorAnimalSearch({
  onSelectPatient,
  onSelectTutor,
  enableNavigation = true,
  onOpenTutorPatients,
  speciesOptions = DEFAULT_SPECIES,
  initialState,
  onStateChange,
  selectionMode = false,
  selectActionLabel = 'Selecionar',
  closeDrawerOnSelect = true,
  closeResultsOnSelect = false,
  syncWithUrl = true,
}: MainTutorAnimalSearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialState?.term || '')
  const [debouncedSearch, setDebouncedSearch] = useState(initialState?.term || '')
  const [searchScope, setSearchScope] = useState<SearchScope>(initialState?.scope || 'all')

  // Filtros avançados
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterSpecies, setFilterSpecies] = useState(initialState?.species || 'all')
  const [filterBreed, setFilterBreed] = useState(initialState?.breed || '')
  const [filterPhone, setFilterPhone] = useState(initialState?.phone || '')

  // Resultados e paginação
  const [results, setResults] = useState<TutorAnimalPair[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(initialState?.page || 1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasSearched, setHasSearched] = useState(
    Boolean(initialState?.term?.trim()) ||
      Boolean(initialState?.species && initialState.species !== 'all') ||
      Boolean(initialState?.breed?.trim()) ||
      Boolean(initialState?.phone?.trim()),
  )

  // Drawer lateral para visualização mestre-detalhe dos animais do tutor
  const [drawerOpen, setDrawerOpen] = useState(Boolean(initialState?.drawerTutorId))
  const [selectedDrawerTutor, setSelectedDrawerTutor] = useState<Tutor | null>(null)
  const [drawerAnimals, setDrawerAnimals] = useState<Patient[]>([])
  const [drawerAnimalsLoading, setDrawerAnimalsLoading] = useState(false)

  const activeFiltersCount =
    (filterSpecies !== 'all' ? 1 : 0) + (filterBreed.trim() ? 1 : 0) + (filterPhone.trim() ? 1 : 0)

  // Atualiza a persistência de navegação sempre que os filtros mudarem
  const notifyStateChange = (updates?: Partial<MainSearchNavState>) => {
    const currentState: MainSearchNavState = {
      term: searchTerm,
      scope: searchScope,
      species: filterSpecies,
      breed: filterBreed,
      phone: filterPhone,
      page: currentPage,
      drawerTutorId: selectedDrawerTutor?.id || null,
      ...updates,
    }
    if (onStateChange) {
      onStateChange(currentState)
    }
  }

  // Debounce do termo de busca principal (350ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  // Executa busca sempre que busca, escopo ou filtros mudarem
  useEffect(() => {
    const hasActiveSearch =
      Boolean(debouncedSearch.trim()) ||
      filterSpecies !== 'all' ||
      Boolean(filterBreed.trim()) ||
      Boolean(filterPhone.trim())

    if (!hasActiveSearch) {
      setResults([])
      setTotalItems(0)
      setHasMore(false)
      setHasSearched(false)
      notifyStateChange({ term: debouncedSearch, page: 1 })
      return
    }

    setHasSearched(true)
    const initialPage = 1
    setCurrentPage(initialPage)
    performSearch(initialPage, true)
    notifyStateChange({ term: debouncedSearch, scope: searchScope, page: initialPage })
  }, [debouncedSearch, searchScope, filterSpecies, filterBreed, filterPhone])

  // Se houver drawerTutorId salvo no initialState, recupera tutor e reabre o drawer
  useEffect(() => {
    if (initialState?.drawerTutorId) {
      openDrawerForTutorId(initialState.drawerTutorId)
    }
  }, [])

  // Sincronização ao navegar com o botão Voltar/Avançar do navegador (popstate)
  useEffect(() => {
    if (!syncWithUrl) return
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const drawerTutorParam = params.get('drawerTutor')
      if (drawerTutorParam) {
        openDrawerForTutorId(drawerTutorParam)
      } else {
        setDrawerOpen(false)
        setSelectedDrawerTutor(null)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [syncWithUrl])

  const openDrawerForTutorId = async (
    tutorId: string,
    initialTutorObj?: Tutor,
    cachedAnimals?: Patient[],
  ) => {
    setDrawerOpen(true)
    notifyStateChange({ drawerTutorId: tutorId })

    if (initialTutorObj && cachedAnimals && cachedAnimals.length > 0) {
      setSelectedDrawerTutor(initialTutorObj)
      setDrawerAnimals(cachedAnimals)
      return
    }

    setDrawerAnimalsLoading(true)
    try {
      const { default: pb } = await import('@/lib/pocketbase/client')
      let tutorObj = initialTutorObj
      if (!tutorObj) {
        try {
          tutorObj = await pb.collection('tutors').getOne<Tutor>(tutorId)
        } catch {
          /* ignora se não encontrar tutor */
        }
      }
      if (tutorObj) {
        setSelectedDrawerTutor(tutorObj)
      }

      const patients = await pb.collection('patients').getFullList<Patient>({
        filter: `tutor_id = "${tutorId}"`,
        sort: 'name',
      })
      setDrawerAnimals(patients)
    } catch (e) {
      console.warn('Erro ao carregar animais no drawer do tutor:', e)
    } finally {
      setDrawerAnimalsLoading(false)
    }
  }

  const performSearch = async (pageToLoad: number, isInitial: boolean) => {
    if (isInitial) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const filters: TutorAnimalSearchFilters = {
        query: debouncedSearch,
        scope: searchScope,
        species: filterSpecies,
        breed: filterBreed,
        phone: filterPhone,
        page: pageToLoad,
        perPage: 50,
      }

      const res = await searchTutorAnimalPairs(filters)

      if (isInitial) {
        setResults(res.items)
      } else {
        setResults((prev) => {
          const existingKeys = new Set(
            prev.map((i) =>
              i.isTutorMasterCard
                ? `tutor-${i.tutor.id}`
                : `patient-${i.matchedPatient?.id || i.tutor.id}`,
            ),
          )
          const newOnes = res.items.filter((i) => {
            const key = i.isTutorMasterCard
              ? `tutor-${i.tutor.id}`
              : `patient-${i.matchedPatient?.id || i.tutor.id}`
            return !existingKeys.has(key)
          })
          return [...prev, ...newOnes]
        })
      }

      setTotalItems(res.totalItems)
      setCurrentPage(res.page)
      setHasMore(res.hasMore)

      // Se o drawer estava aberto para um tutor salvo, atualiza o objeto do tutor caso apareça nos resultados
      if (initialState?.drawerTutorId && !selectedDrawerTutor) {
        const matchingPair = res.items.find((p) => p.tutor?.id === initialState.drawerTutorId)
        if (matchingPair) {
          setSelectedDrawerTutor(matchingPair.tutor)
          setDrawerAnimals(matchingPair.associatedPatients)
        }
      }
    } catch (err) {
      console.error('Erro na busca principal Tutor + Animal:', err)
      if (isInitial) {
        setResults([])
        setTotalItems(0)
        setHasMore(false)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return
    const nextPage = currentPage + 1
    performSearch(nextPage, false)
    notifyStateChange({ page: nextPage })
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setDebouncedSearch('')
    setSearchScope('all')
    setFilterSpecies('all')
    setFilterBreed('')
    setFilterPhone('')
    setResults([])
    setTotalItems(0)
    setHasMore(false)
    setHasSearched(false)
    setDrawerOpen(false)
    setSelectedDrawerTutor(null)
    setDrawerAnimals([])
    notifyStateChange({
      term: '',
      scope: 'all',
      species: 'all',
      breed: '',
      phone: '',
      page: 1,
      drawerTutorId: null,
    })
  }

  const handleClearFiltersOnly = () => {
    setFilterSpecies('all')
    setFilterBreed('')
    setFilterPhone('')
  }

  const openWhatsApp = (phone: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    const cleanPhone = phone?.replace(/\D/g, '') || ''
    if (cleanPhone) {
      const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      window.open(`https://wa.me/${number}`, '_blank')
    }
  }

  const handleTutorCardClick = (pair: TutorAnimalPair) => {
    if (onSelectTutor) {
      onSelectTutor(pair.tutor)
    }
    setSelectedDrawerTutor(pair.tutor)
    // Garante que se o animal tiver o tutor associado no expand ele seja mantido
    const enrichedAnimals = pair.associatedPatients.map((animal) => ({
      ...animal,
      tutor_id: animal.tutor_id || pair.tutor.id,
      expand: {
        ...(animal.expand || {}),
        tutor_id: animal.expand?.tutor_id || pair.tutor,
      },
    }))
    setDrawerAnimals(enrichedAnimals)
    setDrawerOpen(true)
    notifyStateChange({ drawerTutorId: pair.tutor.id })
  }

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open)
    if (!open) {
      notifyStateChange({ drawerTutorId: null })
    }
  }

  const handleSelectAnimal = (patient: Patient, tutor?: Tutor) => {
    if (onSelectPatient) {
      const patientWithTutor: Patient = {
        ...patient,
        expand: {
          ...(patient.expand || {}),
          tutor_id: patient.expand?.tutor_id || tutor || selectedDrawerTutor || undefined,
        },
      }
      onSelectPatient(patientWithTutor)
    }
    if (closeDrawerOnSelect) {
      setDrawerOpen(false)
      notifyStateChange({ drawerTutorId: null })
    }
    if (closeResultsOnSelect) {
      setSearchTerm('')
      setDebouncedSearch('')
      setResults([])
      setTotalItems(0)
      setHasMore(false)
      setHasSearched(false)
      setDrawerOpen(false)
      setSelectedDrawerTutor(null)
      setDrawerAnimals([])
      notifyStateChange({
        term: '',
        page: 1,
        drawerTutorId: null,
      })
    }
  }

  return (
    <div className="space-y-3">
      {/* Barra Principal de Busca com Seletor de Escopo e Botão de Filtro */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        {/* Seletor de Escopo: Tudo | Tutor | Animal */}
        <div className="w-full sm:w-36 shrink-0">
          <Select
            value={searchScope}
            onValueChange={(val: SearchScope) => {
              setSearchScope(val)
              notifyStateChange({ scope: val })
            }}
          >
            <SelectTrigger
              className="h-11 bg-white border-slate-300 shadow-2xs text-xs font-semibold text-slate-800"
              title="Escopo da pesquisa"
            >
              <SelectValue placeholder="Escopo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="font-medium">Tudo (Tutor + Animal)</span>
              </SelectItem>
              <SelectItem value="tutor">
                <span className="font-medium">Apenas Tutor</span>
              </SelectItem>
              <SelectItem value="animal">
                <span className="font-medium">Apenas Animal</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              searchScope === 'tutor'
                ? "Buscar pelo Nome do Tutor (ex: 'Francisco Maria', 'Silva')..."
                : searchScope === 'animal'
                  ? "Buscar pelo Nome do Animal ou Nº Oficial (ex: 'Pipoca', 'Sansão', '1042')..."
                  : "Buscar por Tutor e/ou Animal (ex: 'Francisco Maria', 'Pipoca', 'Sansão')..."
            }
            className="pl-10 pr-9 bg-white border-slate-300 shadow-2xs h-11 text-sm focus-visible:ring-primary focus-visible:border-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              title="Limpar texto"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botão Filtrar que abre o painel popover */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={activeFiltersCount > 0 ? 'default' : 'outline'}
              className={`h-11 px-4 gap-2 font-medium shrink-0 shadow-2xs ${
                activeFiltersCount > 0
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Filtrar</span>
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full bg-white text-primary font-bold text-[11px]"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-80 sm:w-96 p-4 bg-white shadow-xl border-slate-200"
            align="end"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-primary" />
                  Filtros Complementares
                </h4>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFiltersOnly}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Filtro: Espécie */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Espécie do Animal</Label>
                <Select value={filterSpecies} onValueChange={setFilterSpecies}>
                  <SelectTrigger className="bg-slate-50 border-slate-300 text-xs h-9">
                    <SelectValue placeholder="Todas as espécies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as espécies</SelectItem>
                    {speciesOptions.map((sp) => (
                      <SelectItem key={sp} value={sp}>
                        {sp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro: Raça */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Raça</Label>
                <Input
                  value={filterBreed}
                  onChange={(e) => setFilterBreed(e.target.value)}
                  placeholder="Ex: Poodle, Pastor, SRD, Siamês..."
                  className="bg-slate-50 border-slate-300 text-xs h-9"
                />
              </div>

              {/* Filtro: Telefone do Tutor (tolerante a pontuação) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">
                  Telefone do Tutor (números ou com traço)
                </Label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={filterPhone}
                    onChange={(e) => setFilterPhone(e.target.value)}
                    placeholder="Ex: 99999-1111 ou 999991111"
                    className="pl-8 bg-slate-50 border-slate-300 text-xs h-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Busca tolerante: encontra com ou sem traço, DDD ou parênteses.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 bg-primary text-white hover:bg-primary/90"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Botão limpar quando houver busca ativa */}
        {hasSearched && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="h-11 px-3 text-xs text-muted-foreground hover:text-slate-900 shrink-0"
            title="Limpar busca"
          >
            Limpar
          </Button>
        )}
      </div>

      {/* Badges de filtros ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600 pt-0.5">
          <span className="font-medium text-slate-500">Filtros aplicados:</span>
          {filterSpecies !== 'all' && (
            <Badge
              variant="secondary"
              className="gap-1 bg-slate-100 text-slate-700 border border-slate-200"
            >
              Espécie: {filterSpecies}
              <button
                type="button"
                onClick={() => setFilterSpecies('all')}
                className="hover:text-red-600 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filterBreed.trim() && (
            <Badge
              variant="secondary"
              className="gap-1 bg-slate-100 text-slate-700 border border-slate-200"
            >
              Raça: {filterBreed}
              <button
                type="button"
                onClick={() => setFilterBreed('')}
                className="hover:text-red-600 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filterPhone.trim() && (
            <Badge
              variant="secondary"
              className="gap-1 bg-slate-100 text-slate-700 border border-slate-200"
            >
              Tel: {filterPhone}
              <button
                type="button"
                onClick={() => setFilterPhone('')}
                className="hover:text-red-600 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Painel de Resultados da Busca Principal */}
      {hasSearched && (
        <Card className="border border-primary/25 bg-gradient-to-b from-primary/[0.03] to-transparent shadow-sm">
          <CardContent className="p-4 space-y-3">
            {/* Cabeçalho do Resultado com Contador */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-slate-900">
                  Resultados da Busca Principal (Tutor + Animal)
                </span>
                {searchScope !== 'all' && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium border-primary/30 text-primary"
                  >
                    {searchScope === 'tutor' ? 'Escopo: Tutor' : 'Escopo: Animal'}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {isLoading ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...
                  </span>
                ) : (
                  <span>
                    Total:{' '}
                    <strong className="text-slate-900">{totalItems.toLocaleString('pt-BR')}</strong>{' '}
                    {totalItems === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                  </span>
                )}
              </div>
            </div>

            {/* Lista de Resultados */}
            {isLoading && results.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                Buscando tutores e animais associados...
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm space-y-1">
                <p className="font-medium text-slate-700">Nenhum resultado encontrado.</p>
                <p className="text-xs text-slate-500">
                  Tente buscar por partes dos nomes do tutor ou do animal, ou ajuste os filtros.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.map((pair, index) => {
                  const patient = pair.matchedPatient
                  const tutor = pair.tutor

                  // Item 1: Apresentação mestre-detalhe na nova busca
                  // Quando o resultado casar pelo NOME DO TUTOR (escopo "Tudo" ou "Tutor"):
                  // Exibir UM ÚNICO QUADRO POR TUTOR — nome, telefone/WhatsApp e indicador de "X animais",
                  // sem repetir os dados dos animais no quadro.
                  // Ao clicar no quadro do tutor, abre painel lateral (drawer/sheet padrão shadcn)
                  // listando TODOS os animais daquele tutor com os botões já existentes hoje.
                  if (pair.isTutorMasterCard) {
                    const animalCount = pair.associatedPatients.length
                    return (
                      <div
                        key={`tutor-master-${tutor.id}-${index}`}
                        onClick={() => handleTutorCardClick(pair)}
                        className="group bg-white hover:bg-slate-50/95 border border-slate-200 hover:border-primary/50 rounded-lg p-3 sm:p-4 transition-all shadow-2xs hover:shadow-sm cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        {/* Lado Esquerdo: Quadro do Tutor Mestre */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              <User className="w-3 h-3 text-slate-500" /> Tutor(a)
                            </span>
                            <span className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                              {tutor.name}
                            </span>
                            {tutor.phone && (
                              <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {tutor.phone}
                              </span>
                            )}
                            {tutor.phone && (
                              <button
                                type="button"
                                onClick={(e) => openWhatsApp(tutor.phone, e)}
                                className="text-green-600 hover:text-green-700 p-0.5 inline-flex items-center hover:scale-110 transition-transform"
                                title="WhatsApp do tutor"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            )}
                            {tutor.city && (
                              <span className="text-xs text-slate-500">
                                • {tutor.city}
                                {tutor.state ? `/${tutor.state}` : ''}
                              </span>
                            )}
                          </div>

                          {/* Indicador de "X animais" — sem repetir os dados dos animais no quadro */}
                          <div className="flex items-center gap-2 pt-0.5">
                            <Badge
                              variant="secondary"
                              className="bg-primary/10 text-primary border border-primary/25 font-semibold text-xs px-2.5 py-0.5 gap-1.5"
                            >
                              <PawPrint className="w-3.5 h-3.5" />
                              <span>
                                {animalCount === 0
                                  ? 'Nenhum animal vinculado'
                                  : animalCount === 1
                                    ? '1 animal'
                                    : `${animalCount} animais`}
                              </span>
                            </Badge>
                            <span className="text-xs text-slate-400">
                              (Clique para ver a lista completa de animais)
                            </span>
                          </div>
                        </div>

                        {/* Lado Direito: Ação para Abrir Drawer */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 border-primary/30 text-primary group-hover:bg-primary group-hover:text-white transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTutorCardClick(pair)
                            }}
                          >
                            <span>Ver Animais ({animalCount})</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  // Item 1.3: Quando o casamento for pelo NOME DO ANIMAL (escopo "Tudo" ou "Animal"):
                  // manter o formato atual: animal em destaque (espécie/raça) com o tutor identificado.
                  return (
                    <div
                      key={`patient-focus-${tutor.id}-${patient?.id || index}`}
                      className="group bg-white hover:bg-slate-50/90 border border-slate-200 rounded-lg p-3 sm:p-3.5 transition-all shadow-2xs hover:border-primary/40 hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Lado Esquerdo: Animal em Destaque + Tutor Identificado */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {patient && (
                          <div>
                            {/* Destaque do Animal */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                                <PawPrint className="w-3 h-3" /> Animal correspondente
                              </span>
                              {enableNavigation ? (
                                <Link
                                  to={`/pacientes/${patient.id}`}
                                  className="text-base font-bold text-slate-900 hover:text-primary transition-colors hover:underline"
                                >
                                  {patient.name}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onSelectPatient?.(patient)}
                                  className="text-base font-bold text-slate-900 hover:text-primary transition-colors text-left"
                                >
                                  {patient.name}
                                </button>
                              )}

                              {patient.nume ? (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[11px] bg-blue-50 text-blue-800 border-blue-200 font-bold"
                                  title="Número Oficial NUME"
                                >
                                  Nº {patient.nume}
                                </Badge>
                              ) : null}

                              <Badge
                                variant="secondary"
                                className={
                                  patient.species?.toLowerCase() === 'cão' ||
                                  patient.species?.toLowerCase() === 'cachorro' ||
                                  patient.species?.toLowerCase() === 'canino'
                                    ? 'bg-blue-50 text-blue-700 text-xs'
                                    : 'bg-purple-50 text-purple-700 text-xs'
                                }
                              >
                                {patient.species}
                              </Badge>
                              {patient.breed && (
                                <span className="text-xs text-slate-600">• {patient.breed}</span>
                              )}
                              {patient.deceased && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  Óbito
                                </Badge>
                              )}
                            </div>

                            {/* Tutor identificado junto */}
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-slate-700 font-medium">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                Tutor(a): <strong>{tutor.name}</strong>
                              </span>
                              {tutor.phone && (
                                <span className="flex items-center gap-1 text-slate-500 font-mono">
                                  • {tutor.phone}
                                </span>
                              )}
                              {tutor.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => openWhatsApp(tutor.phone, e)}
                                  className="text-green-600 hover:text-green-700 p-0.5 inline-flex items-center"
                                  title="WhatsApp do tutor"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {tutor.city && (
                                <span className="text-slate-400">
                                  • {tutor.city}
                                  {tutor.state ? `/${tutor.state}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Animais Associados ao Lado / Abaixo com badges clicáveis */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <PawPrint className="w-3.5 h-3.5 text-slate-400" />
                            Outros animais deste tutor ({pair.associatedPatients.length}):
                          </span>
                          {pair.associatedPatients.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">
                              Nenhum outro animal vinculado
                            </span>
                          ) : (
                            pair.associatedPatients.map((assoc) => {
                              const isThisPatientMatched = patient?.id === assoc.id
                              return enableNavigation ? (
                                <Link
                                  key={assoc.id}
                                  to={`/pacientes/${assoc.id}`}
                                  className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 transition-colors border ${
                                    isThisPatientMatched
                                      ? 'bg-primary/10 text-primary border-primary/30 font-semibold hover:bg-primary/20'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                  }`}
                                  title={`Ver ficha de ${assoc.name} (${assoc.species} - ${assoc.breed || 'SRD'})`}
                                >
                                  <span>{assoc.name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    ({assoc.species})
                                  </span>
                                </Link>
                              ) : (
                                <button
                                  key={assoc.id}
                                  type="button"
                                  onClick={() => onSelectPatient?.(assoc)}
                                  className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 transition-colors border ${
                                    isThisPatientMatched
                                      ? 'bg-primary/10 text-primary border-primary/30 font-semibold hover:bg-primary/20'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span>{assoc.name}</span>
                                  <span className="text-[10px] text-slate-500">
                                    ({assoc.species})
                                  </span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>

                      {/* Lado Direito: Ações Diretas */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* Se estiver em modo de seleção (ex: /receituario), exibe botão Selecionar com destaque */}
                        {patient && selectionMode && onSelectPatient && (
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectAnimal(patient, tutor)
                            }}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{selectActionLabel}</span>
                          </Button>
                        )}

                        {patient && enableNavigation && (
                          <Link to={`/pacientes/${patient.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            >
                              <span>Ficha do Animal</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTutorCardClick(pair)}
                          className="h-8 text-xs text-slate-600 hover:text-slate-900"
                          title="Ver todos os animais deste tutor em painel lateral"
                        >
                          <span>Ver Todos</span>
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Botão Carregar Mais / Rolagem Contínua */}
            {hasMore && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full sm:w-auto px-6 h-9 text-xs font-medium border-primary/30 text-primary hover:bg-primary/5"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Carregando mais 50 registros...
                    </>
                  ) : (
                    <>
                      Carregar mais resultados ({results.length} de {totalItems})
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drawer Lateral (Sheet shadcn) para Apresentação Mestre-Detalhe dos Animais do Tutor */}
      <Sheet open={drawerOpen} onOpenChange={handleDrawerClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6 flex flex-col">
          <SheetHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-slate-900">
                  {selectedDrawerTutor?.name || 'Animais do Tutor'}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  {selectedDrawerTutor?.phone && (
                    <span className="font-mono mr-2">{selectedDrawerTutor.phone}</span>
                  )}
                  {selectedDrawerTutor?.city && (
                    <span>
                      {selectedDrawerTutor.city}
                      {selectedDrawerTutor.state ? `/${selectedDrawerTutor.state}` : ''}
                    </span>
                  )}
                </SheetDescription>
              </div>
            </div>
            {selectedDrawerTutor?.phone && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => openWhatsApp(selectedDrawerTutor.phone, e)}
                  className="h-8 text-xs gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                  <span>Conversar no WhatsApp</span>
                </Button>
              </div>
            )}
          </SheetHeader>

          <div className="mt-4 flex-1 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <PawPrint className="w-4 h-4 text-primary" />
                Animais Vinculados ({drawerAnimals.length})
              </span>
            </div>

            {drawerAnimalsLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                Carregando animais do tutor...
              </div>
            ) : drawerAnimals.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm border rounded-lg bg-slate-50">
                Nenhum animal cadastrado para este tutor.
              </div>
            ) : (
              <div className="space-y-2.5">
                {drawerAnimals.map((animal) => (
                  <div
                    key={animal.id}
                    className="p-3.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-lg transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {animal.name}
                        </span>
                        {animal.nume ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] bg-blue-50 text-blue-800 border-blue-200 font-bold"
                            title="Número Oficial do Paciente (NUME)"
                          >
                            Nº {animal.nume}
                          </Badge>
                        ) : animal.ctrl && animal.ctrl !== '0' ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] bg-slate-100 text-slate-600 border-slate-200"
                            title="Código Legado CTRL"
                          >
                            CTRL: {animal.ctrl}
                          </Badge>
                        ) : null}
                        {animal.deceased && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Óbito
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <Badge
                          variant="secondary"
                          className={
                            animal.species?.toLowerCase() === 'cão' ||
                            animal.species?.toLowerCase() === 'cachorro' ||
                            animal.species?.toLowerCase() === 'canino'
                              ? 'bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0'
                              : 'bg-purple-50 text-purple-700 text-[10px] px-1.5 py-0'
                          }
                        >
                          {animal.species}
                        </Badge>
                        <span>{animal.breed || 'SRD'}</span>
                        {animal.gender && <span>• {animal.gender}</span>}
                        {animal.weight && <span>• {animal.weight} kg</span>}
                      </div>
                    </div>

                    {/* Botão de Ação Direta (Ficha Clínica ou Selecionar para Receituário) */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {selectionMode && onSelectPatient && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            handleSelectAnimal(animal, selectedDrawerTutor || undefined)
                          }
                          className="h-8 text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{selectActionLabel}</span>
                        </Button>
                      )}

                      {enableNavigation && (
                        <Link to={`/pacientes/${animal.id}`}>
                          <Button
                            variant={selectionMode ? 'outline' : 'default'}
                            size="sm"
                            className={`h-8 text-xs gap-1.5 ${
                              selectionMode
                                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                : 'bg-primary text-white hover:bg-primary/90'
                            }`}
                          >
                            <span>Ficha Clínica</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}

                      {!enableNavigation && !selectionMode && (
                        <Button
                          size="sm"
                          onClick={() => onSelectPatient?.(animal)}
                          className="h-8 text-xs gap-1.5 bg-primary text-white hover:bg-primary/90"
                        >
                          <span>Ficha Clínica</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
