import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { Patient, Tutor } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  MessageCircle,
  Edit2,
  Loader2,
  Save,
  AlertTriangle,
  Clock,
  Filter,
  PawPrint,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  Check,
  X,
} from 'lucide-react'
import { removeAccents } from '@/lib/search-utils'
import { MainTutorAnimalSearch } from '@/components/patient/MainTutorAnimalSearch'
import {
  resolveInitialPacientesState,
  persistPacientesState,
  PacientesNavState,
  MainSearchNavState,
} from '@/services/pacientes-navigation-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getReturnAlerts, ReturnAlert } from '@/services/return-alerts'
import { auditService } from '@/services/audit'

const openWhatsApp = (phone: string) => {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (cleanPhone) {
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    window.open(`https://wa.me/${number}`, '_blank')
  }
}

const PAGE_SIZE = 50

export default function Patients() {
  const [initialNavState] = useState<PacientesNavState>(() => resolveInitialPacientesState())

  const [activeTab, setActiveTab] = useState<'patients' | 'tutors'>(initialNavState.activeTab)

  const [patientSearch, setPatientSearch] = useState(initialNavState.patientsTab.search)
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState(
    initialNavState.patientsTab.search,
  )
  const [patientSpeciesFilter, setPatientSpeciesFilter] = useState(
    initialNavState.patientsTab.species,
  )
  const [patientSortField, setPatientSortField] = useState<'name' | 'tutor' | null>(
    initialNavState.patientsTab.sortField,
  )
  const [patientSortDirection, setPatientSortDirection] = useState<'asc' | 'desc'>(
    initialNavState.patientsTab.sortDirection,
  )
  const [patientPage, setPatientPage] = useState(initialNavState.patientsTab.page)
  const [totalPatients, setTotalPatients] = useState(0)
  const [patientsLoading, setPatientsLoading] = useState(false)

  const [tutorSearch, setTutorSearch] = useState(initialNavState.tutorsTab.search)
  const [debouncedTutorSearch, setDebouncedTutorSearch] = useState(initialNavState.tutorsTab.search)
  const [tutorSortField, setTutorSortField] = useState<'name' | null>(
    initialNavState.tutorsTab.sortField,
  )
  const [tutorSortDirection, setTutorSortDirection] = useState<'asc' | 'desc'>(
    initialNavState.tutorsTab.sortDirection,
  )
  const [tutorPage, setTutorPage] = useState(initialNavState.tutorsTab.page)
  const [totalTutors, setTotalTutors] = useState(0)
  const [tutorsLoading, setTutorsLoading] = useState(false)

  const [patients, setPatients] = useState<Patient[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [selectableTutors, setSelectableTutors] = useState<Tutor[]>([])
  const [selectableTutorSearch, setSelectableTutorSearch] = useState('')
  const [isSelectTutorDialogOpen, setIsSelectTutorDialogOpen] = useState(false)
  const [tutorSelectQuery, setTutorSelectQuery] = useState('')
  const [tutorSelectResults, setTutorSelectResults] = useState<Tutor[]>([])
  const [tutorSelectLoading, setTutorSelectLoading] = useState(false)
  const [selectedTutorObj, setSelectedTutorObj] = useState<Tutor | null>(null)
  const [patientAlertsMap, setPatientAlertsMap] = useState<Record<string, ReturnAlert>>({})

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [tutorMode, setTutorMode] = useState<'existing' | 'new'>('existing')
  const [formData, setFormData] = useState({
    tutorId: '',
    newTutorName: '',
    newTutorPhone: '',
    newTutorEmail: '',
    newTutorCpf: '',
    newTutorCep: '',
    newTutorAddress: '',
    newTutorNumber: '',
    newTutorComplement: '',
    newTutorNeighborhood: '',
    newTutorCity: '',
    newTutorState: '',
    name: '',
    species: 'Cão',
    breed: '',
    birth_date: '',
    gender: 'Macho',
    weight: '',
    nume: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Estado para Edição de Tutor
  const { toast } = useToast()
  const [isEditTutorOpen, setIsEditTutorOpen] = useState(false)
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null)
  const [tutorEditData, setTutorEditData] = useState({
    name: '',
    phone: '',
    phone_secondary: '',
    email: '',
    cpf: '',
    rg: '',
    cep: '',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    indication: '',
    additional_info: '',
  })
  const [tutorEditLoading, setTutorEditLoading] = useState(false)
  const [tutorEditErrors, setTutorEditErrors] = useState<Record<string, string>>({})
  const [tutorCepLoading, setTutorCepLoading] = useState(false)
  const [newTutorCepLoading, setNewTutorCepLoading] = useState(false)

  // Estado para Modal de Pacientes do Tutor
  const [isTutorPatientsDialogOpen, setIsTutorPatientsDialogOpen] = useState(
    Boolean(initialNavState.tutorsTab.modalTutorId),
  )
  const [selectedTutorForPatients, setSelectedTutorForPatients] = useState<Tutor | null>(null)
  const [tutorPatientsList, setTutorPatientsList] = useState<Patient[]>([])
  const [tutorPatientsLoading, setTutorPatientsLoading] = useState(false)

  const handleOpenTutorPatients = async (tutor: Tutor, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setSelectedTutorForPatients(tutor)
    setIsTutorPatientsDialogOpen(true)
    persistPacientesState((prev) => ({
      ...prev,
      tutorsTab: {
        ...prev.tutorsTab,
        modalTutorId: tutor.id,
      },
    }))
    setTutorPatientsLoading(true)
    try {
      const list = await api.getPatientsByTutor(tutor.id)
      setTutorPatientsList(list)
    } catch (err) {
      console.error('Erro ao buscar pacientes do tutor:', err)
      toast({
        title: 'Erro ao buscar animais',
        description: 'Não foi possível carregar os animais vinculados a este tutor.',
        variant: 'destructive',
      })
      setTutorPatientsList([])
    } finally {
      setTutorPatientsLoading(false)
    }
  }

  // Se veio com modalTutorId salvo no initialNavState, reabre o modal de animais do tutor
  useEffect(() => {
    if (initialNavState.tutorsTab.modalTutorId) {
      const tutorId = initialNavState.tutorsTab.modalTutorId
      setIsTutorPatientsDialogOpen(true)
      setTutorPatientsLoading(true)
      api
        .getTutorsPaged({ page: 1, perPage: 1, search: '' }) // mock fetch or direct fetch
        .then(async () => {
          const { default: pb } = await import('@/lib/pocketbase/client')
          const tutor = await pb.collection('tutors').getOne<Tutor>(tutorId)
          setSelectedTutorForPatients(tutor)
          const list = await api.getPatientsByTutor(tutorId)
          setTutorPatientsList(list)
        })
        .catch((e) => {
          console.warn('Erro ao restaurar modal de animais do tutor:', e)
        })
        .finally(() => {
          setTutorPatientsLoading(false)
        })
    }
  }, [])

  const handleNewTutorCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setFormData((prev) => ({ ...prev, newTutorCep: val }))
    if (val.length === 8) {
      setNewTutorCepLoading(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            newTutorAddress: data.logradouro || prev.newTutorAddress,
            newTutorNeighborhood: data.bairro || prev.newTutorNeighborhood,
            newTutorCity: data.localidade || prev.newTutorCity,
            newTutorState: data.uf || prev.newTutorState,
          }))
          toast({ title: 'CEP Encontrado', description: 'Campos preenchidos automaticamente.' })
        } else {
          toast({ title: 'CEP não encontrado', variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
      } finally {
        setNewTutorCepLoading(false)
      }
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch)
      setPatientPage(1)
      persistPacientesState((prev) => ({
        ...prev,
        patientsTab: {
          ...prev.patientsTab,
          search: patientSearch,
          page: 1,
        },
      }))
    }, 400)
    return () => clearTimeout(t)
  }, [patientSearch])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedTutorSearch(tutorSearch)
      setTutorPage(1)
      persistPacientesState((prev) => ({
        ...prev,
        tutorsTab: {
          ...prev.tutorsTab,
          search: tutorSearch,
          page: 1,
        },
      }))
    }, 400)
    return () => clearTimeout(t)
  }, [tutorSearch])

  const handleTogglePatientSort = (field: 'name' | 'tutor') => {
    if (patientSortField === field) {
      setPatientSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setPatientSortField(field)
      setPatientSortDirection('asc')
    }
  }

  const handleToggleTutorSort = (field: 'name') => {
    if (tutorSortField === field) {
      setTutorSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setTutorSortField(field)
      setTutorSortDirection('asc')
    }
  }

  const loadPatients = async () => {
    setPatientsLoading(true)
    try {
      // Quando ordenado por tutor no backend: tutor_id.name
      // Quando ordenado por paciente no backend: name
      // Ordem padrão: -created
      let pbSort = '-created'
      if (patientSortField === 'name') {
        pbSort = patientSortDirection === 'asc' ? 'name' : '-name'
      } else if (patientSortField === 'tutor') {
        pbSort = patientSortDirection === 'asc' ? 'tutor_id.name' : '-tutor_id.name'
      }

      const res = await api.getPatientsPaged({
        page: patientPage,
        perPage: PAGE_SIZE,
        search: debouncedPatientSearch,
        species: patientSpeciesFilter,
        sort: pbSort,
      })
      setPatients(res.items)
      setTotalPatients(res.totalItems)

      // Carrega alertas apenas para os pacientes visíveis na página atual
      if (res.items.length > 0) {
        const pIds = res.items.map((p) => p.id)
        getReturnAlerts({ daysAhead: 30, patientIds: pIds })
          .then((alertsRes) => {
            const map: Record<string, ReturnAlert> = {}
            for (const a of alertsRes.alerts) {
              map[a.patientId] = a
            }
            setPatientAlertsMap((prev) => ({ ...prev, ...map }))
          })
          .catch(() => {})
      }
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err)
    } finally {
      setPatientsLoading(false)
    }
  }

  const loadTutors = async () => {
    setTutorsLoading(true)
    try {
      let pbSort = '-created'
      if (tutorSortField === 'name') {
        pbSort = tutorSortDirection === 'asc' ? 'name' : '-name'
      }

      const res = await api.getTutorsPaged({
        page: tutorPage,
        perPage: PAGE_SIZE,
        search: debouncedTutorSearch,
        sort: pbSort,
      })
      setTutors(res.items)
      setTotalTutors(res.totalItems)
    } catch (err) {
      console.error('Erro ao buscar tutores:', err)
    } finally {
      setTutorsLoading(false)
    }
  }

  const loadSelectableTutors = async (search?: string) => {
    try {
      const res = await api.searchTutorsForSelect(search)
      setSelectableTutors(res.items)
    } catch (err) {
      console.error('Erro ao carregar tutores para seleção:', err)
    }
  }

  const handleSearchTutorsForDialog = async (term: string) => {
    setTutorSelectLoading(true)
    try {
      const res = await api.searchTutorsForSelect(term, 100)
      setTutorSelectResults(res.items)
    } catch (err) {
      console.error('Erro ao buscar tutores:', err)
      setTutorSelectResults([])
    } finally {
      setTutorSelectLoading(false)
    }
  }

  // Debounce da busca no diálogo de seleção de tutor (300ms)
  useEffect(() => {
    if (!isSelectTutorDialogOpen) return
    const timer = setTimeout(() => {
      handleSearchTutorsForDialog(tutorSelectQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [tutorSelectQuery, isSelectTutorDialogOpen])

  const handleOpenSelectTutorDialog = () => {
    setTutorSelectQuery('')
    setIsSelectTutorDialogOpen(true)
    handleSearchTutorsForDialog('')
  }

  useEffect(() => {
    loadPatients()
  }, [
    patientPage,
    debouncedPatientSearch,
    patientSpeciesFilter,
    patientSortField,
    patientSortDirection,
  ])

  useEffect(() => {
    loadTutors()
  }, [tutorPage, debouncedTutorSearch, tutorSortField, tutorSortDirection])

  useEffect(() => {
    if (isSheetOpen) {
      loadSelectableTutors(selectableTutorSearch)
      // Carregar automaticamente o próximo NUME oficial disponível para dar continuidade à numeração
      api
        .getNextPatientNume()
        .then((nextNume) => {
          if (nextNume) {
            setFormData((prev) => ({
              ...prev,
              nume: prev.nume && prev.nume !== '0' ? prev.nume : nextNume,
            }))
          }
        })
        .catch((e) => {
          console.warn('Erro ao carregar próximo NUME:', e)
        })
    }
  }, [isSheetOpen, selectableTutorSearch])

  useRealtime('patients', () => {
    loadPatients()
  })
  useRealtime('vaccines', () => {
    if (patients.length > 0) {
      getReturnAlerts({ daysAhead: 30, patientIds: patients.map((p) => p.id) })
        .then((alertsRes) => {
          const map: Record<string, ReturnAlert> = {}
          for (const a of alertsRes.alerts) {
            map[a.patientId] = a
          }
          setPatientAlertsMap((prev) => ({ ...prev, ...map }))
        })
        .catch(() => {})
    }
  })
  useRealtime('tutors', () => {
    loadTutors()
    if (isSheetOpen) {
      loadSelectableTutors()
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    try {
      let finalTutorId = formData.tutorId
      let createdTutorName = ''
      if (tutorMode === 'new') {
        if (!formData.newTutorName.trim()) throw new Error('Nome do tutor é obrigatório')

        // Monta o logradouro completo com número e complemento se informados
        let formattedAddress = formData.newTutorAddress.trim()
        if (formData.newTutorNumber.trim()) {
          formattedAddress = formattedAddress
            ? `${formattedAddress}, ${formData.newTutorNumber.trim()}`
            : formData.newTutorNumber.trim()
        }
        if (formData.newTutorComplement.trim()) {
          formattedAddress = formattedAddress
            ? `${formattedAddress} - ${formData.newTutorComplement.trim()}`
            : formData.newTutorComplement.trim()
        }

        const newTutor = await api.createTutor({
          name: formData.newTutorName.trim(),
          phone: formData.newTutorPhone.trim(),
          email: formData.newTutorEmail.trim(),
          cpf: formData.newTutorCpf.trim(),
          cep: formData.newTutorCep.trim(),
          address: formattedAddress,
          neighborhood: formData.newTutorNeighborhood.trim(),
          city: formData.newTutorCity.trim(),
          state: formData.newTutorState.trim().toUpperCase(),
        })
        finalTutorId = newTutor.id
        createdTutorName = newTutor.name

        // Auditoria: Criação de novo tutor
        auditService.log({
          action: 'create',
          module: 'tutors',
          recordId: newTutor.id,
          recordLabel: newTutor.name,
          tutorName: newTutor.name,
          changes: {
            name: { label: 'Nome', oldValue: null, newValue: newTutor.name },
            phone: { label: 'Telefone', oldValue: null, newValue: newTutor.phone },
            email: { label: 'E-mail', oldValue: null, newValue: newTutor.email },
            cpf: { label: 'CPF', oldValue: null, newValue: newTutor.cpf },
            cep: { label: 'CEP', oldValue: null, newValue: newTutor.cep },
            address: { label: 'Endereço', oldValue: null, newValue: newTutor.address },
            neighborhood: { label: 'Bairro', oldValue: null, newValue: newTutor.neighborhood },
            city: { label: 'Cidade', oldValue: null, newValue: newTutor.city },
            state: { label: 'UF', oldValue: null, newValue: newTutor.state },
          },
          details: `Novo tutor cadastrado: ${newTutor.name}`,
        })
      } else {
        const found =
          (selectedTutorObj && selectedTutorObj.id === finalTutorId ? selectedTutorObj : null) ||
          selectableTutors.find((t) => t.id === finalTutorId) ||
          tutorSelectResults.find((t) => t.id === finalTutorId)
        createdTutorName = found?.name || ''
      }
      if (!finalTutorId) throw new Error('Selecione um tutor')

      const newPatient = await api.createPatient({
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        birth_date: formData.birth_date ? new Date(formData.birth_date).toISOString() : '',
        gender: formData.gender as 'Macho' | 'Fêmea',
        weight: parseFloat(formData.weight) || 0,
        nume: formData.nume ? formData.nume.trim() : undefined,
        tutor_id: finalTutorId,
      })

      // Auditoria: Criação de novo paciente
      auditService.log({
        action: 'create',
        module: 'patients',
        recordId: newPatient.id,
        recordLabel: newPatient.name,
        patientName: newPatient.name,
        tutorName: createdTutorName,
        changes: {
          name: { label: 'Nome', oldValue: null, newValue: newPatient.name },
          species: { label: 'Espécie', oldValue: null, newValue: newPatient.species },
          breed: { label: 'Raça', oldValue: null, newValue: newPatient.breed },
          gender: { label: 'Sexo', oldValue: null, newValue: newPatient.gender },
          weight: { label: 'Peso (kg)', oldValue: null, newValue: newPatient.weight },
          nume: { label: 'Nº Oficial (NUME)', oldValue: null, newValue: newPatient.nume || null },
        },
        details: `Novo paciente cadastrado: ${newPatient.name} (${newPatient.species} / ${newPatient.breed || '-'}) vinculado a ${createdTutorName || 'tutor existente'}`,
      })

      setIsSheetOpen(false)
      setSelectedTutorObj(null)
      setFormData({
        tutorId: '',
        newTutorName: '',
        newTutorPhone: '',
        newTutorEmail: '',
        newTutorCpf: '',
        newTutorCep: '',
        newTutorAddress: '',
        newTutorNumber: '',
        newTutorComplement: '',
        newTutorNeighborhood: '',
        newTutorCity: '',
        newTutorState: '',
        name: '',
        species: 'Cão',
        breed: '',
        birth_date: '',
        gender: 'Macho',
        weight: '',
        nume: '',
      })
    } catch (err: any) {
      if (err.message) setErrors({ form: err.message })
      else setErrors(extractFieldErrors(err))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEditTutor = (tutor: Tutor) => {
    setEditingTutor(tutor)
    setTutorEditData({
      name: tutor.name || '',
      phone: tutor.phone || '',
      phone_secondary: tutor.phone_secondary || '',
      email: tutor.email || '',
      cpf: tutor.cpf || '',
      rg: tutor.rg || '',
      cep: tutor.cep || '',
      address: tutor.address || '',
      neighborhood: tutor.neighborhood || '',
      city: tutor.city || '',
      state: tutor.state || '',
      indication: tutor.indication || '',
      additional_info: tutor.additional_info || '',
    })
    setTutorEditErrors({})
    setIsEditTutorOpen(true)
  }

  const handleTutorCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setTutorEditData((prev) => ({ ...prev, cep: val }))
    if (val.length === 8) {
      setTutorCepLoading(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setTutorEditData((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }))
          toast({ title: 'CEP Encontrado', description: 'Campos preenchidos automaticamente.' })
        } else {
          toast({ title: 'CEP não encontrado', variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
      } finally {
        setTutorCepLoading(false)
      }
    }
  }

  // Normalização alfabética ignorando acentuação e maiúsculas/minúsculas
  // para que ex.: "Ábobo" e "Abobo" fiquem juntos na ordem alfabética na listagem exibida.
  const sortedPatients = [...patients].sort((a, b) => {
    if (!patientSortField) return 0
    let valA = ''
    let valB = ''
    if (patientSortField === 'name') {
      valA = removeAccents(a.name || '')
        .trim()
        .toLowerCase()
      valB = removeAccents(b.name || '')
        .trim()
        .toLowerCase()
    } else if (patientSortField === 'tutor') {
      valA = removeAccents(a.expand?.tutor_id?.name || '')
        .trim()
        .toLowerCase()
      valB = removeAccents(b.expand?.tutor_id?.name || '')
        .trim()
        .toLowerCase()
    }
    const cmp = valA.localeCompare(valB, 'pt-BR')
    return patientSortDirection === 'asc' ? cmp : -cmp
  })

  const sortedTutors = [...tutors].sort((a, b) => {
    if (!tutorSortField) return 0
    let valA = ''
    let valB = ''
    if (tutorSortField === 'name') {
      valA = removeAccents(a.name || '')
        .trim()
        .toLowerCase()
      valB = removeAccents(b.name || '')
        .trim()
        .toLowerCase()
    }
    const cmp = valA.localeCompare(valB, 'pt-BR')
    return tutorSortDirection === 'asc' ? cmp : -cmp
  })

  const handleSaveTutor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTutor) return

    if (!tutorEditData.name.trim()) {
      setTutorEditErrors({ name: 'Nome do tutor é obrigatório.' })
      return
    }

    setTutorEditLoading(true)
    setTutorEditErrors({})
    try {
      const updatePayload = {
        name: tutorEditData.name.trim(),
        phone: tutorEditData.phone.trim(),
        phone_secondary: tutorEditData.phone_secondary.trim(),
        email: tutorEditData.email.trim(),
        cpf: tutorEditData.cpf.trim(),
        rg: tutorEditData.rg.trim(),
        cep: tutorEditData.cep.trim(),
        address: tutorEditData.address.trim(),
        neighborhood: tutorEditData.neighborhood.trim(),
        city: tutorEditData.city.trim(),
        state: tutorEditData.state.trim().toUpperCase(),
        indication: tutorEditData.indication.trim(),
        additional_info: tutorEditData.additional_info.trim(),
      }

      const diff = auditService.computeDiff(editingTutor, updatePayload)

      await api.updateTutor(editingTutor.id, updatePayload)

      // Auditoria: Edição de tutor
      if (Object.keys(diff).length > 0) {
        auditService.log({
          action: 'update',
          module: 'tutors',
          recordId: editingTutor.id,
          recordLabel: updatePayload.name,
          tutorName: updatePayload.name,
          changes: diff,
          details: `Alteração de dados cadastrais do tutor ${updatePayload.name} (${Object.keys(diff).length} campos alterados)`,
        })
      }

      toast({ title: 'Sucesso', description: 'Dados do tutor atualizados com sucesso.' })
      setIsEditTutorOpen(false)
      await loadTutors()
      if (isSheetOpen) {
        await loadSelectableTutors()
      }
      await loadPatients()
    } catch (err: any) {
      if (err.message) setTutorEditErrors({ form: err.message })
      else setTutorEditErrors(extractFieldErrors(err))
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao atualizar dados do tutor.',
        variant: 'destructive',
      })
    } finally {
      setTutorEditLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Animais & Tutores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os cadastros de animais e seus responsáveis.
          </p>
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 gap-2 text-white">
              <Plus className="w-4 h-4" /> Novo Animal
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Novo Animal</SheetTitle>
              <SheetDescription>Cadastre um novo animal e associe a um tutor.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              {errors.form && (
                <div className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">
                  {errors.form}
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Tutor</Label>
                <Select value={tutorMode} onValueChange={(v: any) => setTutorMode(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">Tutor Existente</SelectItem>
                    <SelectItem value="new">Novo Tutor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tutorMode === 'existing' ? (
                <div className="space-y-2">
                  <Label>Selecione o Tutor *</Label>
                  {selectedTutorObj ? (
                    <div className="flex items-center justify-between p-2.5 rounded-md border border-primary/40 bg-primary/5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {selectedTutorObj.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {selectedTutorObj.phone
                            ? `Tel: ${selectedTutorObj.phone}`
                            : 'Sem telefone'}
                          {selectedTutorObj.city && ` • ${selectedTutorObj.city}`}
                          {selectedTutorObj.state && `/${selectedTutorObj.state}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          onClick={handleOpenSelectTutorDialog}
                        >
                          Trocar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setSelectedTutorObj(null)
                            setFormData((prev) => ({ ...prev, tutorId: '' }))
                          }}
                          title="Remover seleção"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenSelectTutorDialog}
                      className="w-full justify-start text-left font-normal text-muted-foreground hover:text-slate-900 border-dashed"
                    >
                      <Search className="w-4 h-4 mr-2 shrink-0 text-slate-400" />
                      Clique para buscar e selecionar o tutor...
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Busque por nome entre todos os tutores cadastrados. Se não encontrar, mude para
                    &quot;Novo Tutor&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                  <h4 className="font-medium text-sm">Dados do Novo Tutor</h4>
                  <Input
                    placeholder="Nome *"
                    value={formData.newTutorName}
                    onChange={(e) => setFormData({ ...formData, newTutorName: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Telefone *"
                    value={formData.newTutorPhone}
                    onChange={(e) => setFormData({ ...formData, newTutorPhone: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={formData.newTutorEmail}
                    onChange={(e) => setFormData({ ...formData, newTutorEmail: e.target.value })}
                  />
                  <Input
                    placeholder="CPF"
                    value={formData.newTutorCpf}
                    onChange={(e) => setFormData({ ...formData, newTutorCpf: e.target.value })}
                  />

                  {/* Endereço Completo do Novo Tutor */}
                  <div className="pt-2 border-t space-y-3">
                    <h5 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                      Endereço Completo
                    </h5>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1 relative">
                        <Label className="text-xs">CEP</Label>
                        <div className="relative">
                          <Input
                            value={formData.newTutorCep}
                            onChange={handleNewTutorCepChange}
                            placeholder="00000-000"
                            maxLength={9}
                            className="text-xs pr-7"
                          />
                          {newTutorCepLoading && (
                            <Loader2 className="absolute right-2 top-2.5 w-3.5 h-3.5 animate-spin text-slate-400" />
                          )}
                        </div>
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Rua / Logradouro</Label>
                        <Input
                          value={formData.newTutorAddress}
                          onChange={(e) =>
                            setFormData({ ...formData, newTutorAddress: e.target.value })
                          }
                          placeholder="Rua, Avenida..."
                          className="text-xs"
                          disabled={newTutorCepLoading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Número</Label>
                        <Input
                          value={formData.newTutorNumber}
                          onChange={(e) =>
                            setFormData({ ...formData, newTutorNumber: e.target.value })
                          }
                          placeholder="Ex: 123, S/N"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Complemento</Label>
                        <Input
                          value={formData.newTutorComplement}
                          onChange={(e) =>
                            setFormData({ ...formData, newTutorComplement: e.target.value })
                          }
                          placeholder="Apto, Bloco..."
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Bairro</Label>
                        <Input
                          value={formData.newTutorNeighborhood}
                          onChange={(e) =>
                            setFormData({ ...formData, newTutorNeighborhood: e.target.value })
                          }
                          placeholder="Bairro"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          value={formData.newTutorCity}
                          onChange={(e) =>
                            setFormData({ ...formData, newTutorCity: e.target.value })
                          }
                          placeholder="Cidade"
                          className="text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">UF</Label>
                        <Input
                          value={formData.newTutorState}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              newTutorState: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="SP"
                          maxLength={2}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-4">
                <h4 className="font-medium text-sm border-b pb-2">Dados do Animal</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Nome do Animal *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Nº Oficial (NUME)"
                      value={formData.nume}
                      readOnly
                      className="bg-slate-50 font-mono font-bold text-blue-900 border-blue-200 cursor-not-allowed"
                      title="Número Oficial do Animal (Gerado automaticamente em sequência contínua)"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Espécie"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="Raça"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Nascimento</Label>
                    <Input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                </div>
                <Select
                  value={formData.gender}
                  onValueChange={(v) => setFormData({ ...formData, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Fêmea">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Cadastro'}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      {/* Nova Busca Principal (Tutor + Animal) — Lógica Reutilizável com Mestre-Detalhe e Persistência */}
      <MainTutorAnimalSearch
        initialState={initialNavState.mainSearch}
        onStateChange={(searchState: MainSearchNavState) => {
          persistPacientesState((prev) => ({
            ...prev,
            mainSearch: searchState,
          }))
        }}
        onOpenTutorPatients={handleOpenTutorPatients}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          const tab = val as 'patients' | 'tutors'
          setActiveTab(tab)
          persistPacientesState((prev) => ({
            ...prev,
            activeTab: tab,
          }))
        }}
        className="w-full"
      >
        <TabsList className="mb-4 bg-slate-200/80 p-1 border border-slate-300/80 shadow-2xs">
          <TabsTrigger
            value="patients"
            className="data-[state=active]:bg-slate-100 data-[state=active]:text-primary font-medium"
          >
            Lista de Animais
            {totalPatients > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 text-xs bg-slate-200 text-slate-700"
              >
                {totalPatients.toLocaleString('pt-BR')}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="tutors"
            className="data-[state=active]:bg-slate-100 data-[state=active]:text-primary font-medium"
          >
            Lista de Tutores
            {totalTutors > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 px-1.5 py-0 text-xs bg-slate-200 text-slate-700"
              >
                {totalTutors.toLocaleString('pt-BR')}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-0">
          <Card className="border border-slate-200/80 shadow-xs overflow-hidden bg-slate-100/70">
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-100/90 rounded-t-lg">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome do animal, nº oficial, espécie ou raça..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-9 bg-slate-50/90 border-slate-300 w-full focus-visible:bg-white"
                    />
                  </div>

                  <div className="w-full sm:w-44">
                    <Select
                      value={patientSpeciesFilter}
                      onValueChange={(val) => {
                        setPatientSpeciesFilter(val)
                        setPatientPage(1)
                      }}
                    >
                      <SelectTrigger className="bg-slate-50/90 border-slate-300">
                        <SelectValue placeholder="Espécie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as espécies</SelectItem>
                        <SelectItem value="Canino">Canino</SelectItem>
                        <SelectItem value="Felino">Felino</SelectItem>
                        <SelectItem value="Cão">Cão</SelectItem>
                        <SelectItem value="Gato">Gato</SelectItem>
                        <SelectItem value="Ave">Ave</SelectItem>
                        <SelectItem value="Silvestre">Silvestre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  {patientsLoading ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                    </span>
                  ) : (
                    <span>
                      Total: <strong>{totalPatients.toLocaleString('pt-BR')}</strong> animais
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 bg-slate-200/90 z-10 shadow-2xs border-b border-slate-200">
                    <TableRow className="bg-slate-200/95 hover:bg-slate-200/95">
                      <TableHead className="min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleTogglePatientSort('name')}
                          className="flex items-center gap-1.5 font-semibold text-slate-800 hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 -mx-1"
                          title="Clique para ordenar por nome do animal"
                        >
                          <span>Animal</span>
                          {patientSortField === 'name' ? (
                            patientSortDirection === 'asc' ? (
                              <ArrowUp className="w-4 h-4 text-primary" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="min-w-[130px]">Nº Oficial</TableHead>
                      <TableHead className="min-w-[180px]">Espécie/Raça</TableHead>
                      <TableHead className="min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleTogglePatientSort('tutor')}
                          className="flex items-center gap-1.5 font-semibold text-slate-800 hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 -mx-1"
                          title="Clique para ordenar por nome do tutor"
                        >
                          <span>Tutor</span>
                          {patientSortField === 'tutor' ? (
                            patientSortDirection === 'asc' ? (
                              <ArrowUp className="w-4 h-4 text-primary" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="min-w-[150px]">Telefone</TableHead>
                      <TableHead className="text-right min-w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-slate-100/60 divide-y divide-slate-200/80">
                    {patientsLoading && patients.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                          Carregando animais...
                        </TableCell>
                      </TableRow>
                    ) : patients.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhum animal encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPatients.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className="group bg-slate-100/70 hover:bg-slate-200/70 cursor-pointer transition-colors"
                        >
                          <TableCell>
                            <Link
                              to={`/pacientes/${patient.id}`}
                              className="font-semibold text-slate-900 group-hover:text-primary transition-colors flex items-center gap-2 flex-wrap"
                            >
                              <span>{patient.name}</span>
                              {patientAlertsMap[patient.id] && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 font-medium inline-flex items-center gap-1 ${
                                    patientAlertsMap[patient.id].status === 'overdue'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}
                                  title={`Retorno ${
                                    patientAlertsMap[patient.id].status === 'overdue'
                                      ? 'Vencido'
                                      : 'Próximo'
                                  }: ${patientAlertsMap[patient.id].description}`}
                                >
                                  {patientAlertsMap[patient.id].status === 'overdue' ? (
                                    <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                                  ) : (
                                    <Clock className="w-2.5 h-2.5 text-amber-500" />
                                  )}
                                  {patientAlertsMap[patient.id].status === 'overdue'
                                    ? 'Retorno vencido'
                                    : 'Retorno próximo'}
                                </Badge>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/pacientes/${patient.id}`}
                              className="flex items-center gap-1.5 flex-wrap"
                            >
                              {patient.nume ? (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs bg-blue-50 text-blue-800 border-blue-200 font-bold"
                                  title="Número Oficial do Animal"
                                >
                                  {patient.nume}
                                </Badge>
                              ) : patient.ctrl && patient.ctrl !== '0' ? (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[11px] bg-slate-50 text-slate-600 border-slate-200"
                                  title="Código Legado CTRL"
                                >
                                  CTRL: {patient.ctrl}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-400 font-mono">-</span>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/pacientes/${patient.id}`}
                              className="flex gap-2 items-center"
                            >
                              <Badge
                                variant="secondary"
                                className={
                                  patient.species?.toLowerCase() === 'cão' ||
                                  patient.species?.toLowerCase() === 'cachorro'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-purple-50 text-purple-700'
                                }
                              >
                                {patient.species}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{patient.breed}</span>
                              {patient.deceased && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                  Óbito
                                </Badge>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">
                            <Link to={`/pacientes/${patient.id}`} className="block">
                              {patient.expand?.tutor_id?.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            <div className="flex items-center gap-2">
                              {patient.expand?.tutor_id?.phone || '-'}
                              {patient.expand?.tutor_id?.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openWhatsApp(patient.expand?.tutor_id?.phone!)
                                  }}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Contatar via WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/pacientes/${patient.id}`} tabIndex={-1}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Barra de Paginação Servidor - Pacientes */}
              {totalPatients > 0 && (
                <div className="p-3 border-t bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div>
                    Página <strong>{patientPage}</strong> de{' '}
                    <strong>{Math.max(1, Math.ceil(totalPatients / PAGE_SIZE))}</strong> (
                    {(patientPage - 1) * PAGE_SIZE + 1} a{' '}
                    {Math.min(patientPage * PAGE_SIZE, totalPatients)} de{' '}
                    {totalPatients.toLocaleString('pt-BR')} registros)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPatientPage(1)}
                      disabled={patientPage <= 1 || patientsLoading}
                      className="h-8 px-2"
                      title="Primeira página"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPatientPage((p) => Math.max(1, p - 1))}
                      disabled={patientPage <= 1 || patientsLoading}
                      className="h-8 px-3 gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPatientPage((p) =>
                          p < Math.ceil(totalPatients / PAGE_SIZE) ? p + 1 : p,
                        )
                      }
                      disabled={
                        patientPage >= Math.ceil(totalPatients / PAGE_SIZE) || patientsLoading
                      }
                      className="h-8 px-3 gap-1"
                    >
                      Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPatientPage(Math.ceil(totalPatients / PAGE_SIZE))}
                      disabled={
                        patientPage >= Math.ceil(totalPatients / PAGE_SIZE) || patientsLoading
                      }
                      className="h-8 px-2"
                      title="Última página"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutors" className="mt-0">
          <Card className="border border-slate-200/80 shadow-xs overflow-hidden bg-slate-100/70">
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-100/90 rounded-t-lg">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tutor por nome, cidade, CPF ou telefone..."
                    value={tutorSearch}
                    onChange={(e) => setTutorSearch(e.target.value)}
                    className="pl-9 bg-slate-50/90 border-slate-300 w-full focus-visible:bg-white"
                  />
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-3 shrink-0">
                  {tutorsLoading ? (
                    <span className="flex items-center gap-1.5 text-primary">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
                    </span>
                  ) : (
                    <span>
                      Total: <strong>{totalTutors.toLocaleString('pt-BR')}</strong> tutores
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 bg-slate-200/90 z-10 shadow-2xs border-b border-slate-200">
                    <TableRow className="bg-slate-200/95 hover:bg-slate-200/95">
                      <TableHead className="w-[110px] text-center">Animais</TableHead>
                      <TableHead className="min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleToggleTutorSort('name')}
                          className="flex items-center gap-1.5 font-semibold text-slate-800 hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded px-1 -mx-1"
                          title="Clique para ordenar por nome do tutor"
                        >
                          <span>Nome</span>
                          {tutorSortField === 'name' ? (
                            tutorSortDirection === 'asc' ? (
                              <ArrowUp className="w-4 h-4 text-primary" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-primary" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="min-w-[140px]">CPF / RG</TableHead>
                      <TableHead className="min-w-[160px]">Telefone</TableHead>
                      <TableHead className="min-w-[140px]">Cidade / Estado</TableHead>
                      <TableHead className="min-w-[160px]">Email</TableHead>
                      <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-slate-100/60 divide-y divide-slate-200/80">
                    {tutorsLoading && tutors.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                          Carregando tutores...
                        </TableCell>
                      </TableRow>
                    ) : tutors.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          Nenhum tutor encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedTutors.map((tutor) => (
                        <TableRow
                          key={tutor.id}
                          onClick={() => handleOpenEditTutor(tutor)}
                          className="bg-slate-100/70 hover:bg-slate-200/70 cursor-pointer transition-colors group"
                        >
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleOpenTutorPatients(tutor, e)}
                              className="h-8 px-2 gap-1 text-xs border-primary/30 text-primary hover:bg-primary hover:text-white"
                              title="Ver animais deste tutor"
                            >
                              <PawPrint className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Animais</span>
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                            <div>{tutor.name}</div>
                            {tutor.indication && (
                              <div className="text-[11px] text-muted-foreground">
                                Indicação: {tutor.indication}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            <div>{tutor.cpf || '-'}</div>
                            {tutor.rg && (
                              <div className="text-[11px] text-muted-foreground">
                                RG: {tutor.rg}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              {tutor.phone || '-'}
                              {tutor.phone && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openWhatsApp(tutor.phone!)
                                  }}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Contatar via WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {tutor.phone_secondary && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                {tutor.phone_secondary}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {tutor.city || tutor.state ? (
                              <span>
                                {tutor.city || ''}
                                {tutor.city && tutor.state ? ' / ' : ''}
                                {tutor.state || ''}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {tutor.email || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditTutor(tutor)
                              }}
                              className="gap-1.5 text-xs h-8 hover:bg-primary hover:text-white transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Barra de Paginação Servidor - Tutores */}
              {totalTutors > 0 && (
                <div className="p-3 border-t bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div>
                    Página <strong>{tutorPage}</strong> de{' '}
                    <strong>{Math.max(1, Math.ceil(totalTutors / PAGE_SIZE))}</strong> (
                    {(tutorPage - 1) * PAGE_SIZE + 1} a{' '}
                    {Math.min(tutorPage * PAGE_SIZE, totalTutors)} de{' '}
                    {totalTutors.toLocaleString('pt-BR')} registros)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTutorPage(1)}
                      disabled={tutorPage <= 1 || tutorsLoading}
                      className="h-8 px-2"
                      title="Primeira página"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTutorPage((p) => Math.max(1, p - 1))}
                      disabled={tutorPage <= 1 || tutorsLoading}
                      className="h-8 px-3 gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTutorPage((p) => (p < Math.ceil(totalTutors / PAGE_SIZE) ? p + 1 : p))
                      }
                      disabled={tutorPage >= Math.ceil(totalTutors / PAGE_SIZE) || tutorsLoading}
                      className="h-8 px-3 gap-1"
                    >
                      Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTutorPage(Math.ceil(totalTutors / PAGE_SIZE))}
                      disabled={tutorPage >= Math.ceil(totalTutors / PAGE_SIZE) || tutorsLoading}
                      className="h-8 px-2"
                      title="Última página"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sheet de Edição de Tutor */}
      <Sheet open={isEditTutorOpen} onOpenChange={setIsEditTutorOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Editar Dados do Tutor</SheetTitle>
            <SheetDescription>
              Atualize as informações cadastrais, contatos e endereço do tutor.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveTutor} className="space-y-4 mt-6">
            {tutorEditErrors.form && (
              <div className="text-red-500 text-sm font-medium bg-red-50 p-2.5 rounded">
                {tutorEditErrors.form}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="tutor-edit-name">Nome do Tutor *</Label>
                <Input
                  id="tutor-edit-name"
                  value={tutorEditData.name}
                  onChange={(e) => setTutorEditData({ ...tutorEditData, name: e.target.value })}
                  placeholder="Nome completo"
                  required
                />
                {tutorEditErrors.name && (
                  <p className="text-xs text-red-500">{tutorEditErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-cpf">CPF</Label>
                  <Input
                    id="tutor-edit-cpf"
                    value={tutorEditData.cpf}
                    onChange={(e) => setTutorEditData({ ...tutorEditData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                  {tutorEditErrors.cpf && (
                    <p className="text-xs text-red-500">{tutorEditErrors.cpf}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-rg">RG</Label>
                  <Input
                    id="tutor-edit-rg"
                    value={tutorEditData.rg}
                    onChange={(e) => setTutorEditData({ ...tutorEditData, rg: e.target.value })}
                    placeholder="Número do RG"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-phone" className="flex items-center gap-1.5">
                    Telefone Principal
                    {tutorEditData.phone && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp(tutorEditData.phone)}
                        className="text-green-600 hover:text-green-700"
                        title="Testar WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </Label>
                  <Input
                    id="tutor-edit-phone"
                    value={tutorEditData.phone}
                    onChange={(e) => setTutorEditData({ ...tutorEditData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-phone-sec" className="flex items-center gap-1.5">
                    Telefone Secundário
                    {tutorEditData.phone_secondary && (
                      <button
                        type="button"
                        onClick={() => openWhatsApp(tutorEditData.phone_secondary)}
                        className="text-green-600 hover:text-green-700"
                        title="Testar WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </Label>
                  <Input
                    id="tutor-edit-phone-sec"
                    value={tutorEditData.phone_secondary}
                    onChange={(e) =>
                      setTutorEditData({ ...tutorEditData, phone_secondary: e.target.value })
                    }
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tutor-edit-email">Email</Label>
                <Input
                  id="tutor-edit-email"
                  type="email"
                  value={tutorEditData.email}
                  onChange={(e) => setTutorEditData({ ...tutorEditData, email: e.target.value })}
                  placeholder="exemplo@email.com"
                />
                {tutorEditErrors.email && (
                  <p className="text-xs text-red-500">{tutorEditErrors.email}</p>
                )}
              </div>

              <div className="pt-2 border-t space-y-3">
                <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
                  Endereço
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 relative">
                    <Label htmlFor="tutor-edit-cep">CEP</Label>
                    <div className="relative">
                      <Input
                        id="tutor-edit-cep"
                        value={tutorEditData.cep}
                        onChange={handleTutorCepChange}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {tutorCepLoading && (
                        <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="tutor-edit-address">Logradouro / Número</Label>
                    <Input
                      id="tutor-edit-address"
                      value={tutorEditData.address}
                      onChange={(e) =>
                        setTutorEditData({ ...tutorEditData, address: e.target.value })
                      }
                      placeholder="Rua, Av, Número"
                      disabled={tutorCepLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="tutor-edit-bair">Bairro</Label>
                    <Input
                      id="tutor-edit-bair"
                      value={tutorEditData.neighborhood}
                      onChange={(e) =>
                        setTutorEditData({ ...tutorEditData, neighborhood: e.target.value })
                      }
                      placeholder="Bairro"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tutor-edit-city">Cidade</Label>
                    <Input
                      id="tutor-edit-city"
                      value={tutorEditData.city}
                      onChange={(e) => setTutorEditData({ ...tutorEditData, city: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tutor-edit-state">UF</Label>
                    <Input
                      id="tutor-edit-state"
                      value={tutorEditData.state}
                      onChange={(e) =>
                        setTutorEditData({ ...tutorEditData, state: e.target.value.toUpperCase() })
                      }
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-inst">Indicação (Quem indicou)</Label>
                  <Input
                    id="tutor-edit-inst"
                    value={tutorEditData.indication}
                    onChange={(e) =>
                      setTutorEditData({ ...tutorEditData, indication: e.target.value })
                    }
                    placeholder="Ex: Dr. Fulano, Amigo, Instagram"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tutor-edit-info">Informações Adicionais</Label>
                  <Textarea
                    id="tutor-edit-info"
                    value={tutorEditData.additional_info}
                    onChange={(e) =>
                      setTutorEditData({ ...tutorEditData, additional_info: e.target.value })
                    }
                    placeholder="Observações sobre contato, horários de preferência, etc."
                    className="min-h-[70px] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditTutorOpen(false)}
                disabled={tutorEditLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={tutorEditLoading} className="gap-1.5 bg-primary">
                {tutorEditLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {tutorEditLoading ? 'Salvando...' : 'Salvar Tutor'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Diálogo de Seleção de Tutor com Busca */}
      <Dialog open={isSelectTutorDialogOpen} onOpenChange={setIsSelectTutorDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="w-5 h-5 text-primary" />
              Selecionar Tutor
            </DialogTitle>
            <DialogDescription>
              Busque pelo nome do tutor para associar ao novo animal.
            </DialogDescription>
          </DialogHeader>

          {/* Campo de Busca no Topo */}
          <div className="relative shrink-0 my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Digite o nome do tutor (ex: Adao, Silva, Maria)..."
              value={tutorSelectQuery}
              onChange={(e) => setTutorSelectQuery(e.target.value)}
              className="pl-9 pr-9 bg-slate-50/90 border-slate-300 w-full focus-visible:bg-white"
            />
            {tutorSelectQuery && (
              <button
                type="button"
                onClick={() => setTutorSelectQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-900 p-0.5"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Contador / Status */}
          <div className="shrink-0 flex items-center justify-between text-xs text-muted-foreground px-1 pb-1">
            <span>
              {tutorSelectLoading ? (
                <span className="flex items-center gap-1.5 text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...
                </span>
              ) : (
                <span>
                  Exibindo <strong>{tutorSelectResults.length}</strong> tutor(es)
                  {tutorSelectResults.length >= 100 && ' (limite de 100)'}
                </span>
              )}
            </span>
            {tutorSelectQuery.trim() && (
              <span>Filtro por nome: &quot;{tutorSelectQuery.trim()}&quot;</span>
            )}
          </div>

          {/* Lista de Resultados com rolagem */}
          <div className="flex-1 overflow-y-auto min-h-[260px] max-h-[50vh] border border-slate-200/80 rounded-md divide-y divide-slate-200/80 bg-slate-100/60 shadow-2xs">
            {tutorSelectLoading && tutorSelectResults.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                Buscando tutores...
              </div>
            ) : tutorSelectResults.length === 0 ? (
              <div className="py-12 px-4 text-center text-muted-foreground text-sm">
                <p className="font-medium text-slate-700 mb-1">
                  {tutorSelectQuery.trim()
                    ? `Nenhum tutor encontrado para "${tutorSelectQuery.trim()}".`
                    : 'Nenhum tutor encontrado.'}
                </p>
                <p className="text-xs text-slate-500">
                  Tente verificar a grafia ou cadastrar como &quot;Novo Tutor&quot; no formulário.
                </p>
              </div>
            ) : (
              tutorSelectResults.map((tutor) => {
                const isSelected = formData.tutorId === tutor.id
                return (
                  <div
                    key={tutor.id}
                    onClick={() => {
                      setSelectedTutorObj(tutor)
                      setFormData((prev) => ({ ...prev, tutorId: tutor.id }))
                      setIsSelectTutorDialogOpen(false)
                    }}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors bg-slate-100/70 ${
                      isSelected
                        ? 'bg-primary/10 border-l-4 border-l-primary hover:bg-primary/15'
                        : 'hover:bg-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">{tutor.name}</span>
                        {isSelected && (
                          <Badge
                            variant="outline"
                            className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0 shrink-0"
                          >
                            Selecionado
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span>
                          <strong className="font-normal text-slate-400">Tel:</strong>{' '}
                          {tutor.phone || 'Sem telefone'}
                        </span>
                        <span>
                          <strong className="font-normal text-slate-400">Cidade:</strong>{' '}
                          {tutor.city || '-'}
                          {tutor.state ? `/${tutor.state}` : ''}
                        </span>
                        {tutor.cpf && (
                          <span className="text-slate-400 text-[11px]">CPF: {tutor.cpf}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedTutorObj(tutor)
                            setFormData((prev) => ({ ...prev, tutorId: tutor.id }))
                            setIsSelectTutorDialogOpen(false)
                          }}
                        >
                          Selecionar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="shrink-0 pt-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSelectTutorDialogOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Pacientes do Tutor */}
      <Dialog
        open={isTutorPatientsDialogOpen}
        onOpenChange={(open) => {
          setIsTutorPatientsDialogOpen(open)
          if (!open) {
            persistPacientesState((prev) => ({
              ...prev,
              tutorsTab: {
                ...prev.tutorsTab,
                modalTutorId: null,
              },
            }))
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-primary" />
              Animais vinculados
            </DialogTitle>
            <DialogDescription>
              {selectedTutorForPatients ? (
                <span>
                  Tutor: <strong>{selectedTutorForPatients.name}</strong>
                  {selectedTutorForPatients.phone && ` (${selectedTutorForPatients.phone})`}
                </span>
              ) : (
                'Lista de animais deste tutor'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {tutorPatientsLoading ? (
              <div className="py-10 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                Carregando animais do tutor...
              </div>
            ) : tutorPatientsList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm border rounded-lg bg-slate-50/50">
                Nenhum animal cadastrado para este tutor.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/80 rounded-lg border border-slate-200/80 bg-slate-100/60 overflow-hidden shadow-2xs">
                {tutorPatientsList.map((patient) => (
                  <Link
                    key={patient.id}
                    to={`/pacientes/${patient.id}`}
                    onClick={() => setIsTutorPatientsDialogOpen(false)}
                    className="p-3.5 flex items-center justify-between bg-slate-100/70 hover:bg-slate-200/70 transition-colors group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                          {patient.name}
                        </span>
                        {patient.nume ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] bg-blue-50 text-blue-800 border-blue-200 font-bold"
                            title="Número Oficial do Paciente"
                          >
                            {patient.nume}
                          </Badge>
                        ) : patient.ctrl && patient.ctrl !== '0' ? (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] bg-slate-50 text-slate-600 border-slate-200"
                            title="Código Legado CTRL"
                          >
                            CTRL: {patient.ctrl}
                          </Badge>
                        ) : null}
                        {patient.deceased && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Óbito
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className={
                            patient.species?.toLowerCase() === 'cão' ||
                            patient.species?.toLowerCase() === 'cachorro'
                              ? 'bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0'
                              : 'bg-purple-50 text-purple-700 text-[10px] px-1.5 py-0'
                          }
                        >
                          {patient.species}
                        </Badge>
                        <span>{patient.breed || 'SRD'}</span>
                        {patient.gender && <span>• {patient.gender}</span>}
                        {patient.weight ? <span>• {patient.weight} kg</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform">
                      <span>Ver ficha</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
