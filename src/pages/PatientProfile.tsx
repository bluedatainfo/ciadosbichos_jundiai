import { useParams, useNavigate } from 'react-router-dom'
import { mockPatients } from '@/lib/mock-data'
import { calculateAge } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Activity, AlertCircle } from 'lucide-react'
import { GeneralInfoTab } from '@/components/patient/GeneralInfoTab'
import { ReturnsTab } from '@/components/patient/ReturnsTab'
import { ClinicalHistoryTab } from '@/components/patient/ClinicalHistoryTab'
import { ImagesTab } from '@/components/patient/ImagesTab'

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const patient = mockPatients.find((p) => p.id === id)

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
        <h2 className="text-2xl font-bold mb-4">Paciente não encontrado</h2>
        <Button onClick={() => navigate('/pacientes')}>Voltar para a lista</Button>
      </div>
    )
  }

  const age = calculateAge(patient.birthDate)

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

      {patient.debts && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 flex items-center gap-3 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="font-medium text-sm">
            Atenção: Paciente possui débitos ativos ({patient.debts})
          </span>
        </div>
      )}

      {/* Header Summary Card */}
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-primary/10 to-transparent h-24 absolute w-full top-0 left-0" />
          <div className="relative p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl bg-white shadow-md border-4 border-white overflow-hidden flex-shrink-0 z-10">
              {patient.photoUrl ? (
                <img
                  src={patient.photoUrl}
                  alt={patient.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-slate-300" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
                  {patient.name}
                </h2>
                {!patient.isAlive && <Badge variant="destructive">Óbito</Badge>}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1 font-medium text-slate-800">
                  {patient.species} - {patient.breed}
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div>{patient.gender}</div>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <div className="text-primary font-medium">{age}</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-full md:w-auto z-10">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Tutor Responsável
              </div>
              <div className="font-semibold text-slate-900">{patient.owner.name}</div>
              <div className="text-sm text-slate-600 mt-1">{patient.owner.phones[0]}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs System */}
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
            Retornos
            {patient.returns.filter((r) => r.status === 'Pendente').length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {patient.returns.filter((r) => r.status === 'Pendente').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="imagens"
            className="px-6 py-2.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium"
          >
            Imagens ({patient.images.length})
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
          <TabsContent value="imagens" className="mt-0 outline-none">
            <ImagesTab patient={patient} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
