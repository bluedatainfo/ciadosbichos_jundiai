import { useState, useEffect } from 'react'
import { Patient, Vaccine } from '@/lib/types'
import { api } from '@/services/api'
import pb from '@/lib/pocketbase/client'
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
import { Plus, Calendar, Clock, RefreshCw } from 'lucide-react'
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
import { format, parseISO } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export function ReturnsTab({ patient }: { patient: Patient }) {
  const [returnsList, setReturnsList] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ date: '', notes: '' })
  const { toast } = useToast()

  const loadReturns = async () => {
    try {
      // Carrega os retornos (gravados na collection 'vaccines', que armazena os pares VAC1-5 + VTX1-5 do legado)
      const records = await pb.collection('vaccines').getFullList<Vaccine>({
        filter: `patient_id = "${patient.id}"`,
      })

      // Ordenar por data cronológica (mais recentes primeiro ou sem data ao final)
      const sorted = [...records].sort((a, b) => {
        if (!a.date && !b.date) {
          return new Date(b.created).getTime() - new Date(a.created).getTime()
        }
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })

      setReturnsList(sorted)
    } catch (error) {
      console.error('Erro ao carregar retornos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReturns()
  }, [patient.id])

  useRealtime('vaccines', () => loadReturns())

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        patient_id: patient.id,
        name: formData.notes.trim() || 'Retorno',
        date: formData.date ? new Date(formData.date + 'T12:00:00.000Z').toISOString() : '',
        notes: '',
      }

      await api.createVaccine(payload)

      setIsDialogOpen(false)
      setFormData({ date: '', notes: '' })
      toast({
        title: 'Retorno incluído',
        description: 'O retorno foi registrado com sucesso.',
      })
      await loadReturns()
    } catch (error) {
      toast({
        title: 'Erro ao salvar retorno',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    try {
      const parsed = parseISO(dateStr)
      if (isNaN(parsed.getTime())) return dateStr
      return format(parsed, 'dd/MM/yyyy')
    } catch {
      return dateStr
    }
  }

  const getHistoricalText = (item: Vaccine) => {
    // Caso tenha texto no campo name ou notes, prioriza o texto existente
    const text = item.name || item.notes || ''
    return text.trim() || '-'
  }

  return (
    <Card className="border-none shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 pb-4">
        <div>
          <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> Retornos do Paciente
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Histórico completo de retornos importados da base legado (VAC1-5 / VTX1-5) e novos
            retornos lançados.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Incluir retorno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Incluir Retorno</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="return-date">Data do Retorno</Label>
                <Input
                  id="return-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Data prevista ou realizada para o retorno.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-notes">Histórico / Descrição *</Label>
                <Textarea
                  id="return-notes"
                  required
                  placeholder="Ex: Retorno para avaliação de sutura, reavaliação pós-cirúrgica, reforço..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar Retorno'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white">
              <TableHead className="w-[180px] font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" /> Data
                </span>
              </TableHead>
              <TableHead className="font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> Histórico / Descrição
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={2} className="h-32 text-center text-muted-foreground">
                  Carregando retornos...
                </TableCell>
              </TableRow>
            ) : returnsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <p className="font-medium">Nenhum retorno cadastrado para este paciente.</p>
                    <p className="text-xs text-slate-400">
                      Clique em &quot;Incluir retorno&quot; para registrar um novo retorno.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              returnsList.map((retorno) => {
                const historyText = getHistoricalText(retorno)
                const dateDisplay = formatDisplayDate(retorno.date)
                const hasDate = Boolean(retorno.date)
                const hasText = historyText !== '-'

                return (
                  <TableRow key={retorno.id} className="hover:bg-slate-50/70">
                    <TableCell className="font-medium align-top py-3 text-slate-900 whitespace-nowrap">
                      {hasDate ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {dateDisplay}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Sem data informada
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top py-3 text-slate-800 text-sm">
                      {hasText ? (
                        <span className="break-words font-medium">{historyText}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem descrição</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
