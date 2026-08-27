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

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda de Retornos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie retornos, vacinas e consultas agendadas.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

          <div className="overflow-x-auto rounded-lg border print:border-none print:overflow-visible">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 print:bg-transparent">
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tutor (Contato)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right print:hidden">Ações</TableHead>
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
                      className={cn(
                        'transition-colors',
                        isAlert(app) ? 'bg-red-50/40 hover:bg-red-50 print:bg-transparent' : '',
                      )}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground print:hidden" />
                          {app.date ? format(new Date(app.date), 'dd/MM/yyyy HH:mm') : '-'}
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
                            {app.expand?.patient_id?.expand?.tutor_id?.name}
                            <span className="text-muted-foreground ml-1 text-xs print:text-black">
                              ({app.expand?.patient_id?.expand?.tutor_id?.phone})
                            </span>
                          </div>
                          {app.expand?.patient_id?.expand?.tutor_id?.phone && (
                            <button
                              onClick={() =>
                                openWhatsApp(app.expand?.patient_id?.expand?.tutor_id?.phone!)
                              }
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
                      <TableCell>
                        <Badge
                          variant={
                            app.status === 'scheduled'
                              ? 'default'
                              : app.status === 'completed'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className={cn(
                            app.status === 'scheduled'
                              ? 'bg-amber-100 text-amber-800'
                              : app.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : '',
                            'print:bg-transparent print:border print:border-slate-300 print:text-black',
                          )}
                        >
                          {app.status === 'scheduled'
                            ? 'Agendado'
                            : app.status === 'completed'
                              ? 'Concluído'
                              : 'Cancelado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        {app.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleComplete(app.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Concluir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
