import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity, Users, Clock, Syringe, PlusCircle, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { Appointment } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'

export default function Index() {
  const [stats, setStats] = useState({ totalPatients: 0, appointmentsToday: 0, pendingReturns: 0 })
  const [upcoming, setUpcoming] = useState<Appointment[]>([])

  const loadData = async () => {
    const pts = await api.getPatients()
    const apps = await api.getAppointments()

    const todayStr = new Date().toISOString().split('T')[0]
    const todayApps = apps.filter((a) => a.date.startsWith(todayStr))
    const pending = apps.filter((a) => a.status === 'scheduled' && a.type === 'return')

    setStats({
      totalPatients: pts.length,
      appointmentsToday: todayApps.length,
      pendingReturns: pending.length,
    })
    setUpcoming(apps.filter((a) => a.status === 'scheduled').slice(0, 5))
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('patients', () => loadData())
  useRealtime('appointments', () => loadData())

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      return: 'Retorno',
      vaccine: 'Vacina',
      surgery: 'Cirurgia',
      consultation: 'Consulta',
    }
    return labels[type] || type
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao VetSaaS. {stats.totalPatients} pacientes registrados.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atendimentos Hoje
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.appointmentsToday}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pacientes Cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.totalPatients}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retornos Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.pendingReturns}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vacinas Programadas
            </CardTitle>
            <Syringe className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {upcoming.filter((a) => a.type === 'vaccine').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-5 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Nenhum agendamento futuro.
                    </TableCell>
                  </TableRow>
                )}
                {upcoming.map((app) => (
                  <TableRow key={app.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {app.expand?.patient_id?.name || 'Desconhecido'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {app.expand?.patient_id?.species}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.expand?.patient_id?.expand?.tutor_id?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-700 border-amber-200"
                      >
                        {getTypeLabel(app.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {app.expand?.patient_id?.id && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80"
                        >
                          <Link to={`/pacientes/${app.expand.patient_id.id}`}>Ver Ficha</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-sm bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 h-12 text-primary font-medium"
              asChild
            >
              <Link to="/pacientes">
                <PlusCircle className="w-5 h-5" /> Cadastrar Tutor/Animal
              </Link>
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-3 h-12 text-primary font-medium bg-primary-foreground/90 hover:bg-white"
              asChild
            >
              <Link to="/agenda">
                <FileText className="w-5 h-5" /> Ver Agenda Completa
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
