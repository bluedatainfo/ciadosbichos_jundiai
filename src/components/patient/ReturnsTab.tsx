import { useState, useEffect } from 'react'
import { Patient, Vaccine } from '@/lib/types'
import { api } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Calendar,
  Clock,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
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
import { format, parseISO, differenceInCalendarDays, startOfDay } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/pocketbase/errors'

export type ReturnItemSituation = 'overdue' | 'due_soon' | 'completed' | 'normal'

export function ReturnsTab({ patient }: { patient: Patient }) {
  const [returnsList, setReturnsList] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ date: '', notes: '' })

  // Estado para Edição do Retorno
  const [editingItem, setEditingItem] = useState<Vaccine | null>(null)
  const [editFormData, setEditFormData] = useState({ date: '', notes: '' })
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Acompanha qual ID acabou de ser salvo para destacar o botão "Marcar como realizado"
  const [justSavedId, setJustSavedId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const { toast } = useToast()

  const loadReturns = async () => {
    try {
      // Carrega os retornos (gravados na collection 'vaccines', que armazena os pares VAC1-5 + VTX1-5 do legado e novos)
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

  // Determina a situação de um registro de retorno
  const getReturnSituation = (
    item: Vaccine,
  ): {
    situation: ReturnItemSituation
    isHighlighted: boolean
    label: string
    diffDays?: number
  } => {
    if (item.completed) {
      return { situation: 'completed', isHighlighted: false, label: 'Realizado' }
    }

    if (!item.date) {
      return { situation: 'normal', isHighlighted: false, label: 'Pendente' }
    }

    try {
      const parsed = parseISO(item.date)
      if (isNaN(parsed.getTime())) {
        return { situation: 'normal', isHighlighted: false, label: 'Pendente' }
      }

      const today = startOfDay(new Date())
      const diff = differenceInCalendarDays(parsed, today)

      if (diff < 0) {
        return {
          situation: 'overdue',
          isHighlighted: true,
          label: 'Vencido',
          diffDays: diff,
        }
      } else if (diff <= 30) {
        return {
          situation: 'due_soon',
          isHighlighted: true,
          label: 'Retorno Próximo',
          diffDays: diff,
        }
      }

      return { situation: 'normal', isHighlighted: false, label: 'Agendado', diffDays: diff }
    } catch {
      return { situation: 'normal', isHighlighted: false, label: 'Pendente' }
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        patient_id: patient.id,
        name: formData.notes.trim() || 'Retorno',
        date: formData.date ? new Date(formData.date + 'T12:00:00.000Z').toISOString() : '',
        notes: '',
        completed: false,
      }

      const created = await api.createVaccine(payload)

      setIsDialogOpen(false)
      setFormData({ date: '', notes: '' })
      // Se foi cadastrado sem data ou com data pendente, oferece o botão rápido de marcar como realizado
      setJustSavedId(created.id)
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

  const handleOpenEdit = (item: Vaccine) => {
    setEditingItem(item)
    let initialDate = ''
    if (item.date) {
      try {
        const d = parseISO(item.date)
        if (!isNaN(d.getTime())) {
          initialDate = format(d, 'yyyy-MM-dd')
        }
      } catch {
        initialDate = ''
      }
    }
    setEditFormData({
      date: initialDate,
      notes: item.name || item.notes || '',
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem) return
    setEditSubmitting(true)
    try {
      const payload: Partial<Vaccine> = {
        name: editFormData.notes.trim() || 'Retorno',
        date: editFormData.date ? new Date(editFormData.date + 'T12:00:00.000Z').toISOString() : '',
      }

      await api.updateVaccine(editingItem.id, payload)

      const savedId = editingItem.id
      setEditingItem(null)
      // Exibir o botão "Marcar como realizado" no registro após salvar
      setJustSavedId(savedId)

      toast({
        title: 'Retorno atualizado',
        description:
          'Data e descrição ajustadas com sucesso. Agora você pode marcá-lo como realizado.',
      })
      await loadReturns()
    } catch (error) {
      toast({
        title: 'Erro ao atualizar retorno',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleToggleCompleted = async (item: Vaccine, markAs: boolean) => {
    setMarkingId(item.id)
    try {
      await api.updateVaccine(item.id, { completed: markAs })
      // Se acabou de marcar como realizado, remove o estado justSavedId
      if (justSavedId === item.id) {
        setJustSavedId(null)
      }
      toast({
        title: markAs ? 'Retorno Concluído' : 'Retorno Reaberto',
        description: markAs
          ? 'O retorno foi marcado como realizado e removido dos alertas de vencimento.'
          : 'O retorno foi reaberto como pendente.',
      })
      await loadReturns()
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setMarkingId(null)
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
            retornos lançados com controle de realização.
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
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="return-date">Data do Retorno</Label>
                <Input
                  id="return-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Data prevista ou agendada para o retorno do animal.
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
              <TableHead className="w-[170px] font-semibold text-slate-700">
                Situação / Status
              </TableHead>
              <TableHead className="font-semibold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> Histórico / Descrição
                </span>
              </TableHead>
              <TableHead className="text-right font-semibold text-slate-700 min-w-[210px]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  Carregando retornos...
                </TableCell>
              </TableRow>
            ) : returnsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
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
                const sit = getReturnSituation(retorno)
                const isOverdue = sit.situation === 'overdue'
                const isDueSoon = sit.situation === 'due_soon'
                const isCompleted = sit.situation === 'completed'
                const isHighlighted = sit.isHighlighted
                const wasJustSaved = justSavedId === retorno.id
                const isProcessing = markingId === retorno.id

                return (
                  <TableRow
                    key={retorno.id}
                    className={`transition-colors ${
                      isHighlighted
                        ? 'bg-yellow-100/80 hover:bg-yellow-200/80 border-l-4 border-l-amber-500 shadow-sm'
                        : isCompleted
                          ? 'hover:bg-slate-50/70 opacity-90'
                          : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <TableCell className="font-medium align-middle py-3 text-slate-900 whitespace-nowrap">
                      {hasDate ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            isHighlighted
                              ? 'bg-amber-200/90 text-amber-950 font-bold border border-amber-400'
                              : isCompleted
                                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {dateDisplay}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Sem data informada
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-middle py-3">
                      {isOverdue && (
                        <Badge
                          variant="destructive"
                          className="text-[11px] font-bold gap-1 bg-red-600 hover:bg-red-700 text-white shadow-xs"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Vencido ({Math.abs(sit.diffDays ?? 0)}d)
                        </Badge>
                      )}
                      {isDueSoon && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                        >
                          <Clock className="w-3 h-3" />
                          Retorno Próximo ({sit.diffDays}d)
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge
                          variant="secondary"
                          className="text-[11px] font-medium gap-1 bg-green-100 text-green-800 border border-green-200"
                        >
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Realizado
                        </Badge>
                      )}
                      {!isHighlighted && !isCompleted && (
                        <span className="text-xs text-slate-500 font-medium">Pendente</span>
                      )}
                    </TableCell>

                    <TableCell className="align-middle py-3 text-slate-800 text-sm">
                      {hasText ? (
                        <span
                          className={`break-words ${
                            isHighlighted
                              ? 'font-semibold text-slate-950'
                              : isCompleted
                                ? 'text-slate-600'
                                : 'font-medium'
                          }`}
                        >
                          {historyText}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem descrição</span>
                      )}
                    </TableCell>

                    <TableCell className="align-middle py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {/* Botão Editar: presente especialmente nos destacados ou em qualquer pendente */}
                        {(isHighlighted || !isCompleted) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(retorno)}
                            className={`h-8 gap-1.5 text-xs font-semibold ${
                              isHighlighted
                                ? 'bg-white/95 border-amber-400 text-amber-950 hover:bg-amber-100 hover:border-amber-500 shadow-xs'
                                : 'hover:bg-slate-100'
                            }`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Editar
                          </Button>
                        )}

                        {/* Botão "Marcar como realizado": exibido com destaque após salvar ou nos retornos destacados/pendentes */}
                        {!isCompleted ? (
                          <Button
                            size="sm"
                            disabled={isProcessing}
                            onClick={() => handleToggleCompleted(retorno, true)}
                            className={`h-8 gap-1.5 text-xs font-semibold shadow-xs transition-all ${
                              wasJustSaved
                                ? 'bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-400 ring-offset-1 animate-pulse'
                                : isHighlighted
                                  ? 'bg-green-600 hover:bg-green-700 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isProcessing ? 'Gravando...' : 'Marcar como realizado'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isProcessing}
                            onClick={() => handleToggleCompleted(retorno, false)}
                            title="Reabrir este retorno como pendente"
                            className="h-8 gap-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reabrir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Diálogo de Edição de Retorno */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" /> Editar Retorno
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-return-date">Data do Retorno</Label>
              <Input
                id="edit-return-date"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Ajuste a data prevista ou realizada para o retorno.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-return-notes">Histórico / Descrição *</Label>
              <Textarea
                id="edit-return-notes"
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
                onClick={() => setEditingItem(null)}
                disabled={editSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editSubmitting}>
                {editSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
