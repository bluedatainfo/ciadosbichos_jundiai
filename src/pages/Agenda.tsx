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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadData = async () => {
    const data = await api.getAppointments(statusFilter)
    setAppointments(data)
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda de Retornos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie retornos, vacinas e consultas agendadas.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white border-slate-200">
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

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Tutor (Contato)</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nenhum agendamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments.map((app) => (
                    <TableRow
                      key={app.id}
                      className={cn(
                        'transition-colors',
                        isAlert(app) ? 'bg-red-50/40 hover:bg-red-50' : '',
                      )}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {app.date ? format(new Date(app.date), 'dd/MM/yyyy HH:mm') : '-'}
                          {isAlert(app) && (
                            <AlertTriangle
                              className="w-4 h-4 text-red-500 animate-pulse ml-1"
                              title="Retorno em menos de 48h!"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {app.expand?.patient_id?.name || 'Desconhecido'}
                      </TableCell>
                      <TableCell>
                        {app.expand?.patient_id?.expand?.tutor_id?.name} (
                        {app.expand?.patient_id?.expand?.tutor_id?.phone})
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'bg-white',
                            isAlert(app) && 'border-red-200 text-red-700 bg-red-50',
                          )}
                        >
                          {getTypeLabel(app.type)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[200px] truncate"
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
