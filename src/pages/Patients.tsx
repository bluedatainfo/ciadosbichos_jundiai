import { useState, useEffect } from 'react'
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
  MessageCircle,
  Edit2,
  Loader2,
  Save,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getReturnAlerts, ReturnAlert } from '@/services/return-alerts'

const openWhatsApp = (phone: string) => {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (cleanPhone) {
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    window.open(`https://wa.me/${number}`, '_blank')
  }
}

export default function Patients() {
  const [patientSearch, setPatientSearch] = useState('')
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState('')
  const [tutorSearch, setTutorSearch] = useState('')
  const [debouncedTutorSearch, setDebouncedTutorSearch] = useState('')

  const [patients, setPatients] = useState<Patient[]>([])
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [allTutors, setAllTutors] = useState<Tutor[]>([])
  const [patientAlertsMap, setPatientAlertsMap] = useState<Record<string, ReturnAlert>>({})

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [tutorMode, setTutorMode] = useState<'existing' | 'new'>('existing')
  const [formData, setFormData] = useState({
    tutorId: '',
    newTutorName: '',
    newTutorPhone: '',
    newTutorEmail: '',
    newTutorCpf: '',
    name: '',
    species: 'Cão',
    breed: '',
    birth_date: '',
    gender: 'Macho',
    weight: '',
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPatientSearch(patientSearch), 500)
    return () => clearTimeout(t)
  }, [patientSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTutorSearch(tutorSearch), 500)
    return () => clearTimeout(t)
  }, [tutorSearch])

  const loadPatients = async () => setPatients(await api.getPatients(debouncedPatientSearch))
  const loadTutors = async () => setTutors(await api.getTutors(debouncedTutorSearch))
  const loadAllTutors = async () => setAllTutors(await api.getTutors())

  const loadAlerts = async () => {
    try {
      const res = await getReturnAlerts({ daysAhead: 30 })
      const map: Record<string, ReturnAlert> = {}
      for (const a of res.alerts) {
        map[a.patientId] = a
      }
      setPatientAlertsMap(map)
    } catch {
      // Ignora erro de alertas
    }
  }

  useEffect(() => {
    loadPatients()
  }, [debouncedPatientSearch])
  useEffect(() => {
    loadTutors()
  }, [debouncedTutorSearch])
  useEffect(() => {
    loadAllTutors()
    loadAlerts()
  }, [])

  useRealtime('patients', () => {
    loadPatients()
    loadAlerts()
  })
  useRealtime('vaccines', () => loadAlerts())
  useRealtime('tutors', () => {
    loadTutors()
    loadAllTutors()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    try {
      let finalTutorId = formData.tutorId
      if (tutorMode === 'new') {
        if (!formData.newTutorName) throw new Error('Nome do tutor é obrigatório')
        const newTutor = await api.createTutor({
          name: formData.newTutorName,
          phone: formData.newTutorPhone,
          email: formData.newTutorEmail,
          cpf: formData.newTutorCpf,
        })
        finalTutorId = newTutor.id
      }
      if (!finalTutorId) throw new Error('Selecione um tutor')

      await api.createPatient({
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        birth_date: formData.birth_date ? new Date(formData.birth_date).toISOString() : '',
        gender: formData.gender as 'Macho' | 'Fêmea',
        weight: parseFloat(formData.weight) || 0,
        tutor_id: finalTutorId,
      })
      setIsSheetOpen(false)
      setFormData({
        tutorId: '',
        newTutorName: '',
        newTutorPhone: '',
        newTutorEmail: '',
        newTutorCpf: '',
        name: '',
        species: 'Cão',
        breed: '',
        birth_date: '',
        gender: 'Macho',
        weight: '',
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
      await api.updateTutor(editingTutor.id, {
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
      })

      toast({ title: 'Sucesso', description: 'Dados do tutor atualizados com sucesso.' })
      setIsEditTutorOpen(false)
      await loadTutors()
      await loadAllTutors()
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pacientes & Tutores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os cadastros de animais e seus responsáveis.
          </p>
        </div>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" /> Novo Cadastro
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Novo Paciente</SheetTitle>
              <SheetDescription>Cadastre um novo paciente e associe a um tutor.</SheetDescription>
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
                  <Label>Selecione o Tutor</Label>
                  <Select
                    value={formData.tutorId}
                    onValueChange={(v) => setFormData({ ...formData, tutorId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allTutors.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                </div>
              )}

              <div className="space-y-4 pt-4">
                <h4 className="font-medium text-sm border-b pb-2">Dados do Animal</h4>
                <Input
                  placeholder="Nome do Animal *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
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

      <Tabs defaultValue="patients" className="w-full">
        <TabsList className="mb-4 bg-slate-100">
          <TabsTrigger value="patients">Lista de Pacientes</TabsTrigger>
          <TabsTrigger value="tutors">Lista de Tutores</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-0">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center bg-white rounded-t-lg">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente por nome, raça ou espécie..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 w-full"
                  />
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                    <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                      <TableHead className="min-w-[150px]">Paciente</TableHead>
                      <TableHead className="min-w-[180px]">Espécie/Raça</TableHead>
                      <TableHead className="min-w-[180px]">Tutor</TableHead>
                      <TableHead className="min-w-[150px]">Telefone</TableHead>
                      <TableHead className="text-right min-w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          Nenhum paciente encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      patients.map((patient) => (
                        <TableRow
                          key={patient.id}
                          className="group hover:bg-slate-50 cursor-pointer transition-colors"
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tutors" className="mt-0">
          <Card className="border-none shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center bg-white rounded-t-lg">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tutor por nome ou CPF..."
                    value={tutorSearch}
                    onChange={(e) => setTutorSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 w-full"
                  />
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px]">
                <Table className="min-w-[800px]">
                  <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                    <TableRow className="bg-slate-50/95 hover:bg-slate-50/95">
                      <TableHead className="min-w-[180px]">Nome</TableHead>
                      <TableHead className="min-w-[140px]">CPF / RG</TableHead>
                      <TableHead className="min-w-[160px]">Telefone</TableHead>
                      <TableHead className="min-w-[140px]">Cidade / Estado</TableHead>
                      <TableHead className="min-w-[160px]">Email</TableHead>
                      <TableHead className="text-right min-w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          Nenhum tutor encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tutors.map((tutor) => (
                        <TableRow
                          key={tutor.id}
                          className="hover:bg-slate-50 transition-colors group"
                        >
                          <TableCell className="font-medium text-slate-900">
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
                              onClick={() => handleOpenEditTutor(tutor)}
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
    </div>
  )
}
