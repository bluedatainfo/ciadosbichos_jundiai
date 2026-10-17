import { useState } from 'react'
import { Patient } from '@/lib/types'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Loader2, MessageCircle, UploadCloud } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { auditService } from '@/services/audit'

export function GeneralInfoTab({ patient }: { patient: Patient }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)
  const tutor = patient.expand?.tutor_id

  const [tutorData, setTutorData] = useState({
    name: tutor?.name || '',
    phone: tutor?.phone || '',
    phone_secondary: tutor?.phone_secondary || '',
    cpf: tutor?.cpf || '',
    email: tutor?.email || '',
    cep: tutor?.cep || '',
    address: tutor?.address || '',
    additional_info: tutor?.additional_info || '',
    rg: tutor?.rg || '',
    city: tutor?.city || '',
    state: tutor?.state || '',
    neighborhood: tutor?.neighborhood || '',
    indication: tutor?.indication || '',
    tel3: tutor?.tel3 || '',
    dbdt_flag: tutor?.dbdt_flag || false,
    dbtx: tutor?.dbtx || '',
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [patientData, setPatientData] = useState({
    name: patient.name,
    species: patient.species,
    breed: patient.breed,
    weight: patient.weight.toString(),
    gender: patient.gender,
    birth_date: patient.birth_date ? patient.birth_date.split(' ')[0] : '',
    pelagem: patient.pelagem || '',
    microchip: patient.microchip || '',
    ctrl: patient.ctrl || '',
    nume: patient.nume || '',
    import_key: patient.import_key || '',
    deceased: patient.deceased || false,
    status_notes: patient.status_notes || '',
  })

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone) {
      const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      window.open(`https://wa.me/${number}`, '_blank')
    }
  }

  const createdDate = patient.created ? format(new Date(patient.created), 'dd/MM/yyyy') : ''
  const lastVisitDate = patient.last_visit
    ? format(new Date(patient.last_visit), 'dd/MM/yyyy')
    : 'Nenhuma visita'

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '')
    setTutorData((prev) => ({ ...prev, cep: val }))
    if (val.length === 8) {
      setCepLoading(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setTutorData((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }))
          toast({
            title: 'CEP Encontrado',
            description: 'Endereço, bairro, cidade e estado preenchidos automaticamente.',
          })
        } else {
          toast({ title: 'CEP não encontrado', variant: 'destructive' })
        }
      } catch (err) {
        toast({ title: 'Erro ao buscar CEP', variant: 'destructive' })
      } finally {
        setCepLoading(false)
      }
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const patientUpdatePayload = {
        name: patientData.name,
        species: patientData.species,
        breed: patientData.breed,
        weight: parseFloat(patientData.weight) || 0,
        gender: patientData.gender as any,
        birth_date: patientData.birth_date ? new Date(patientData.birth_date).toISOString() : '',
        pelagem: patientData.pelagem,
        microchip: patientData.microchip,
        ctrl: patientData.ctrl,
        nume: patientData.nume,
        deceased: patientData.deceased,
        status_notes: patientData.status_notes,
        ...(photoFile ? { photo: photoFile } : {}),
      }

      const patientDiff = auditService.computeDiff(patient, patientUpdatePayload)

      await api.updatePatient(patient.id, patientUpdatePayload)

      if (Object.keys(patientDiff).length > 0) {
        auditService.log({
          action: 'update',
          module: 'patients',
          recordId: patient.id,
          recordLabel: patientData.name,
          patientName: patientData.name,
          tutorName: tutor?.name || tutorData.name,
          changes: patientDiff,
          details: `Atualização dos dados gerais do paciente ${patientData.name} (${Object.keys(patientDiff).length} campos alterados)`,
        })
      }

      if (tutor) {
        const tutorUpdatePayload = {
          name: tutorData.name,
          phone: tutorData.phone,
          phone_secondary: tutorData.phone_secondary,
          cpf: tutorData.cpf,
          email: tutorData.email,
          cep: tutorData.cep,
          address: tutorData.address,
          additional_info: tutorData.additional_info,
          rg: tutorData.rg,
          city: tutorData.city,
          state: tutorData.state,
          neighborhood: tutorData.neighborhood,
          indication: tutorData.indication,
          tel3: tutorData.tel3,
          dbdt_flag: tutorData.dbdt_flag,
          dbtx: tutorData.dbtx,
        }

        const tutorDiff = auditService.computeDiff(tutor, tutorUpdatePayload)

        await api.updateTutor(tutor.id, tutorUpdatePayload)

        if (Object.keys(tutorDiff).length > 0) {
          auditService.log({
            action: 'update',
            module: 'tutors',
            recordId: tutor.id,
            recordLabel: tutorData.name,
            tutorName: tutorData.name,
            patientName: patientData.name,
            changes: tutorDiff,
            details: `Atualização de dados cadastrais do tutor ${tutorData.name} via ficha do paciente`,
          })
        }
      }
      toast({ title: 'Sucesso', description: 'Dados gerais atualizados com sucesso.' })
    } catch (err) {
      toast({ title: 'Erro', description: 'Erro ao salvar alterações.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-sm">
        <CardHeader className="border-b bg-slate-50/50 pb-4">
          <CardTitle className="text-lg text-slate-800">Seção Tutor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Nome do Tutor em posição de destaque natural com fundo amarelo claro */}
          <div className="space-y-1.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/70">
            <Label
              htmlFor="tutor-name"
              className="text-amber-950 font-semibold flex items-center gap-1.5"
            >
              <span>Nome do Tutor</span>
              <span className="text-xs font-normal text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                Destaque
              </span>
            </Label>
            <Input
              id="tutor-name"
              value={tutorData.name}
              onChange={(e) => setTutorData({ ...tutorData, name: e.target.value })}
              className="bg-amber-50/60 border-amber-300 focus-visible:ring-amber-400 text-slate-900 font-medium"
              placeholder="Nome completo do tutor"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={tutorData.cpf}
                onChange={(e) => setTutorData({ ...tutorData, cpf: e.target.value })}
                className="bg-slate-100/70"
              />
            </div>
            <div className="space-y-1">
              <Label>RG</Label>
              <Input
                value={tutorData.rg}
                onChange={(e) => setTutorData({ ...tutorData, rg: e.target.value })}
                className="bg-slate-100/70"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                Telefone
                {tutorData.phone && (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(tutorData.phone)}
                    className="text-green-600 hover:text-green-700"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </Label>
              <Input
                value={tutorData.phone}
                onChange={(e) => setTutorData({ ...tutorData, phone: e.target.value })}
                className="bg-slate-100/70"
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                Telefone Secundário
                {tutorData.phone_secondary && (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(tutorData.phone_secondary)}
                    className="text-green-600 hover:text-green-700"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </Label>
              <Input
                value={tutorData.phone_secondary}
                onChange={(e) => setTutorData({ ...tutorData, phone_secondary: e.target.value })}
                className="bg-slate-100/70"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                Telefone 3
                {tutorData.tel3 && (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(tutorData.tel3)}
                    className="text-green-600 hover:text-green-700"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </Label>
              <Input
                value={tutorData.tel3}
                onChange={(e) => setTutorData({ ...tutorData, tel3: e.target.value })}
                className="bg-slate-100/70"
                placeholder="Telefone adicional / recado"
              />
            </div>
            <div className="space-y-1">
              <Label>Indicação (Quem indicou)</Label>
              <Input
                value={tutorData.indication}
                onChange={(e) => setTutorData({ ...tutorData, indication: e.target.value })}
                className="bg-slate-100/70"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={tutorData.email}
              onChange={(e) => setTutorData({ ...tutorData, email: e.target.value })}
              className="bg-slate-100/70"
            />
          </div>

          <div className="space-y-2 p-3 rounded-lg border border-slate-200 bg-slate-100/70">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tutor-dbdt-flag"
                checked={tutorData.dbdt_flag}
                onChange={(e) => setTutorData({ ...tutorData, dbdt_flag: e.target.checked })}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
              />
              <Label
                htmlFor="tutor-dbdt-flag"
                className="font-semibold text-slate-800 cursor-pointer flex items-center gap-2 flex-wrap"
              >
                <span>Débito</span>
                {tutorData.dbtx && (
                  <span className="font-normal text-xs text-red-700 bg-red-100/80 px-2 py-0.5 rounded border border-red-200">
                    {tutorData.dbtx}
                  </span>
                )}
              </Label>
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-xs text-muted-foreground">
                Texto / Detalhe do Débito (DBTX)
              </Label>
              <Input
                placeholder="Ex: Débito pendente R$ 150,00 referente a consulta em..."
                value={tutorData.dbtx}
                onChange={(e) => setTutorData({ ...tutorData, dbtx: e.target.value })}
                className="bg-white/90 text-xs"
              />
            </div>
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Endereço do Tutor
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1 relative">
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    value={tutorData.cep}
                    onChange={handleCepChange}
                    className="bg-slate-100/70 pr-8"
                    maxLength={9}
                    placeholder="00000000"
                  />
                  {cepLoading && (
                    <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Endereço / Logradouro</Label>
                <Input
                  value={tutorData.address}
                  onChange={(e) => setTutorData({ ...tutorData, address: e.target.value })}
                  className="bg-slate-100/70"
                  placeholder="Rua, Av, Número, Complemento"
                  disabled={cepLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Bairro</Label>
                <Input
                  value={tutorData.neighborhood}
                  onChange={(e) => setTutorData({ ...tutorData, neighborhood: e.target.value })}
                  className="bg-slate-100/70"
                  placeholder="Bairro"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Cidade</Label>
                <Input
                  value={tutorData.city}
                  onChange={(e) => setTutorData({ ...tutorData, city: e.target.value })}
                  className="bg-slate-100/70"
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Estado (UF)</Label>
                <Input
                  value={tutorData.state}
                  onChange={(e) =>
                    setTutorData({ ...tutorData, state: e.target.value.toUpperCase() })
                  }
                  className="bg-slate-100/70"
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t">
            <Label>Informações Adicionais</Label>
            <Textarea
              value={tutorData.additional_info}
              onChange={(e) => setTutorData({ ...tutorData, additional_info: e.target.value })}
              className="bg-slate-100/70 min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <CardTitle className="text-lg text-slate-800">Seção Animal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {/* Nome do Animal em posição de destaque natural com fundo amarelo claro */}
            <div className="space-y-1.5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/70">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="patient-name"
                  className="text-amber-950 font-semibold flex items-center gap-1.5"
                >
                  <span>Nome do Animal</span>
                  <span className="text-xs font-normal text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                    Destaque
                  </span>
                </Label>
                {patientData.nume && (
                  <span
                    className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-200"
                    title="Nº Oficial (NUME) do Paciente"
                  >
                    NUME: {patientData.nume}
                  </span>
                )}
              </div>
              <Input
                id="patient-name"
                value={patientData.name}
                onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                className="bg-amber-50/60 border-amber-300 focus-visible:ring-amber-400 text-slate-900 font-medium w-full"
                placeholder="Nome do animal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Foto do Paciente</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                    className="bg-slate-100/70 flex-1"
                  />
                  {photoFile && (
                    <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                      {photoFile.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Data de Cadastro</Label>
                <Input
                  value={createdDate}
                  readOnly
                  className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <Label>Data da Última Visita</Label>
                <Input
                  value={lastVisitDate}
                  readOnly
                  className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nascimento</Label>
                <Input
                  type="date"
                  value={patientData.birth_date}
                  onChange={(e) => setPatientData({ ...patientData, birth_date: e.target.value })}
                  className="bg-slate-100/70"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Espécie</Label>
                <Input
                  value={patientData.species}
                  onChange={(e) => setPatientData({ ...patientData, species: e.target.value })}
                  className="bg-slate-100/70"
                />
              </div>
              <div className="space-y-1">
                <Label>Raça</Label>
                <Input
                  value={patientData.breed}
                  onChange={(e) => setPatientData({ ...patientData, breed: e.target.value })}
                  className="bg-slate-100/70"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Pelagem</Label>
                <Input
                  value={patientData.pelagem}
                  onChange={(e) => setPatientData({ ...patientData, pelagem: e.target.value })}
                  className="bg-slate-100/70"
                />
              </div>
              <div className="space-y-1">
                <Label>Sexo</Label>
                <Select
                  value={patientData.gender}
                  onValueChange={(v: 'Macho' | 'Fêmea') =>
                    setPatientData({ ...patientData, gender: v })
                  }
                >
                  <SelectTrigger className="bg-slate-100/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Fêmea">Fêmea</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={patientData.weight}
                  onChange={(e) => setPatientData({ ...patientData, weight: e.target.value })}
                  className="bg-slate-100/70"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1">
                <Label>Microchip</Label>
                <Input
                  placeholder="Número do chip"
                  value={patientData.microchip}
                  onChange={(e) => setPatientData({ ...patientData, microchip: e.target.value })}
                  className="bg-slate-100/70 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Código Legado (CTRL)</Label>
                <Input
                  value={patientData.ctrl}
                  onChange={(e) => setPatientData({ ...patientData, ctrl: e.target.value })}
                  className="bg-slate-100/70 font-mono text-xs"
                />
              </div>
            </div>

            {patientData.import_key && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">
                  Chave de Importação do Legado
                </Label>
                <Input
                  value={patientData.import_key}
                  readOnly
                  className="bg-slate-100/70 text-slate-500 font-mono text-[11px]"
                />
              </div>
            )}

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="deceased-check"
                  checked={patientData.deceased}
                  onChange={(e) => setPatientData({ ...patientData, deceased: e.target.checked })}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <Label
                  htmlFor="deceased-check"
                  className="font-semibold text-red-700 cursor-pointer"
                >
                  Marcar animal como Óbito / Falecido
                </Label>
              </div>
              {patientData.deceased && (
                <div className="space-y-1 pl-6">
                  <Label className="text-xs text-muted-foreground">
                    Observação de Óbito (DBTX)
                  </Label>
                  <Input
                    placeholder="Ex: Óbito em dd/mm/aaaa, eutanásia, etc."
                    value={patientData.status_notes}
                    onChange={(e) =>
                      setPatientData({ ...patientData, status_notes: e.target.value })
                    }
                    className="bg-slate-100/70 text-xs"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
