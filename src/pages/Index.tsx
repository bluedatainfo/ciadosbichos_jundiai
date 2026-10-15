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
import {
  Users,
  UserSquare,
  Calendar,
  AlertCircle,
  PlusCircle,
  FileText,
  BellRing,
  Stethoscope,
  Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { api } from '@/services/api'
import { Appointment, RecentClinicalRecordItem } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'
import { ReturnAlertsSection } from '@/components/dashboard/ReturnAlertsSection'
import { getReturnAlerts } from '@/services/return-alerts'

interface DashboardStatsState {
  totalPatients: number
  totalTutors: number
  appointmentsToday: number
  lowStockCount: number
  returnAlertsCount: number
}

interface CachedDashboardData {
  stats: DashboardStatsState
  upcomingAppointments: Appointment[]
  recentClinicalRecords: RecentClinicalRecordItem[]
}

const DASHBOARD_CACHE_KEY = 'clinica_dashboard_stats_cache_v2'

function getInitialCachedStats(): {
  stats: DashboardStatsState
  upcoming: Appointment[]
  recentClinical: RecentClinicalRecordItem[]
  isCached: boolean
} {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CachedDashboardData
      if (
        typeof parsed?.stats?.totalPatients === 'number' &&
        typeof parsed?.stats?.totalTutors === 'number'
      ) {
        return {
          stats: {
            totalPatients: parsed.stats.totalPatients,
            totalTutors: parsed.stats.totalTutors,
            appointmentsToday: parsed.stats.appointmentsToday ?? 0,
            lowStockCount: parsed.stats.lowStockCount ?? 0,
            returnAlertsCount: parsed.stats.returnAlertsCount ?? 0,
          },
          upcoming: Array.isArray(parsed.upcomingAppointments) ? parsed.upcomingAppointments : [],
          recentClinical: Array.isArray(parsed.recentClinicalRecords)
            ? parsed.recentClinicalRecords
            : [],
          isCached: true,
        }
      }
    }
  } catch {
    // ignorar erros de parse do localStorage
  }
  return {
    stats: {
      totalPatients: 0,
      totalTutors: 0,
      appointmentsToday: 0,
      lowStockCount: 0,
      returnAlertsCount: 0,
    },
    upcoming: [],
    recentClinical: [],
    isCached: false,
  }
}

export default function Index() {
  const initial = getInitialCachedStats()
  const [stats, setStats] = useState<DashboardStatsState>(initial.stats)
  const [hasLoaded, setHasLoaded] = useState<boolean>(initial.isCached)
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>(initial.upcoming)
  const [recentClinicalRecords, setRecentClinicalRecords] = useState<RecentClinicalRecordItem[]>(
    initial.recentClinical,
  )

  const loadData = async () => {
    try {
      // 1. Dispara a busca otimizada das estatísticas e retornos
      const [s, alertsData, fallbackUpcoming, fallbackClinical] = await Promise.all([
        api.getDashboardStats(),
        getReturnAlerts().catch(() => ({ alerts: [], overdueCount: 0, dueSoonCount: 0 })),
        api.getUpcomingAppointments().catch(() => []),
        api.getRecentClinicalRecords().catch(() => []),
      ])

      const finalReturnAlertsCount =
        typeof alertsData?.alerts?.length === 'number'
          ? alertsData.alerts.length
          : (s.returnAlertsCount ?? 0)

      const newStats: DashboardStatsState = {
        totalPatients: s.totalPatients,
        totalTutors: s.totalTutors,
        appointmentsToday: s.appointmentsToday,
        lowStockCount: s.lowStockCount,
        returnAlertsCount: finalReturnAlertsCount,
      }

      setStats(newStats)
      setHasLoaded(true)

      // Próximos agendamentos (futuros)
      const nextUpcoming =
        s.upcomingAppointments && s.upcomingAppointments.length > 0
          ? s.upcomingAppointments
          : fallbackUpcoming
      setUpcomingAppointments(nextUpcoming)

      // Atendimentos recentes (fichas clínicas realizadas até hoje)
      const nextClinical =
        s.recentClinicalRecords && s.recentClinicalRecords.length > 0
          ? s.recentClinicalRecords
          : fallbackClinical
      setRecentClinicalRecords(nextClinical)

      // Atualiza o cache do localStorage para visitas instantâneas posteriores
      try {
        const cachePayload: CachedDashboardData = {
          stats: newStats,
          upcomingAppointments: nextUpcoming,
          recentClinicalRecords: nextClinical,
        }
        localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cachePayload))
      } catch {
        /* ignorar */
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setHasLoaded(true)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('patients', () => loadData())
  useRealtime('tutors', () => loadData())
  useRealtime('appointments', () => loadData())
  useRealtime('clinical_records', () => loadData())
  useRealtime('vaccines', () => loadData())

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      return: 'Retorno',
      vaccine: 'Vacina',
      surgery: 'Cirurgia',
      consultation: 'Consulta',
    }
    return labels[type] || type
  }

  const formatSafeDate = (dateVal: string | undefined | null) => {
    if (!dateVal) return '-'
    try {
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) return dateVal
      return format(d, 'dd/MM/yyyy HH:mm')
    } catch {
      return dateVal
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da operação da clínica.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Animais Cadastrados
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {!hasLoaded ? (
              <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{stats.totalPatients}</div>
            )}
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
            {!hasLoaded ? (
              <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{stats.totalTutors}</div>
            )}
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
            {!hasLoaded ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{stats.appointmentsToday}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alertas de Retorno
            </CardTitle>
            <BellRing className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {!hasLoaded ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-bold text-amber-600">{stats.returnAlertsCount}</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Itens em Falta
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {!hasLoaded ? (
              <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-md" />
            ) : (
              <div className="text-3xl font-bold text-red-600">{stats.lowStockCount}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Painel Visível de Alertas de Retorno */}
      <ReturnAlertsSection />

      {/* Painéis Principais: Próximos Agendamentos (Futuro) e Atendimentos Recentes (Realizados) */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Painel 1: Próximos Agendamentos (Recepção) */}
        <Card className="md:col-span-5 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" /> Próximos Agendamentos
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consultas e retornos marcados para datas futuras — visão da recepção.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link to="/agenda">Ver Agenda Completa</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingAppointments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhum agendamento futuro encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {upcomingAppointments.map((app) => (
                  <TableRow key={app.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium text-sm">
                      {formatSafeDate(app.date)}
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

        {/* Card Lateral de Ações Rápidas */}
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

      {/* Painel 2: Atendimentos Recentes (Realizados nas Fichas Clínicas) */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-emerald-600" /> Atendimentos Recentes
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consultas e evoluções clínicas realizadas (fonte: fichas clínicas) ordenadas pela data
              mais recente.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to="/pacientes">Ver Animais</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Data do Atendimento</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Veterinário</TableHead>
                <TableHead>Diagnóstico / Queixa</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClinicalRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum atendimento clínico recente registrado.
                  </TableCell>
                </TableRow>
              )}
              {recentClinicalRecords.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-sm">{formatSafeDate(item.date)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{item.patient_name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-700">{item.tutor_name}</div>
                  </TableCell>
                  <TableCell>
                    {item.veterinarian ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        {item.veterinarian}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell
                    className="max-w-[260px] truncate text-xs text-slate-600"
                    title={item.diagnosis || item.description}
                  >
                    {item.diagnosis ? (
                      <span className="font-medium text-slate-800">{item.diagnosis}</span>
                    ) : (
                      item.description || '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.patient_id && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80"
                      >
                        <Link to={`/pacientes/${item.patient_id}`}>Ficha</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
