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
import { Search, Plus, ChevronRight, MessageCircle } from 'lucide-react'

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

  useEffect(() => {
    loadPatients()
  }, [debouncedPatientSearch])
  useEffect(() => {
    loadTutors()
  }, [debouncedTutorSearch])
  useEffect(() => {
    loadAllTutors()
  }, [])

  useRealtime('patients', () => loadPatients())
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

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead>Paciente</TableHead>
                      <TableHead>Espécie/Raça</TableHead>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
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
                              className="font-semibold text-slate-900 group-hover:text-primary transition-colors block"
                            >
                              {patient.name}
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

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                          Nenhum tutor encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tutors.map((tutor) => (
                        <TableRow key={tutor.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-medium text-slate-900">{tutor.name}</TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {tutor.cpf || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              {tutor.phone || '-'}
                              {tutor.phone && (
                                <button
                                  onClick={() => openWhatsApp(tutor.phone!)}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Contatar via WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {tutor.email || '-'}
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
    </div>
  )
}
