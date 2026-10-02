import { useState, useEffect } from 'react'
import { Patient, ClinicalRecord } from '@/lib/types'
import { api } from '@/services/api'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Activity, Paperclip, Trash2, UploadCloud, Edit2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
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
import { useToast } from '@/hooks/use-toast'
import { auditService } from '@/services/audit'

export function ClinicalHistoryTab({ patient }: { patient: Patient }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAttendant = user?.role === 'attendant'
  const [records, setRecords] = useState<ClinicalRecord[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ description: '', diagnosis: '', treatment: '' })
  const [files, setFiles] = useState<File[]>([])

  // Estado de Edição de Registro
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null)
  const [editFormData, setEditFormData] = useState({
    date: '',
    description: '',
    diagnosis: '',
    treatment: '',
  })
  const [editLoading, setEditLoading] = useState(false)

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
      const createdRecord = await api.createClinicalRecord({
        patient_id: patient.id,
        ...formData,
        files,
      })

      // Auditoria: Lançamento de nova evolução / prescrição
      auditService.log({
        action: 'create',
        module: 'clinical_records',
        recordId: createdRecord?.id || '',
        recordLabel: `Evolução clínica de ${patient.name}`,
        patientName: patient.name,
        tutorName: patient.expand?.tutor_id?.name || '',
        changes: {
          description: {
            label: 'Queixa / Evolução',
            oldValue: null,
            newValue: formData.description,
          },
          diagnosis: {
            label: 'Diagnóstico',
            oldValue: null,
            newValue: formData.diagnosis || 'Não informado',
          },
          treatment: {
            label: 'Tratamento Prescrito',
            oldValue: null,
            newValue: formData.treatment || 'Não informado',
          },
        },
        details: `Nova evolução clínica registrada para ${patient.name}. Prescrição: ${formData.treatment || 'Sem prescrição informada'}`,
      })

      setIsDialogOpen(false)
      setFormData({ description: '', diagnosis: '', treatment: '' })
      setFiles([])
      toast({
        title: 'Registro clínico salvo',
        description: 'A nova evolução foi registrada com sucesso.',
      })
      await loadRecords()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar registro',
        description: err.message || 'Falha ao registrar evolução clínica.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEdit = (record: ClinicalRecord) => {
    setEditingRecord(record)
    // Converte a data salva no record para o formato datetime-local ou date (YYYY-MM-DDTHH:mm)
    let formattedDate = ''
    try {
      const d = new Date(record.created)
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0')
        const yyyy = d.getFullYear()
        const mm = pad(d.getMonth() + 1)
        const dd = pad(d.getDate())
        const hh = pad(d.getHours())
        const min = pad(d.getMinutes())
        formattedDate = `${yyyy}-${mm}-${dd}T${hh}:${min}`
      }
    } catch {
      formattedDate = ''
    }

    setEditFormData({
      date: formattedDate,
      description: record.description || '',
      diagnosis: record.diagnosis || '',
      treatment: record.treatment || '',
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRecord) return
    setEditLoading(true)
    try {
      const payload: Record<string, any> = {
        description: editFormData.description,
        diagnosis: editFormData.diagnosis,
        treatment: editFormData.treatment,
      }
      if (editFormData.date) {
        payload.created = new Date(editFormData.date).toISOString()
      }

      const diff = auditService.computeDiff(editingRecord, payload)

      await api.updateClinicalRecord(editingRecord.id, payload)

      // Auditoria: Edição de evolução clínica / prescrição
      auditService.log({
        action: 'update',
        module: 'clinical_records',
        recordId: editingRecord.id,
        recordLabel: `Evolução clínica de ${patient.name}`,
        patientName: patient.name,
        tutorName: patient.expand?.tutor_id?.name || '',
        changes: diff,
        details: `Alteração de evolução clínica / prescrição de ${patient.name}. Nova prescrição: ${payload.treatment || '-'}`,
      })

      setIsEditDialogOpen(false)
      setEditingRecord(null)
      toast({
        title: 'Evolução clínica atualizada',
        description: 'O registro foi editado com sucesso na mesma fonte de dados.',
      })
      await loadRecords()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar registro',
        description: err.message || 'Falha ao gravar alterações do registro clínico.',
        variant: 'destructive',
      })
    } finally {
      setEditLoading(false)
    }
  }

  const handleAddAttachment = async (recordId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setLoading(true)
    try {
      const form = new FormData()
      Array.from(fileList).forEach((f) => form.append('files+', f))
      await pb.collection('clinical_records').update(recordId, form)
      toast({ title: 'Arquivos anexados com sucesso' })
      loadRecords()
    } catch (err: any) {
      toast({ title: 'Erro ao anexar', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAttachment = async (recordId: string, filename: string) => {
    if (!confirm('Deseja excluir este anexo?')) return
    setLoading(true)
    try {
      await pb.collection('clinical_records').update(recordId, { 'files-': [filename] })
      toast({ title: 'Anexo excluído' })
      loadRecords()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-end">
        {!isAttendant && (
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
                <div className="space-y-2">
                  <Label>Anexos (Exames, Laudos)</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Registro'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
                <div className="font-semibold text-primary flex items-center gap-2">
                  <span>{new Date(record.created).toLocaleDateString('pt-BR')}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    às{' '}
                    {new Date(record.created).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {!isAttendant && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(record)}
                    className="h-8 gap-1.5 text-xs border-primary/20 hover:bg-primary hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </Button>
                )}
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
                {((record.files && record.files.length > 0) || !isAttendant) && (
                  <div className="space-y-2 mt-4 col-span-full border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                        Anexos
                      </h4>
                      {!isAttendant && (
                        <div className="relative">
                          <Input
                            type="file"
                            multiple
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => {
                              handleAddAttachment(record.id, e.target.files)
                              e.target.value = ''
                            }}
                            disabled={loading}
                          />
                          <Button size="sm" variant="outline" className="gap-2 h-8">
                            <UploadCloud className="w-3.5 h-3.5" /> Adicionar
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {record.files?.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-md border border-primary/10"
                        >
                          <a
                            href={pb.files.getURL(record, file)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                          >
                            <Paperclip className="w-4 h-4" />{' '}
                            {file.length > 20 ? file.substring(0, 20) + '...' : file}
                          </a>
                          {!isAttendant && (
                            <button
                              onClick={() => handleDeleteAttachment(record.id, file)}
                              className="text-red-500 hover:text-red-700 ml-1 p-1"
                              disabled={loading}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de Edição de Registro Clínico */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-primary" /> Editar Registro Clínico
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateRecord} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-record-date">Data e Hora do Atendimento</Label>
              <Input
                id="edit-record-date"
                type="datetime-local"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Permite corrigir a data e horário original do atendimento clínico.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-record-description">Queixa / Evolução / Sintomas *</Label>
              <Textarea
                id="edit-record-description"
                required
                rows={5}
                placeholder="Descreva as anotações clínicas, sintomas observados e histórico..."
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-record-diagnosis">Diagnóstico</Label>
              <Input
                id="edit-record-diagnosis"
                placeholder="Diagnóstico clínico presuntivo ou definitivo"
                value={editFormData.diagnosis}
                onChange={(e) => setEditFormData({ ...editFormData, diagnosis: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-record-treatment">Tratamento Prescrito / Orientações</Label>
              <Textarea
                id="edit-record-treatment"
                rows={3}
                placeholder="Medicações receitadas, dosagens, procedimentos realizados..."
                value={editFormData.treatment}
                onChange={(e) => setEditFormData({ ...editFormData, treatment: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={editLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editLoading} className="gap-1.5 bg-primary">
                <CheckCircle2 className="w-4 h-4" />
                {editLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
