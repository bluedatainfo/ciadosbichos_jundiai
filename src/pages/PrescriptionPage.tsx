import React, { useState, useEffect, useRef, useId } from 'react'
import {
  FileSignature,
  Printer,
  Download,
  Paperclip,
  Search,
  Calendar as CalendarIcon,
  Bold,
  Italic,
  List,
  Heading2,
  CheckCircle2,
  History,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Eye,
  ChevronRight,
  User,
  PawPrint,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  generatePrescriptionDocument,
  printPrescriptionDocument,
  formatPrescriptionDate,
} from '@/lib/prescription-engine'
import { prescriptionService, PrescriptionRecord } from '@/services/prescription'
import { auditService } from '@/services/audit'
import { buildFieldVariantsFilter, removeAccents } from '@/lib/search-utils'
import { Link } from 'react-router-dom'

interface SearchPatientResult {
  id: string
  name: string
  species?: string
  breed?: string
  tutor_id?: string
  expand?: {
    tutor_id?: {
      id: string
      name: string
      phone?: string
    }
  }
}

export default function PrescriptionPage() {
  const { toast } = useToast()

  // IDs acessíveis para campos de formulário
  const dateInputId = useId()
  const searchInputId = useId()
  const prescriptionAreaId = useId()

  // Estado do formulário
  const [selectedPatient, setSelectedPatient] = useState<SearchPatientResult | null>(null)
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [prescriptionText, setPrescriptionText] = useState<string>('')

  // Estado de busca de pacientes/tutores
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchPatientResult[]>([])
  const [totalSearchResults, setTotalSearchResults] = useState<number>(0)
  const [searchPage, setSearchPage] = useState<number>(1)
  const [hasMoreSearch, setHasMoreSearch] = useState<boolean>(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  // Estados de ação e pré-visualização
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSavingAttachment, setIsSavingAttachment] = useState(false)
  const [previewCanvases, setPreviewCanvases] = useState<string[]>([])
  const [previewTotalPages, setPreviewTotalPages] = useState<number>(1)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)

  // Histórico de receituários
  const [historyList, setHistoryList] = useState<PrescriptionRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fechar dropdown de busca ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Carregar histórico inicial
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const res = await prescriptionService.getList(1, 15)
      setHistoryList(res.items)
    } catch (err) {
      console.warn('Erro ao carregar histórico de receituários:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Construtor do filtro PocketBase para busca por nome do animal OU tutor
  const buildSearchFilter = (query: string): string => {
    const term = query.trim()
    if (!term) return ''
    const patientNameFilter = buildFieldVariantsFilter('name', term)
    const tutorNameFilter = buildFieldVariantsFilter('tutor_id.name', term)
    if (patientNameFilter && tutorNameFilter) {
      return `(${patientNameFilter} || ${tutorNameFilter})`
    }
    return patientNameFilter || tutorNameFilter || ''
  }

  // Ordenação inteligente: pacientes cujo nome começa com o termo vêm primeiro,
  // seguidos por pacientes cujo nome contém o termo, seguidos por tutores.
  // Dentro do mesmo grupo, ordem alfabética.
  const sortResultsByRelevance = (
    items: SearchPatientResult[],
    query: string,
  ): SearchPatientResult[] => {
    const qNorm = removeAccents(query).trim().toLowerCase()
    if (!qNorm) return items

    return [...items].sort((a, b) => {
      const aName = removeAccents(a.name || '').toLowerCase()
      const bName = removeAccents(b.name || '').toLowerCase()
      const aTutor = removeAccents(a.expand?.tutor_id?.name || '').toLowerCase()
      const bTutor = removeAccents(b.expand?.tutor_id?.name || '').toLowerCase()

      const aNameExact = aName === qNorm
      const bNameExact = bName === qNorm
      if (aNameExact !== bNameExact) return aNameExact ? -1 : 1

      const aNameStarts = aName.startsWith(qNorm)
      const bNameStarts = bName.startsWith(qNorm)
      if (aNameStarts !== bNameStarts) return aNameStarts ? -1 : 1

      const aNameContains = aName.includes(qNorm)
      const bNameContains = bName.includes(qNorm)
      if (aNameContains !== bNameContains) return aNameContains ? -1 : 1

      const aTutorStarts = aTutor.startsWith(qNorm)
      const bTutorStarts = bTutor.startsWith(qNorm)
      if (aTutorStarts !== bTutorStarts) return aTutorStarts ? -1 : 1

      return aName.localeCompare(bName, 'pt-BR')
    })
  }

  // Busca inicial debounced de animal/tutor (página 1, lote de 50)
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([])
      setTotalSearchResults(0)
      setSearchPage(1)
      setHasMoreSearch(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const filterStr = buildSearchFilter(trimmed)
        const res = await pb.collection('patients').getList<SearchPatientResult>(1, 50, {
          filter: filterStr,
          expand: 'tutor_id',
          sort: 'name',
        })
        const sorted = sortResultsByRelevance(res.items, trimmed)
        setSearchResults(sorted)
        setTotalSearchResults(res.totalItems)
        setSearchPage(1)
        setHasMoreSearch(res.page < res.totalPages)
        setShowDropdown(true)
      } catch (err) {
        console.warn('Erro na busca de pacientes para receituário:', err)
      } finally {
        setIsSearching(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Carregar mais resultados (rolagem contínua / scroll infinito)
  const handleLoadMoreResults = async () => {
    if (isLoadingMore || !hasMoreSearch) return
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    setIsLoadingMore(true)
    try {
      const nextPage = searchPage + 1
      const filterStr = buildSearchFilter(trimmed)
      const res = await pb.collection('patients').getList<SearchPatientResult>(nextPage, 50, {
        filter: filterStr,
        expand: 'tutor_id',
        sort: 'name',
      })

      setSearchResults((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newUnique = res.items.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newUnique]
      })
      setSearchPage(res.page)
      setTotalSearchResults(res.totalItems)
      setHasMoreSearch(res.page < res.totalPages)
    } catch (err) {
      console.warn('Erro ao carregar mais pacientes:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Handler de scroll no container de dropdown
  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom && hasMoreSearch && !isLoadingMore) {
      handleLoadMoreResults()
    }
  }

  // Formatação rápida na área de texto
  const insertFormatting = (prefix: string, suffix = '') => {
    const el = textareaRef.current
    if (!el) return

    const start = el.selectionStart
    const end = el.selectionEnd
    const current = el.value

    const selectedText = current.substring(start, end)
    const replacement = `${prefix}${selectedText || 'item'}${suffix}`

    const updated = current.substring(0, start) + replacement + current.substring(end)
    setPrescriptionText(updated)

    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length)
    }, 50)
  }

  // Gera o nome padronizado de arquivo receituario_NOMEDOANIMAL_data.pdf
  const getPdfFilename = () => {
    const pName = selectedPatient?.name
      ? selectedPatient.name
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '_')
      : 'PACIENTE'
    const dStr = date
      ? date.replace(/-/g, '')
      : new Date().toISOString().split('T')[0].replace(/-/g, '')
    return `receituario_${pName}_${dStr}.pdf`
  }

  // Validação básica antes de gerar
  const validateForm = (): boolean => {
    if (!selectedPatient) {
      toast({
        title: 'Selecione o paciente',
        description: 'É necessário selecionar um animal/tutor antes de emitir o receituário.',
        variant: 'destructive',
      })
      return false
    }
    if (!prescriptionText.trim()) {
      toast({
        title: 'Prescrição em branco',
        description: 'Digite os medicamentos, dosagens ou orientações do receituário.',
        variant: 'destructive',
      })
      return false
    }
    return true
  }

  // Ação: Pré-visualizar Composição
  const handlePreview = async () => {
    if (!validateForm()) return
    setIsGenerating(true)
    try {
      const tutorName = selectedPatient?.expand?.tutor_id?.name || ''
      const doc = await generatePrescriptionDocument({
        patientName: selectedPatient!.name,
        tutorName,
        date,
        content: prescriptionText,
      })

      const previews = doc.pageCanvases.map((c) => c.toDataURL('image/jpeg', 0.9))
      setPreviewCanvases(previews)
      setPreviewTotalPages(doc.totalPages)
      setIsPreviewModalOpen(true)
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar prévia',
        description: err.message || 'Falha ao processar páginas do receituário.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Ação: Gerar e Baixar PDF
  const handleDownloadPdf = async () => {
    if (!validateForm()) return
    setIsGenerating(true)
    try {
      const tutorName = selectedPatient?.expand?.tutor_id?.name || ''
      const doc = await generatePrescriptionDocument({
        patientName: selectedPatient!.name,
        tutorName,
        date,
        content: prescriptionText,
      })

      const filename = getPdfFilename()
      const url = URL.createObjectURL(doc.pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Salva no histórico de receituários
      await prescriptionService.create({
        patient_id: selectedPatient!.id,
        patient_name: selectedPatient!.name,
        tutor_name: tutorName,
        date,
        content: prescriptionText,
      })
      loadHistory()

      toast({
        title: 'PDF gerado com sucesso',
        description: `Arquivo ${filename} baixado (${doc.totalPages} página${doc.totalPages > 1 ? 's' : ''}).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: err.message || 'Falha na compilação do documento.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Ação: Imprimir (ambiente isolado sem interface)
  const handlePrint = async () => {
    if (!validateForm()) return
    setIsGenerating(true)
    try {
      const tutorName = selectedPatient?.expand?.tutor_id?.name || ''
      const doc = await generatePrescriptionDocument({
        patientName: selectedPatient!.name,
        tutorName,
        date,
        content: prescriptionText,
      })

      await printPrescriptionDocument(doc.pageCanvases)

      // Registra no histórico
      await prescriptionService.create({
        patient_id: selectedPatient!.id,
        patient_name: selectedPatient!.name,
        tutor_name: tutorName,
        date,
        content: prescriptionText,
      })
      loadHistory()

      toast({
        title: 'Impressão iniciada',
        description: `Enviado para diálogo de impressão (${doc.totalPages} página${doc.totalPages > 1 ? 's' : ''}).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao imprimir',
        description: err.message || 'Falha ao inicializar impressão.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Ação: Salvar e Anexar à Ficha Clínica do Paciente
  const handleSaveAndAttach = async () => {
    if (!validateForm()) return
    setIsSavingAttachment(true)
    try {
      const tutorName = selectedPatient?.expand?.tutor_id?.name || ''
      const doc = await generatePrescriptionDocument({
        patientName: selectedPatient!.name,
        tutorName,
        date,
        content: prescriptionText,
      })

      const filename = getPdfFilename()
      const dateFormatted = formatPrescriptionDate(date)

      // 1. Grava como anexo em clinical_records do paciente e registra auditoria
      await prescriptionService.attachToClinicalHistory(
        selectedPatient!.id,
        selectedPatient!.name,
        tutorName,
        doc.pdfBlob,
        filename,
        prescriptionText,
        dateFormatted,
      )

      // 2. Grava no histórico de receituários
      await prescriptionService.create({
        patient_id: selectedPatient!.id,
        patient_name: selectedPatient!.name,
        tutor_name: tutorName,
        date,
        content: prescriptionText,
      })
      loadHistory()

      toast({
        title: 'Receituário anexado com sucesso!',
        description: `O PDF ${filename} foi anexado à Ficha Clínica de ${selectedPatient!.name} e já pode ser aberto no visualizador embutido.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao anexar receituário',
        description: err.message || 'Falha ao gravar anexo na ficha clínica.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingAttachment(false)
    }
  }

  // Reabrir receituário do histórico
  const handleReopenHistory = async (record: PrescriptionRecord) => {
    // Tenta carregar dados do paciente
    try {
      const patient = await pb
        .collection('patients')
        .getOne<SearchPatientResult>(record.patient_id, {
          expand: 'tutor_id',
        })
      setSelectedPatient(patient)
    } catch {
      setSelectedPatient({
        id: record.patient_id,
        name: record.patient_name,
        expand: record.tutor_name ? { tutor_id: { id: '', name: record.tutor_name } } : undefined,
      })
    }

    setDate(record.date || new Date().toISOString().split('T')[0])
    setPrescriptionText(record.content || '')

    toast({
      title: 'Receituário carregado',
      description: `Dados de ${record.patient_name} recarregados no formulário.`,
    })
  }

  // Inserir modelo rápido de prescrição
  const handleInsertTemplate = (type: 'padrao' | 'antibiotico' | 'curativo') => {
    let template = ''
    if (type === 'padrao') {
      template =
        'USO ORAL:\n' +
        '1. Anti-inflamatório Meloxicam 1mg ---------- 10 comprimidos\n' +
        '   Administrar 1 comprimido a cada 24 horas, durante 5 dias, após a refeição.\n\n' +
        '2. Protetor Gástrico Omeprazol 10mg ---------- 14 cápsulas\n' +
        '   Administrar 1 cápsula pela manhã, em jejum, durante 7 dias.\n\n' +
        'RECOMENDAÇÕES GERAIS:\n' +
        '- Oferecer alimentação pastosa e água fresca à vontade.\n' +
        '- Retorno para reavaliação clínica em 7 a 10 dias.'
    } else if (type === 'antibiotico') {
      template =
        'USO ORAL:\n' +
        '1. Antibiótico Amoxicilina + Clavulanato 250mg ---------- 14 comprimidos\n' +
        '   Administrar 1 comprimido a cada 12 horas, durante 7 dias consecutivos.\n\n' +
        '2. Analgésico Dipirona Gotas (500mg/mL) ---------- 1 frasco\n' +
        '   Administrar 1 gota por kg de peso corporal a cada 8 horas se houver dor ou febre.\n\n' +
        'ORIENTAÇÕES:\n' +
        '- Manter o tratamento pelo período integral prescrito, mesmo havendo melhora antes.\n' +
        '- Comunicar a clínica caso ocorram vômitos ou alterações gastrointestinais.'
    } else if (type === 'curativo') {
      template =
        'USO TÓPICO:\n' +
        '1. Solução Fisiológica 0,9% ---------- 1 frasco\n' +
        '   Higienizar o local da ferida cuidadosamente 2 vezes ao dia.\n\n' +
        '2. Pomada Cicatrizante e Antisséptica ---------- 1 bisnaga\n' +
        '   Aplicar camada fina sobre a lesão após a higienização, cobrindo com gaze estéril.\n\n' +
        '3. Colar Elisabetano (Cone Protetor)\n' +
        '   Uso contínuo para impedir lambedura ou coceira na área afetada.'
    }

    setPrescriptionText((prev) => (prev ? `${prev}\n\n${template}` : template))
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Topo da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileSignature className="w-6 h-6 text-emerald-700" />
            Receituário Veterinário
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Emissão de receitas no modelo timbrado oficial com paginação contínua e anexo direto à
            ficha clínica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedPatient && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs h-9 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50"
            >
              <Link to={`/pacientes/${selectedPatient.id}`}>
                <PawPrint className="w-3.5 h-3.5 mr-1.5" /> Ver Ficha do Animal
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal: Formulário de Prescrição */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <PawPrint className="w-4 h-4 text-emerald-700" /> Dados do Paciente e Emissão
              </CardTitle>
              <CardDescription className="text-xs">
                Selecione o paciente cadastrado na clínica e a data da prescrição.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Busca de Paciente / Tutor */}
                <div className="md:col-span-2 relative" ref={searchContainerRef}>
                  <Label htmlFor={searchInputId} className="text-xs font-semibold text-slate-700">
                    Buscar Animal ou Tutor *
                  </Label>
                  <div className="relative mt-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id={searchInputId}
                      placeholder="Digite o nome do animal ou do tutor..."
                      className="pl-9 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true)
                      }}
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5">
                        <span className="animate-spin text-xs text-muted-foreground">⏳</span>
                      </div>
                    )}
                  </div>

                  {/* Dropdown de Resultados da Busca */}
                  {showDropdown && (
                    <div
                      ref={dropdownListRef}
                      onScroll={handleDropdownScroll}
                      className="absolute left-0 right-0 top-full mt-1 bg-white rounded-md border border-slate-200 shadow-xl z-30 max-h-80 overflow-y-auto divide-y divide-slate-100"
                    >
                      {/* Cabeçalho informativo do total de resultados */}
                      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 flex items-center justify-between sticky top-0 z-10">
                        <span>
                          {totalSearchResults > 0 ? (
                            <>
                              <strong>{totalSearchResults}</strong> resultado
                              {totalSearchResults > 1 ? 's' : ''} encontrado
                              {totalSearchResults > 1 ? 's' : ''}
                              {searchResults.length < totalSearchResults && (
                                <span className="text-slate-400 font-normal">
                                  {' '}
                                  (exibindo {searchResults.length}, role para ver todos)
                                </span>
                              )}
                            </>
                          ) : (
                            'Nenhum resultado'
                          )}
                        </span>
                        {isSearching && (
                          <span className="text-emerald-700 font-medium">Buscando...</span>
                        )}
                      </div>

                      {searchResults.length === 0 && !isSearching && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Nenhum animal ou tutor encontrado para "{searchQuery}".
                        </div>
                      )}

                      {searchResults.map((p) => {
                        const tutorName = p.expand?.tutor_id?.name || 'Tutor não informado'
                        return (
                          <div
                            key={p.id}
                            className="p-3 hover:bg-emerald-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                            onClick={() => {
                              setSelectedPatient(p)
                              setSearchQuery('')
                              setShowDropdown(false)
                            }}
                          >
                            <div className="min-w-0 flex-1">
                              {/* Linha do Animal com identificação clara e em destaque */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 font-bold text-sm text-slate-900 group-hover:text-emerald-900">
                                  <PawPrint className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{p.name}</span>
                                </span>

                                {p.species && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 h-4.5 font-medium border-emerald-600/30 text-emerald-800 bg-emerald-50/50"
                                  >
                                    {p.species}
                                    {p.breed ? ` • ${p.breed}` : ''}
                                  </Badge>
                                )}
                              </div>

                              {/* Linha do Tutor com identificação clara ao lado/abaixo */}
                              <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700">Tutor:</span>
                                <span className="text-slate-700 font-normal truncate">
                                  {tutorName}
                                </span>
                                {p.expand?.tutor_id?.phone && (
                                  <span className="text-slate-400 text-[11px] hidden sm:inline">
                                    • {p.expand.tutor_id.phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0 transition-colors" />
                          </div>
                        )
                      })}

                      {/* Indicador de carregamento ou botão de carregar mais ao final da rolagem */}
                      {hasMoreSearch && (
                        <div className="p-2.5 text-center bg-slate-50 border-t border-slate-100">
                          {isLoadingMore ? (
                            <span className="text-xs text-slate-500 animate-pulse">
                              Carregando mais resultados...
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLoadMoreResults()
                              }}
                              className="text-xs text-emerald-700 hover:text-emerald-800 h-7"
                            >
                              Carregar mais ({searchResults.length} de {totalSearchResults})
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Campo de Data da Receita */}
                <div>
                  <Label htmlFor={dateInputId} className="text-xs font-semibold text-slate-700">
                    Data da Receita *
                  </Label>
                  <div className="relative mt-1">
                    <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      id={dateInputId}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Card de Paciente Selecionado */}
              {selectedPatient ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-2xs">
                      {selectedPatient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{selectedPatient.name}</span>
                        {selectedPatient.species && (
                          <span className="text-xs font-normal text-slate-600">
                            ({selectedPatient.species} {selectedPatient.breed || ''})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5 text-emerald-800" />
                        <strong>Tutor:</strong>{' '}
                        <span>{selectedPatient.expand?.tutor_id?.name || 'Não informado'}</span>
                        {selectedPatient.expand?.tutor_id?.phone && (
                          <span className="text-slate-400">
                            • {selectedPatient.expand.tutor_id.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 self-end sm:self-center h-8"
                  >
                    Trocar Animal
                  </Button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-3 text-center text-xs text-slate-500">
                  Nenhum animal selecionado. Use o campo de busca acima para escolher o paciente.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Área de Texto da Prescrição com Barra de Ferramentas Simples */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-emerald-700" /> Prescrição & Orientações
                </CardTitle>
                <CardDescription className="text-xs">
                  Digite os medicamentos, dosagens e instruções. Quebras de linhas e listas são
                  respeitadas na paginação oficial.
                </CardDescription>
              </div>

              {/* Botões de Modelos Rápidos */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertTemplate('padrao')}
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700"
                >
                  <Sparkles className="w-3 h-3 mr-1 text-amber-600" /> Modelo Padrão
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertTemplate('antibiotico')}
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hidden sm:inline-flex"
                >
                  Antibiótico
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInsertTemplate('curativo')}
                  className="text-xs h-7 px-2 border-slate-300 text-slate-700 hidden md:inline-flex"
                >
                  Curativo
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {/* Barra de Formatação Simples */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting('# ', '')}
                  className="h-7 px-2 text-xs font-bold text-slate-700"
                  title="Título / Seção (ex: # USO ORAL)"
                >
                  <Heading2 className="w-3.5 h-3.5 mr-1" /> Título
                </Button>
                <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting('- ', '')}
                  className="h-7 px-2 text-xs text-slate-700"
                  title="Lista com marcadores (- item)"
                >
                  <List className="w-3.5 h-3.5 mr-1" /> Marcador
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting('1. ', '')}
                  className="h-7 px-2 text-xs text-slate-700"
                  title="Lista numerada (1. item)"
                >
                  1. Numerada
                </Button>
                <div className="w-[1px] h-4 bg-slate-300 mx-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting('**', '**')}
                  className="h-7 px-2 text-xs font-bold text-slate-700"
                  title="Negrito (**texto**)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertFormatting('*', '*')}
                  className="h-7 px-2 text-xs italic text-slate-700"
                  title="Itálico (*texto*)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </Button>

                <div className="ml-auto text-[11px] text-muted-foreground pr-2 hidden sm:block">
                  A quebra de página A4 é automática e nunca corta linhas.
                </div>
              </div>

              {/* Textarea Grande de Prescrição */}
              <div>
                <Label htmlFor={prescriptionAreaId} className="sr-only">
                  Texto da Prescrição
                </Label>
                <Textarea
                  id={prescriptionAreaId}
                  ref={textareaRef}
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                  placeholder="Exemplo:&#10;USO ORAL:&#10;1. Meloxicam 1mg ---------- 10 comprimidos&#10;   Administrar 1 comprimido a cada 24 horas durante 5 dias.&#10;&#10;2. Omeprazol 10mg ---------- 14 cápsulas&#10;   Administrar 1 cápsula em jejum por 7 dias."
                  rows={14}
                  className="font-mono text-sm leading-relaxed border-slate-300 min-h-[280px]"
                />
              </div>

              {/* Barra de Ações Principais */}
              <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isGenerating || isSavingAttachment}
                  className="gap-2 text-xs border-slate-300"
                >
                  <Eye className="w-4 h-4 text-slate-600" /> Prévia Visual
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isGenerating || isSavingAttachment}
                    className="gap-2 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Printer className="w-4 h-4 text-emerald-700" /> Imprimir
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={isGenerating || isSavingAttachment}
                    className="gap-2 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Download className="w-4 h-4 text-emerald-700" /> Gerar PDF
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSaveAndAttach}
                    disabled={isGenerating || isSavingAttachment}
                    className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-xs"
                  >
                    <Paperclip className="w-4 h-4" />
                    {isSavingAttachment ? 'Anexando...' : 'Salvar e Anexar à Ficha Clínica'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Lateral: Guia do Timbrado e Histórico de Receituários */}
        <div className="space-y-6">
          {/* Card Informativo do Modelo Oficial */}
          <Card className="border-emerald-200/80 bg-linear-to-b from-emerald-50/50 to-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-emerald-700" /> Modelo Timbrado Oficial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600">
              <p>
                O documento gerado utiliza a <strong>arte original oficial</strong> da Veterinária
                Companhia dos Bichos:
              </p>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-700">
                <li>
                  <strong>Cabeçalho fixo:</strong> Logo cão/gato, checkboxes e lista dos médicos
                  veterinários (CRMV-SP).
                </li>
                <li>
                  <strong>Área interna:</strong> Retângulo arredondado com marca d'água verde clara
                  onde o texto é renderizado.
                </li>
                <li>
                  <strong>Rodapé fixo:</strong> Endereço (Rua Elias Fausto, 60), telefones e aviso
                  de retorno em 30 dias.
                </li>
                <li>
                  <strong>Múltiplas páginas A4:</strong> Textos longos continuam automaticamente em
                  nova página com a mesma arte de fundo.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Card Histórico de Receituários Emitidos */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-600" /> Histórico Recente
                </CardTitle>
                <CardDescription className="text-xs">
                  Receituários já gerados no sistema
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                title="Atualizar lista"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {isLoadingHistory ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Carregando histórico...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed rounded-md">
                  Nenhum receituário registrado ainda.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {historyList.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="flex items-center gap-1.5 truncate">
                          <PawPrint className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          {item.patient_name}
                        </span>
                        <span className="text-[11px] font-normal text-slate-500 shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatPrescriptionDate(item.date)}
                        </span>
                      </div>

                      {item.tutor_name && (
                        <div className="text-[11px] text-slate-500 truncate">
                          Tutor: {item.tutor_name}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-400 line-clamp-1 flex-1 mr-2">
                          {item.content.replace(/\n+/g, ' ')}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReopenHistory(item)}
                          className="h-6 px-2 text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/60"
                        >
                          Reabrir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Pré-Visualização Visual das Páginas */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-emerald-700" />
                Prévia do Receituário Oficial
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Composição em modelo timbrado A4 — {previewTotalPages} página
                {previewTotalPages > 1 ? 's' : ''} calculada{previewTotalPages > 1 ? 's' : ''}.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 pr-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsPreviewModalOpen(false)
                  handlePrint()
                }}
                className="gap-1.5 h-8 text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsPreviewModalOpen(false)
                  handleDownloadPdf()
                }}
                className="gap-1.5 h-8 text-xs bg-emerald-700 hover:bg-emerald-800"
              >
                <Download className="w-3.5 h-3.5" /> Baixar PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-100/70 rounded-lg border">
            {previewCanvases.map((imgSrc, idx) => (
              <div key={idx} className="flex flex-col items-center space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Página {idx + 1} de {previewTotalPages}
                </div>
                <div className="bg-white p-2 rounded shadow-md border max-w-full">
                  <img
                    src={imgSrc}
                    alt={`Página ${idx + 1}`}
                    className="max-h-[70vh] w-auto object-contain mx-auto"
                  />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
