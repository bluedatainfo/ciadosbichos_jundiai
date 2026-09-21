import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { Appointment } from '@/lib/types'
import { useRealtime } from '@/hooks/use-realtime'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageCircle,
  CalendarIcon,
  Printer,
  FileText,
  Globe,
  ExternalLink,
  Eye,
  User,
  PawPrint,
  Phone,
  Tag,
  Database,
  FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const openWhatsApp = (phone: string) => {
  const cleanPhone = phone?.replace(/\D/g, '') || ''
  if (cleanPhone) {
    const number = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    window.open(`https://wa.me/${number}`, '_blank')
  }
}

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const openDetails = (app: Appointment) => {
    setSelectedAppointment(app)
    setIsDetailsOpen(true)
  }

  const loadData = async () => {
    const data = await api.getAppointments({ status: statusFilter, startDate, endDate })
    setAppointments(data)
  }

  useEffect(() => {
    loadData()
  }, [statusFilter, startDate, endDate])
  useRealtime('appointments', () => loadData())

  const handleComplete = async (id: string) => {
    await api.updateAppointment(id, { status: 'completed' })
    loadData()
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      return: 'Retorno',
      vaccine: 'Vacina',
      surgery: 'Cirurgia',
      consultation: 'Consulta',
    }
    return labels[type] || type
  }

  const isAlert = (app: Appointment) => {
    if (app.type !== 'return' || app.status !== 'scheduled') return false
    const diff = new Date(app.date).getTime() - new Date().getTime()
    return diff > 0 && diff <= 48 * 60 * 60 * 1000
  }

  const getSourceInfo = (app: Appointment) => {
    const isLegacy = app.notes?.includes('[Migração Access]')
    if (isLegacy) {
      return {
        label: 'Migração Access',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Database,
      }
    }
    if (app.source === 'public') {
      return {
        label: 'Online (Tutor)',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Globe,
      }
    }
    return {
      label: 'Manual (Interno)',
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: FileSpreadsheet,
    }
  }

  const getStatusBadge = (status: Appointment['status']) => {
    const isScheduled = status === 'scheduled'
    const isCompleted = status === 'completed'
    return (
      <Badge
        variant={isScheduled ? 'default' : isCompleted ? 'secondary' : 'destructive'}
        className={cn(
          isScheduled
            ? 'bg-amber-100 text-amber-800'
            : isCompleted
              ? 'bg-green-100 text-green-800'
              : '',
          'print:bg-transparent print:border print:border-slate-300 print:text-black',
        )}
      >
        {isScheduled ? 'Agendado' : isCompleted ? 'Concluído' : 'Cancelado'}
      </Badge>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Agenda de Atendimentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie retornos, vacinas e consultas agendadas (internas e online).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
            <a href="/agendamento" target="_blank" rel="noreferrer">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Página de Agendamento
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <FileText className="w-4 h-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm print:shadow-none bg-transparent sm:bg-white print:bg-white">
        <CardHeader className="print:hidden pb-4 px-0 sm:px-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Data Inicial</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal bg-white',
                        !startDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Data Final</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal bg-white',
                        !endDate && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="scheduled">Agendados</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-slate-900 w-full md:w-auto"
                onClick={() => {
                  setStartDate(undefined)
                  setEndDate(undefined)
                  setStatusFilter('all')
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 print:p-0">
          <div className="hidden print:block mb-6 pb-4 border-b border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900">Relatório de Agenda</h2>
            <p className="text-sm text-slate-600 mt-1">
              Período: {startDate ? format(startDate, 'dd/MM/yyyy') : 'Qualquer data'} até{' '}
              {endDate ? format(endDate, 'dd/MM/yyyy') : 'Qualquer data'}
            </p>
            {statusFilter !== 'all' && (
              <p className="text-sm text-slate-600">
                Status:{' '}
                {statusFilter === 'scheduled'
                  ? 'Agendados'
                  : statusFilter === 'completed'
                    ? 'Concluídos'
                    : 'Cancelados'}
              </p>
            )}
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[350px] rounded-lg border print:border-none print:overflow-visible print:max-h-none">
            <Table className="min-w-[850px]">
              <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm print:static">
                <TableRow className="bg-slate-50/95 print:bg-transparent">
                  <TableHead className="min-w-[170px]">Data</TableHead>
                  <TableHead className="min-w-[140px]">Paciente</TableHead>
                  <TableHead className="min-w-[180px]">Tutor (Contato)</TableHead>
                  <TableHead className="min-w-[110px]">Tipo</TableHead>
                  <TableHead className="min-w-[220px]">Notas</TableHead>
                  <TableHead className="min-w-[120px]">Status</TableHead>
                  <TableHead className="text-right min-w-[110px] print:hidden">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nenhum agendamento encontrado para este período.
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments.map((app) => (
                    <TableRow
                      key={app.id}
                      onClick={() => openDetails(app)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-slate-50/80',
                        isAlert(app) ? 'bg-red-50/40 hover:bg-red-50 print:bg-transparent' : '',
                      )}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground print:hidden" />
                          <span>
                            {app.date ? format(new Date(app.date), 'dd/MM/yyyy HH:mm') : '-'}
                          </span>
                          {app.notes?.includes('[Migração Access]') ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 print:hidden gap-1 font-medium"
                              title="Importado do legado Access"
                            >
                              <Database className="w-2.5 h-2.5 text-amber-600" />
                              Legado
                            </Badge>
                          ) : (
                            app.source === 'public' && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0 print:hidden gap-1 font-medium"
                                title="Agendado online pelo tutor"
                              >
                                <Globe className="w-2.5 h-2.5 text-blue-600" />
                                Online
                              </Badge>
                            )
                          )}
                          {isAlert(app) && (
                            <span title="Retorno em menos de 48h!">
                              <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse ml-1 print:hidden" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900 print:text-black">
                        {app.expand?.patient_id?.name || 'Desconhecido'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="print:text-black">
                            {app.expand?.patient_id?.expand?.tutor_id?.name || 'Não informado'}
                            {app.expand?.patient_id?.expand?.tutor_id?.phone && (
                              <span className="text-muted-foreground ml-1 text-xs print:text-black">
                                ({app.expand?.patient_id?.expand?.tutor_id?.phone})
                              </span>
                            )}
                          </div>
                          {app.expand?.patient_id?.expand?.tutor_id?.phone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openWhatsApp(app.expand?.patient_id?.expand?.tutor_id?.phone!)
                              }}
                              className="text-green-600 hover:text-green-700 p-1 print:hidden"
                              title="Contatar via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'bg-white print:border-none print:p-0 print:text-black',
                            isAlert(app) &&
                              'border-red-200 text-red-700 bg-red-50 print:bg-transparent',
                          )}
                        >
                          {getTypeLabel(app.type)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[200px] truncate print:whitespace-normal print:max-w-none print:text-black"
                        title={app.notes}
                      >
                        {app.notes || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell className="text-right print:hidden whitespace-nowrap">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-slate-700 hover:text-slate-900"
                            onClick={() => openDetails(app)}
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            Ver detalhes
                          </Button>
                          {app.status === 'scheduled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handleComplete(app.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1.5" />
                              Concluir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de detalhes completos do agendamento */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              Detalhes do Agendamento
            </DialogTitle>
            <DialogDescription>
              Informações completas do agendamento e dados vinculados.
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-2">
              {/* Informações Principais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg border bg-slate-50/60 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Data e Hora
                  </span>
                  <p className="font-medium text-slate-900">
                    {selectedAppointment.date
                      ? format(new Date(selectedAppointment.date), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })
                      : 'Não informada'}
                  </p>
                </div>

                <div className="p-3 rounded-lg border bg-slate-50/60 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    Tipo de Atendimento
                  </span>
                  <div>
                    <Badge variant="outline" className="bg-white">
                      {getTypeLabel(selectedAppointment.type)}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-slate-50/60 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </span>
                  <div>{getStatusBadge(selectedAppointment.status)}</div>
                </div>

                <div className="p-3 rounded-lg border bg-slate-50/60 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Origem
                  </span>
                  <div>
                    {(() => {
                      const sourceInfo = getSourceInfo(selectedAppointment)
                      const Icon = sourceInfo.icon
                      return (
                        <Badge
                          variant="outline"
                          className={cn('gap-1 font-medium', sourceInfo.badgeClass)}
                        >
                          <Icon className="w-3 h-3" />
                          {sourceInfo.label}
                        </Badge>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Paciente e Tutor */}
              <div className="p-4 rounded-lg border bg-slate-50/60 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <PawPrint className="w-3.5 h-3.5 text-primary" />
                      Paciente
                    </span>
                    <p className="font-semibold text-base text-slate-900">
                      {selectedAppointment.expand?.patient_id?.name || 'Desconhecido'}
                    </p>
                    {(selectedAppointment.expand?.patient_id?.species ||
                      selectedAppointment.expand?.patient_id?.breed) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          selectedAppointment.expand?.patient_id?.species,
                          selectedAppointment.expand?.patient_id?.breed,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t pt-2.5 space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    Tutor e Contato
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        {selectedAppointment.expand?.patient_id?.expand?.tutor_id?.name ||
                          'Tutor não informado'}
                      </p>
                      {selectedAppointment.expand?.patient_id?.expand?.tutor_id?.phone ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {selectedAppointment.expand?.patient_id?.expand?.tutor_id?.phone}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Sem telefone</p>
                      )}
                    </div>
                    {selectedAppointment.expand?.patient_id?.expand?.tutor_id?.phone && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50 gap-1.5"
                        onClick={() =>
                          openWhatsApp(
                            selectedAppointment.expand?.patient_id?.expand?.tutor_id?.phone!,
                          )
                        }
                      >
                        <MessageCircle className="w-4 h-4" />
                        Conversar no WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Notas Completas (sem truncar) */}
              <div className="p-4 rounded-lg border bg-white space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Notas e Observações Completas
                </span>
                <div className="p-3 bg-slate-50 rounded-md border text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed max-h-60 overflow-y-auto">
                  {selectedAppointment.notes?.trim() ? (
                    selectedAppointment.notes
                  ) : (
                    <span className="text-muted-foreground italic">
                      Nenhuma observação cadastrada para este agendamento.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between items-stretch sm:items-center">
            {selectedAppointment?.status === 'scheduled' ? (
              <Button
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50 gap-1.5 w-full sm:w-auto"
                onClick={async () => {
                  if (selectedAppointment) {
                    await handleComplete(selectedAppointment.id)
                    setSelectedAppointment({
                      ...selectedAppointment,
                      status: 'completed',
                    })
                  }
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Concluir Agendamento
              </Button>
            ) : (
              <div />
            )}
            <Button
              variant="outline"
              onClick={() => setIsDetailsOpen(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
