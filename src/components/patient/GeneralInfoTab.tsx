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
import { Save, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

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
  })

  const [patientData, setPatientData] = useState({
    name: patient.name,
    species: patient.species,
    breed: patient.breed,
    weight: patient.weight.toString(),
    gender: patient.gender,
    birth_date: patient.birth_date ? patient.birth_date.split(' ')[0] : '',
    pelagem: patient.pelagem || '',
  })

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
            address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`,
          }))
          toast({ title: 'CEP Encontrado', description: 'Endereço preenchido automaticamente.' })
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
      await api.updatePatient(patient.id, {
        name: patientData.name,
        species: patientData.species,
        breed: patientData.breed,
        weight: parseFloat(patientData.weight) || 0,
        gender: patientData.gender as any,
        birth_date: patientData.birth_date ? new Date(patientData.birth_date).toISOString() : '',
        pelagem: patientData.pelagem,
      })
      if (tutor) {
        await api.updateTutor(tutor.id, {
          name: tutorData.name,
          phone: tutorData.phone,
          phone_secondary: tutorData.phone_secondary,
          cpf: tutorData.cpf,
          email: tutorData.email,
          cep: tutorData.cep,
          address: tutorData.address,
          additional_info: tutorData.additional_info,
        })
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome do Tutor</Label>
              <Input
                value={tutorData.name}
                onChange={(e) => setTutorData({ ...tutorData, name: e.target.value })}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={tutorData.cpf}
                onChange={(e) => setTutorData({ ...tutorData, cpf: e.target.value })}
                className="bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={tutorData.phone}
                onChange={(e) => setTutorData({ ...tutorData, phone: e.target.value })}
                className="bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label>Telefone Secundário</Label>
              <Input
                value={tutorData.phone_secondary}
                onChange={(e) => setTutorData({ ...tutorData, phone_secondary: e.target.value })}
                className="bg-white"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              type="email"
              value={tutorData.email}
              onChange={(e) => setTutorData({ ...tutorData, email: e.target.value })}
              className="bg-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1 relative">
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  value={tutorData.cep}
                  onChange={handleCepChange}
                  className="bg-white pr-8"
                  maxLength={9}
                  placeholder="00000000"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Endereço</Label>
              <Input
                value={tutorData.address}
                onChange={(e) => setTutorData({ ...tutorData, address: e.target.value })}
                className="bg-white"
                disabled={cepLoading}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Informações Adicionais</Label>
            <Textarea
              value={tutorData.additional_info}
              onChange={(e) => setTutorData({ ...tutorData, additional_info: e.target.value })}
              className="bg-white min-h-[80px]"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Data de Cadastro</Label>
                <Input
                  value={createdDate}
                  readOnly
                  className="bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <Label>Data da Última Visita</Label>
                <Input
                  value={lastVisitDate}
                  readOnly
                  className="bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={patientData.name}
                  onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>Nascimento</Label>
                <Input
                  type="date"
                  value={patientData.birth_date}
                  onChange={(e) => setPatientData({ ...patientData, birth_date: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Espécie</Label>
                <Input
                  value={patientData.species}
                  onChange={(e) => setPatientData({ ...patientData, species: e.target.value })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>Raça</Label>
                <Input
                  value={patientData.breed}
                  onChange={(e) => setPatientData({ ...patientData, breed: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Pelagem</Label>
                <Input
                  value={patientData.pelagem}
                  onChange={(e) => setPatientData({ ...patientData, pelagem: e.target.value })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label>Sexo</Label>
                <Select
                  value={patientData.gender}
                  onValueChange={(v) => setPatientData({ ...patientData, gender: v })}
                >
                  <SelectTrigger className="bg-white">
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
                  className="bg-white"
                />
              </div>
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
