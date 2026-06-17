import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { Patient } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Activity } from 'lucide-react'
import { GeneralInfoTab } from '@/components/patient/GeneralInfoTab'
import { ReturnsTab } from '@/components/patient/ReturnsTab'
import { ClinicalHistoryTab } from '@/components/patient/ClinicalHistoryTab'

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!id) return
    try {
      const data = await api.getPatient(id)
      setPatient(data)
    } catch {
      setPatient(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])
  useRealtime('patients', () => loadData())
  useRealtime('tutors', () => loadData())

  if (loading)
    return <div className="p-8 text-center text-muted-foreground">Carregando ficha...</div>

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <h2 className="text-2xl font-bold mb-4">Paciente não encontrado</h2>
        <Button onClick={() => navigate('/pacientes')}>Voltar para a lista</Button>
      </div>
    )
  }

  const getAge = (dateStr: string) => {
    if (!dateStr) return '-'
    const diff = Date.now() - new Date(dateStr).getTime()
    const age = new Date(diff)
    return Math.abs(age.getUTCFullYear() - 1970) + ' anos'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/pacientes')}
          className="text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ficha do Paciente</h1>
          <p className="text-sm text-muted-foreground">ID: {patient.id}</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-primary/10 to-transparent h-24 absolute w-full top-0 left-0" />
          <div className="relative p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-100 shadow-md border-4 border-white overflow-hidden flex-shrink-0 flex items-center justify-center z-10">
              <Activity className="w-8 h-8 text-slate-300" />
            </div>

            <div className="flex-1 space-y-2 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                  {patient.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1 font-medium text-slate-800">
                  {patient.species} - {patient.breed}
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div>{patient.gender}</div>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="text-primary font-medium">{getAge(patient.birth_date)}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full md:w-auto z-10">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Tutor Responsável
              </div>
              <div className="font-semibold text-slate-900">{patient.expand?.tutor_id?.name}</div>
              <div className="text-sm text-slate-600 mt-1">{patient.expand?.tutor_id?.phone}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="gerais" className="w-full space-y-6">
        <TabsList className="bg-white border shadow-sm w-full justify-start h-auto p-1 overflow-x-auto flex-nowrap rounded-lg">
          <TabsTrigger
            value="gerais"
            className="px-6 py-2.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
          >
            Dados Gerais
          </TabsTrigger>
          <TabsTrigger
            value="clinica"
            className="px-6 py-2.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
          >
            Ficha Clínica
          </TabsTrigger>
          <TabsTrigger
            value="retornos"
            className="px-6 py-2.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium flex items-center gap-2"
          >
            Retornos / Agenda
          </TabsTrigger>
        </TabsList>
        <div className="bg-white/50 rounded-xl">
          <TabsContent value="gerais" className="mt-0 outline-none">
            <GeneralInfoTab patient={patient} />
          </TabsContent>
          <TabsContent value="clinica" className="mt-0 outline-none">
            <ClinicalHistoryTab patient={patient} />
          </TabsContent>
          <TabsContent value="retornos" className="mt-0 outline-none">
            <ReturnsTab patient={patient} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
