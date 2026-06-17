import { useState, useEffect } from 'react'
import { Patient, ClinicalRecord } from '@/lib/types'
import { api } from '@/services/api'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Activity } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function ClinicalHistoryTab({ patient }: { patient: Patient }) {
  const [records, setRecords] = useState<ClinicalRecord[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ description: '', diagnosis: '', treatment: '' })

  const loadRecords = async () => {
    setRecords(await api.getClinicalRecords(patient.id))
  }

  useEffect(() => {
    loadRecords()
  }, [patient.id])
  useRealtime('clinical_records', () => loadRecords())

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.createClinicalRecord({ patient_id: patient.id, ...formData })
      setIsDialogOpen(false)
      setFormData({ description: '', diagnosis: '', treatment: '' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Nova Evolução Clínica
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Evolução</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Sintomas / Queixa</Label>
                <Textarea
                  required
                  placeholder="Descreva as observações"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Diagnóstico</Label>
                <Input
                  placeholder="Diagnóstico"
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tratamento Prescrito</Label>
                <Textarea
                  placeholder="Medicações, procedimentos..."
                  value={formData.treatment}
                  onChange={(e) => setFormData({ ...formData, treatment: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Registro'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
            Nenhum registro clínico encontrado para este paciente.
          </div>
        ) : (
          records.map((record) => (
            <Card key={record.id} className="border-none shadow-sm overflow-hidden">
              <div className="bg-primary/5 px-6 py-3 border-b flex items-center justify-between">
                <div className="font-semibold text-primary">
                  {new Date(record.created).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <CardContent className="p-6 grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Queixa / Evolução
                  </h4>
                  <p className="text-slate-800 whitespace-pre-wrap">{record.description}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Diagnóstico
                  </h4>
                  <p className="text-slate-800 font-medium">{record.diagnosis || '-'}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Tratamento Prescrito
                  </h4>
                  <p className="text-slate-800 whitespace-pre-wrap">{record.treatment || '-'}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
