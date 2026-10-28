import { useState, useEffect } from 'react'
import { Patient, ClinicalRecord } from '@/lib/types'
import { api } from '@/services/api'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Activity,
  Paperclip,
  Trash2,
  UploadCloud,
  Edit2,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Search,
  X,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { removeAccents, getSearchVariants } from '@/lib/search-utils'
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

  // Estado do Visualizador de Anexo Embutido
  const [viewingAttachment, setViewingAttachment] = useState<{
    url: string
    filename: string
  } | null>(null)

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

  // Estado de Exclusão de Registro Clínico
  const [deletingRecord, setDeletingRecord] = useState<ClinicalRecord | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Estado de Pesquisa dentro da Ficha Clínica
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null)

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

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return
    setDeleteLoading(true)
    try {
      const rec = deletingRecord
      await api.deleteClinicalRecord(rec.id)

      setDeletingRecord(null)
      toast({
        title: 'Lançamento excluído',
        description: 'O lançamento foi removido da ficha clínica com sucesso.',
      })
      await loadRecords()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir lançamento',
        description: err.message || 'Falha ao remover registro da ficha clínica.',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
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

  /**
   * Utilitários para busca na ficha clínica:
   * Case-insensitive e sem acentos (insensível a acentuação)
   * Pesquisa em description, diagnosis e treatment.
   */
  const searchNormalized = removeAccents(searchTerm.trim().toLowerCase())
  const searchVariants = searchTerm.trim()
    ? getSearchVariants(searchTerm.trim()).map((v) => v.toLowerCase())
    : []

  const searchResults = (() => {
    if (!searchNormalized) return []
    return records
      .map((rec) => {
        const fullText = [rec.description || '', rec.diagnosis || '', rec.treatment || ''].join(' ')
        const normText = removeAccents(fullText.toLowerCase())

        // Verifica se o texto normalizado contém o termo normalizado ou alguma variante
        const foundIndex = normText.indexOf(searchNormalized)
        if (foundIndex === -1 && !searchVariants.some((v) => fullText.toLowerCase().includes(v))) {
          return null
        }

        // Gera trecho com contexto ao redor da primeira ocorrência encontrada
        const matchIdx = foundIndex !== -1 ? foundIndex : 0
        const start = Math.max(0, matchIdx - 40)
        const end = Math.min(fullText.length, matchIdx + searchNormalized.length + 60)
        let snippet = fullText.slice(start, end).trim()
        if (start > 0) snippet = '...' + snippet
        if (end < fullText.length) snippet = snippet + '...'

        const dateInfo = getRecordDateInfo(rec)
        return {
          record: rec,
          dateDisplay:
            dateInfo.displayDate + (dateInfo.displayTime ? ` às ${dateInfo.displayTime}` : ''),
          snippet,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  })()

  // Rola suavemente até o card correspondente e aplica um destaque temporário
  const scrollToRecord = (recordId: string) => {
    setActiveHighlightId(recordId)
    const el = document.getElementById(`clinical-record-${recordId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Renderiza texto destacando as ocorrências do termo de busca (sem acento / com acento)
  const renderHighlightedText = (text: string, term: string) => {
    if (!term.trim() || !text) return text
    const cleanTerm = removeAccents(term.trim().toLowerCase())
    if (!cleanTerm) return text

    const parts: { text: string; isMatch: boolean }[] = []
    let remaining = text

    while (remaining.length > 0) {
      const normRemaining = removeAccents(remaining.toLowerCase())
      const matchIndex = normRemaining.indexOf(cleanTerm)

      if (matchIndex === -1) {
        parts.push({ text: remaining, isMatch: false })
        break
      }

      if (matchIndex > 0) {
        parts.push({ text: remaining.slice(0, matchIndex), isMatch: false })
      }

      const matchText = remaining.slice(matchIndex, matchIndex + cleanTerm.length)
      parts.push({ text: matchText, isMatch: true })

      remaining = remaining.slice(matchIndex + cleanTerm.length)
    }

    return parts.map((part, i) =>
      part.isMatch ? (
        <mark key={i} className="bg-yellow-200 text-yellow-950 font-bold px-1 rounded">
          {part.text}
        </mark>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Barra superior: Botão Pesquisa no canto esquerdo e Nova Evolução no canto direito */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Button
            type="button"
            onClick={() => setIsSearchOpen((prev) => !prev)}
            className="gap-2 bg-primary hover:bg-primary/90 h-9 text-xs font-semibold"
          >
            <Search className="w-4 h-4" />
            Pesquisa na Ficha
            {searchTerm && (
              <span className="ml-1 px-1.5 py-0.2 bg-white/20 text-white rounded text-[10px]">
                {searchResults.length}
              </span>
            )}
          </Button>
        </div>

        {!isAttendant && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary hover:bg-primary/90 h-9 text-xs font-semibold">
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

      {/* Painel expansível de Pesquisa da Ficha Clínica */}
      {isSearchOpen && (
        <Card className="border border-slate-200 bg-slate-50/70 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  autoFocus
                  placeholder="Pesquisar medicamento, sintoma, diagnóstico ou procedimento em toda a ficha..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 bg-white h-9 text-xs sm:text-sm"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                    title="Limpar pesquisa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setIsSearchOpen(false)
                }}
                className="h-9 text-xs"
              >
                Fechar
              </Button>
            </div>

            {/* Status e Resultados da Busca */}
            {searchTerm.trim() && (
              <div className="pt-1">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center bg-white rounded-md border border-dashed border-slate-200 text-xs text-muted-foreground">
                    Nenhum lançamento encontrado para o termo &ldquo;<strong>{searchTerm}</strong>
                    &rdquo;.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                      <span>
                        Encontrado(s) <strong>{searchResults.length}</strong> lançamento(s) com o
                        termo:
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        Limpar busca
                      </Button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {searchResults.map((res) => (
                        <div
                          key={res.record.id}
                          onClick={() => scrollToRecord(res.record.id)}
                          className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors bg-white hover:bg-yellow-50/60 ${
                            activeHighlightId === res.record.id
                              ? 'border-yellow-400 ring-2 ring-yellow-300 bg-yellow-50/80'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 font-semibold text-slate-800 mb-1">
                            <span className="flex items-center gap-1.5 text-primary">
                              <Activity className="w-3.5 h-3.5" />
                              {res.dateDisplay}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 hover:text-primary">
                              Ir ao lançamento <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                          <p className="text-slate-600 line-clamp-2 leading-relaxed">
                            {renderHighlightedText(res.snippet, searchTerm)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Listagem de Lançamentos da Ficha Clínica (Ordem Decrescente Estrita Mantida) */}
      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
            Nenhum registro clínico encontrado para este paciente.
          </div>
        ) : (
          records.map((record) => {
            const isMatchInSearch = searchTerm.trim()
              ? searchResults.some((sr) => sr.record.id === record.id)
              : false
            const isHighlightedCard = activeHighlightId === record.id

            return (
              <Card
                key={record.id}
                id={`clinical-record-${record.id}`}
                className={`border shadow-sm overflow-hidden transition-all duration-300 ${
                  isHighlightedCard
                    ? 'ring-3 ring-yellow-400 border-yellow-400 bg-yellow-50/30'
                    : isMatchInSearch
                      ? 'border-yellow-300 bg-yellow-50/10'
                      : 'border-slate-200/80'
                }`}
              >
                <div className="bg-primary/5 px-6 py-3 border-b flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-primary flex items-center gap-2">
                    <span>{getRecordDateInfo(record).displayDate}</span>
                    {getRecordDateInfo(record).displayTime && (
                      <span className="text-xs font-normal text-muted-foreground">
                        às {getRecordDateInfo(record).displayTime}
                      </span>
                    )}
                    {isMatchInSearch && (
                      <span className="ml-2 px-2 py-0.5 text-[11px] font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                        Termo encontrado
                      </span>
                    )}
                  </div>

                  {!isAttendant && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(record)}
                        className="h-8 gap-1.5 text-xs border-primary/20 hover:bg-primary hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Editar
                      </Button>

                      {/* Botão Excluir lançamento da ficha clínica ao lado de Editar */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingRecord(record)}
                        className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300"
                        title="Excluir este lançamento da ficha clínica"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="sr-only">Excluir lançamento</span>
                      </Button>
                    </div>
                  )}
                </div>

                <CardContent className="p-6 grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Queixa / Evolução
                    </h4>
                    <p className="text-slate-800 whitespace-pre-wrap">
                      {searchTerm.trim()
                        ? renderHighlightedText(record.description || '', searchTerm)
                        : record.description}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Diagnóstico
                    </h4>
                    <p className="text-slate-800 font-medium">
                      {searchTerm.trim() && record.diagnosis
                        ? renderHighlightedText(record.diagnosis, searchTerm)
                        : record.diagnosis || '-'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Tratamento Prescrito
                    </h4>
                    <p className="text-slate-800 whitespace-pre-wrap">
                      {searchTerm.trim() && record.treatment
                        ? renderHighlightedText(record.treatment, searchTerm)
                        : record.treatment || '-'}
                    </p>
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
                        {record.files?.map((file) => {
                          const fileUrl = pb.files.getURL(record, file)
                          const isImg = /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(file)
                          const isPdf = /\.pdf$/i.test(file)

                          return (
                            <div
                              key={file}
                              className="flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-md border border-primary/10 hover:border-primary/30 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingAttachment({ url: fileUrl, filename: file })
                                }
                                className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                                title={`Visualizar ${file}`}
                              >
                                {isImg ? (
                                  <ImageIcon className="w-4 h-4 shrink-0 text-primary" />
                                ) : isPdf ? (
                                  <FileText className="w-4 h-4 shrink-0 text-primary" />
                                ) : (
                                  <Paperclip className="w-4 h-4 shrink-0" />
                                )}
                                <span>
                                  {file.length > 20 ? file.substring(0, 20) + '...' : file}
                                </span>
                              </button>
                              {!isAttendant && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(record.id, file)}
                                  className="text-red-500 hover:text-red-700 ml-1 p-1"
                                  disabled={loading}
                                  title="Excluir anexo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Dialog do Visualizador de Anexo Embutido */}
      <Dialog
        open={!!viewingAttachment}
        onOpenChange={(open) => {
          if (!open) setViewingAttachment(null)
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] md:w-[85vw] max-h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b shrink-0 flex flex-row items-center justify-between pr-8">
            <div className="space-y-1 min-w-0 flex-1 mr-4">
              <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2 truncate">
                {viewingAttachment &&
                /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(viewingAttachment.filename) ? (
                  <ImageIcon className="w-5 h-5 text-primary shrink-0" />
                ) : viewingAttachment && /\.pdf$/i.test(viewingAttachment.filename) ? (
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <Paperclip className="w-5 h-5 text-primary shrink-0" />
                )}
                <span className="truncate" title={viewingAttachment?.filename}>
                  {viewingAttachment?.filename}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Visualização integrada de anexo da ficha clínica
              </DialogDescription>
            </div>
            {viewingAttachment && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs shrink-0" asChild>
                <a href={viewingAttachment.url} download={viewingAttachment.filename}>
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
              </Button>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-auto mt-4 flex items-center justify-center min-h-[300px] max-h-[calc(92vh-130px)] bg-slate-50/50 rounded-lg border">
            {viewingAttachment &&
              (() => {
                const fname = viewingAttachment.filename
                const url = viewingAttachment.url
                const isImage = /\.(jpe?g|png|webp|gif|svg|bmp)$/i.test(fname)
                const isPdf = /\.pdf$/i.test(fname)

                if (isImage) {
                  return (
                    <div className="w-full h-full p-2 flex items-center justify-center">
                      <img
                        src={url}
                        alt={fname}
                        className="max-w-full max-h-[calc(92vh-160px)] object-contain rounded shadow-xs"
                      />
                    </div>
                  )
                }

                if (isPdf) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <object
                        data={url}
                        type="application/pdf"
                        className="w-full h-[calc(92vh-160px)] min-h-[480px] rounded"
                      >
                        {/* Fallback caso o navegador não renderize via object */}
                        <iframe
                          src={url}
                          title={fname}
                          className="w-full h-[calc(92vh-160px)] min-h-[480px] rounded border-0"
                        >
                          <div className="p-8 text-center space-y-4">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                            <p className="text-sm text-slate-600">
                              Não foi possível carregar o visualizador de PDF embutido neste
                              navegador.
                            </p>
                            <Button asChild className="gap-2">
                              <a href={url} download={fname}>
                                <Download className="w-4 h-4" /> Baixar PDF
                              </a>
                            </Button>
                          </div>
                        </iframe>
                      </object>
                    </div>
                  )
                }

                return (
                  <div className="p-8 text-center space-y-4 max-w-md">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                      <Paperclip className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 break-all">{fname}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Este tipo de arquivo não possui pré-visualização direta no navegador. Faça o
                        download para abrir no seu computador.
                      </p>
                    </div>
                    <Button asChild className="gap-2 bg-primary">
                      <a href={url} download={fname}>
                        <Download className="w-4 h-4" /> Baixar Arquivo
                      </a>
                    </Button>
                  </div>
                )
              })()}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Dialog de Confirmação para Exclusão de Lançamento da Ficha Clínica */}
      <Dialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5" /> Excluir este lançamento da ficha clínica?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 pt-2">
              Tem certeza de que deseja remover permanentemente este atendimento da ficha clínica do
              animal? A exclusão ficará registrada na auditoria e não afeta anexos de outros
              lançamentos.
            </DialogDescription>
          </DialogHeader>

          {deletingRecord && (
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs space-y-1.5 my-2">
              <p>
                <strong className="text-slate-700">Data do Atendimento:</strong>{' '}
                {getRecordDateInfo(deletingRecord).displayDate}
                {getRecordDateInfo(deletingRecord).displayTime
                  ? ` às ${getRecordDateInfo(deletingRecord).displayTime}`
                  : ''}
              </p>
              {deletingRecord.description && (
                <p className="line-clamp-3">
                  <strong className="text-slate-700">Queixa / Evolução:</strong>{' '}
                  {deletingRecord.description}
                </p>
              )}
              {deletingRecord.diagnosis && (
                <p>
                  <strong className="text-slate-700">Diagnóstico:</strong>{' '}
                  {deletingRecord.diagnosis}
                </p>
              )}
              {deletingRecord.treatment && (
                <p className="line-clamp-2">
                  <strong className="text-slate-700">Tratamento:</strong> {deletingRecord.treatment}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingRecord(null)}
              disabled={deleteLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteRecord}
              disabled={deleteLoading}
              className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="w-4 h-4" />
              {deleteLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
