import React, { useState, useCallback, useEffect, useRef } from 'react'
import { parseFile, parseMultipleFiles, ParseResult } from '@/lib/csv-parser'
import { EntityType, ENTITY_LABELS, FIELD_CONFIGS, validateRow } from '@/lib/import-config'
import { processImport, ImportReport as ImportReportType } from '@/services/import'
import {
  processAccessImport,
  AccessImportProgress,
  AccessImportReport as AccessImportReportType,
} from '@/services/access-import'
import {
  ServerImportFinalReport,
  ServerImportProgress,
  serverImportPipelineService,
} from '@/services/server-import-pipeline'
import { ServerImportReportView } from '@/components/import/ServerImportReportView'
import { ComplementaryImportReportView } from '@/components/import/ComplementaryImportReportView'
import {
  complementaryImportPipelineService,
  ComplementaryImportProgress,
  ComplementaryImportFinalReport,
} from '@/services/complementary-import-pipeline'
import {
  incrementalSyncService,
  SyncBalanceSummary,
  SyncProgress,
  SyncResultReport as SyncResultReportType,
} from '@/services/incremental-sync'
import { SyncBalanceReportView } from '@/components/import/SyncBalanceReportView'
import { SyncResultReportView } from '@/components/import/SyncResultReportView'
import { importProgressService, ImportProgressRecord } from '@/services/import-progress'
import { runAccessDateParserTests } from '@/lib/__tests__/access-date-parser.test'
import { runAccessRateLimitAsyncTests } from '@/lib/__tests__/access-rate-limit.test'
import { runAccessRangeImportTests } from '@/lib/__tests__/access-range-import.test'
import { runSyncHashUtilsTests } from '@/lib/__tests__/sync-hash-utils.test'
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
  Upload,
  Scale,
  GitCompare,
  Pause,
  ShieldCheck,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type ImportMode =
  | 'server_reload'
  | 'access_legacy'
  | 'standard'
  | 'incremental_sync'
  | 'complementary'
type Step = 'select' | 'upload' | 'map' | 'preview' | 'sync_balance' | 'importing' | 'report'
type AccessBatchSelection = 'range' | '50' | '200' | 'full'

const ENTITY_ICONS = {
  tutors: Users,
  patients: PawPrint,
  appointments: CalendarDays,
}

