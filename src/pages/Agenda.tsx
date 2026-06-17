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
import { format } from 'date-fns'
import { CheckCircle, Clock } from 'lucide-react'

export default function Agenda() {
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const loadData = async () => {
    const data = await api.getAppointments()
    setAppointments(data)
  }

  useEffect(() => {
    loadData()
  }, [])
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda de Retornos</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie retornos, vacinas e consultas agendadas.
        </p>
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
                    <TableRow key={app.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {app.date ? format(new Date(app.date), 'dd/MM/yyyy HH:mm') : '-'}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {app.expand?.patient_id?.name || 'Desconhecido'}
                      </TableCell>
                      <TableCell>
                        {app.expand?.patient_id?.expand?.tutor_id?.name} (
                        {app.expand?.patient_id?.expand?.tutor_id?.phone})
                      </TableCell>
                      <TableCell>{getTypeLabel(app.type)}</TableCell>
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
