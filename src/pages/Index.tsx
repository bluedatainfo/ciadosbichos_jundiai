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
import { Users, UserSquare, Calendar, AlertCircle, PlusCircle, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { Appointment } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'

export default function Index() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalTutors: 0,
    appointmentsToday: 0,
    upcomingReturnsWeek: 0,
  })
  const [recent, setRecent] = useState<Appointment[]>([])

  const loadData = async () => {
    const s = await api.getDashboardStats()
    const r = await api.getRecentAppointments()
    setStats(s)
    setRecent(r)
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('patients', () => loadData())
  useRealtime('tutors', () => loadData())
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
        <p className="text-muted-foreground mt-1">Visão geral da operação da clínica.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              Tutores Cadastrados
            </CardTitle>
            <UserSquare className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.totalTutors}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Atendimentos Hoje
            </CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.appointmentsToday}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retornos (7 dias)
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.upcomingReturnsWeek}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        <Card className="md:col-span-5 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      Nenhum agendamento recente.
                    </TableCell>
                  </TableRow>
                )}
                {recent.map((app) => (
                  <TableRow key={app.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-sm">
                      {format(new Date(app.date), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {app.expand?.patient_id?.name || 'Desconhecido'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tutor: {app.expand?.patient_id?.expand?.tutor_id?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-50">
                        {getTypeLabel(app.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          app.status === 'scheduled'
                            ? 'default'
                            : app.status === 'completed'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className={
                          app.status === 'scheduled'
                            ? 'bg-amber-100 text-amber-800'
                            : app.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : ''
                        }
                      >
                        {app.status === 'scheduled'
                          ? 'Agendado'
                          : app.status === 'completed'
                            ? 'Concluído'
                            : 'Cancelado'}
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
                          <Link to={`/pacientes/${app.expand.patient_id.id}`}>Ficha</Link>
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