export default function Import() {
  const { toast } = useToast()
  const [mode, setMode] = useState<ImportMode>('server_reload')
  const [step, setStep] = useState<Step>('select')
  const [entityType, setEntityType] = useState<EntityType | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [fileCount, setFileCount] = useState<number>(1)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  // Estados do Pipeline de Servidor (Wipe Prévio + Recarga Completa)
  const [serverImportProgress, setServerImportProgress] = useState<ServerImportProgress | null>(
    null,
  )
  const [serverImportReport, setServerImportReport] = useState<ServerImportFinalReport | null>(null)

  // Estados da Importação Complementar (TEL3 / Débito)
  const [complementaryProgress, setComplementaryProgress] =
    useState<ComplementaryImportProgress | null>(null)
  const [complementaryReport, setComplementaryReport] =
    useState<ComplementaryImportFinalReport | null>(null)

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

  // Estados específicos da Sincronização Incremental
  const [syncBalance, setSyncBalance] = useState<SyncBalanceSummary | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [syncReport, setSyncReport] = useState<SyncResultReportType | null>(null)
  const [isAnalyzingBalance, setIsAnalyzingBalance] = useState(false)
  const [balanceAnalysisProgress, setBalanceAnalysisProgress] = useState<{
    percent: number
    message: string
  }>({
    percent: 0,
    message: '',
  })
  const [isSyncPaused, setIsSyncPaused] = useState(false)
  const pauseSyncRef = useRef(false)

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

  const handleMultipleFiles = useCallback(
    async (files: File[]) => {
      const summaryName =
        files.length > 1
          ? `${files.length} partes (${files.map((f) => f.name).join(', ')})`
          : files[0]?.name || ''
      setFileName(summaryName)
      setFileCount(files.length)
      const result = await parseMultipleFiles(files)
      setParseResult(result)

      if (result.errors.length > 0) {
        toast({ title: 'Aviso', description: result.errors[0], variant: 'destructive' })
        if (result.headers.length === 0) return
      }

      // Se estamos no modo de recarga no servidor (padrão)
      const detectedAccess = isAccessHeader(result.headers)
      if (mode === 'complementary') {
        setStep('preview')
        toast({
          title: 'Arquivo DADOS.TXT Carregado',
          description: `${result.rows.length.toLocaleString('pt-BR')} registros prontos para Importação Complementar (TEL3 / Débito).`,
        })
        return
      }

      if (mode === 'server_reload' || detectedAccess) {
        if (mode === 'incremental_sync') {
          setMode('incremental_sync')
          setStep('preview')
          setRangeStart(1)
          setRangeEnd(Math.min(result.rows.length, 1000))
          toast({
            title: 'Arquivos Carregados para Sincronização',
            description: `${result.rows.length.toLocaleString('pt-BR')} registros combinados em ${files.length} partes.`,
          })
          return
        }

        if (mode === 'access_legacy') {
          setMode('access_legacy')
          setStep('preview')
          setRangeStart(1)
          setRangeEnd(Math.min(result.rows.length, 1000))
          toast({
            title: 'Arquivo Access Detectado',
            description: `${result.rows.length.toLocaleString('pt-BR')} registros combinados a partir de ${files.length} partes.`,
          })
          return
        }

        // Padrão: server_reload
        setMode('server_reload')
        setStep('preview')
        toast({
          title: 'Arquivo Completo Carregado',
          description: `${result.rows.length.toLocaleString('pt-BR')} registros prontos para limpeza prévia e recarga oficial no servidor.`,
        })
        return
      }
    },
    [mode, toast],
  )

  const handleFile = useCallback(
    async (file: File) => {
      setFileCount(1)
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
        const syncHashCheck = runSyncHashUtilsTests()
        if (!syncHashCheck.passed) {
          console.warn(
            'Alerta nos testes do gerador de hashes da sincronização:',
            syncHashCheck.results.filter((r) => !r.ok),
          )
        }
      } catch (tErr) {
        console.warn('Erro ao verificar suite de testes:', tErr)
      }

      // Se estamos no modo de recarga no servidor (padrão)
      const detectedAccess = isAccessHeader(result.headers)
      if (mode === 'complementary') {
        setStep('preview')
        toast({
          title: 'Arquivo DADOS.TXT Carregado',
          description: `${result.rows.length.toLocaleString('pt-BR')} registros prontos para Importação Complementar (TEL3 / Débito).`,
        })
        return
      }

      if (mode === 'server_reload' || detectedAccess) {
        if (mode === 'incremental_sync') {
          setMode('incremental_sync')
          setStep('preview')
          setRangeStart(1)
          setRangeEnd(Math.min(result.rows.length, 1000))
          toast({
            title: 'Arquivo Carregado para Sincronização',
            description: `${result.rows.length.toLocaleString('pt-BR')} registros prontos para comparação incremental.`,
          })
          return
        }

        if (mode === 'access_legacy') {
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

        // Padrão: server_reload
        setMode('server_reload')
        setStep('preview')
        toast({
          title: 'Arquivo Completo Carregado',
          description: `${result.rows.length.toLocaleString('pt-BR')} registros prontos para limpeza prévia e recarga oficial no servidor.`,
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

  // Executar a Carga Oficial pelo Pipeline de Servidor (Wipe Primeiro, Depois Carga)
  const handleStartServerReload = async () => {
    if (!parseResult || !parseResult.rows.length) return

    const confirmMsg =
      'ATENÇÃO: Esta ação executará a limpeza completa (wipe) de pacientes, tutores, prontuários, vacinas, retornos e logs de teste no banco de dados, preservando exclusivamente o administrador bluedata@bluedatainfo.com.br. Em seguida, o arquivo completo será importado diretamente no servidor. Deseja prosseguir?'

    if (!confirm(confirmMsg)) {
      return
    }

    setStep('importing')
    setServerImportProgress({
      phase: 'wiping',
      current: 0,
      total: parseResult.rows.length,
      percent: 0,
      statusMessage: 'Iniciando limpeza prévia da base no servidor...',
      counts: {
        tutorsCreated: 0,
        tutorsReused: 0,
        patientsCreated: 0,
        patientsWithNume: 0,
        patientsWithoutNume: 0,
        clinicalCreated: 0,
        vaccinesCreated: 0,
        appointmentsCreated: 0,
        failed: 0,
      },
    })

    try {
      const finalRep = await serverImportPipelineService.executeFullServerImport(parseResult.rows, {
        batchSize: 200,
        onProgress: (p) => {
          setServerImportProgress(p)
        },
      })

      setServerImportReport(finalRep)
      setStep('report')
      toast({
        title: finalRep.success
          ? 'Recarga Oficial Concluída com Sucesso!'
          : 'Recarga Concluída com Pendências',
        description: `${finalRep.counts.patientsCreated} pacientes (${finalRep.counts.patientsWithNume} com NUME, ${finalRep.counts.patientsWithoutNume} sem NUME) e ${finalRep.counts.tutorsCreated} tutores criados.`,
      })
    } catch (err: any) {
      console.error('Falha no pipeline de servidor:', err)
      toast({
        title: 'Erro na recarga de servidor',
        description: err.message || 'Falha ao executar pipeline no servidor.',
        variant: 'destructive',
      })
      setStep('preview')
    }
  }

  // Executar a Importação Complementar (TEL3 / Débito) no Servidor
  const handleStartComplementaryImport = async () => {
    if (!parseResult || !parseResult.rows.length) return

    setStep('importing')
    setComplementaryProgress({
      current: 0,
      total: parseResult.rows.length,
      percent: 0,
      statusMessage: 'Iniciando casamento de tutores e preenchimento de campos vazios...',
      counts: {
        linesRead: 0,
        tutorsMatched: 0,
        fieldsFilled: 0,
        notMatched: 0,
        tel3Filled: 0,
        dbdtFilled: 0,
        dbtxFilled: 0,
        skippedAlreadyFilled: 0,
      },
    })

    try {
      const finalRep = await complementaryImportPipelineService.executeComplementaryImport(
        parseResult.rows,
        {
          batchSize: 250,
          onProgress: (p) => {
            setComplementaryProgress(p)
          },
        },
      )

      setComplementaryReport(finalRep)
      setStep('report')
      toast({
        title: 'Importação Complementar Concluída!',
        description: `${finalRep.counts.tutorsMatched} tutores casados, ${finalRep.counts.fieldsFilled} campos preenchidos.`,
      })
    } catch (err: any) {
      console.error('Falha na importação complementar:', err)
      toast({
        title: 'Erro na importação complementar',
        description: err.message || 'Falha ao executar carga no servidor.',
        variant: 'destructive',
      })
      setStep('preview')
    }
  }

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

  // Executar Análise de Balanceamento da Sincronização
  const handleAnalyzeSyncBalance = async () => {
    if (!parseResult) return

    let effectiveStart = 1
    let effectiveEnd = parseResult.rows.length
    if (batchSelection === 'range') {
      effectiveStart = Math.max(1, Math.min(rangeStart || 1, parseResult.rows.length))
      effectiveEnd = Math.max(
        effectiveStart,
        Math.min(rangeEnd || effectiveStart, parseResult.rows.length),
      )
    } else if (batchSelection === '50') {
      effectiveEnd = Math.min(50, parseResult.rows.length)
    } else if (batchSelection === '200') {
      effectiveEnd = Math.min(200, parseResult.rows.length)
    }

    setIsAnalyzingBalance(true)
    setBalanceAnalysisProgress({ percent: 0, message: 'Iniciando análise incremental...' })

    try {
      const summary = await incrementalSyncService.analyzeBalance(parseResult.rows, {
        startIndex: effectiveStart,
        endIndex: effectiveEnd,
        onProgress: (percent, message) => {
          setBalanceAnalysisProgress({ percent, message })
        },
      })
      setSyncBalance(summary)
      setStep('sync_balance')
    } catch (err: any) {
      toast({
        title: 'Erro na análise de balanceamento',
        description: err.message || 'Falha ao comparar base oficial.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzingBalance(false)
    }
  }

  // Executar a Aplicação Real da Sincronização Incremental
  const handleConfirmAndApplySync = async () => {
    if (!parseResult || !syncBalance) return

    let effectiveStart = 1
    let effectiveEnd = parseResult.rows.length
    if (batchSelection === 'range') {
      effectiveStart = Math.max(1, Math.min(rangeStart || 1, parseResult.rows.length))
      effectiveEnd = Math.max(
        effectiveStart,
        Math.min(rangeEnd || effectiveStart, parseResult.rows.length),
      )
    } else if (batchSelection === '50') {
      effectiveEnd = Math.min(50, parseResult.rows.length)
    } else if (batchSelection === '200') {
      effectiveEnd = Math.min(200, parseResult.rows.length)
    }

    pauseSyncRef.current = false
    setIsSyncPaused(false)
    setStep('importing')

    try {
      const rep = await incrementalSyncService.applySync(parseResult.rows, syncBalance, {
        startIndex: effectiveStart,
        endIndex: effectiveEnd,
        batchSize: 200,
        onProgress: (p) => {
          setSyncProgress(p)
          // Salvar progresso contínuo
          incrementalSyncService.savePersistedState({
            fileName,
            totalRows: parseResult.rows.length,
            lastProcessedLine: effectiveStart + p.current - 1,
            balance: syncBalance,
            progress: p,
            timestamp: new Date().toISOString(),
          })
        },
        shouldPause: () => pauseSyncRef.current,
      })

      setSyncReport(rep)
      setStep('report')

      toast({
        title: rep.success
          ? 'Sincronização Finalizada com Sucesso!'
          : 'Sincronização Concluída com Avisos',
        description: `${rep.applied.patientsUpdated} pacientes atualizados, ${rep.applied.patientsCreated} criados diretamente no servidor em ${rep.durationSeconds}s.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro durante a sincronização',
        description: err.message || 'Falha ao aplicar alterações.',
        variant: 'destructive',
      })
      setStep('sync_balance')
    }
  }

  const handlePauseSync = () => {
    pauseSyncRef.current = true
    setIsSyncPaused(true)
    toast({
      title: 'Sincronização Pausada',
      description:
        'O processo será pausado ao concluir o lote atual no servidor. O progresso foi preservado e você pode retomar a qualquer momento.',
    })
  }

  const reset = () => {
    setStep('select')
    setEntityType(null)
    setMapping({})
    setMode('server_reload')
    setStandardProgress(0)
    setStandardReport(null)
    setAccessProgress(null)
    setAccessReport(null)
    setServerImportProgress(null)
    setServerImportReport(null)
    setComplementaryProgress(null)
    setComplementaryReport(null)
    setSyncBalance(null)
    setSyncProgress(null)
    setSyncReport(null)
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

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Botão sempre visível para carregar CSV de pendências mesmo com 0 falhas no banco */}
          <Button
            variant="outline"
            onClick={() => setIsReprocessModalOpen(true)}
            className="gap-2 shadow-sm shrink-0 border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            <Upload className="w-4 h-4 text-primary" />
            Carregar CSV de Falhas
          </Button>

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
      </div>

      {step === 'select' && (
        <div className="space-y-6">
          {/* Card em Destaque: Importação Complementar (TEL3 / Débito) */}
          <Card
            onClick={() => {
              setMode('complementary')
              setStep('upload')
            }}
            className="cursor-pointer border-2 border-indigo-600 hover:border-indigo-700 hover:shadow-xl transition-all bg-gradient-to-r from-indigo-500/15 via-white to-indigo-500/5 p-2 group ring-1 ring-indigo-500/30"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-md">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">
                      Importação Complementar (TEL3 / Débito)
                    </h3>
                    <Badge className="bg-indigo-600 text-white font-semibold">
                      Novo • Produção Segura
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Casa cada linha do arquivo <code>DADOS.TXT</code> (~21.296 linhas) com o tutor
                    já existente no sistema pela regra prioritária{' '}
                    <strong>NUME &gt; import_key</strong> (sem usar CTRL). Preenche{' '}
                    <strong>SOMENTE campos vazios</strong> de <code>tel3</code>,{' '}
                    <code>dbdt_flag</code> (quando DBDT=-1) e <code>dbtx</code>.
                    <br />
                    <strong className="text-slate-800">
                      NUNCA sobrescreve dados já cadastrados
                    </strong>{' '}
                    e{' '}
                    <strong className="text-slate-800">NÃO cria novos tutores ou pacientes</strong>.
                    Todas as alterações geram auditoria (anterior → novo).
                  </p>
                  <p className="text-xs text-indigo-800 font-medium flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    Processamento seguro em segundo plano no servidor nativo com exibição dos totais
                    de conferência.
                  </p>
                </div>
              </div>
              <Button className="shrink-0 gap-2 shadow-md bg-indigo-600 hover:bg-indigo-700 text-white group-hover:translate-x-1 transition-transform font-bold">
                Carga Complementar <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card em Destaque 1: Recarga Oficial no Servidor com Limpeza Prévia (Wipe Primeiro) */}
          <Card
            onClick={() => {
              setMode('server_reload')
              setStep('upload')
            }}
            className="cursor-pointer border-2 border-emerald-600 hover:border-emerald-700 hover:shadow-xl transition-all bg-gradient-to-r from-emerald-500/15 via-white to-emerald-500/5 p-2 group ring-1 ring-emerald-500/30"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-md">
                  <Zap className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">
                      Recarga Oficial no Servidor (Arquivo Completo com NUME)
                    </h3>
                    <Badge className="bg-emerald-600 text-white font-semibold">
                      Fluxo Oficial Recomendado
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    <strong>1. Zera completamente a base</strong> de pacientes, tutores, fichas,
                    vacinas, agendamentos e logs de teste (preserva apenas o administrador{' '}
                    <code>bluedata@bluedatainfo.com.br</code> e as configurações da clínica).
                    <br />
                    <strong>2. Processa e grava o arquivo inteiro no servidor</strong> com os campos{' '}
                    <code>nume</code>, <code>import_key</code> e <code>import_hash</code>,
                    conferindo que 100% dos pacientes possuam NUME preenchido.
                  </p>
                  <p className="text-xs text-emerald-800 font-medium flex items-center gap-1.5 pt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Arquivo único enviado inteiro sem divisão em partes — alta performance direta no
                    SQLite nativo.
                  </p>
                </div>
              </div>
              <Button className="shrink-0 gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white group-hover:translate-x-1 transition-transform font-bold">
                Iniciar Recarga Oficial <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Sincronização Incremental */}
          <Card
            onClick={() => {
              setMode('incremental_sync')
              setStep('upload')
            }}
            className="cursor-pointer border border-slate-300 hover:border-slate-400 hover:shadow-md transition-all bg-white p-2 group"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 group-hover:bg-slate-200 transition-colors shadow-sm">
                  <GitCompare className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900">
                      Sincronização Incremental (Pós-Carga Oficial)
                    </h3>
                    <Badge variant="outline" className="text-slate-600">
                      Modo Comparativo
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Compara uma cópia do Access com os dados já existentes no sistema.{' '}
                    <strong>Pula idênticos</strong>,{' '}
                    <strong>atualiza divergentes com auditoria</strong> (&ldquo;vale o do
                    arquivo&rdquo;) e <strong>cria novos</strong>. Deve ser executada apenas após
                    conferir o preview e o relatório de balanceamento.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="shrink-0 gap-2 shadow-sm group-hover:translate-x-1 transition-transform"
              >
                Sincronizar <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Migração Completa Inicial do Access 2.0 */}
          <Card
            onClick={() => {
              setMode('access_legacy')
              setStep('upload')
            }}
            className="cursor-pointer border border-slate-300 hover:border-primary hover:shadow-md transition-all bg-white p-2 group"
          >
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors shadow-sm">
                  <Database className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      Importação Completa do Sistema Legado (Access 2.0)
                    </h3>
                    <Badge variant="outline" className="text-slate-600">
                      Carga Inicial
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Importação sequencial de todas as linhas de um arquivo limpo do Access por
                    faixas (ex: 1–1.000, 1.001–2.000). Cria todos os tutores, pacientes, fichas
                    clínicas, vacinas e agendamentos.
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                    <strong>Suporta teste com lote pequeno (~50 registros)</strong> antes da base
                    completa.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="shrink-0 gap-2 shadow-sm group-hover:translate-x-1 transition-transform"
              >
                Carga Completa <ArrowRight className="w-4 h-4" />
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
              {mode === 'complementary' ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Enviar Arquivo DADOS.TXT
                  (Importação Complementar)
                </>
              ) : mode === 'server_reload' ? (
                <>
                  <Zap className="w-5 h-5 text-emerald-600" /> Enviar Arquivo Completo de 12/10
                  (.csv ou .txt)
                </>
              ) : mode === 'access_legacy' ? (
                <>
                  <Database className="w-5 h-5 text-primary" /> Enviar Arquivo Exportado do Access
                  2.0 (.csv ou .txt)
                </>
              ) : (
                `Enviar arquivo — ${entityType ? ENTITY_LABELS[entityType] : ''}`
              )}
            </CardTitle>
            {mode === 'complementary' && (
              <CardDescription className="text-xs">
                Selecione o arquivo <code>DADOS.TXT</code> original da clínica (~21.296 linhas). O
                sistema cruzará os dados com os tutores e pacientes já existentes e preencherá
                somente campos vazios de Telefone 3 e Débito.
              </CardDescription>
            )}
            {mode === 'server_reload' && (
              <CardDescription className="text-xs">
                Envie o arquivo completo de uma única vez (sem dividir em partes). O sistema fará a
                limpeza prévia e a importação pelo servidor nativo.
              </CardDescription>
            )}
            {mode === 'access_legacy' && (
              <CardDescription className="text-xs">
                Selecione o arquivo exportado como texto delimitado por vírgula (ex:{' '}
                <code>BD_TESTE.csv</code> ou <code>BD_TESTE.txt</code>).
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUpload
              onFile={handleFile}
              onFiles={handleMultipleFiles}
              fileName={fileName}
              fileCount={fileCount}
            />
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep('select')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo PREVIEW (Modo Importação Complementar) */}
      {step === 'preview' && mode === 'complementary' && parseResult && (
        <Card className="border-none shadow-sm space-y-6">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Prévia da Importação
                  Complementar (TEL3 / Débito)
                </CardTitle>
                <CardDescription>
                  Confira as linhas lidas do arquivo DADOS.TXT antes de iniciar o cruzamento no
                  servidor.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="w-fit text-xs bg-indigo-50 text-indigo-800 border-indigo-300 font-mono"
              >
                {fileName || 'DADOS.TXT'} ({parseResult.rows.length.toLocaleString('pt-BR')} linhas)
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 space-y-2">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                Regras de Proteção em Produção Ativas
              </div>
              <ul className="text-xs text-indigo-900 leading-relaxed list-disc list-inside space-y-1">
                <li>
                  <strong>Casamento estrito:</strong> NUME oficial &gt; import_key (o campo CTRL não
                  é usado como referência).
                </li>
                <li>
                  <strong>Proteção de dados existentes:</strong> preenche SOMENTE campos vazios de{' '}
                  <code>tel3</code>, <code>dbdt_flag</code> (quando DBDT=-1) e <code>dbtx</code>.
                  Nunca sobrescreve nada já preenchido em produção.
                </li>
                <li>
                  <strong>Sem criação de novos registros:</strong> linhas sem casamento serão apenas
                  contadas e reportadas.
                </li>
                <li>
                  <strong>Rastreabilidade total:</strong> cada alteração gerará registro na
                  auditoria com os valores anterior e novo.
                </li>
              </ul>
            </div>

            {/* Prévia dos Dados */}
            <AccessDataPreview
              rows={parseResult.rows}
              limit={50}
              rangeStart={1}
              rangeEnd={Math.min(50, parseResult.rows.length)}
              isRangeMode={false}
            />

            {/* Ações Inferiores */}
            <div className="flex justify-between items-center pt-2 flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Escolher Outro Arquivo
              </Button>
              <Button
                onClick={handleStartComplementaryImport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg font-bold px-6 text-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                Iniciar Carga Complementar ({parseResult.rows.length.toLocaleString('pt-BR')}{' '}
                linhas)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo PREVIEW (Modo Recarga Oficial no Servidor) */}
      {step === 'preview' && mode === 'server_reload' && parseResult && (
        <Card className="border-none shadow-sm space-y-6">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Zap className="w-5 h-5 text-emerald-600" /> Prévia da Recarga Oficial no Servidor
                </CardTitle>
                <CardDescription>
                  Confira as linhas lidas do arquivo completo antes de executar a limpeza prévia e o
                  processamento no servidor.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="w-fit text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-mono"
              >
                {fileName || 'Arquivo Oficial'} ({parseResult.rows.length.toLocaleString('pt-BR')}{' '}
                linhas)
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                Aviso de Limpeza Completa Prévia (Wipe Obrigatório)
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Ao clicar em &ldquo;Zerar Base e Iniciar Carga no Servidor&rdquo;, o servidor
                primeiro apagará completamente todas as duplicações e dados das cargas anteriores de
                teste (pacientes, tutores, fichas, vacinas, retornos, agendamentos, logs de
                auditoria e tabelas de trabalho de deduplicação). Apenas o usuário administrador{' '}
                <strong>bluedata@bluedatainfo.com.br</strong> com a sua senha atual e as
                configurações da clínica serão preservados.
              </p>
            </div>

            {/* Prévia dos Dados */}
            <AccessDataPreview
              rows={parseResult.rows}
              limit={50}
              rangeStart={1}
              rangeEnd={Math.min(50, parseResult.rows.length)}
              isRangeMode={false}
            />

            {/* Ações Inferiores */}
            <div className="flex justify-between items-center pt-2 flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setStep('upload')}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Escolher Outro Arquivo
              </Button>
              <Button
                onClick={handleStartServerReload}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg font-bold px-6 text-sm"
              >
                <Zap className="w-4 h-4" />
                Zerar Base e Iniciar Carga no Servidor (
                {parseResult.rows.length.toLocaleString('pt-BR')} linhas)
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

      {/* Passo PREVIEW (Modo Sincronização Incremental) */}
      {step === 'preview' && mode === 'incremental_sync' && parseResult && (
        <Card className="border-none shadow-sm space-y-6">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-emerald-600" /> Sincronização Incremental:
                  Configuração da Faixa
                </CardTitle>
                <CardDescription>
                  Selecione as linhas do arquivo oficial para comparação registro a registro. Na
                  próxima etapa você verá o balanço prévio antes de aplicar ao banco de dados.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="w-fit text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-mono"
              >
                {fileName || 'Arquivo Oficial'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-indigo-950">
                  Regra do Usuário: &ldquo;Vale o do arquivo&rdquo;
                </p>
                <p className="text-indigo-800 leading-relaxed">
                  Registros idênticos serão pulados; registros divergentes serão atualizados com os
                  dados da base oficial (com registro na Auditoria); novos serão inseridos
                  completos; registros existentes no sistema ausentes no arquivo serão mantidos
                  intactos.
                </p>
              </div>
            </div>

            {/* Configuração de Faixa */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" /> Faixa de Linhas para
                    Sincronização
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Você pode sincronizar faixas (ex: 1–1.000, 1.001–2.000) ou a base inteira.
                  </p>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  Total no CSV: {parseResult.rows.length.toLocaleString('pt-BR')} linhas
                </Badge>
              </div>

              <RadioGroup
                value={batchSelection}
                onValueChange={(val) => setBatchSelection(val as AccessBatchSelection)}
                className="grid gap-2.5 sm:grid-cols-4 pt-1"
              >
                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === 'range'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('range')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="range" id="sync-opt-range" />
                    <Label
                      htmlFor="sync-opt-range"
                      className="text-xs font-bold cursor-pointer text-slate-900"
                    >
                      Por Faixa de Linhas
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Sessões controladas (ex: 1–1.000)
                  </p>
                  <Badge className="bg-emerald-600 text-white text-[10px] w-fit mt-2 ml-6">
                    Recomendado
                  </Badge>
                </div>

                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === '50'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('50')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="50" id="sync-opt-50" />
                    <Label
                      htmlFor="sync-opt-50"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Teste Rápido (50 linhas)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Conferência rápida do balanceamento
                  </p>
                </div>

                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === '200'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('200')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="200" id="sync-opt-200" />
                    <Label
                      htmlFor="sync-opt-200"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Intermediário (200 linhas)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Amostra intermediária de teste
                  </p>
                </div>

                <div
                  className={cn(
                    'flex flex-col justify-between p-3 rounded-lg border transition-all cursor-pointer',
                    batchSelection === 'full'
                      ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                  onClick={() => setBatchSelection('full')}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="sync-opt-full" />
                    <Label
                      htmlFor="sync-opt-full"
                      className="text-xs font-semibold cursor-pointer text-slate-900"
                    >
                      Arquivo Todo ({parseResult.rows.length.toLocaleString()})
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 pl-6">
                    Compara e sincroniza todas as linhas
                  </p>
                </div>
              </RadioGroup>

              {batchSelection === 'range' && (
                <div className="mt-3 p-3.5 bg-white rounded-lg border border-emerald-300/60 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-slate-800">
                        Intervalo de Linhas a Sincronizar
                      </Label>
                      <p className="text-[11px] text-slate-500">
                        Defina a faixa desejada para este ciclo de sincronização.
                      </p>
                    </div>

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
                      <Label
                        htmlFor="sync-range-start"
                        className="text-xs font-medium text-slate-700"
                      >
                        Linha Inicial:
                      </Label>
                      <Input
                        id="sync-range-start"
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
                      <Label
                        htmlFor="sync-range-end"
                        className="text-xs font-medium text-slate-700"
                      >
                        Linha Final:
                      </Label>
                      <Input
                        id="sync-range-end"
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
                </div>
              )}
            </div>

            {/* Prévia dos Dados */}
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

            {/* Barra de Progresso durante Análise de Balanceamento */}
            {isAnalyzingBalance && (
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    {balanceAnalysisProgress.message}
                  </span>
                  <span>{balanceAnalysisProgress.percent}%</span>
                </div>
                <Progress value={balanceAnalysisProgress.percent} className="h-2.5" />
              </div>
            )}

            {/* Ações Inferiores */}
            <div className="flex justify-between items-center pt-2 flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={() => setStep('upload')}
                disabled={isAnalyzingBalance}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Escolher Outro Arquivo
              </Button>
              <Button
                onClick={handleAnalyzeSyncBalance}
                disabled={isAnalyzingBalance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md font-bold px-6"
              >
                {isAnalyzingBalance ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando Base...
                  </>
                ) : (
                  <>
                    <Scale className="w-4 h-4" />
                    Gerar Relatório de Balanceamento (
                    {batchSelection === 'range'
                      ? `${rangeStart}–${rangeEnd}`
                      : batchSelection === '50'
                        ? '50 linhas'
                        : batchSelection === '200'
                          ? '200 linhas'
                          : 'Todas as linhas'}
                    )
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo NOVO: RELATÓRIO DE BALANCEAMENTO PRÉ-SINCRONIZAÇÃO */}
      {step === 'sync_balance' && syncBalance && parseResult && (
        <SyncBalanceReportView
          balance={syncBalance}
          fileName={fileName}
          totalRows={parseResult.rows.length}
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
          onConfirmSync={handleConfirmAndApplySync}
          onCancel={() => setStep('preview')}
        />
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
                {mode === 'complementary'
                  ? 'Processando Importação Complementar (TEL3 / Débito)...'
                  : mode === 'server_reload'
                    ? serverImportProgress?.phase === 'wiping'
                      ? 'Zerando Base de Dados e Preservando Administrador...'
                      : 'Processando Recarga Completa no Servidor...'
                    : mode === 'incremental_sync'
                      ? 'Aplicando Sincronização no Servidor (Alta Performance)...'
                      : mode === 'access_legacy'
                        ? 'Processando migração em lotes...'
                        : 'Processando importação...'}
              </p>
              <p className="text-xs text-muted-foreground max-w-md">
                {mode === 'complementary'
                  ? 'Casando tutores por NUME e preenchendo somente campos vazios de Telefone 3 e Débito no servidor, mantendo as edições de produção intactas.'
                  : mode === 'server_reload'
                    ? 'Execução 100% no servidor nativo (pb_hooks / SQLite): sem limites de requisição do navegador. Gravando tutores, pacientes com NUME, fichas e vacinas em transações atômicas.'
                    : mode === 'incremental_sync'
                      ? 'Processamento em tempo real direto no banco de dados (pb_hooks): sem requisições HTTP individuais e sem sofrer rate limit. Regra "vale o do arquivo" com auditoria campo a campo.'
                      : mode === 'access_legacy'
                        ? 'Desduplicando tutores, gerando chave composta dos animais e vinculando históricos clínicos e vacinas a cada paciente individual.'
                        : 'Gravando registros no banco de dados.'}
              </p>
            </div>

            <div className="w-full max-w-md space-y-2">
              <Progress
                value={
                  mode === 'complementary'
                    ? complementaryProgress?.percent || 0
                    : mode === 'server_reload'
                      ? serverImportProgress?.percent || 0
                      : mode === 'incremental_sync'
                        ? syncProgress?.percent || 0
                        : mode === 'access_legacy'
                          ? accessProgress?.percent || 0
                          : standardProgress
                }
                className="w-full h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {mode === 'complementary'
                    ? complementaryProgress?.statusMessage || 'Iniciando...'
                    : mode === 'server_reload'
                      ? serverImportProgress?.statusMessage || 'Iniciando...'
                      : mode === 'incremental_sync'
                        ? syncProgress?.statusMessage || 'Iniciando sincronização...'
                        : mode === 'access_legacy'
                          ? accessProgress?.statusMessage || 'Iniciando...'
                          : `${standardProgress}% concluído`}
                </span>
                <span className="font-semibold">
                  {mode === 'complementary'
                    ? `${complementaryProgress?.percent || 0}%`
                    : mode === 'server_reload'
                      ? `${serverImportProgress?.percent || 0}%`
                      : mode === 'incremental_sync'
                        ? `${syncProgress?.percent || 0}%`
                        : mode === 'access_legacy'
                          ? `${accessProgress?.percent || 0}%`
                          : `${standardProgress}%`}
                </span>
              </div>
            </div>

            {/* Contadores ao vivo do modo complementary */}
            {mode === 'complementary' && complementaryProgress && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xl mt-4 text-center">
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-indigo-700">
                    {complementaryProgress.counts.linesRead.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Linhas Lidas</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-emerald-700">
                    {complementaryProgress.counts.tutorsMatched.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Tutores Casados</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-blue-700">
                    {complementaryProgress.counts.fieldsFilled.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Campos Preenchidos</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-amber-700">
                    {complementaryProgress.counts.notMatched.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Não Casados</p>
                </div>
              </div>
            )}
            {/* Contadores ao vivo do modo server_reload */}
            {mode === 'server_reload' && serverImportProgress && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xl mt-4 text-center">
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-blue-700">
                    {serverImportProgress.counts.tutorsCreated.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Tutores Criados</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-emerald-700">
                    {serverImportProgress.counts.patientsCreated.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Pacientes (
                    {serverImportProgress.counts.patientsWithNume.toLocaleString('pt-BR')} com NUME)
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-amber-700">
                    {serverImportProgress.counts.clinicalCreated.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Prontuários / Fichas</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border text-xs">
                  <p className="font-bold text-purple-700">
                    {serverImportProgress.counts.vaccinesCreated.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[10px] text-slate-500">Vacinas</p>
                </div>
              </div>
            )}

            {/* Painel de Contadores de Sincronização */}
            {mode === 'incremental_sync' && syncProgress && (
              <div className="w-full max-w-xl space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border">
                    <p className="font-bold text-blue-700">
                      {syncProgress.tutorsUpdated} at. / {syncProgress.tutorsCreated} nov.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Tutores ({syncProgress.tutorsSkipped} pulados)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border">
                    <p className="font-bold text-emerald-700">
                      {syncProgress.patientsUpdated} at. / {syncProgress.patientsCreated} nov.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Pacientes ({syncProgress.patientsSkipped} pulados)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border">
                    <p className="font-bold text-purple-700">+{syncProgress.clinicalCreated}</p>
                    <p className="text-[10px] text-slate-500">
                      Fichas ({syncProgress.clinicalSkipped} puladas)
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border">
                    <p className="font-bold text-indigo-700">{syncProgress.auditsLogged}</p>
                    <p className="text-[10px] text-slate-500">Logs de Auditoria</p>
                  </div>
                </div>

                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePauseSync}
                    disabled={isSyncPaused}
                    className="gap-1.5 text-xs text-amber-700 hover:text-amber-800"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    {isSyncPaused ? 'Pausando após registro atual...' : 'Pausar Sincronização'}
                  </Button>
                </div>
              </div>
            )}

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
          {mode === 'complementary' && complementaryReport && (
            <ComplementaryImportReportView report={complementaryReport} onReset={reset} />
          )}

          {mode === 'server_reload' && serverImportReport && (
            <ServerImportReportView
              report={serverImportReport}
              fileName={fileName}
              onRestart={reset}
            />
          )}

          {mode === 'incremental_sync' && syncReport && (
            <SyncResultReportView
              report={syncReport}
              onRestart={() => setStep('preview')}
              onContinueNextRange={() => {
                if (batchSelection === 'range') {
                  const currentEnd = rangeEnd || 1000
                  const newStart = currentEnd + 1
                  const newEnd = Math.min(parseResult?.rows.length || 0, currentEnd + 1000)
                  setRangeStart(newStart)
                  setRangeEnd(newEnd)
                  setStep('preview')
                } else {
                  setStep('preview')
                }
              }}
              nextRangeSuggested={
                batchSelection === 'range' && (rangeEnd || 0) < (parseResult?.rows.length || 0)
                  ? {
                      start: (rangeEnd || 0) + 1,
                      end: Math.min(parseResult?.rows.length || 0, (rangeEnd || 0) + 1000),
                    }
                  : null
              }
            />
          )}

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
