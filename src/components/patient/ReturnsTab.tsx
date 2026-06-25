import { useState, useEffect } from 'react'
import { Patient, Appointment } from '@/lib/types'
import { api } from '@/services/api'
import { useRealtime } from '@/hooks/use-realtime'
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
import { Plus, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export function ReturnsTab({ patient }: { patient: Patient }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ date: '', time: '10:00', type: 'return', notes: '' })
  const { toast } = useToast()

  const loadApps = async () => {
    setAppointments(await api.getPatientAppointments(patient.id))
  }

  useEffect(() => {
    loadApps()
  }, [patient.id])
  useRealtime('appointments', () => loadApps())

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}:00`).toISOString()
      await api.createAppointment({
        patient_id: patient.id,
        status: 'scheduled',
        date: dateTime,
        type: formData.type as any,
        notes: formData.notes,
      })
      setIsDialogOpen(false)
      setFormData({ date: '', time: '10:00', type: 'return', notes: '' })
      toast({
        title: 'Agendamento criado',
        description: 'O agendamento foi salvo com sucesso.',
      })
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await api.updateAppointment(id, { status: 'completed' })
      toast({
        title: 'Concluído',
        description: 'O status do agendamento foi atualizado.',
      })
      loadApps()
    } catch (error) {
      toast({
        title: 'Erro',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    }
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
    <Card className="border-none shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 pb-4">
        <CardTitle className="text-lg text-slate-800">Agenda de Retornos e Vacinas</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Retorno / Consulta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consulta</SelectItem>
                    <SelectItem value="return">Retorno</SelectItem>
                    <SelectItem value="vaccine">Vacina</SelectItem>
                    <SelectItem value="surgery">Cirurgia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Notas..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white">
              <TableHead className="w-[150px]">Data Prevista</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[120px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhum agendamento futuro.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell className="font-medium">
                    {ret.date ? format(new Date(ret.date), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    {getTypeLabel(ret.type)}
                  </TableCell>
                  <TableCell
                    className="text-sm text-slate-500 max-w-[200px] truncate"
                    title={ret.notes}
                  >
                    {ret.notes || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ret.status === 'scheduled'
                          ? 'default'
                          : ret.status === 'completed'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className={
                        ret.status === 'scheduled'
                          ? 'bg-amber-100 text-amber-800'
                          : ret.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : ''
                      }
                    >
                      {ret.status === 'scheduled'
                        ? 'Agendado'
                        : ret.status === 'completed'
                          ? 'Concluído'
                          : 'Cancelado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {ret.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleComplete(ret.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Concluir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
