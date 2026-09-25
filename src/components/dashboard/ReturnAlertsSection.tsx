import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  BellRing,
  AlertTriangle,
  Clock,
  ChevronRight,
  MessageCircle,
  RefreshCw,
  CalendarCheck,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getReturnAlerts, ReturnAlert } from '@/services/return-alerts'
import { useRealtime } from '@/hooks/use-realtime'

const openWhatsApp = (phone: string, patientName: string) => {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (cleanPhone) {
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    const msg = encodeURIComponent(
      `Olá! Entramos em contato da clínica veterinária para lembrar sobre o retorno do seu pet ${patientName}.`,
    )
    window.open(`https://wa.me/${number}?text=${msg}`, '_blank')
  }
}

export function ReturnAlertsSection() {
  const [alerts, setAlerts] = useState<ReturnAlert[]>([])
  const [stats, setStats] = useState({ overdueCount: 0, dueSoonCount: 0 })
  const [loading, setLoading] = useState(true)
  const [filterMode, setFilterMode] = useState<'all' | 'overdue' | 'due_soon'>('all')

  const loadAlerts = async () => {
    try {
      const data = await getReturnAlerts({ daysAhead: 30 })
      setAlerts(data.alerts)
      setStats({
        overdueCount: data.overdueCount,
        dueSoonCount: data.dueSoonCount,
      })
    } catch (err) {
      console.error('Erro ao carregar alertas de retorno:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  useRealtime('vaccines', () => loadAlerts())
  useRealtime('patients', () => loadAlerts())

  const filteredAlerts = alerts.filter((a) => {
    if (filterMode === 'overdue') return a.status === 'overdue'
    if (filterMode === 'due_soon') return a.status === 'due_soon'
    return true
  })

  const formatDateDisplay = (isoStr: string) => {
    try {
      const d = parseISO(isoStr)
      if (isNaN(d.getTime())) return isoStr
      return format(d, 'dd/MM/yyyy')
    } catch {
      return isoStr
    }
  }

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b bg-slate-50/60">
        <div>
          <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
            <BellRing className="w-5 h-5 text-amber-500" />
            Alertas de Retorno dos Pacientes
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identifica pacientes com retornos pendentes, vencidos ou com previsão nos próximos 30
            dias com base nas datas de retorno registradas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={filterMode === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterMode('all')}
            className="h-8 text-xs gap-1.5"
          >
            Todos ({alerts.length})
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'overdue' ? 'destructive' : 'outline'}
            onClick={() => setFilterMode('overdue')}
            className={`h-8 text-xs gap-1.5 ${
              filterMode === 'overdue' ? '' : 'text-red-700 border-red-200 hover:bg-red-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Vencidos ({stats.overdueCount})
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'due_soon' ? 'secondary' : 'outline'}
            onClick={() => setFilterMode('due_soon')}
            className={`h-8 text-xs gap-1.5 ${
              filterMode === 'due_soon'
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'text-amber-800 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Próximos 30d ({stats.dueSoonCount})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadAlerts}
            title="Atualizar alertas"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[380px] overflow-y-auto">
          <Table>
            <TableHeader className="bg-slate-50/70 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[180px]">Situação / Previsão</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Motivo / Descrição</TableHead>
                <TableHead>Tutor & Contato</TableHead>
                <TableHead className="text-right w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Carregando alertas de retorno...
                  </TableCell>
                </TableRow>
              ) : filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <CalendarCheck className="w-8 h-8 text-green-500 stroke-1" />
                      <p className="font-medium text-slate-700">
                        {filterMode === 'overdue'
                          ? 'Nenhum paciente com retorno vencido no momento.'
                          : filterMode === 'due_soon'
                            ? 'Nenhum retorno previsto para os próximos 30 dias.'
                            : 'Nenhum alerta de retorno pendente.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.slice(0, 50).map((alert) => {
                  const isOverdue = alert.status === 'overdue'
                  const absDays = Math.abs(alert.daysDifference)
                  const daysText = isOverdue
                    ? absDays === 0
                      ? 'Hoje'
                      : `Atrasado há ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`
                    : absDays === 0
                      ? 'Hoje'
                      : `Em ${absDays} ${absDays === 1 ? 'dia' : 'dias'}`

                  return (
                    <TableRow key={alert.id} className="hover:bg-slate-50 transition-colors group">
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <Badge
                            variant={isOverdue ? 'destructive' : 'secondary'}
                            className={`text-xs font-semibold gap-1 ${
                              isOverdue
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isOverdue ? (
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            {isOverdue ? 'Vencido' : 'Próximo'}
                          </Badge>
                          <div className="text-xs text-slate-600 font-medium">
                            {formatDateDisplay(alert.returnDate)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{daysText}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Link
                          to={`/pacientes/${alert.patientId}`}
                          className="font-bold text-slate-900 group-hover:text-primary transition-colors block text-sm"
                        >
                          {alert.patientName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {alert.patientSpecies}{' '}
                          {alert.patientBreed ? `• ${alert.patientBreed}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-sm text-slate-800 max-w-[280px]">
                        <span className="line-clamp-2" title={alert.description}>
                          {alert.description}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle text-sm">
                        <div className="font-medium text-slate-900">{alert.tutorName || '-'}</div>
                        {alert.tutorPhone ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                            <span>{alert.tutorPhone}</span>
                            <button
                              type="button"
                              onClick={() => openWhatsApp(alert.tutorPhone!, alert.patientName)}
                              className="text-green-600 hover:text-green-700 p-0.5"
                              title="Lembrar retorno via WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem telefone</span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-primary hover:text-primary/90 text-xs"
                        >
                          <Link to={`/pacientes/${alert.patientId}`}>
                            Ver Ficha <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
