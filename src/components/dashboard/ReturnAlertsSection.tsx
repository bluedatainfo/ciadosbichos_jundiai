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
  Edit2,
  CheckCircle2,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { format, parseISO } from 'date-fns'
import { getReturnAlerts, ReturnAlert } from '@/services/return-alerts'
import { api } from '@/services/api'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

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

  // Estado para Edição do Retorno a partir do Dashboard
  const [editingAlert, setEditingAlert] = useState<ReturnAlert | null>(null)
  const [editFormData, setEditFormData] = useState({ date: '', notes: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Feedback e marcação rápida
  const [justSavedAlertId, setJustSavedAlertId] = useState<string | null>(null)
  const [markingAlertId, setMarkingAlertId] = useState<string | null>(null)

  const { toast } = useToast()

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

  const handleOpenEdit = (alert: ReturnAlert) => {
    setEditingAlert(alert)
    let initialDate = ''
    if (alert.returnDate) {
      try {
        const d = parseISO(alert.returnDate)
        if (!isNaN(d.getTime())) {
          initialDate = format(d, 'yyyy-MM-dd')
        }
      } catch {
        initialDate = ''
      }
    }
    setEditFormData({
      date: initialDate,
      notes: alert.description || '',
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAlert || !editingAlert.vaccineId) return
    setEditSubmitting(true)
    try {
      await api.updateVaccine(editingAlert.vaccineId, {
        name: editFormData.notes.trim() || 'Retorno',
        date: editFormData.date ? new Date(editFormData.date + 'T12:00:00.000Z').toISOString() : '',
      })

      const alertId = editingAlert.id
      setEditingAlert(null)
      setJustSavedAlertId(alertId)

      toast({
        title: 'Retorno atualizado',
        description:
          'Data e histórico ajustados com sucesso. Agora você pode marcá-lo como realizado.',
      })
      await loadAlerts()
    } catch (err) {
      toast({
        title: 'Erro ao salvar retorno',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleMarkCompleted = async (alert: ReturnAlert) => {
    if (!alert.vaccineId) return
    setMarkingAlertId(alert.id)
    try {
      await api.updateVaccine(alert.vaccineId, { completed: true })
      if (justSavedAlertId === alert.id) {
        setJustSavedAlertId(null)
      }
      toast({
        title: 'Retorno Concluído',
        description: `O retorno do paciente ${alert.patientName} foi marcado como realizado e removido dos alertas.`,
      })
      await loadAlerts()
    } catch (err) {
      toast({
        title: 'Erro ao marcar como realizado',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setMarkingAlertId(null)
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
            Identifica pacientes com retornos pendentes não realizados (Vencidos e Próximos 30 dias)
            com destaque visual em amarelo e opções para editar data/histórico ou marcar como
            concluído.
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
                <TableHead className="text-right min-w-[210px]">Ações</TableHead>
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

                  const wasJustSaved = justSavedAlertId === alert.id
                  const isProcessing = markingAlertId === alert.id

                  return (
                    <TableRow
                      key={alert.id}
                      className="bg-yellow-100/80 hover:bg-yellow-200/80 border-l-4 border-l-amber-500 transition-colors group shadow-xs"
                    >
                      <TableCell className="align-middle">
                        <div className="space-y-1">
                          <Badge
                            variant={isOverdue ? 'destructive' : 'secondary'}
                            className={`text-xs font-bold gap-1 ${
                              isOverdue
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                          >
                            {isOverdue ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {isOverdue ? 'Vencido' : 'Retorno Próximo'}
                          </Badge>
                          <div className="text-xs text-amber-950 font-bold">
                            {formatDateDisplay(alert.returnDate)}
                          </div>
                          <div className="text-[11px] text-amber-900/80 font-medium">
                            {daysText}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Link
                          to={`/pacientes/${alert.patientId}`}
                          className="font-bold text-slate-900 group-hover:text-primary transition-colors block text-sm"
                        >
                          {alert.patientName}
                        </Link>
                        <div className="text-xs text-slate-600">
                          {alert.patientSpecies}{' '}
                          {alert.patientBreed ? `• ${alert.patientBreed}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-sm text-slate-900 max-w-[280px]">
                        <span className="line-clamp-2 font-medium" title={alert.description}>
                          {alert.description}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle text-sm">
                        <div className="font-semibold text-slate-900">{alert.tutorName || '-'}</div>
                        {alert.tutorPhone ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-0.5">
                            <span className="font-medium">{alert.tutorPhone}</span>
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
                      <TableCell className="align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Botão Editar: para veterinário ajustar data e histórico */}
                          {alert.vaccineId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEdit(alert)}
                              className="h-8 gap-1 text-xs font-semibold bg-white/95 border-amber-400 text-amber-950 hover:bg-amber-100 hover:border-amber-500 shadow-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </Button>
                          )}

                          {/* Botão Marcar como realizado */}
                          {alert.vaccineId && (
                            <Button
                              size="sm"
                              disabled={isProcessing}
                              onClick={() => handleMarkCompleted(alert)}
                              className={`h-8 gap-1 text-xs font-semibold text-white shadow-xs transition-all ${
                                wasJustSaved
                                  ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-400 ring-offset-1 animate-pulse'
                                  : 'bg-green-600 hover:bg-green-700'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isProcessing ? 'Gravando...' : 'Marcar como realizado'}
                            </Button>
                          )}

                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-0.5 text-primary hover:text-primary/90 text-xs px-2"
                          >
                            <Link to={`/pacientes/${alert.patientId}`}>
                              Ficha <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Diálogo de Edição de Retorno do Dashboard */}
      <Dialog open={Boolean(editingAlert)} onOpenChange={(open) => !open && setEditingAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" /> Editar Retorno —{' '}
              {editingAlert?.patientName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="dash-edit-return-date">Data do Retorno</Label>
              <Input
                id="dash-edit-return-date"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Ajuste a data prevista ou realizada para o retorno.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dash-edit-return-notes">Histórico / Descrição *</Label>
              <Textarea
                id="dash-edit-return-notes"
                required
                placeholder="Descrição do motivo ou procedimento do retorno..."
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingAlert(null)}
                disabled={editSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Salvando...' : 'Salvar Retorno'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
