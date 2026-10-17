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
import { auditService, formatClinicalRecordAuditLabel } from '@/services/audit'

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

  /**
   * Extrai a data cronológica real de um registro clínico:
   * 1. Busca prefixo de data no início da descrição: [dd/mm/aaaa], [d/m/aaaa], [dd/mm/aa]
   *    Também tolera data no início sem colchetes seguida de pontuação (ex: 15/10/2026.P=...)
   * 2. Anos de 2 dígitos (26, 25...): >= 30 => 19xx; < 30 => 20xx (26 -> 2026, 25 -> 2025)
   * 3. Se não houver data no início do texto, usa record.created
   */
  /**
   * Extrai a data cronológica real de um registro clínico:
   * 1. Busca prefixo de data no início da descrição: [dd/mm/aaaa], [d/m/aaaa], [dd/mm/aa]
   *    Também tolera data no início sem colchetes seguida de pontuação (ex: 15/10/2026.P=...)
   * 2. Anos de 2 dígitos (26, 25...): >= 30 => 19xx; < 30 => 20xx (26 -> 2026, 25 -> 2025)
   * 3. Se não houver data no início do texto, usa record.created
   */
  const getRecordDateInfo = (
    record: ClinicalRecord,
  ): { timestamp: number; displayDate: string; displayTime?: string } => {
    const desc = (record.description || '').trim()
    const pad = (n: number) => n.toString().padStart(2, '0')

    // 1. Prefixo com colchetes: [11/7/2026], [02/10/26], [22/12/2025], etc.
    const bracketMatch = desc.match(/^\[\s*(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\s*\]/)
    if (bracketMatch) {
      const d = parseInt(bracketMatch[1], 10)
      const m = parseInt(bracketMatch[2], 10)
      let y = parseInt(bracketMatch[3], 10)
      if (y < 100) {
        y = y >= 30 ? 1900 + y : 2000 + y
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          timestamp: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getTime(),
          displayDate: `${pad(d)}/${pad(m)}/${y}`,
        }
      }
    }

    // 2. Prefixo sem colchetes no início (ex: "15/10/2026.P=31.6 KG..." ou "15/10/2026 - ...")
    const leadingMatch = desc.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:[.:\-\s]|$)/)
    if (leadingMatch) {
      const d = parseInt(leadingMatch[1], 10)
      const m = parseInt(leadingMatch[2], 10)
      let y = parseInt(leadingMatch[3], 10)
      if (y < 100) {
        y = y >= 30 ? 1900 + y : 2000 + y
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return {
          timestamp: new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getTime(),
          displayDate: `${pad(d)}/${pad(m)}/${y}`,
        }
      }
    }

    // 3. Fallback: data de gravação do registro (created)
    if (record.created) {
      const cd = new Date(record.created)
      const t = cd.getTime()
      if (!isNaN(t)) {
        return {
          timestamp: t,
          displayDate: cd.toLocaleDateString('pt-BR'),
          displayTime: cd.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }
      }
    }

    return { timestamp: 0, displayDate: '-' }
  }

  const getRecordTimestamp = (record: ClinicalRecord): number => {
    return getRecordDateInfo(record).timestamp
  }

  /**
   * Ordena registros do mais recente para o mais antigo:
   * Chave primária: timestamp extraído do prefixo ou created
   * Chave de desempate: created decrescente (ou id)
   */
  const sortRecordsDescending = (list: ClinicalRecord[]): ClinicalRecord[] => {
    return [...list].sort((a, b) => {
      const tA = getRecordTimestamp(a)
      const tB = getRecordTimestamp(b)
      if (tA !== tB) {
        return tB - tA // decrescente estrito
      }
      // Desempate por created
      const cA = a.created ? new Date(a.created).getTime() : 0
      const cB = b.created ? new Date(b.created).getTime() : 0
      if (cA !== cB) {
        return cB - cA
      }
      return (b.id || '').localeCompare(a.id || '')
    })
  }

  const loadRecords = async () => {
    const raw = await api.getClinicalRecords(patient.id)
    setRecords(sortRecordsDescending(raw))
  }

  useEffect(() => {
    loadRecords()
  }, [patient.id])
  useRealtime('clinical_records', () => loadRecords())

  const checkAlreadyRecorded = async (
    patientId: string,
    desc: string,
    diag: string,
    treat: string,
  ): Promise<ClinicalRecord | null> => {
    try {
      // Busca os últimos registros deste paciente criados recentemente (últimos 15 minutos)
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T', ' ')
      const candidates = await pb.collection('clinical_records').getList<ClinicalRecord>(1, 5, {
        filter: `patient_id = "${patientId}" && created >= "${fifteenMinsAgo}"`,
        sort: '-created',
      })

      const norm = (s: string | null | undefined) => (s || '').trim()
      const match = candidates.items.find(
        (r) =>
          norm(r.description) === norm(desc) &&
          norm(r.diagnosis) === norm(diag) &&
          norm(r.treatment) === norm(treat),
      )
      return match || null
    } catch (err) {
      console.warn('Erro ao verificar duplicidade de evolução clínica:', err)
      return null
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const submittedDesc = formData.description
    const submittedDiag = formData.diagnosis
    const submittedTreat = formData.treatment
    const submittedFiles = files

    let createdRecord: ClinicalRecord | null = null
    let saveSucceeded = false
    const maxRetries = 2

    // 1. Salvamento resiliente com retry e verificação anti-duplicação
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Antes de retentar (ou logo no início caso venha de falha anterior),
        // verificar se o registro com este mesmo conteúdo já foi persistido no banco
        if (attempt > 0) {
          const existing = await checkAlreadyRecorded(
            patient.id,
            submittedDesc,
            submittedDiag,
            submittedTreat,
          )
          if (existing) {
            console.log(
              'Registro já gravado previamente na base. Evitando duplicação:',
              existing.id,
            )
            createdRecord = existing
            saveSucceeded = true
            break
          }
        }

        createdRecord = (await api.createClinicalRecord({
          patient_id: patient.id,
          description: submittedDesc,
          diagnosis: submittedDiag,
          treatment: submittedTreat,
          files: submittedFiles,
        })) as unknown as ClinicalRecord
        saveSucceeded = true
        break
      } catch (err: any) {
        console.warn(`Falha ao gravar evolução (tentativa ${attempt + 1}/${maxRetries + 1}):`, err)

        // Imediatamente após uma falha de rede/timeout, checa se gravou mesmo assim
        const justSaved = await checkAlreadyRecorded(
          patient.id,
          submittedDesc,
          submittedDiag,
          submittedTreat,
        )
        if (justSaved) {
          console.log('Registro encontrado na base após erro de rede:', justSaved.id)
          createdRecord = justSaved
          saveSucceeded = true
          break
        }

        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 1200 * (attempt + 1)))
        }
      }
    }

    // Se após retentativas não houve sucesso confirmado
    if (!saveSucceeded || !createdRecord) {
      setLoading(false)
      toast({
        title: 'Instabilidade ao confirmar salvamento',
        description:
          'O atendimento PODE ter sido salvo no servidor devido à lentidão de rede. Por favor, confira a lista de atendimentos antes de redigitar.',
        variant: 'destructive',
      })
      // Tenta recarregar a lista caso tenha sido gravado de fato
      loadRecords().catch(() => {})
      return
    }

    // 2. Registro gravado com sucesso! Limpar formulário e fechar modal imediatamente
    setIsDialogOpen(false)
    setFormData({ description: '', diagnosis: '', treatment: '' })
    setFiles([])

    // 3. Auditoria resiliente (nunca estoura erro na tela nem invalida o salvamento bem-sucedido)
    try {
      const recordDateForLabel = createdRecord.created || new Date().toISOString()
      const recordLabel = formatClinicalRecordAuditLabel(
        patient.name,
        recordDateForLabel,
        submittedDesc,
      )

      auditService.log({
        action: 'create',
        module: 'clinical_records',
        recordId: createdRecord.id || '',
        recordLabel,
        patientName: patient.name,
        tutorName: patient.expand?.tutor_id?.name || '',
        changes: {
          description: {
            label: 'Queixa / Evolução',
            oldValue: null,
            newValue: submittedDesc,
          },
          diagnosis: {
            label: 'Diagnóstico',
            oldValue: null,
            newValue: submittedDiag || 'Não informado',
          },
          treatment: {
            label: 'Tratamento Prescrito',
            oldValue: null,
            newValue: submittedTreat || 'Não informado',
          },
        },
        details: `Nova evolução clínica registrada para ${patient.name}. Prescrição: ${submittedTreat || 'Sem prescrição informada'}`,
      })
    } catch (auditErr) {
      console.warn('Erro não-bloqueante na auditoria pós-salvamento:', auditErr)
    }

    // 4. Recarga resiliente da ficha com retry automático de 1–2 vezes
    let reloadOk = false
    for (let rAttempt = 0; rAttempt <= 2; rAttempt++) {
      try {
        await loadRecords()
        reloadOk = true
        break
      } catch (reloadErr) {
        console.warn(`Erro na recarga da ficha (tentativa ${rAttempt + 1}):`, reloadErr)
        await new Promise((res) => setTimeout(res, 1000))
      }
    }

    setLoading(false)

    if (reloadOk) {
      toast({
        title: 'Registro clínico salvo',
        description: 'A nova evolução foi registrada com sucesso.',
      })
    } else {
      toast({
        title: 'Registro clínico salvo com sucesso',
        description:
          'A evolução foi gravada na base, mas houve lentidão ao recarregar a lista. Atualize a página se não visualizar de imediato.',
      })
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
      // Identifica com a data de atendimento do registro e o trecho da queixa/evolução
      const recordDateForLabel = payload.created || editingRecord.created
      const recordDescForLabel = payload.description || editingRecord.description
      const recordLabel = formatClinicalRecordAuditLabel(
        patient.name,
        recordDateForLabel,
        recordDescForLabel,
      )

      auditService.log({
        action: 'update',
        module: 'clinical_records',
        recordId: editingRecord.id,
        recordLabel,
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
                  <span>{getRecordDateInfo(record).displayDate}</span>
                  {getRecordDateInfo(record).displayTime && (
                    <span className="text-xs font-normal text-muted-foreground">
                      às {getRecordDateInfo(record).displayTime}
                    </span>
                  )}
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
