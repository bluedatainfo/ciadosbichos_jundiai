import { useState, useCallback, useEffect } from 'react'
import { parseFile, ParseResult } from '@/lib/csv-parser'
import { EntityType, ENTITY_LABELS, FIELD_CONFIGS, validateRow } from '@/lib/import-config'
import { processImport, ImportReport as ImportReportType } from '@/services/import'
import {
  processAccessImport,
  AccessImportProgress,
  AccessImportReport as AccessImportReportType,
} from '@/services/access-import'
import { importProgressService, ImportProgressRecord } from '@/services/import-progress'
import { runAccessDateParserTests } from '@/lib/__tests__/access-date-parser.test'
import { runAccessRateLimitAsyncTests } from '@/lib/__tests__/access-rate-limit.test'
import { runAccessRangeImportTests } from '@/lib/__tests__/access-range-import.test'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/import/FileUpload'
import { FieldMapping } from '@/components/import/FieldMapping'
import { DataPreview } from '@/components/import/DataPreview'
import { ImportReport } from '@/components/import/ImportReport'
import { AccessDataPreview } from '@/components/import/AccessDataPreview'
import { AccessImportReportView } from '@/components/import/AccessImportReportView'
import { ReprocessFailuresModal } from '@/components/import/ReprocessFailuresModal'
import { importFailuresService, ImportFailureRecord } from '@/services/import-failures'
import {
  Users,
  PawPrint,
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Database,
  Sparkles,
  Play,
  FlaskConical,
  Layers,
  History,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type ImportMode = 'access_legacy' | 'standard'
type Step = 'select' | 'upload' | 'map' | 'preview' | 'importing' | 'report'
type AccessBatchSelection = 'range' | '50' | '200' | 'full'

const ENTITY_ICONS = {
  tutors: Users,
  patients: PawPrint,
  appointments: CalendarDays,
}

export default function Import() {
  const { toast } = useToast()
  const [mode, setMode] = useState<ImportMode>('access_legacy')
  const [step, setStep] = useState<Step>('select')
  const [entityType, setEntityType] = useState<EntityType | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Opções para importação do Access
  const [batchSelection, setBatchSelection] = useState<AccessBatchSelection>('range')
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1000)
  const [accessProgress, setAccessProgress] = useState<AccessImportProgress | null>(null)
  const [accessReport, setAccessReport] = useState<AccessImportReportType | null>(null)

  // Controle persistente de progresso ("Onde parei")
  const [savedProgress, setSavedProgress] = useState<ImportProgressRecord | null>(null)
  const [isLoadingProgress, setIsLoadingProgress] = useState(false)

  // Controle de Falhas Registradas no banco (import_failures)
  const [pendingFailuresCount, setPendingFailuresCount] = useState<number>(0)
  const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false)
  const [storedFailures, setStoredFailures] = useState<ImportFailureRecord[]>([])

  // Opções do modo standard
  const [standardProgress, setStandardProgress] = useState(0)
  const [standardReport, setStandardReport] = useState<ImportReportType | null>(null)

  // Carregar contagem de falhas do banco
  const loadFailuresCount = useCallback(async () => {
    try {
      const count = await importFailuresService.getPendingCount()
      setPendingFailuresCount(count)
      if (count > 0) {
        const list = await importFailuresService.getAllPendingFailures()
        setStoredFailures(list)
      } else {
        setStoredFailures([])
      }
    } catch (e) {
      console.warn('Erro ao carregar falhas:', e)
    }
  }, [])

  // Carregar progresso salvo ao inicializar ou quando mudar arquivo
  const loadSavedProgress = useCallback(
    async (currentFileName?: string) => {
      setIsLoadingProgress(true)
      try {
        const rec = await importProgressService.getLatestProgress(currentFileName)
        setSavedProgress(rec)
        await loadFailuresCount()
      } catch (e) {
        console.warn('Erro ao carregar progresso:', e)
      } finally {
        setIsLoadingProgress(false)
      }
    },
    [loadFailuresCount],
  )

  useEffect(() => {
    loadSavedProgress(fileName || undefined)
  }, [fileName, loadSavedProgress])

  // Detecta se os headers contêm as colunas típicas do Access
  const isAccessHeader = (headers: string[]) => {
    const upper = headers.map((h) => h.toUpperCase())
    const accessCols = ['CTRL', 'NOME', 'ANIM', 'ESPE', 'TEXTO']
    return accessCols.filter((c) => upper.includes(c)).length >= 3
  }

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name)
      const result = await parseFile(file)
      setParseResult(result)

      if (result.errors.length > 0) {
        toast({ title: 'Aviso', description: result.errors[0], variant: 'destructive' })
        if (result.headers.length === 0) return
      }

      // Validação rápida interna do parser de datas e rate limit
      try {
        const testCheck = runAccessDateParserTests()
        if (!testCheck.passed) {
          console.warn(
            'Alerta nos testes do parser de datas:',
            testCheck.results.filter((r) => !r.ok),
          )
        }
        runAccessRateLimitAsyncTests().then((res) => {
          if (!res.passed) {
            console.warn(
              'Alerta nos testes do rate limit/retry:',
              res.results.filter((r) => !r.ok),
            )
          }
        })
        runAccessRangeImportTests().then((res) => {
          if (!res.passed) {
            console.warn(
              'Alerta nos testes de importação por faixa:',
              res.results.filter((r) => !r.ok),
            )
          }
        })
      } catch (tErr) {
        console.warn('Erro ao verificar suite de testes:', tErr)
      }

      // Se estamos no modo Access legado OU se detectamos os cabeçalhos do Access
      const detectedAccess = isAccessHeader(result.headers)
      if (mode === 'access_legacy' || detectedAccess) {
        setMode('access_legacy')
        setStep('preview')

        // Checar progresso prévio deste arquivo
        try {
          const prev = await importProgressService.getLatestProgress(file.name)
          setSavedProgress(prev)
          if (prev && prev.last_processed_line > 0) {
            const nextStart = prev.last_processed_line + 1
            const nextEnd = Math.min(result.rows.length, nextStart + 999)
            setRangeStart(nextStart)
            setRangeEnd(nextEnd)
            setBatchSelection('range')
          } else {
            setRangeStart(1)
            setRangeEnd(Math.min(result.rows.length, 1000))
          }
        } catch (_) {
          setRangeStart(1)
          setRangeEnd(Math.min(result.rows.length, 1000))
        }

        toast({
          title: 'Arquivo Access Detectado',
          description: `${result.rows.length.toLocaleString('pt-BR')} registros carregados com sucesso.`,
        })
        return
      }

      // Modo padrão (tabelas individuais)
      const autoMap: Record<string, string> = {}
      const fields = entityType ? FIELD_CONFIGS[entityType] : []
      fields.forEach((f) => {
        const match = result.headers.find(
          (h) =>
            h.toLowerCase().includes(f.key.toLowerCase()) ||
            h.toLowerCase() === f.label.toLowerCase(),
        )
        if (match) autoMap[f.key] = match
      })
      setMapping(autoMap)
      setStep('map')
    },
    [entityType, mode, toast],
  )

  const handleStartAccessImport = async () => {
    if (!parseResult) return

    let effectiveStart: number | undefined
    let effectiveEnd: number | undefined
    let effectiveLimit: number | undefined

    if (batchSelection === 'range') {
      const safeStart = Math.max(1, Math.min(rangeStart || 1, parseResult.rows.length))
      const safeEnd = Math.max(safeStart, Math.min(rangeEnd || safeStart, parseResult.rows.length))
      effectiveStart = safeStart
      effectiveEnd = safeEnd
    } else if (batchSelection === '50') {
      effectiveLimit = 50
      effectiveStart = 1
      effectiveEnd = Math.min(50, parseResult.rows.length)
    } else if (batchSelection === '200') {
      effectiveLimit = 200
      effectiveStart = 1
      effectiveEnd = Math.min(200, parseResult.rows.length)
    } else {
      // 'full'
      effectiveStart = 1
      effectiveEnd = parseResult.rows.length
    }

    setStep('importing')

    try {
      const res = await processAccessImport(parseResult.rows, {
        limit: effectiveLimit,
        startIndex: effectiveStart,
        endIndex: effectiveEnd,
        batchSize: 25,
        onProgress: (p) => {
          setAccessProgress(p)
        },
      })

      // Gravar progresso persistente ao concluir a faixa
      const lastLine = res.rangeEnd || effectiveEnd || parseResult.rows.length
      try {
        const saved = await importProgressService.saveProgress({
          fileName,
          totalFileRows: parseResult.rows.length,
          lastProcessedLine: lastLine,
          lastRangeStart: res.rangeStart || effectiveStart,
          lastRangeEnd: res.rangeEnd || effectiveEnd,
          summary: {
            tutorsCreated: res.tutorsCreated,
            patientsCreated: res.patientsCreated,
            clinicalEntriesCreated: res.clinicalEntriesCreated,
            vaccinesCreated: res.vaccinesCreated,
            appointmentsCreated: res.appointmentsCreated,
            failed: res.failed,
          },
        })
        if (saved) {
          setSavedProgress(saved)
        }
      } catch (saveErr) {
        console.warn('Erro ao salvar progresso após conclusão:', saveErr)
      }

      setAccessReport(res)
      setStep('report')
      toast({
        title: res.failed === 0 ? 'Faixa importada com sucesso!' : 'Faixa concluída com pendências',
        description: `${res.patientsCreated} pacientes, ${res.tutorsCreated} tutores criados. Ponto de retomada gravado (linha ${lastLine}).`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro na importação',
        description: err.message || 'Falha ao processar arquivo.',
        variant: 'destructive',
      })
      setStep('preview')
    }
  }

  // Ação para continuar de onde parou
  const handleContinueFromWhereIStopped = () => {
    if (!parseResult) return
    const lastLine = savedProgress?.last_processed_line || 0
    const nextStart = lastLine + 1
    const nextEnd = Math.min(parseResult.rows.length, nextStart + 999)

    setBatchSelection('range')
    setRangeStart(nextStart)
    setRangeEnd(nextEnd)
    setStep('preview')

    toast({
      title: 'Próxima faixa pré-configurada!',
      description: `Linhas ${nextStart.toLocaleString('pt-BR')} a ${nextEnd.toLocaleString('pt-BR')} prontas para importação.`,
    })
  }

  // Ação para reiniciar / zerar progresso
  const handleClearProgress = async () => {
    if (
      confirm(
        'Deseja realmente zerar o ponto de retomada salvo para este arquivo? Isso redefinirá a contagem para a linha 1.',
      )
    ) {
      await importProgressService.clearProgress(fileName || undefined)
      setSavedProgress(null)
      setRangeStart(1)
      if (parseResult) {
        setRangeEnd(Math.min(1000, parseResult.rows.length))
      }
      toast({
        title: 'Progresso zerado',
        description: 'Você pode iniciar uma nova importação a partir da linha 1.',
      })
    }
  }

  const handleStartStandardImport = async () => {
    if (!entityType || !parseResult) return
    setStep('importing')
    setStandardProgress(0)

    const validRecords = parseResult.rows.map((row) => validateRow(entityType, row, mapping))
    const goodRecords = validRecords.filter((v) => v.valid)

    const result = await processImport(entityType, goodRecords, (curr, total) => {
      setStandardProgress(Math.round((curr / total) * 100))
    })
    setStandardReport(result)
    setStep('report')
    toast({
      title: result.success ? 'Sucesso!' : 'Importação concluída com avisos',
      description: `${result.created} registros criados, ${result.failed} falhas.`,
    })
  }

  const reset = () => {
    setStep('select')
    setEntityType(null)
    // Manter parseResult e fileName se o usuário estiver trabalhando no arquivo,
    // ou permitir novo arquivo se quiser
    setMapping({})
    setStandardProgress(0)
    setStandardReport(null)
    setAccessProgress(null)
    setAccessReport(null)
  }

  // Ao voltar do relatório de uma faixa para importar a próxima
  const handleContinueNextRangeFromReport = () => {
    if (!parseResult) return
    const lastLine = accessReport?.rangeEnd || savedProgress?.last_processed_line || rangeEnd
    const nextStart = lastLine + 1
    const nextEnd = Math.min(parseResult.rows.length, nextStart + 999)

    setBatchSelection('range')
    setRangeStart(nextStart)
    setRangeEnd(nextEnd)
    setStep('preview')
  }

  // Próxima faixa sugerida calculada
  const nextRangeSuggested =
    parseResult && (accessReport?.rangeEnd || savedProgress?.last_processed_line)
      ? {
          start: (accessReport?.rangeEnd || savedProgress?.last_processed_line || 0) + 1,
          end: Math.min(
            parseResult.rows.length,
            (accessReport?.rangeEnd || savedProgress?.last_processed_line || 0) + 1000,
          ),
        }
      : null

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-primary" /> Importação & Migração de Dados
          </h1>
          <p className="text-muted-foreground mt-1">
            Importe arquivos do sistema legado Access 2.0 (tabela única) ou arquivos CSV padrão.
          </p>
        </div>

        {/* Botão de Reprocessamento Global caso haja falhas no banco */}
        {pendingFailuresCount > 0 && (
          <Button
            onClick={() => setIsReprocessModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            Reprocessar Falhas ({pendingFailuresCount.toLocaleString('pt-BR')})
          </Button>
        )}
      </div>

      {step === 'select' && (
        <div className="space-y-6">
          {/* Card Principal: Migração do Access 2.0 */}
          <Card
            onClick={() => {
              setMode('access_legacy')
              setStep('upload')
            }}
            className="cursor-pointer border-2 border-primary/40 hover:border-primary hover:shadow-lg transition-all bg-gradient-to-r from-primary/5 via-white to-transparent p-2 group"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-md">
                  <Database className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      Migração do Sistema Legado (Access 2.0)
                    </h3>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Importa o arquivo delimitado com tabela única contendo colunas{' '}
                    <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono text-primary font-semibold">
                      NOME, ANIM, ESPE, NASC, PELA, TEXTO, VAC1-5...
                    </code>
                    . Cria cada paciente de forma individual por linha com chave composta única,
                    desduplicação inteligente de tutores, extração cronológica do histórico clínico
                    individualizado e vacinas.
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                    <strong>Suporta teste com lote pequeno (~50 registros)</strong> antes da base
                    completa de 21.000+.
                  </p>
                </div>
              </div>
              <Button className="shrink-0 gap-2 shadow-sm group-hover:translate-x-1 transition-transform">
                Iniciar Migração <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Seção secundária: importações manuais por tabela */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Ou selecione para importar tabelas individuais em formato CSV genérico:
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => {
                const Icon = ENTITY_ICONS[et]
                return (
                  <Card
                    key={et}
                    onClick={() => {
                      setMode('standard')
                      setEntityType(et)
                      setStep('upload')
                    }}
                    className="cursor-pointer border hover:border-slate-400 hover:shadow-sm transition-all"
                  >
                    <CardContent className="flex flex-col items-center gap-3 pt-6">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-slate-600" />
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{ENTITY_LABELS[et]}</p>
                      <span className="text-xs text-muted-foreground">CSV individual</span>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {mode === 'access_legacy' ? (
                <>
                  <Database className="w-5 h-5 text-primary" /> Enviar Arquivo Exportado do Access
                  2.0 (.csv ou .txt)
                </>
              ) : (
                `Enviar arquivo — ${entityType ? ENTITY_LABELS[entityType] : ''}`
              )}
            </CardTitle>
            {mode === 'access_legacy' && (
              <CardDescription className="text-xs">
                Selecione o arquivo exportado como texto delimitado por vírgula (ex:{' '}
                <code>BD_TESTE.csv</code> ou <code>BD_TESTE.txt</code>).
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload onFile={handleFile} fileName={fileName} />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('select')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo MAP (somente modo standard) */}
      {step === 'map' && mode === 'standard' && entityType && parseResult && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Mapeamento de Campos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldMapping
              entityType={entityType}
              headers={parseResult.headers}
              mapping={mapping}
              onMappingChange={(key, value) => setMapping({ ...mapping, [key]: value })}
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep('preview')}
                disabled={Object.keys(mapping).length === 0}
              >
                Prévia <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo PREVIEW (Modo Access Legado) */}
      {step === 'preview' && mode === 'access_legacy' && parseResult && (
        <Card className="border-none shadow-sm space-y-6">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Prévia da Migração & Configuração de
                  Faixa
                </CardTitle>
                <CardDescription>
                  Valide como os dados dos tutores, animais e atendimentos foram interpretados antes
                  de gravar no banco de dados.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-xs bg-slate-50 font-mono">
                {fileName || 'Arquivo Access'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* PAINEL PERSISTENTE: ONDE PAREI */}
            {savedProgress && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900">
                          Status da Migração: &ldquo;Onde Parei&rdquo;
                        </h4>
                        <Badge className="bg-emerald-600 text-white text-[11px] px-2 py-0.5">
                          {savedProgress.last_processed_line.toLocaleString('pt-BR')} linhas já
                          processadas
                        </Badge>
                        {savedProgress.file_name !== fileName && (
                          <Badge
                            variant="outline"
                            className="text-amber-700 bg-amber-50 text-[10px]"
                          >
                            Registro de outro arquivo ({savedProgress.file_name})
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Última conclusão:{' '}
                        <strong>
                          {new Date(
                            savedProgress.completed_at || savedProgress.updated,
                          ).toLocaleString('pt-BR')}
                        </strong>{' '}
                        (Faixa: {savedProgress.last_range_start || 1}–
                        {savedProgress.last_range_end || savedProgress.last_processed_line}).
                      </p>
                      {savedProgress.summary && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Totais da última faixa: {savedProgress.summary.patientsCreated || 0}{' '}
                          pacientes, {savedProgress.summary.tutorsCreated || 0} tutores,{' '}
                          {savedProgress.summary.clinicalEntriesCreated || 0} evoluções.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {savedProgress.last_processed_line < parseResult.rows.length ? (
                      <Button
                        size="sm"
                        onClick={handleContinueFromWhereIStopped}
                        className="bg-primary hover:bg-primary/90 text-white gap-1.5 shadow-sm text-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Continuar de onde parou ({savedProgress.last_processed_line + 1}–
                        {Math.min(
                          parseResult.rows.length,
                          savedProgress.last_processed_line + 1000,
                        )}
                        )
                      </Button>
                    ) : (
                      <Badge className="bg-green-600 text-white text-xs">
                        ✓ Todas as {parseResult.rows.length} linhas concluídas!
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleClearProgress}
                      className="text-slate-500 hover:text-red-600 text-xs gap-1"
                      title="Zerar progresso salvo e começar da linha 1"
                    >
                      <RotateCcw className="w-3 h-3" /> Zerar Progresso
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Configuração de Modo e Faixa de Linhas */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Escolha o Modo de Processamento
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Importe por faixas curtas e independentes (ex: 1.000 linhas) para evitar
                    travamento do navegador, ou use lotes de conferência rápida. A desduplicação por
                    chave de origem protege contra qualquer duplicidade.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  Total: {parseResult.rows.length.toLocaleString('pt-BR')} linhas
                </Badge>
              </div>

              <RadioGroup
                value={batchSelection}
                onValueChange={(val) => setBatchSelection(val as AccessBatchSelection)}
                className="grid gap-2.5 sm:grid-cols-4 pt-1"
              >
                {/* Opção 1: Faixa Customizada (Recomendada) */}
                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === 'range'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('range')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="range" id="opt-range" />
                    <Label
                      htmlFor="opt-range"
                      className="text-xs font-bold cursor-pointer text-slate-900"
                    >
                      Por Faixa de Linhas
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Sessões curtas de 1.000 linhas (1–1.000, 1.001–2.000...)
                  </p>
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] w-fit mt-2 ml-6">
                    Recomendado
                  </Badge>
                </div>

                {/* Opção 2: Teste Pequeno 50 */}
                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === '50'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('50')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="50" id="opt-50" />
                    <Label
                      htmlFor="opt-50"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Teste Rápido (50 linhas)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Conferência rápida da estrutura e desduplicação
                  </p>
                </div>

                {/* Opção 3: Intermediário 200 */}
                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === '200'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('200')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="200" id="opt-200" />
                    <Label
                      htmlFor="opt-200"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Intermediário (200 linhas)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Teste mais amplo antes de lotes maiores
                  </p>
                </div>

                {/* Opção 4: Completo */}
                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === 'full'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('full')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="opt-full" />
                    <Label
                      htmlFor="opt-full"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Base Completa ({parseResult.rows.length.toLocaleString()})
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Processa todo o arquivo em uma única sessão
                  </p>
                </div>
              </RadioGroup>

              {/* Controles de Intervalo quando 'range' estiver ativo */}
              {batchSelection === 'range' && (
                <div className="mt-3 p-3.5 bg-white rounded-lg border border-primary/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-slate-800">
                        Intervalo de Linhas a Processar (1-based)
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Defina o número inicial e final do arquivo delimitado. Tamanho padrão: 1.000
                        linhas.
                      </p>
                    </div>

                    {/* Atalhos rápidos de faixa */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-medium">Faixas comuns:</span>
                      {[
                        { label: '1–1.000', s: 1, e: 1000 },
                        { label: '1.001–2.000', s: 1001, e: 2000 },
                        { label: '2.001–3.000', s: 2001, e: 3000 },
                        { label: '3.001–4.000', s: 3001, e: 4000 },
                      ].map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            setRangeStart(preset.s)
                            setRangeEnd(Math.min(parseResult.rows.length, preset.e))
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="range-start" className="text-xs font-medium text-slate-700">
                        Linha Inicial:
                      </Label>
                      <Input
                        id="range-start"
                        type="number"
                        min={1}
                        max={parseResult.rows.length}
                        value={rangeStart}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1
                          setRangeStart(val)
                          if (rangeEnd < val) {
                            setRangeEnd(Math.min(parseResult.rows.length, val + 999))
                          }
                        }}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="range-end" className="text-xs font-medium text-slate-700">
                        Linha Final:
                      </Label>
                      <Input
                        id="range-end"
                        type="number"
                        min={rangeStart}
                        max={parseResult.rows.length}
                        value={rangeEnd}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || rangeStart
                          setRangeEnd(Math.min(parseResult.rows.length, Math.max(val, rangeStart)))
                        }}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t">
                    <span className="flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Registros nesta sessão:{' '}
                      <strong className="text-slate-900">
                        {Math.max(0, rangeEnd - rangeStart + 1).toLocaleString('pt-BR')} linhas
                      </strong>{' '}
                      (do total de {parseResult.rows.length.toLocaleString('pt-BR')})
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Linhas {rangeStart.toLocaleString('pt-BR')} até{' '}
                      {rangeEnd.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Componente de Prévia dos Dados Filtrados pela Faixa */}
            <AccessDataPreview
              rows={parseResult.rows}
              limit={batchSelection === '50' ? 50 : batchSelection === '200' ? 200 : 50}
              rangeStart={batchSelection === 'range' ? rangeStart : 1}
              rangeEnd={
                batchSelection === 'range'
                  ? rangeEnd
                  : batchSelection === '50'
                    ? 50
                    : batchSelection === '200'
                      ? 200
                      : parseResult.rows.length
              }
              isRangeMode={batchSelection === 'range'}
            />

            {/* Ações Inferiores */}
            <div className="flex justify-between items-center pt-2 flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Escolher Outro Arquivo
              </Button>
              <Button onClick={handleStartAccessImport} className="bg-primary gap-2 shadow-md">
                <Play className="w-4 h-4" />
                {batchSelection === 'range'
                  ? `Iniciar Importação da Faixa (${rangeStart}–${rangeEnd}: ${Math.max(0, rangeEnd - rangeStart + 1)} linhas)`
                  : batchSelection === '50'
                    ? 'Iniciar Importação do Lote de Teste (50 linhas)'
                    : batchSelection === '200'
                      ? 'Iniciar Importação do Lote Intermediário (200 linhas)'
                      : `Iniciar Importação Completa (${parseResult.rows.length.toLocaleString()} linhas)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo PREVIEW (Modo Standard) */}
      {step === 'preview' && mode === 'standard' && entityType && parseResult && (
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Prévia e Validação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DataPreview entityType={entityType} rows={parseResult.rows} mapping={mapping} />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('map')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleStartStandardImport} className="bg-primary">
                Iniciar Importação <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo IMPORTING */}
      {step === 'importing' && (
        <Card className="border-none shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg text-slate-800">
                {mode === 'access_legacy'
                  ? 'Processando migração em lotes...'
                  : 'Processando importação...'}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {mode === 'access_legacy'
                  ? 'Desduplicando tutores, gerando chave composta dos animais e vinculando históricos clínicos e vacinas a cada paciente individual.'
                  : 'Gravando registros no banco de dados.'}
              </p>
            </div>

            <div className="w-full max-w-md space-y-2">
              <Progress
                value={mode === 'access_legacy' ? accessProgress?.percent || 0 : standardProgress}
                className="w-full h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {mode === 'access_legacy'
                    ? accessProgress?.statusMessage || 'Iniciando...'
                    : `${standardProgress}% concluído`}
                </span>
                <span className="font-semibold">
                  {mode === 'access_legacy'
                    ? `${accessProgress?.percent || 0}%`
                    : `${standardProgress}%`}
                </span>
              </div>
            </div>

            {mode === 'access_legacy' && accessProgress && (
              <div className="grid grid-cols-5 gap-2 w-full max-w-xl mt-4 text-center">
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-blue-700">{accessProgress.tutorsCreated}</p>
                  <p className="text-[10px] text-slate-500">Tutores</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-emerald-700">{accessProgress.patientsCreated}</p>
                  <p className="text-[10px] text-slate-500">Pacientes</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-amber-700">
                    {accessProgress.clinicalEntriesCreated}
                  </p>
                  <p className="text-[10px] text-slate-500">Evoluções</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-purple-700">{accessProgress.vaccinesCreated}</p>
                  <p className="text-[10px] text-slate-500">Vacinas</p>
                </div>
                <div className="p-2 bg-slate-50 rounded border text-xs">
                  <p className="font-bold text-teal-700">
                    {accessProgress.appointmentsCreated || 0}
                  </p>
                  <p className="text-[10px] text-slate-500">Retornos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Passo REPORT */}
      {step === 'report' && (
        <>
          {mode === 'access_legacy' && accessReport && (
            <AccessImportReportView
              report={accessReport}
              onRestart={() => setStep('preview')}
              onContinueNextRange={handleContinueNextRangeFromReport}
              nextRangeSuggested={nextRangeSuggested}
              rawRows={parseResult?.rows}
              onReprocessSuccess={(rec) => {
                loadFailuresCount()
                if (accessReport) {
                  setAccessReport({
                    ...accessReport,
                    clinicalEntriesCreated: accessReport.clinicalEntriesCreated + rec,
                    failed: Math.max(0, accessReport.failed - rec),
                  })
                }
              }}
            />
          )}
          {mode === 'standard' && standardReport && entityType && (
            <ImportReport report={standardReport} entityType={entityType} onRestart={reset} />
          )}
        </>
      )}
      {/* Modal de Reprocessamento de Falhas */}
      <ReprocessFailuresModal
        open={isReprocessModalOpen}
        onOpenChange={setIsReprocessModalOpen}
        rawRows={parseResult?.rows}
        initialFailures={storedFailures}
        onFailuresResolved={async () => {
          await loadFailuresCount()
        }}
      />
    </div>
  )
}
