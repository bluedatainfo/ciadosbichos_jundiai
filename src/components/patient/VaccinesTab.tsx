import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { Vaccine } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Syringe, Plus, Calendar, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

export function VaccinesTab({ patientId }: { patientId: string }) {
  const { toast } = useToast()
  const [vaccines, setVaccines] = useState<Vaccine[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    notes: '',
  })

  const loadVaccines = async () => {
    try {
      const data = await api.getVaccines(patientId)
      setVaccines(data)
    } catch (err) {
      console.warn('Erro ao carregar vacinas:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVaccines()
  }, [patientId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.createVaccine({
        patient_id: patientId,
        name: formData.name,
        date: formData.date ? new Date(formData.date).toISOString() : '',
        notes: formData.notes,
      })
      toast({ title: 'Sucesso', description: 'Vacina registrada com sucesso.' })
      setIsDialogOpen(false)
      setFormData({ name: '', date: '', notes: '' })
      loadVaccines()
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Falha ao salvar vacina.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando vacinas...</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Syringe className="w-5 h-5 text-primary" /> Histórico de Vacinação
          </h3>
          <p className="text-xs text-muted-foreground">
            Acompanhe as doses aplicadas e registros migrados do sistema legado.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Registrar Vacina
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Nova Vacina</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Nome da Vacina / Protocolo *</Label>
                <Input
                  required
                  placeholder="Ex: V10, Antirrábica, Giardia..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data da Aplicação</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Observações / Lote / Fabricante</Label>
                <Input
                  placeholder="Observações adicionais..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Vacina'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {vaccines.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Syringe className="w-10 h-10 text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">
              Nenhuma vacina registrada para este paciente.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              As vacinas aplicadas ou migradas de VAC1 a VAC5 aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vaccines.map((v) => (
            <Card
              key={v.id}
              className="border shadow-none hover:border-slate-300 transition-colors"
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-slate-900">{v.name}</h4>
                  <span className="p-1.5 rounded-md bg-purple-50 text-purple-600">
                    <Syringe className="w-4 h-4" />
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {v.date ? format(new Date(v.date), 'dd/MM/yyyy') : 'Data não informada'}
                  </span>
                </div>

                {v.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{v.notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
